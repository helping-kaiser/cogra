// THE READER'S HIDDEN SET, AS THE TAP LEFT IT (hidden-actors packet §5.1).
// web's twin is `web/src/lib/hidden/hidden-set.ts`.
//
// The feed filter is the reader's own and runs on the device (feed-ranking.md
// §9.1: hard exclusions are post-rank frontend filters), so the whole set is
// here: read whole at the feed's open and pull, and on the app's return to the
// foreground. The Settings row counts it and the Hidden accounts sheet lists
// it without a fetch of its own.
//
// HIDE AND UNHIDE ARE READ-SIDE COMFORTS (RowSigning.md): the set changes at
// the tap and the request goes out behind it, ONE IN FLIGHT PER ACTOR, THE
// LAST INTENT WINS — `SavedWrites`' queue, for the same reason.
//
// A FAILURE IS SAID ON THE ROW THE GESTURE WAS MADE FROM (design digest item
// 55): the set reverts to what the server last confirmed, and the failure is
// recorded against its ORIGIN, so that row, and only that row, carries the
// line until Retry or the next fresh read.
//
// The set belongs to one account: a sign-out or a change of account drops it
// whole (auth.md "Multi-account device custody").

package com.cogra.domain.hidden

import com.cogra.domain.Outcome
import com.cogra.domain.di.ApplicationScope
import com.cogra.domain.store.TokenStore
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HiddenSet @Inject constructor(
    private val repository: HiddenRepository,
    tokens: TokenStore,
    @ApplicationScope private val scope: CoroutineScope,
) {
    /** The clock a hide with no time of its own is stamped at; tests pin it. */
    internal var now: () -> Instant = Instant::now

    private sealed interface Intent {
        data class Hide(val at: Instant?) : Intent

        data object Unhide : Intent
    }

    private data class Ask(val intent: Intent, val kind: HiddenComfort, val origin: String, val entry: HiddenEntry)

    private class ActorState(var confirmed: HiddenEntry?, var shown: HiddenEntry?) {
        var inFlight = false
        var queued: Ask? = null
    }

    private val lock = Any()
    private var server = mapOf<String, HiddenEntry>()
    private val acts = mutableMapOf<String, ActorState>()
    private val failed = mutableMapOf<String, Pair<Ask, HiddenFailure>>()
    private var status = HiddenStatus.UNREAD
    private var reading: CompletableDeferred<Boolean>? = null
    private var generation = 0

    private val _view = MutableStateFlow(HiddenView())
    val view: StateFlow<HiddenView> = _view.asStateFlow()

    private val _reverts = MutableSharedFlow<String>(extraBufferCapacity = 16)

    /** The origin of a comfort that reverted — the host clears the snackbar that announced it. */
    val reverts: SharedFlow<String> = _reverts.asSharedFlow()

    init {
        scope.launch {
            tokens.tokens
                .map { it?.accountId }
                .distinctUntilChanged()
                .drop(1)
                .collect { reset() }
        }
    }

    /** Reads the set once; a set already read answers at once. */
    suspend fun ensure(): Boolean = if (synchronized(lock) { status } == HiddenStatus.READ) true else refetch()

    /**
     * Reads the set again — a feed open or pull, a return to the foreground.
     * A fresh read is a fresh load: its rows' lines go (RowSigning.md:17), and
     * the reader's own acts step aside for what it says, except where a write
     * is still on its way. Concurrent asks share one read.
     */
    suspend fun refetch(): Boolean {
        val (pending, mine, asked) = synchronized(lock) {
            val current = reading
            if (current != null) {
                Triple(current, false, generation)
            } else {
                val fresh = CompletableDeferred<Boolean>()
                reading = fresh
                status = status.takeIf { it == HiddenStatus.READ } ?: HiddenStatus.READING
                Triple(fresh, true, generation)
            }
        }
        if (!mine) return pending.await()
        publish()
        val read = repository.hiddenActors()
        val ok = synchronized(lock) {
            reading = null
            when {
                // An account change meanwhile: the answer was the last reader's.
                asked != generation -> false
                read is Outcome.Success -> {
                    server = read.value.associateBy { it.person.id }
                    status = HiddenStatus.READ
                    failed.clear()
                    acts.entries.removeAll { (_, act) -> !act.inFlight && act.queued == null }
                    true
                }
                else -> {
                    status = status.takeIf { it == HiddenStatus.READ } ?: HiddenStatus.FAILED
                    false
                }
            }
        }
        publish()
        pending.complete(ok)
        return ok
    }

    /**
     * Hide [person] from the row [origin] — now, or at [at] (an Undo of an
     * unhide puts the row back in its place with its age).
     */
    fun hide(person: HiddenPerson, origin: String, at: Instant? = null, kind: HiddenComfort = HiddenComfort.HIDE) {
        val entry = HiddenEntry(person, at ?: now())
        act(person.id, Ask(Intent.Hide(at), kind, origin, entry), entry)
    }

    /** Unhide [entry]'s person from the row [origin]. */
    fun unhide(entry: HiddenEntry, origin: String, kind: HiddenComfort = HiddenComfort.UNHIDE) {
        act(entry.person.id, Ask(Intent.Unhide, kind, origin, entry), null)
    }

    /** Asks the comfort that did not go through on [origin]'s row again; signs nothing. */
    fun retry(origin: String) {
        val ask = synchronized(lock) { failed[origin]?.first } ?: return
        when (ask.intent) {
            is Intent.Hide -> hide(ask.entry.person, origin, ask.intent.at, ask.kind)
            Intent.Unhide -> unhide(ask.entry, origin, ask.kind)
        }
    }

    /** Signing out or switching accounts: nothing of the last reader's survives. */
    fun reset() {
        synchronized(lock) {
            generation++
            server = emptyMap()
            acts.clear()
            failed.clear()
            reading = null
            status = HiddenStatus.UNREAD
        }
        publish()
    }

    private fun act(actor: String, ask: Ask, shown: HiddenEntry?) {
        val send = synchronized(lock) {
            // Another act on the same target clears its line (RowSigning.md:17).
            failed.remove(ask.origin)
            val state = acts.getOrPut(actor) { ActorState(confirmed = server[actor], shown = server[actor]) }
            state.shown = shown
            if (state.inFlight) {
                state.queued = ask
                null
            } else {
                state.inFlight = true
                state
            }
        }
        publish()
        if (send != null) dispatch(actor, send, ask)
    }

    private fun dispatch(actor: String, state: ActorState, ask: Ask) {
        val asked = synchronized(lock) { generation }
        scope.launch {
            // Null: the write did not go through. An answer carries what the
            // server now holds — the entry at its moment, or nobody.
            val answer: Answer? = when (val intent = ask.intent) {
                is Intent.Hide -> (repository.hideActor(actor, intent.at) as? Outcome.Success)
                    ?.let { Answer(ask.entry.copy(hiddenAt = it.value)) }
                Intent.Unhide -> (repository.unhideActor(actor) as? Outcome.Success)?.let { Answer(null) }
            }
            settle(actor, state, ask, answer, asked)
        }
    }

    private fun settle(actor: String, state: ActorState, ask: Ask, answer: Answer?, asked: Int) {
        var reverted = false
        val next = synchronized(lock) {
            if (asked != generation) return
            state.inFlight = false
            state.confirmed = when (answer) {
                null -> state.confirmed
                else -> answer.entry
            }
            val queued = state.queued
            state.queued = null
            when {
                queued != null -> {
                    state.inFlight = true
                    queued
                }
                answer != null -> {
                    state.shown = answer.entry
                    null
                }
                else -> {
                    state.shown = state.confirmed
                    failed[ask.origin] = ask to HiddenFailure(ask.kind, ask.entry)
                    reverted = true
                    null
                }
            }
        }
        publish()
        if (reverted) _reverts.tryEmit(ask.origin)
        if (next != null) dispatch(actor, state, next)
    }

    private fun publish() {
        _view.value = synchronized(lock) {
            val shown = server.toMutableMap()
            for ((actor, act) in acts) {
                val entry = act.shown
                if (entry == null) shown.remove(actor) else shown[actor] = entry
            }
            HiddenView(
                status = status,
                entries = shown.values.sortedWith(NEWEST_FIRST),
                failures = failed.mapValues { (_, value) -> value.second },
            )
        }
    }

    /** What a write that went through left on the server: the entry, or nobody. */
    private data class Answer(val entry: HiddenEntry?)

    private companion object {
        /** The server's own order: `hidden_at DESC, hidden_id DESC`. */
        val NEWEST_FIRST: Comparator<HiddenEntry> =
            compareByDescending<HiddenEntry> { it.hiddenAt }.thenByDescending { it.person.id }
    }
}
