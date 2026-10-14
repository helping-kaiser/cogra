package com.cogra.feature.content.reply

import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.PickedPicture
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.domain.LicenseChoice
import com.cogra.domain.content.isCommentBodyTooLong
import com.cogra.domain.content.isSensitiveReasonTooLong
import com.cogra.domain.repo.ContentRepository
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.edit.EditActRow
import com.cogra.feature.content.edit.actCount
import com.cogra.feature.content.edit.editActRows
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.UploadFailure
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.inFlight
import com.cogra.feature.content.wizard.pickedPictures
import com.cogra.feature.content.wizard.withAltText
import com.cogra.feature.content.wizard.withSourceRatio
import com.cogra.feature.content.wizard.withUpload

/**
 * `CommentEdit` — the post's one-screen-one-batch at comment scale.
 *
 * One screen, no stages: words, pictures, topics, citations, and the
 * license shown locked. The acts footer is the only thing that opens
 * anything, and what it opens is a sheet (`CommentEditActs`).
 */
data class CommentEditState(
    val commentId: String = "",
    /** The post the comment answers, for the caption line. */
    val parentTitle: String = "",

    val body: String = "",
    val picked: List<PickedAsset> = emptyList(),

    /** What the read loaded — what a change is measured against. */
    val loadedBody: String = "",
    val loadedAttachmentIds: List<String> = emptyList(),
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
     * mark — and never cleared by typing it back. The guard is the acts
     * batch, never a byte comparison (EditComposeUnchanged.md:3).
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
    val submitting: Boolean = false,
    val keyAbsent: Boolean = false,
    val refusal: String? = null,
    val signingFailed: Boolean = false,
    val transportFailed: Boolean = false,
    val saved: Boolean = false,
) {
    val hasPictures: Boolean get() = picked.isNotEmpty()

    val uploadedIds: List<String> get() = picked.mapNotNull { it.mediaId }

    val uploadsDone: Int get() = uploadedIds.size

    val uploadsComplete: Boolean get() = uploadedIds.size == picked.size

    val uploadsFailed: Boolean get() = picked.any { it.upload is AssetUpload.Failed }

    val describedCount: Int get() = picked.count { it.altText.isNotBlank() }

    val canAddPicture: Boolean get() = picked.size < ReplyWizardState.MAX_PICTURES

    /** The comment body's own cap. */
    val bodyTooLong: Boolean get() = isCommentBodyTooLong(body)

    /** The sensitive mark's reason, capped the same way every authored field is. */
    val sensitiveReasonTooLong: Boolean
        get() = sensitive && isSensitiveReasonTooLong(sensitiveReason.orEmpty())

    /**
     * Whether leaving would lose something, and so has to ask first.
     *
     * An edit keeps no draft either, but "something to lose" here means
     * something *changed*: an edit opened and closed untouched has lost
     * nothing, and asking about it would be the noise the rule warns
     * against (design/readme.md §13).
     *
     * It is the act count that answers, not the words alone: a topic or
     * a citation moved is its own act and would be lost with the rest,
     * and an edit that would sign nothing has nothing to lose.
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

    /** An edit that changes nothing signs nothing. */
    val canSign: Boolean
        get() = !submitting &&
            !loading &&
            !keyAbsent &&
            body.isNotBlank() &&
            !bodyTooLong &&
            !sensitiveReasonTooLong &&
            uploadsComplete &&
            signedActionCount > 0

    companion object {
        const val MAX_PICTURES = ContentRepository.MAX_COMMENT_ATTACHMENTS

        /** How much of the words the acts card's Edit row names. */
        const val RECORD_NAME_CHARS = 60
    }
}

/** The picks as the components see them — whole frames, never cropped. */
fun CommentEditState.pickedPictures(): List<PickedPicture> = picked.pickedPictures()

// ---------------------------------------------------------------------
// Transitions.
// ---------------------------------------------------------------------

// A picture taken, removed or described is a change to the record's own
// payload, so each stages the record — and it stays staged (the guard is
// the acts batch, EditComposeUnchanged.md:3).

fun CommentEditState.addPick(uri: String, sourceRatio: Float? = null): CommentEditState {
    if (picked.any { it.uri == uri }) return this
    if (!canAddPicture) return this
    return copy(picked = picked + PickedAsset(uri, sourceRatio), recordStaged = true)
}

fun CommentEditState.removePick(uri: String): CommentEditState = copy(
    picked = picked.filterNot { it.uri == uri },
    describingIndex = null,
    recordStaged = true,
)

fun CommentEditState.withUpload(uri: String, upload: AssetUpload): CommentEditState =
    copy(picked = picked.withUpload(uri, upload))

fun CommentEditState.withSourceRatio(uri: String, ratio: Float): CommentEditState =
    copy(picked = picked.withSourceRatio(uri, ratio))

fun CommentEditState.withAltText(uri: String, text: String): CommentEditState =
    copy(picked = picked.withAltText(uri, text), recordStaged = true)

/** Drops every drawer without leaving the screen. */
fun CommentEditState.closedSheets(): CommentEditState =
    copy(actsOpen = false, sensitiveOpen = false, describingIndex = null)
