package com.cogra.feature.content.reply

import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.PickedPicture
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.domain.repo.ContentRepository
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagSectionState
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
     * The author's own mark on the comment being edited, **as it
     * stands**.
     *
     * `CommentEdit` draws no switch for it — 1:1 with the board, which
     * has no Mark row — but `PrepareCommentEditInput` is complete-state,
     * so a mark the edit does not re-state is a mark the edit removes.
     * These two fields are read when the edit opens and sent back
     * untouched, which is what stops an edit from silently unveiling a
     * comment its author marked (design/backlog.md item 25 part 2 is the
     * open design question about ever *changing* it).
     */
    val sensitive: Boolean = false,
    val sensitiveReason: String? = null,

    /** The acts sheet (`CommentEditActs`), open. */
    val actsOpen: Boolean = false,

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

    val anySheetOpen: Boolean get() = actsOpen || describingIndex != null

    /**
     * Whether the edit record itself is worth staging.
     *
     * An edit opened and left alone stages nothing: the words and the
     * gallery are the edit record's whole payload, so if neither moved
     * there is nothing for it to say, and a topic change beside it is
     * its own act anyway (F10).
     */
    val contentChanged: Boolean
        get() = body != loadedBody || uploadedIds != loadedAttachmentIds

    /**
     * What the edit signs: the Edit record when the body or the gallery
     * moved, plus one Tag act per topic change and one Reference act per
     * citation change — those ride their own mutations, which is why
     * they count beside the edit rather than inside it.
     */
    val signedActionCount: Int
        get() = (if (contentChanged) 1 else 0) +
            tagSection.adds.size + tagSection.removes.size +
            referenceSection.adds.size + referenceSection.removes.size

    /** An edit that changes nothing signs nothing. */
    val canSign: Boolean
        get() = !submitting &&
            !loading &&
            !keyAbsent &&
            body.isNotBlank() &&
            uploadsComplete &&
            signedActionCount > 0

    companion object {
        const val MAX_PICTURES = ContentRepository.MAX_COMMENT_ATTACHMENTS
    }
}

/** The picks as the components see them — whole frames, never cropped. */
fun CommentEditState.pickedPictures(): List<PickedPicture> = picked.pickedPictures()

// ---------------------------------------------------------------------
// Transitions.
// ---------------------------------------------------------------------

fun CommentEditState.addPick(uri: String, sourceRatio: Float? = null): CommentEditState {
    if (picked.any { it.uri == uri }) return this
    if (!canAddPicture) return this
    return copy(picked = picked + PickedAsset(uri, sourceRatio))
}

fun CommentEditState.removePick(uri: String): CommentEditState = copy(
    picked = picked.filterNot { it.uri == uri },
    describingIndex = null,
)

fun CommentEditState.withUpload(uri: String, upload: AssetUpload): CommentEditState =
    copy(picked = picked.withUpload(uri, upload))

fun CommentEditState.withSourceRatio(uri: String, ratio: Float): CommentEditState =
    copy(picked = picked.withSourceRatio(uri, ratio))

fun CommentEditState.withAltText(uri: String, text: String): CommentEditState =
    copy(picked = picked.withAltText(uri, text))

/** Drops every drawer without leaving the screen. */
fun CommentEditState.closedSheets(): CommentEditState =
    copy(actsOpen = false, describingIndex = null)
