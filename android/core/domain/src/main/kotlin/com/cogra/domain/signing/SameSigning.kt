// What a creation surface's Retry does with the signing it already started.
// web's twin is `web/src/lib/compose/same-signing.ts`.
//
// SealSigning.md:31: "WHEN press Retry -> the same signing is asked again";
// SigningAfterClose.md:27: "… AND NEVER anything else is signed". A fresh
// prepare is not the same signing: it stages a second act beside the first,
// whose stored material Home's Resume would still approve — two posts, two
// prices. So a surface remembers the attempt it prepared, and its Retry comes
// here first.
//
// THE RULE, by what the attempt's writes say now:
// - The reader changed nothing → the same batch is signed again from where it
//   stands ([WriteSigner.signAgain]): approved writes answer Done, parked ones
//   continue on their stored material. Only an attempt NO write of which can
//   still be, or become, approved is retired ([retirable]), and only then is a
//   fresh prepare allowed: one write without an answer, or one already done,
//   keeps the whole attempt, since a second act would sit beside it.
// - The reader changed what would be signed → an attempt this device already
//   approved is landing with its first content, and the surface finishes as if
//   it had answered; any other attempt is retired first, so it can never land
//   later, and then the new content is prepared.
//
// RETIRING IS FORGETTING THE DEVICE'S MATERIAL. A write lands only once its
// author's approval witness is relayed ("only an approved act is orderable",
// api-spec.md "The API prepares and relays; only the device signs"), and this
// device can sign one only over the nonces it stored at the pre-signature
// (WriteSigner: a pre-committed write without them is refused "handshake
// material lost"). With the material gone the write waits unapproved until it
// is collected.
//
// THE ATTEMPT IS ITS ACCOUNT'S (auth.md "Multi-account device custody"): every
// leg asks the caller whether the account that pressed is still the active
// one before it runs (the profile seal's `StillPressing`, #680), and an account
// that is no longer the pressing one stops the ask with nothing read, signed or
// retired — the attempt stands for its own account.

package com.cogra.domain.signing

import com.cogra.domain.Outcome
import com.cogra.domain.StagedWriteView
import com.cogra.domain.WriteState
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.store.IdentityStore

/** The signing a surface started: the batch it prepared, what it was prepared from, and for whom. */
data class SigningAttempt(
    /** The account that pressed; the attempt is never asked under another. */
    val owner: String,
    /** The node the batch mints. */
    val node: String,
    /** The batch's staged-write ids, in relay order. */
    val writes: List<String>,
    /** The gesture the batch was prepared from ([intentOf]); a changed one is a different signing. */
    val intent: String,
)

/**
 * The prepare's request, as the attempt's key: any part the reader changes
 * changes it. Every part a surface passes is a data class (or list) of plain
 * values, whose string form is the same in every process, so the key also
 * survives a kept draft. web's twin keys by `JSON.stringify` of the request.
 */
fun intentOf(vararg sent: Any?): String = sent.toList().toString()

/** What asking an attempt again came to. */
sealed interface AskedAgain {
    /** The same batch was signed again; the results read as a [WriteSigner.sign]'s. */
    data class Signed(val results: List<WriteResult>) : AskedAgain

    /** The reader changed the gesture, but the first attempt was approved: it is landing. */
    data object Landing : AskedAgain

    /** The attempt is retired; a fresh prepare may run. */
    data object Fresh : AskedAgain

    /** A state read did not answer: nothing decided, nothing signed. */
    data class Unread(val outcome: Outcome<StagedWriteView?>) : AskedAgain

    /** The expectation could not be built; the caller already said why. Nothing signed. */
    data object Unchecked : AskedAgain

    /** The pressing account is no longer the active one: nothing ran, the attempt stands. */
    data object Foreign : AskedAgain
}

/**
 * Asks attempts again — [WriteSigner.signAgain] for an unchanged gesture, the
 * staged writes' states for a changed one, and [IdentityStore.clearHandshake]
 * to retire. The legs are functions so the rule tests against scripted answers;
 * a surface builds it from the three it already holds.
 */
