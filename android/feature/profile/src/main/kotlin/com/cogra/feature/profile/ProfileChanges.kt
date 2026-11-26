// A PROFILE CHANGE THAT IS STILL SIGNING AFTER ITS SEAL WAS CLOSED, and what
// became of it — the one place the profile's own head reads it from. web's twin
// is `web/src/lib/profile/profile-change.ts`.
//
// "WHEN press Close, the header back arrow, the header X or the system's Back
// GIVEN Sign the change was pressed and has not answered -> the seal closes AND
// the change goes on AND NEVER the act is cancelled" (ProfileEditSeal.md:73).
// The seal's ViewModel dies with the edit's back-stack entry, so the signing
// cannot run in its scope: it runs HERE, on the application scope, and the seal
// and the profile are only two readers of it. While the seal is open it owns the
// answer — its own fault states, its own landing — and nothing stands under the
// head; once the seal has closed, the head carries the wait and the failure
// (ProfileEditSeal.md:75-79, Profile.md:99-101), and a change taken confirms on
// the profile's snackbar (ProfileEditSeal.md:45).
//
// ONE CHANGE AT A TIME: a profile is one record, and the seal's commit refuses a
// second press while one signs (ProfileEditSeal.md:33). A later signing takes
// the slot; an earlier one answering late says nothing.
//
// THE CHANGE IS THE CHANGING ACCOUNT'S (auth.md "Multi-account device
// custody"): the line is bound to the account active at the press and stands
// only under that account's head — hidden while another account is active,
// standing again under its own, until Retry or the next change (Profile.md:101).
// The act outlives the screen, so it also never prepares or signs for another
// account: it asks [StillPressing] before the prepare and before the signing;
// stopped there, it is the owner's failed line. A Retry pressed under another
// account does nothing.

package com.cogra.feature.profile

import com.cogra.domain.di.ApplicationScope
import com.cogra.domain.store.TokenStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/** What one signing of a profile change came to (the failure pack's readings). */
enum class ProfileChangeOutcome {
    /** Every write taken: the profile shows the change. */
    Taken,

    /** No answer reached the seal — the fault line and Retry. */
    Offline,

    /** `You can't sign right now` — the write rule's refusal. */
    WriteRule,

    /** `This shouldn't have happened` — any other refusal. */
    Bug,

    /** CoGra reserves the display name: the edit's own field line, back on the form. */
    NameReserved,

    /**
     * The active account is no longer the one that pressed: the act stopped
     * before it prepared or signed anything, and it ends silently — nothing
     * laid, nothing drawn under the other account's head (auth.md
     * "Multi-account device custody").
     */
    Foreign,
}

/**
 * What an act asks before it prepares and again before it signs: whether the
 * account that pressed is still the active one.
 */
fun interface StillPressing {
    suspend fun holds(): Boolean
}

/** What the profile's head reads under itself; null where nothing stands. */
sealed interface ProfileChangeLine {
    data object Signing : ProfileChangeLine

    /** `That didn't sign.` with `Retry`, which signs the change again. */
    data class Failed(val retry: () -> Unit) : ProfileChangeLine
}

@Singleton
class ProfileChanges @Inject constructor(
    private val tokens: TokenStore,
    @ApplicationScope private val scope: CoroutineScope,
) {
    private class Held(val owner: String?, val line: ProfileChangeLine)

    /** An act signs only for [owner], the account that pressed. */
    private inner class Owner(val owner: String?) : StillPressing {
        override suspend fun holds(): Boolean = owner != null && tokens.current()?.accountId == owner
    }

    private val lock = Any()
    private var signings = 0L
    private var closed = false
    private val held = MutableStateFlow<Held?>(null)
    private val _landed = MutableSharedFlow<Unit>(extraBufferCapacity = 1)

    /**
     * The line under the active account's head, or null. The line is BOUND to
     * the account that pressed, never dropped at a switch: hidden while another
     * account is active, it stands again under its own head, until Retry or the
     * next change (Profile.md:101; auth.md "Multi-account device custody").
     */
    val line: Flow<ProfileChangeLine?> =
        combine(held, tokens.tokens.map { it?.accountId }) { now, account ->
            now?.takeIf { it.owner == account }?.line
        }

    /** One event per change taken after its seal closed: the profile's cue for the snackbar. */
    val landed: SharedFlow<Unit> = _landed.asSharedFlow()

    /**
     * Runs one signing of a profile change on the application scope and answers
     * what it came to. The caller may stop waiting — its seal closed — and the
     * signing goes on: its answer is then the head's. [act] is handed the
     * pressing account's guard and asks it before it prepares and before it
     * signs.
     */
    suspend fun sign(act: suspend (StillPressing) -> ProfileChangeOutcome): ProfileChangeOutcome =
        start(fromHead = false, owner = tokens.current()?.accountId, act).await()

    private fun start(
        fromHead: Boolean,
        owner: String?,
        act: suspend (StillPressing) -> ProfileChangeOutcome,
    ): Deferred<ProfileChangeOutcome> {
        val mine = synchronized(lock) {
            // A Retry under the head has no seal to answer to.
            closed = fromHead
            held.value = Held(owner, ProfileChangeLine.Signing)
            ++signings
        }
        // UNDISPATCHED (kotlinx.coroutines `CoroutineStart`): the act starts at the
        // press itself, so its owner check sees the account that pressed with no
        // dispatch between; it continues on the application scope from its first
        // suspension and outlives the seal.
        return scope.async(start = CoroutineStart.UNDISPATCHED) {
            val outcome = act(Owner(owner))
            settle(mine, owner, outcome, act)
            outcome
        }
    }

    private suspend fun settle(
        mine: Long,
        owner: String?,
        outcome: ProfileChangeOutcome,
        act: suspend (StillPressing) -> ProfileChangeOutcome,
    ) {
        val stillOwners = owner != null && tokens.current()?.accountId == owner
        val land = synchronized(lock) {
            when {
                // A later change was pressed meanwhile: the slot is that change's.
                mine != signings -> false
                // Pressed with no account: there is no head for it to stand under.
                owner == null -> {
                    held.value = null
                    false
                }
                // The seal is still there: its own states say what happened.
                !closed -> {
                    held.value = null
                    false
                }
                // Taken: the line goes; the snackbar confirms only to the owner.
                outcome == ProfileChangeOutcome.Taken -> {
                    held.value = null
                    stillOwners
                }
                // Not taken — a fault, or an act the owner guard stopped at a switch
                // (it signed nothing): the owner's failed line, under the owner's
                // head only, never the other account's.
                else -> {
                    held.value = Held(owner, ProfileChangeLine.Failed { retry(owner, act) })
                    false
                }
            }
        }
        if (land) _landed.tryEmit(Unit)
    }

    /**
     * The head's Retry: the same change, for the same account. A Retry pressed
     * once another account is active — a composition can hold the lambda past
     * the switch — does nothing at all.
     */
    private fun retry(owner: String?, act: suspend (StillPressing) -> ProfileChangeOutcome) {
        scope.launch {
            if (Owner(owner).holds()) start(fromHead = true, owner, act).await()
        }
    }

    /** The seal closed while its change signs: the head takes the answer. */
    fun close() {
        synchronized(lock) {
            if (held.value?.line == ProfileChangeLine.Signing) closed = true
        }
    }
}
