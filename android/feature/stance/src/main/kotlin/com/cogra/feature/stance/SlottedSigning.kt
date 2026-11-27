// EVERY SIGNED STANCE GESTURE GOES THROUGH ITS KIND'S SLOT (`StanceAttempts`):
// a target's pick slot, its walk-back slot, or the kept picks' batch. web's
// twin is `slotted` / `stageAndSign` / `pressedAs` in
// `web/src/lib/stance/apollo-stance-data.ts` (#676, #681, #693, #700, #702).
//
// - A GESTURE WHOSE SIGNING HAS NOT ANSWERED DONE IS ASKED AGAIN, never staged
//   beside (SigningAfterClose.md:27 "AND NEVER anything else is signed"): the
//   same gesture re-signs the first attempt from where it stands; a changed one
//   finds it landing, or retires it before the new one is staged
//   (`SameSigning`).
// - A GESTURE WHILE ANOTHER IN THE SLOT IS STILL ASKING IS NOT A RETRY: it is an
//   act of its own, staged and signed as any is, and the first attempt's memory
//   and material are left alone.
// - THE GESTURE IS THE PRESSING ACCOUNT'S (auth.md "Multi-account device
//   custody"): it takes the account at the press, asks whether that account is
//   still the active one before every leg, and remembers, reads and settles only
//   that account's attempts. A change stops it there, with nothing settled under
//   the other account.
//
// It is the stance holders' collaborator, as `PostSealSigning` is the post
// seal's: the view models own the state, this owns the attempt and the order
// of the legs.

package com.cogra.feature.stance

import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.signing.AskedAgain
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.SameSigning
import com.cogra.domain.signing.SigningAttempt
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.StanceAttempt
import com.cogra.domain.stance.StanceAttempts
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceSlot
import com.cogra.domain.store.TokenStore

/** One gesture's batch as its prepare staged it, or why it did not. */
internal sealed interface Staging {
    data class Staged(val node: String, val writes: List<PreparedWriteView>, val expected: Expectation) : Staging

    /** A prepare was refused; its codes say whether the write rule said no. */
    data class Refused(val errors: List<UserError>) : Staging

    /** A read or a prepare did not answer. */
    data object Unreachable : Staging

    /** The pressing account is no longer the active one. */
    data object Stood : Staging
}

/** What a slotted gesture came to. */
internal sealed interface Slotted {
    /** A signing pass ran — fresh, or the first attempt asked again — and answered these. */
    data class Answered(val results: List<WriteResult>) : Slotted

    /** A prepare, or a Retry's state read, was refused. Nothing signed. */
    data class Refused(val errors: List<UserError>) : Slotted

    /** No answer reached the device before anything was signed. */
    data object Unreachable : Slotted

    /**
     * A changed gesture found the first attempt approved: it is what lands
     * ([first]), and nothing else is signed (SigningAfterClose.md:27).
     */
    data class Landing(val first: StanceAttempt) : Slotted

    /** The pressing account is not the active one (or there is none): nothing ran, nothing settles here. */
    data object Stood : Slotted

    /** No signing key on this device. */
    data object NoKey : Slotted
}

/** One press: the account it was pressed as, and whether that account is still the active one. */
internal class StancePress(val owner: String, val holds: suspend () -> Boolean)

