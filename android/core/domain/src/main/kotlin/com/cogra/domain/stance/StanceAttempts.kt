// THE SIGNING A STANCE GESTURE STARTED, kept until it answers done
// (SigningAfterClose.md:27: "WHEN tap Retry on a line of this pattern -> the
// same signing is asked again … AND NEVER anything else is signed";
// PadFailed.md:51, RowSigning.md:23: "the same pick is signed again";
// SeveranceConfirm.md:33-35; KeptPicksSeal.md:63). web's twin is
// `web/src/lib/stance/stance-attempts.ts`.
//
// A stance is a SUM of records (api-spec.md "The read-side bundle fold"), and
// the server stages every `prepareStance` as a record of its own. So a Retry
// that prepares afresh beside a first attempt the server already took — its
// answer lost on the way back — sums the pick twice and prices it twice. Each
// gesture's attempt is kept here under its [StanceSlot], and the next gesture
// in that slot asks it again ([com.cogra.domain.signing.SameSigning]).
//
// A walk-back keeps a slot of its OWN beside the target's pick slot, and the
// kept picks' seal one beside both: different gestures never retire or "land
// on" each other's attempt.
//
// Memory only, one store for the app — every destination showing a target
// shares it, as every surface of a web tab shares the seam — and kept beside
// the account that pressed (auth.md "Multi-account device custody"): another
// account never asks one, and its own finds it again when it is back. A
// process death forgets it; Home's Resume continues what was parked.

package com.cogra.domain.stance

import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.SigningAttempt
import com.cogra.domain.signing.intentOf
import javax.inject.Inject
import javax.inject.Singleton

/** What an attempt is kept under: a target's pick, its walk-back, or the kept picks' batch. */
sealed interface StanceSlot {
    data class Pick(val target: StanceTarget) : StanceSlot

    data class WalkBack(val target: StanceTarget) : StanceSlot

    /** The kept picks' seal: one batch across many targets (KeptPicksSeal.md:63). */
    data object KeptBatch : StanceSlot
}

/**
 * A slot's attempt: the batch staged, what it was checked against when it
 * was staged, and — for a pick — the pick it signs, which is what lands when
 * a changed pick finds it approved. The kept batch's attempt keeps the picks
 * it staged ([entries]) the same way, so a changed batch that finds it landing
 * lands exactly those.
 */
data class StanceAttempt(
    val attempt: SigningAttempt,
    val expected: Expectation,
    val pick: StancePair? = null,
    val entries: List<KeptPick>? = null,
)

/** The gesture a pick toward [target] was prepared from; a changed pick is another signing. */
fun stanceIntent(target: StanceTarget, pick: StancePair): String =
    intentOf("pick", target, pick.pDirected, pick.pInterest)

/** The walk-back toward [target]: one gesture whatever it nets, so its Retry is always the same. */
fun severanceIntent(target: StanceTarget): String = intentOf("sever", target)

/** The kept picks' batch: every pick, in order; a changed or dropped pick is another signing. */
fun keptBatchIntent(picks: List<Pair<StanceTarget, StancePair>>): String =
    intentOf("kept", picks.map { (target, pick) -> listOf(target, pick.pDirected, pick.pInterest) })

/**
 * One account's attempts.
 *
 * AN ATTEMPT IN FLIGHT IS NOT A FAILED ATTEMPT. Only one whose own signing
 * has returned not done is one a later gesture asks again ([answered]); while
 * a gesture in the slot is still asking ([asking]), another one there is an
 * act of its own — a control refuses a second act while it signs
 * (PadFailed.md:17), but that guard is per control, and this store is shared
 * by every control showing the target.
 */
class AccountStanceAttempts internal constructor() {
    private class Held(var attempt: StanceAttempt?, var asking: Boolean)

    private val held = mutableMapOf<StanceSlot, Held>()

    /** Whether a gesture in [slot] is signing or asking again right now. */
    @Synchronized
    fun asking(slot: StanceSlot): Boolean = held[slot]?.asking == true

    /** The attempt whose signing answered not done, for a Retry to ask again. */
    @Synchronized
    fun answered(slot: StanceSlot): StanceAttempt? = held[slot]?.takeIf { !it.asking }?.attempt

    /** Holds [slot] from the gesture's first step, before anything is staged. */
    @Synchronized
    fun begin(slot: StanceSlot) {
        val entry = held[slot]
        if (entry == null) {
            held[slot] = Held(null, asking = true)
        } else {
            entry.asking = true
        }
    }

    /** The asking gesture's batch, staged and about to be signed. Only a gesture holding the slot remembers. */
    @Synchronized
    fun remember(slot: StanceSlot, attempt: StanceAttempt) {
        held[slot]?.attempt = attempt
    }

    /** The asking gesture answered not done: its attempt, if any, waits for a Retry. */
    @Synchronized
    fun settle(slot: StanceSlot) {
        val entry = held[slot] ?: return
        if (entry.attempt == null) held.remove(slot) else entry.asking = false
    }

    @Synchronized
    fun forget(slot: StanceSlot) {
        held.remove(slot)
    }
}

/** Every account's attempts on this device, each account's apart. */
@Singleton
class StanceAttempts @Inject constructor() {
    private val accounts = mutableMapOf<String, AccountStanceAttempts>()

    /** The attempts of [owner] — the account a gesture was pressed as. */
    @Synchronized
    fun of(owner: String): AccountStanceAttempts = accounts.getOrPut(owner) { AccountStanceAttempts() }
}
