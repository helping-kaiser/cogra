package com.cogra.feature.content.wizard

import com.cogra.domain.ErrorCode
import com.cogra.domain.UserError
import com.cogra.feature.content.ReferenceRow
import com.cogra.feature.content.referenceFieldIndex

/**
 * What became of a seal's press when it did not leave the seal — the failure
 * pack's reading of a refusal (copy-voice, *Faults by code*; SealFaultRow.md,
 * SealFaultBug.md; `_shared.jsx` `ComposeSealBody`'s `state`).
 *
 * THREE REFUSALS READ NOTHING ALIKE, so the seal tells them apart from the
 * contract's own codes and field paths rather than printing the first error's
 * sentence (the web's `lib/compose/seal-fault.ts`, one classifier for both
 * clients):
 * - the WRITE RULE (`WRITE_RULE_FAILED`): a rule working as meant, nothing
 *   failed and nothing was spent — the notice, never Retry;
 * - ONE STAGED CITATION whose target is gone (`NOT_FOUND` on
 *   `references.<index>.target`): a target that landed never stops answering,
 *   so this is a cited post or comment that never landed — said on its row;
 * - ANY OTHER refusal of a staged act: a bug the picking stage should have
 *   blocked — the notice in the bug's own words, and no row marked.
 * And [Offline]: no answer reached the seal at all.
 */
sealed interface SealFault {
    /** No answer reached the seal — the fault line and Retry take the commit's place. */
    data object Offline : SealFault

    /** The citation of [targetId] points at something that never landed. */
    data class Row(val targetId: String) : SealFault

    /** `This shouldn't have happened` — any other refusal of one staged act. */
    data object Bug : SealFault

    /** `You can't sign right now` — the write rule's refusal. */
    data object WriteRule : SealFault
}

/** Reads a refusal the way the seal draws it (see [SealFault]). */
fun sealFaultOf(errors: List<UserError>, references: List<ReferenceRow>): SealFault {
    if (errors.any { it.code == ErrorCode.WRITE_RULE_FAILED }) return SealFault.WriteRule
    for (error in errors) {
        val index = referenceFieldIndex(error.field) ?: continue
        val onTarget = error.field?.size == REFERENCE_TARGET_PATH && error.field?.last() == "target"
        val reference = references.getOrNull(index)
        if (error.code == ErrorCode.NOT_FOUND && onTarget && reference != null) {
            return SealFault.Row(reference.targetId)
        }
    }
    return SealFault.Bug
}

/** `["references", "<i>", "target"]`. */
private const val REFERENCE_TARGET_PATH = 3

// The failure pack's words (copy-voice, *Faults by code*; `_shared.jsx`).
internal const val SEAL_UNLANDED_POST = "This post didn't land, so it can't be cited."
internal const val SEAL_UNLANDED_COMMENT = "This comment didn't land, so it can't be cited."
internal const val SEAL_BUG_TITLE = "This shouldn't have happened"
internal const val SEAL_BUG_FACT =
    "That's a fault on our side, not yours. Nothing was signed or spent, and telling us helps us fix it."
internal const val WRITE_RULE_TITLE = "You can't sign right now"
internal const val WRITE_RULE_FACT =
    "Each signing is paid for, and there's only so much to go around at a time. " +
        "Nothing was signed or spent — your draft is kept."
internal const val SEAL_SLOW_LINE = "Still signing — the network is slow right now."
internal const val SEAL_OFFLINE_LINE = "That didn't send. Try again."