internal class SlottedSigning(
    private val signer: WriteSigner,
    private val sameSigning: SameSigning,
    private val attempts: StanceAttempts,
    private val tokens: TokenStore,
) {
    /** The press, taken as the active account; null with no session — nothing is signed for nobody. */
    suspend fun press(): StancePress? {
        val owner = tokens.current()?.accountId ?: return null
        return StancePress(owner) { tokens.current()?.accountId == owner }
    }

    /**
     * Signs [slot]'s gesture [intent] for [press]: asks the slot's answered
     * attempt again, or stages anew with [stage]. [pick] is what a pick's
     * attempt signs, kept for a landing.
     */
    suspend fun sign(
        slot: StanceSlot,
        intent: String,
        press: StancePress,
        pick: StancePair? = null,
        stage: suspend () -> Staging,
    ): Slotted = try {
        slotted(slot, intent, press, pick, stage)
    } catch (_: NoActorKeyException) {
        Slotted.NoKey
    }

    private suspend fun slotted(
        slot: StanceSlot,
        intent: String,
        press: StancePress,
        pick: StancePair?,
        stage: suspend () -> Staging,
    ): Slotted {
        val mine = attempts.of(press.owner)
        if (mine.asking(slot)) return stageAndSign(slot, null, press, pick, stage)
        val remembered = mine.answered(slot)
        // Held from here, before anything suspends, so a gesture that arrives
        // meanwhile finds this one asking.
        mine.begin(slot)
        try {
            if (remembered != null) {
                // The first attempt is checked against what it was staged
                // against: a walk-back's gesture is the same whatever it nets.
                val asked = sameSigning.askAgain(remembered.attempt, intent, { remembered.expected }, press.holds)
                when (asked) {
                    AskedAgain.Foreign -> return Slotted.Stood
                    // The remembered expectation is always built; never reached.
                    AskedAgain.Unchecked -> return Slotted.Unreachable
                    // Nothing decided, nothing signed: the read's own fault
                    // stands, and the next Retry asks again.
                    is AskedAgain.Unread -> return when (val read = asked.outcome) {
                        is Outcome.Refused -> Slotted.Refused(read.errors)
                        else -> Slotted.Unreachable
                    }
                    AskedAgain.Landing -> {
                        mine.forget(slot)
                        return Slotted.Landing(remembered)
                    }
                    is AskedAgain.Signed -> {
                        if (WriteResult.allDone(asked.results)) mine.forget(slot)
                        return Slotted.Answered(asked.results)
                    }
                    // Retired: the slot stays held for the fresh prepare.
                    AskedAgain.Fresh -> {
                        mine.forget(slot)
                        mine.begin(slot)
                    }
                }
            }
            return stageAndSign(slot, intent, press, pick, stage)
        } finally {
            // Not done: the attempt, if one was staged, waits for a Retry. Runs
            // on cancellation too, so a holder that is cleared mid-signing
            // never leaves the slot asking for good.
            mine.settle(slot)
        }
    }

    /**
     * One gesture's batch, staged and signed. With an [intent] the gesture
     * holds the slot, and its batch is remembered before the first
     * pre-signature — so a Retry after any answer, or none, finds it — and
     * forgotten once it signs. Without one it is an act beside another still
     * asking, and touches no memory.
     */
    private suspend fun stageAndSign(
        slot: StanceSlot,
        intent: String?,
        press: StancePress,
        pick: StancePair?,
        stage: suspend () -> Staging,
    ): Slotted {
        if (!press.holds()) return Slotted.Stood
        val staged = when (val staging = stage()) {
            is Staging.Staged -> staging
            is Staging.Refused -> return Slotted.Refused(staging.errors)
            Staging.Unreachable -> return Slotted.Unreachable
            Staging.Stood -> return Slotted.Stood
        }
        val mine = attempts.of(press.owner)
        if (intent != null) {
            val attempt = SigningAttempt(press.owner, staged.node, staged.writes.map { it.id }, intent)
            mine.remember(slot, StanceAttempt(attempt, staged.expected, pick))
        }
        // Staged under the account that pressed, signed only under it.
        if (!press.holds()) return Slotted.Stood
        val results = signer.sign(staged.writes, staged.expected)
        if (intent != null && WriteResult.allDone(results)) mine.forget(slot)
        // Answered after a switch: nothing of it is settled under the other
        // account; an attempt not done waits for its own account's Retry.
        if (!press.holds()) return Slotted.Stood
        return Slotted.Answered(results)
    }
}
