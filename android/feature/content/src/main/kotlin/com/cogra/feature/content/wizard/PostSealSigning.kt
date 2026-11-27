// The post seal's signing, press by press: a first press prepares and signs; a
// press after a signing that did not answer asks THAT signing again
// (SealSigning.md:31 "WHEN press Retry -> the same signing is asked again";
// SigningAfterClose.md:27 "AND NEVER anything else is signed"). A fresh prepare
// would stage a second post beside the first (`SameSigning`). web's twin is the
// press in `wizard-view.tsx` (#655).
//
// It is the wizard's collaborator, as `WizardUploader` and `SectionsEditor` are:
// the view model owns the state and the draft, this owns the attempt and the
// order of the legs.

package com.cogra.feature.content.wizard

import com.cogra.domain.Outcome
import com.cogra.domain.PreparedContentView
import com.cogra.domain.references.ReferenceClaim
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.signing.AskedAgain
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.SameSigning
import com.cogra.domain.signing.SentContent
import com.cogra.domain.signing.SigningAttempt
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.intentOf
import com.cogra.domain.topics.TagClaim

/** One press of the post seal's commit: who pressed, the seal as it stood, and what it orders. */
internal class PostPress(
    val owner: String,
    val seal: ComposeWizardState,
    /** The prepare's request as the attempt's key ([postIntent]). */
    val intent: String,
    val prepare: suspend () -> Outcome<PreparedContentView>,
    val expectedFor: suspend (node: String) -> Expectation?,
    /** Whether the account that pressed is still the active one. */
    val holds: suspend () -> Boolean,
)

/** What the signing hands back to the seal it belongs to. */
internal class SealMoves(
    /** The press stopped before it ran a leg: the seal stands as it was, nothing said. */
    val stand: () -> Unit,
    val fail: (SealFault) -> Unit,
    /** Writes the draft as it stands, with the attempt still pending. */
    val keepDraft: suspend () -> Unit,
    /** What a signing's answer makes of the seal (the view model's `settle`). */
    val settle: suspend (List<WriteResult>, ComposeWizardState, node: String, writes: List<String>) -> Unit,
    /** The post [node] opens as a success does. */
    val open: (node: String) -> Unit,
    /** No signing key on this device: the seal says so (`ComposeKeyAbsent`). */
    val keyAbsent: () -> Unit,
)

internal class PostSealSigning(
    private val signer: WriteSigner,
    private val sameSigning: SameSigning,
    private val moves: SealMoves,
) {
    /**
     * The signing this seal started and that did not answer — what its next
     * press asks again. It rides the kept draft, so a press after coming back
     * asks it too.
     */
    var attempt: SigningAttempt? = null

    suspend fun press(press: PostPress) {
        try {
            val remembered = attempt
            if (remembered == null || askedAgain(remembered, press)) signFresh(press)
        } catch (_: NoActorKeyException) {
            // `ComposeKeyAbsent`: the write waits on the reader restoring the
            // key, not on time passing. The draft is kept (with its attempt)
            // so restoring loses nothing.
            moves.keepDraft()
            moves.keyAbsent()
        }
    }

    /** Asks [remembered] again, and answers whether a fresh prepare may run: only once it is retired. */
    private suspend fun askedAgain(remembered: SigningAttempt, press: PostPress): Boolean {
        val asked = sameSigning.askAgain(remembered, press.intent, { press.expectedFor(remembered.node) }, press.holds)
        when (asked) {
            AskedAgain.Foreign -> moves.stand()
            AskedAgain.Unchecked -> Unit
            is AskedAgain.Unread -> moves.fail(unreadFault(asked.outcome, press.seal))
            // The FIRST content was approved and is landing, while the reader
            // has changed the post since. INTERIM, the web's (#655; no drawn
            // state covers this moment): the first post opens as a success
            // does, and the changed words stay the working draft with no
            // signing of their own — never sealed, never cleared, never signed
            // on top.
            AskedAgain.Landing -> {
                attempt = null
                moves.keepDraft()
                moves.open(remembered.node)
            }
            is AskedAgain.Signed -> moves.settle(asked.results, press.seal, remembered.node, remembered.writes)
            // Retired: nothing of it can land, and the fresh prepare may run.
            AskedAgain.Fresh -> attempt = null
        }
        return asked == AskedAgain.Fresh
    }

    /** Stages the batch anew and signs it; the attempt is kept with the draft before anything is signed. */
    private suspend fun signFresh(press: PostPress) {
        if (!press.holds()) return moves.stand()
        val current = press.seal
        val prepared = when (val outcome = press.prepare()) {
            is Outcome.Success -> outcome.value
            is Outcome.Refused -> return moves.fail(sealFaultOf(outcome.errors, current.referenceSection.references))
            is Outcome.Failed -> return moves.fail(SealFault.Offline)
        }
        val expected = press.expectedFor(prepared.node) ?: return
        val writes = prepared.writes.map { it.id }
        // The attempt rides the draft BEFORE anything is signed, so a press
        // after a process death in the middle of the signing still asks this
        // one again (web #655, awaited for the same reason).
        attempt = SigningAttempt(press.owner, prepared.node, writes, press.intent)
        moves.keepDraft()
        if (!press.holds()) return moves.stand()
        val results = signer.sign(prepared.writes, expected)
        // Answered after a switch: nothing is settled into the other
        // account's draft; the attempt waits in its own, asked at its next press.
        if (!press.holds()) return moves.stand()
        moves.settle(results, current, prepared.node, writes)
    }
}

/** The post's prepare: the request the seal sends, staged as one batch. */
internal suspend fun ContentRepository.preparePostFrom(
    current: ComposeWizardState,
    sent: SentContent,
    tags: List<TagClaim>,
    references: List<ReferenceClaim>,
): Outcome<PreparedContentView> = preparePost(
    title = sent.title,
    description = sent.description,
    content = sent.content,
    license = current.license,
    tags = tags,
    references = references,
    attachments = sent.attachments,
    sensitive = sent.sensitive,
    sensitiveReason = sent.sensitiveReason,
    pDirected = current.pDirected,
)

/** A Retry's state read that did not answer reads as the prepare's own did: by its codes, or no answer. */
private fun unreadFault(outcome: Outcome<*>, seal: ComposeWizardState): SealFault = when (outcome) {
    is Outcome.Refused -> sealFaultOf(outcome.errors, seal.referenceSection.references)
    else -> SealFault.Offline
}

/**
 * The post's prepare request as its attempt's key (`intentOf`): every field
 * `preparePost` is sent, and so everything the post's expectation is built
 * from but the server's own facts about those fields (the cited nodes' L1 ids,
 * the gallery's digests per media id).
 */
internal fun ComposeWizardState.postIntent(
    sent: SentContent,
    tags: List<TagClaim>,
    references: List<ReferenceClaim>,
): String = intentOf(sent, license, tags, references, pDirected)
