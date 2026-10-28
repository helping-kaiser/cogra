package com.cogra.feature.content.reply

import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.domain.LicenseChoice
import com.cogra.domain.content.isCommentBodyTooLong
import com.cogra.domain.content.isSensitiveReasonTooLong
import com.cogra.domain.repo.ContentRepository
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.edit.EditActRow
import com.cogra.feature.content.edit.EditCrop
import com.cogra.feature.content.edit.EditGallery
import com.cogra.feature.content.edit.actCount
import com.cogra.feature.content.edit.editActRows
import com.cogra.feature.content.wizard.RefusedPick
import com.cogra.feature.content.wizard.SealFault

/**
 * `CommentEdit` / `CommentEditVideo` — the post's one-screen-one-batch at
 * comment scale.
 *
 * One screen, no stages: words, pictures or one clip, topics, citations, and
 * the license shown locked. The acts footer is the only thing that opens
 * anything, and what it opens is a sheet (`CommentEditActs`); the cover's
 * crop alone is raised over it, as a stage of the edit.
 */
data class CommentEditState(
    val commentId: String = "",
    /** The post the comment answers, for the caption line. */
    val parentTitle: String = "",

    val body: String = "",

    /**
     * The gallery the edit leaves standing — the comment's own pictures,
     * whole, never cropped, four at most, or its one clip — and the clip's
     * new face (EditGallery).
     */
    val gallery: EditGallery = EditGallery(),

    /** Files the add control turned away, standing under the pictures until dismissed. */
    val refused: List<RefusedPick> = emptyList(),

    /** The cover's crop, raised over the edit (CoverCrop.md: the comment's square). */
    val cropping: EditCrop.Cover? = null,

    /** What the read loaded — what a change is measured against. */
    val loadedBody: String = "",
    val tagSection: TagSectionState = TagSectionState(),
    val referenceSection: ReferenceSectionState = ReferenceSectionState(),

    /**
     * The author's own mark on the comment, as the edit will leave it.
     *
     * `PrepareCommentEditInput` is complete-state, so a mark the edit
     * does not re-state is a mark the edit removes: these are seeded
     * from the read and sent back whether or not the author touched
     * them. The board's Mark row is what lets them touch them
     * (design/backlog.md item 25 part 2) — the license is fixed by
     * contract at signing, while the mark is the author's ongoing
     * judgment about their own words.
     */
    val sensitive: Boolean = false,
    val sensitiveReason: String? = null,

    /** The mark as the read found it — what a change is measured against. */
    val loadedSensitive: Boolean = false,
    val loadedSensitiveReason: String? = null,

    /** The comment's license as it was signed — shown on the locked row. */
    val license: LicenseChoice = LicenseChoice.PublicDomain,

    /**
     * Whether the edit record is in the batch. STICKY: set by the first
     * change to a field the record carries — the words, the pictures, the
     * clip's face, the mark — and never cleared by typing it back. The guard
     * is the acts batch, never a byte comparison (EditComposeUnchanged.md:3).
     */
    val recordStaged: Boolean = false,

    /** The acts sheet (`CommentEditActs`), open. */
    val actsOpen: Boolean = false,

    /** `ComposeSensitive`, open over the edit. */
    val sensitiveOpen: Boolean = false,

    /** The leave the author has been asked to confirm (`DiscardConfirm`). */
    val confirmingDiscard: Boolean = false,
    val describingIndex: Int? = null,
    val help: HelpTopic? = null,

    val loading: Boolean = true,
    /**
     * Sign the edit was pressed while the edit's uploads ran: the press is
     * HELD and signs the moment the last lands; a failed upload drops it
     * (CommentEdit.md).
     */
    val heldPress: Boolean = false,
    val submitting: Boolean = false,
    /** The signing has gone 5s unanswered — the slow line stands under the count. */
    val slow: Boolean = false,
    /** The prepared batch was not the one the foot read — the held press dropped. */
    val countChanged: Boolean = false,
    /**
     * What became of a refused press (`SealFault`): the write rule's notice,
     * one citation that never landed, or the bug notice. Null at rest.
     */
    val fault: SealFault? = null,
    val keyAbsent: Boolean = false,
    val refusal: String? = null,
    val signingFailed: Boolean = false,
    val transportFailed: Boolean = false,
    val saved: Boolean = false,
) {
    val hasPictures: Boolean get() = !gallery.isEmpty && gallery.clip == null

    /** NEVER shut at the cap: a fifth picture is refused in words under the pictures. */
    val canAddPicture: Boolean get() = gallery.clip == null

    /** The comment body's own cap. */
    val bodyTooLong: Boolean get() = isCommentBodyTooLong(body)

    /** The sensitive mark's reason, capped the same way every authored field is. */
    val sensitiveReasonTooLong: Boolean
        get() = sensitive && isSensitiveReasonTooLong(sensitiveReason.orEmpty())

    /**
     * Whether leaving would lose something, and so has to ask first.
     *
     * An edit keeps no draft, but "something to lose" here means something
     * *changed*: it is the act count that answers, not the words alone — a
     * topic or a citation moved is its own act and would be lost with the
     * rest, and an edit that would sign nothing has nothing to lose.
     */
    val hasSomethingToLose: Boolean get() = signedActionCount > 0

    val anySheetOpen: Boolean get() = actsOpen || sensitiveOpen || describingIndex != null

    /**
     * Whether the edit record itself is staged — [recordStaged], the sticky
     * acts-batch reading, never a comparison of the fields against what the
     * read loaded. A topic or citation change beside it is its own act.
     */
    val contentChanged: Boolean get() = recordStaged

    /** The batch, every kind a row counted in the records it signs (`CommentEditActs`). */
    val actRows: List<EditActRow>
        get() = editActRows(
            recordStaged = recordStaged,
            recordName = body.trim().take(RECORD_NAME_CHARS).ifEmpty { "Your comment" },
            tags = tagSection,
            references = referenceSection,
        )

    /**
     * What the edit signs, in records: the Edit record once staged, one act
     * per tag change, and a citation's withdrawal at its served
     * counter-records (`withdrawalCost`), never one per gesture.
     */
    val signedActionCount: Int get() = actRows.actCount()

    /** The write rule's notice stands in the commit's place. */
    val writeRuleRefused: Boolean get() = fault == SealFault.WriteRule

    /**
     * The commit was pressed and has not answered — signing, or held at the
     * upload gate. The 200ms label swap and the 5s slow line count from it.
     */
    val pressed: Boolean get() = submitting || heldPress

    /**
     * Whether Sign the edit answers a press: an edit that changes nothing
     * signs nothing; ENABLED while an upload runs — a press there is held —
     * and disabled while the gate shows its fault reading (CommentEdit.md).
     */
    val canSign: Boolean
        get() = !pressed &&
            !loading &&
            !keyAbsent &&
            body.isNotBlank() &&
            !bodyTooLong &&
            !sensitiveReasonTooLong &&
            gallery.uploadsFailed == 0 &&
            signedActionCount > 0

    companion object {
        const val MAX_PICTURES = ContentRepository.MAX_COMMENT_ATTACHMENTS

        /** How much of the words the acts card's Edit row names. */
        const val RECORD_NAME_CHARS = 60
    }
}

/** Drops every drawer without leaving the screen. */
fun CommentEditState.closedSheets(): CommentEditState =
    copy(actsOpen = false, sensitiveOpen = false, describingIndex = null)