class SameSigning(
    private val signAgain: suspend (ids: List<String>, expected: Expectation) -> List<WriteResult>,
    private val read: suspend (id: String) -> Outcome<StagedWriteView?>,
    private val retire: suspend (id: String) -> Unit,
) {
    constructor(signer: WriteSigner, writes: WriteRepository, identity: IdentityStore) :
        this(signer::signAgain, writes::stagedWrite, identity::clearHandshake)

    /**
     * Asks [attempt] again for a press whose gesture is [intent]. [expected] is
     * the attempt's own expectation, rebuilt from the form for its node, and
     * built only when the gesture is unchanged; null means it could not be.
     * [stillPressing] is asked before every leg.
     */
    suspend fun askAgain(
        attempt: SigningAttempt,
        intent: String,
        expected: suspend () -> Expectation?,
        stillPressing: suspend () -> Boolean,
    ): AskedAgain {
        if (!stillPressing()) return AskedAgain.Foreign
        if (intent == attempt.intent) {
            val expectation = expected() ?: return AskedAgain.Unchecked
            if (!stillPressing()) return AskedAgain.Foreign
            val results = signAgain(attempt.writes, expectation)
            // Answered after a switch: nothing of it is the active account's
            // to settle or retire; the attempt is asked again under its own.
            if (!stillPressing()) return AskedAgain.Foreign
            // Anything undecided or approved keeps the attempt: the surface
            // shows its fault, and the next Retry asks this same signing again.
            return if (retirable(results)) retireAll(attempt, stillPressing) else AskedAgain.Signed(results)
        }
        for (id in attempt.writes) {
            if (!stillPressing()) return AskedAgain.Foreign
            val outcome = read(id)
            if (outcome !is Outcome.Success) return AskedAgain.Unread(outcome)
            val state = outcome.value?.state
            if (state == WriteState.RELAYING || state == WriteState.LANDED) return AskedAgain.Landing
        }
        return retireAll(attempt, stillPressing)
    }

    private suspend fun retireAll(attempt: SigningAttempt, stillPressing: suspend () -> Boolean): AskedAgain {
        if (!stillPressing()) return AskedAgain.Foreign
        // Custody is scoped by the active account, so the check above is what
        // makes this forget the pressing account's material and no other's.
        for (id in attempt.writes) retire(id)
        return AskedAgain.Fresh
    }
}

/**
 * What one write's result decides about whether it can still be approved.
 *
 * - Done — approved: RELAYING or LANDED. Not retirable; the attempt is landing.
 * - RejectedByDevice — ENDED: the device refused to sign it, material spent.
 * - Refused, every code terminal ([TERMINAL_REFUSALS]: expired, gone, refused
 *   for good) — ENDED: the signer spent the material.
 * - Refused with any kept code (a read-leg refusal, a code this build does not
 *   know, material lost awaiting re-stage) — UNDECIDED: the material is kept,
 *   and the write may still be approved.
 * - AwaitingSeal — NOT APPROVED, decided: the server answered SEALING, so no
 *   witness has gone out; it becomes unapprovable once its material is cleared.
 * - Failed — UNDECIDED: no answer reached the device, and the server may
 *   already be relaying an approval whose answer was lost.
 * - Carried — UNDECIDED: held for the landing, which signs it later.
 */
private enum class Decision { APPROVED, ENDED, NOT_APPROVED, UNDECIDED }

private fun decisionOf(result: WriteResult): Decision = when (result) {
    is WriteResult.Done -> Decision.APPROVED
    is WriteResult.RejectedByDevice -> Decision.ENDED
    is WriteResult.Refused ->
        if (result.errors.isNotEmpty() && result.errors.all { it.code in TERMINAL_REFUSALS }) {
            Decision.ENDED
        } else {
            Decision.UNDECIDED
        }
    is WriteResult.AwaitingSeal -> Decision.NOT_APPROVED
    is WriteResult.Failed, is WriteResult.Carried -> Decision.UNDECIDED
}

/**
 * A fresh prepare is allowed only when NO write of the attempt can still be, or
 * become, approved: every write ended, or was answered not approved — and at
 * least one ended, since an attempt that is merely waiting on its seal is one
 * to ask again, not to replace.
 */
internal fun retirable(results: List<WriteResult>): Boolean {
    val decisions = results.map(::decisionOf)
    return decisions.isNotEmpty() &&
        decisions.all { it == Decision.ENDED || it == Decision.NOT_APPROVED } &&
        decisions.any { it == Decision.ENDED }
}
