// THE READER'S KEPT STATE, AS THE TAP LEFT IT (saved-surface packet, "The save
// action"; RowSigning.md: "save, unsave, hide, undo and unhide answer at the
// tap and revert on failure"). web's twin is `web/src/lib/saved/saved-writes.ts`.
//
// A save is a read-side comfort: the menu answers at the tap and the request
// goes out behind it. So the truth on screen is the last read with the
// reader's own acts laid over it, and that overlay is ONE store, or a post
// saved from the feed would still read `Save` on its detail and still stand in
// the Saved list it was just dropped from ("own mutations applied in place on
// return to Saved", design digest item 57).
//
// ONE WRITE IN FLIGHT PER NODE, AND THE LAST INTENT WINS. A save, an unsave
// and an Undo tapped in a row reach the server in that order, never racing,
// and a queued intent a newer one supersedes is never sent at all. A failure
// reverts to what the server last confirmed, which is exactly what is true,
// and records the comfort so the target's row can say so and Retry it.
//
// The overlay belongs to one account: a sign-out or a change of account drops
// it whole (auth.md "Multi-account device custody").

package com.cogra.domain.saved

import com.cogra.domain.Outcome
import com.cogra.domain.di.ApplicationScope
import com.cogra.domain.store.TokenStore
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

/** Which comfort did not go through — what its row line's Retry asks again. */
enum class ComfortKind { SAVE, UNSAVE, RESTORE }

/** What the reader asked for, last. */
sealed interface SaveIntent {
    data class Keep(val at: Instant?) : SaveIntent

    data object Drop : SaveIntent
}

/** What the screens read: the overlay and the comforts that did not go through. */
data class SavedOverlay(
    /** The reader's own acts: node → kept at, or null for dropped. */
    val shown: Map<String, Instant?> = emptyMap(),
    val failures: Map<String, ComfortKind> = emptyMap(),
) {
    /** What the screen shows for [node]: the reader's own acts over [server]. */
    fun kept(node: String, server: Instant?): Instant? = if (shown.containsKey(node)) shown[node] else server

    fun failure(node: String): ComfortKind? = failures[node]
}

@Singleton
class SavedWrites @Inject constructor(
    private val repository: SavedRepository,
    tokens: TokenStore,
    @ApplicationScope private val scope: CoroutineScope,
) {
    /** The clock an act with no time of its own is kept at; tests pin it. */
    internal var now: () -> Instant = Instant::now

    private class NodeState(var confirmed: Instant?, var shown: Instant?) {
        var inFlight = false
        var queued: Pair<SaveIntent, ComfortKind>? = null
    }

    private val lock = Any()
    private val nodes = mutableMapOf<String, NodeState>()
    private val failed = mutableMapOf<String, Pair<SaveIntent, ComfortKind>>()

    private val _overlay = MutableStateFlow(SavedOverlay())
    val overlay: StateFlow<SavedOverlay> = _overlay.asStateFlow()

    private val _reverts = MutableSharedFlow<Pair<String, ComfortKind>>(extraBufferCapacity = 16)

    /** A comfort that reverted — the host clears the snackbar that announced it (SG-9). */
    val reverts: SharedFlow<Pair<String, ComfortKind>> = _reverts.asSharedFlow()

    init {
        scope.launch {
            tokens.tokens
                .map { it?.accountId }
                .distinctUntilChanged()
                .drop(1)
                .collect { reset() }
        }
    }

    /** Keep [node] — now, or at [at] (an Undo restoring a removed row's place). */
    fun keep(node: String, server: Instant?, at: Instant? = null, kind: ComfortKind = ComfortKind.SAVE) {
        act(node, server, SaveIntent.Keep(at), at ?: now(), kind)
    }

    /** Drop [node] from Saved. */
    fun drop(node: String, server: Instant?) {
        act(node, server, SaveIntent.Drop, null, ComfortKind.UNSAVE)
    }

    /** Asks the comfort that did not go through on [node] again; signs nothing. */
    fun retry(node: String) {
        val (intent, kind) = synchronized(lock) { failed[node] } ?: return
        val confirmed = synchronized(lock) { nodes[node]?.confirmed }
        val shown = when (intent) {
            is SaveIntent.Keep -> intent.at ?: now()
            SaveIntent.Drop -> null
        }
        act(node, confirmed, intent, shown, kind)
    }

    /**
     * A fresh load of a surface: its rows' lines go (RowSigning.md:17) and the
     * overlay steps aside for what the read now says, except where a write is
     * still on its way.
     */
    fun settle() {
        synchronized(lock) {
            failed.clear()
            nodes.entries.removeAll { (_, state) -> !state.inFlight && state.queued == null }
        }
        publish()
    }

    /** Signing out or switching accounts: nothing of the last reader's survives. */
    fun reset() {
        synchronized(lock) {
            nodes.clear()
            failed.clear()
        }
        publish()
    }

    private fun act(node: String, server: Instant?, intent: SaveIntent, shown: Instant?, kind: ComfortKind) {
        val send = synchronized(lock) {
            // Another act on the same target clears its line (RowSigning.md:17).
            failed.remove(node)
            val state = nodes.getOrPut(node) { NodeState(confirmed = server, shown = server) }
            state.shown = shown
            if (state.inFlight) {
                state.queued = intent to kind
                null
            } else {
                state.inFlight = true
                state
            }
        }
        publish()
        if (send != null) dispatch(node, send, intent, kind)
    }

    private fun dispatch(node: String, state: NodeState, intent: SaveIntent, kind: ComfortKind) {
        scope.launch {
            val result: Outcome<Instant?> = when (intent) {
                is SaveIntent.Keep -> repository.setBookmark(node, intent.at).let { outcome ->
                    if (outcome is Outcome.Success) Outcome.Success<Instant?>(outcome.value) else outcome.failedAs()
                }

                SaveIntent.Drop -> repository.removeBookmark(node).let { outcome ->
                    if (outcome is Outcome.Success) Outcome.Success<Instant?>(null) else outcome.failedAs()
                }
            }
            settleWrite(node, state, intent, kind, result)
        }
    }

    private fun settleWrite(
        node: String,
        state: NodeState,
        intent: SaveIntent,
        kind: ComfortKind,
        result: Outcome<Instant?>,
    ) {
        var reverted = false
        val next = synchronized(lock) {
            state.inFlight = false
            val answered = result as? Outcome.Success
            state.confirmed = when (answered) {
                null -> state.confirmed
                else -> answered.value
            }
            val queued = state.queued
            state.queued = null
            when {
                // The newer intent is where the reader wants the node to end
                // up; it goes whatever became of this one.
                queued != null -> {
                    state.inFlight = true
                    queued
                }

                result is Outcome.Success -> {
                    state.shown = result.value
                    null
                }

                else -> {
                    state.shown = state.confirmed
                    failed[node] = intent to kind
                    reverted = true
                    null
                }
            }
        }
        publish()
        if (reverted) _reverts.tryEmit(node to kind)
        if (next != null) dispatch(node, state, next.first, next.second)
    }

    private fun publish() {
        _overlay.value = synchronized(lock) {
            SavedOverlay(
                shown = nodes.mapValues { (_, state) -> state.shown },
                failures = failed.mapValues { (_, value) -> value.second },
            )
        }
    }
}

private fun Outcome<*>.failedAs(): Outcome<Instant?> = when (this) {
    is Outcome.Refused -> this
    is Outcome.Failed -> this
    is Outcome.Success -> Outcome.Failed(IllegalStateException("unreachable"))
}
