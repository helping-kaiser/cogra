// The edits' shared media furniture — the post edit's (EditCompose,
// EditComposeVideo, EditWords) and the comment edit's (CommentEdit,
// CommentEditVideo): the clip and its cover field, the upload gate over the
// foot, the files the add control turned away, the write rule's notice, and
// the crop stage an edit raises. Written once so the two edits draw one thing.

package com.cogra.feature.content.edit

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.InlineSize
import com.cogra.core.designsystem.v2.atom.NoticeLine
import com.cogra.core.designsystem.v2.atom.NoticePanel
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.compose.DescribeCounter
import com.cogra.core.designsystem.v2.compose.DescribeSubject
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.UploadErrorLine
import com.cogra.core.designsystem.v2.compose.UploadGateFailedLine
import com.cogra.core.designsystem.v2.compose.UploadMedia
import com.cogra.core.designsystem.v2.compose.UploadStatusLine
import com.cogra.core.designsystem.v2.compose.failedPicturesLine
import com.cogra.core.designsystem.v2.compose.removeFailedLabel
import com.cogra.core.designsystem.v2.media.CropAspect
import com.cogra.core.designsystem.v2.media.LockedCrop
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.MediaThumb
import com.cogra.core.designsystem.v2.media.REMOVE_VIDEO
import com.cogra.core.designsystem.v2.media.ThumbBadge
import com.cogra.core.designsystem.v2.media.rememberCropState
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.CropWindow
import com.cogra.feature.content.R
import com.cogra.feature.content.toItem
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.COMPOSE_CROP
import com.cogra.feature.content.wizard.CropFrames
import com.cogra.feature.content.wizard.RefusedPick
import com.cogra.feature.content.wizard.WRITE_RULE_TITLE
import com.cogra.feature.content.wizard.WizardBody
import com.cogra.feature.content.wizard.WizardFooter
import com.cogra.feature.content.wizard.formatDuration
import com.cogra.feature.content.wizard.pickedPictures
import com.cogra.feature.content.wizard.text
import com.cogra.feature.content.wizard.toFraming

/**
 * The write rule's fact at an edit: an edit keeps no draft, so the sentence
 * ends on what IS true here (copy-voice; blessed, jakob 2026-10-05 for the
 * comment edit and 2026-10-16 for the post edit).
 */
const val EDIT_WRITE_RULE_FACT =
    "Each signing is paid for, and there's only so much to go around at a time. " +
        "Nothing was signed or spent — your edit is still here."

/** The clip's quiet line where an add control would stand (copy-voice, *Staging a video*: the edit's trim). */
const val CLIP_WHOLE_POST_LINE = "A video is the whole post."

/** Under the cover field's door where a clip has no chosen face (copy-voice, the video-cover round). */
const val COVER_DOOR_NOTE = "It plays the moment it is on screen, so it starts on its own first frame."

/**
 * One labelled group, as the boards stack them at 6dp under a `FieldLabel`;
 * on a registered screen it wears [node] and its label `label`.
 */
@Composable
internal fun EditFieldGroup(label: String, node: DataNode? = null, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().dataNode(node),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.dataNode(node?.div("label")),
        )
        content()
    }
}

/**
 * The tile box a clip and its face are drawn at (round 22: "the clip tiles
 * keep their 114×64 and 54×96 boxes for every shape") — a clip wider than
 * tall in the wide box, any other in the tall one.
 */
private fun clipBox(ratio: Float): Pair<Dp, Dp> = if (ratio > 1f) 114.dp to 64.dp else 54.dp to 96.dp

/**
 * `EditComposeVideo`'s / `CommentEditVideo`'s `Video` field: the one clip,
 * which stays or leaves whole — its own × named `Remove this video` — its one
 * description through the counter, none for its cover. [note] is the post's
 * quiet `A video is the whole post.`; the comment's board draws none, its
 * labelled fields saying the shape of the body.
 */
@Composable
internal fun ClipField(
    clip: EditPicture.Kept,
    onRemove: () -> Unit,
    onDescribe: () -> Unit,
    testTagPrefix: String,
    note: String? = null,
    /** The comment's tile is the 56 square, its picture contained (`CommentEditVideo`). */
    squareTile: Dp? = null,
    /** The field's data-node on a registered screen (`postEdit.video`). */
    node: DataNode? = null,
) {
    EditFieldGroup(label = "Video", node = node) {
        val (width, height) = clipBox(clip.asset.aspectRatio)
        MediaThumb(
            item = clip.asset.toItem(),
            size = squareTile,
            width = width.takeIf { squareTile == null },
            height = height.takeIf { squareTile == null },
            video = true,
            duration = clip.asset.durationMs?.let { formatDuration(it) },
            onRemove = onRemove,
            removeLabel = REMOVE_VIDEO,
            removeTestTag = node?.div("thumb")?.div("remove")?.tag ?: "${testTagPrefix}_clip_remove",
            testTag = node?.div("thumb")?.tag ?: "${testTagPrefix}_clip",
        )
        DescribeCounter(
            described = if (clip.altText.isBlank()) 0 else 1,
            total = 1,
            onDescribe = onDescribe,
            subject = DescribeSubject.Video,
            testTag = "${testTagPrefix}_describe_clip",
            node = node?.div("describeRow"),
        )
        if (note != null) {
            QuietNote(text = note, modifier = Modifier.testTag(node?.div("rule")?.tag ?: "${testTagPrefix}_clip_note"))
        }
    }
}

/**
 * The clip's `Cover` field — one door in two states (copy-voice, *The cover's
 * own words*): `Add a cover` where no face was ever CHOSEN, a taken frame
 * included (EditComposeVideo.md), and the face with `Change the cover` where
 * one was. Both open the device's own picker — NEVER the clip's frames — and
 * the picture passes the cover's crop. A face the edit set wears its upload's
 * ring, or its mark with `One picture didn't upload.` under the row — the
 * cover being one picture — with `Retry` and `Remove it`.
 */
@Composable
internal fun CoverField(
    gallery: EditGallery,
    onPick: () -> Unit,
    onRetry: () -> Unit,
    onRemoveCover: () -> Unit,
    testTagPrefix: String,
    /** The post's door carries its quiet reason; the comment's draws none (CommentEditVideo.md). */
    doorNote: Boolean,
    squareTile: Dp? = null,
    /** The field's data-node on a registered screen (`postEdit.cover`). */
    node: DataNode? = null,
) {
    val clip = gallery.clip ?: return
    EditFieldGroup(label = "Cover", node = node) {
        if (gallery.coverChosen) {
            val face = gallery.newCover
            val (width, height) = clipBox(clip.asset.aspectRatio)
            val drawn = face?.let { asset ->
                listOf(asset).pickedPictures { gallery.crops[it.uri].toFraming() }.single()
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Space.x2),
            ) {
                MediaThumb(
                    item = drawn?.item ?: MediaItem(clip.asset.cover?.url, clip.asset.aspectRatio, null),
                    size = squareTile,
                    width = width.takeIf { squareTile == null },
                    height = height.takeIf { squareTile == null },
                    badge = ThumbBadge.Failed.takeIf { drawn?.failed == true },
                    uploading = drawn?.uploading ?: false,
                    progress = drawn?.progress,
                    testTag = node?.div("thumb")?.tag ?: "${testTagPrefix}_cover",
                )
                CograButton(
                    text = "Change the cover",
                    onClick = onPick,
                    kind = ButtonKind.Text,
                    size = ButtonSize.Compact,
                    testTag = node?.div("change")?.tag ?: "${testTagPrefix}_change_cover",
                )
            }
        } else {
            InlineAction(
                text = "Add a cover",
                onClick = onPick,
                size = InlineSize.Small,
                testTag = node?.div("add")?.tag ?: "${testTagPrefix}_add_cover",
            )
            if (doorNote) {
                QuietNote(
                    text = COVER_DOOR_NOTE,
                    modifier = Modifier.testTag(node?.div("note")?.tag ?: "${testTagPrefix}_cover_note"),
                )
            }
        }
        if (gallery.newCover?.upload is AssetUpload.Failed) {
            UploadErrorLine(
                message = failedPicturesLine(1),
                onRetry = onRetry,
                onRemove = onRemoveCover,
                testTag = "${testTagPrefix}_cover_error",
            )
        }
    }
}

/**
 * THE GATE (EditCompose.md, EditComposeVideo.md, CommentEdit.md): while the
 * bytes the edit took are going up, the seal's line stands over the foot —
 * `Uploading N of M — signing waits for the pictures.`, `…for the cover.`
 * where the edit set a clip's face — and Sign the edit stays enabled; once
 * one failed, the line takes its fault reading with `Retry`, Sign disabled.
 */
@Composable
internal fun EditUploadGate(
    gallery: EditGallery,
    onRetry: () -> Unit,
    testTag: String,
    node: DataNode? = null,
    /** The board draws the gate once per upload state, keyed by it (`EditCompose`'s `upload` chip). */
    keyByState: Boolean = false,
) {
    val media = if (gallery.clip != null) UploadMedia.Cover else UploadMedia.Pictures
    when {
        gallery.uploadsFailed > 0 -> UploadGateFailedLine(
            onRetry = onRetry,
            media = media,
            failed = gallery.uploadsFailed,
            modifier = Modifier.fillMaxWidth(),
            testTag = testTag,
            node = if (keyByState) node?.keyed("failed") else node,
        )
        gallery.uploadsPending > 0 -> UploadStatusLine(
            done = gallery.uploadsDone,
            total = gallery.uploads.size,
            media = media,
            modifier = Modifier.fillMaxWidth(),
            testTag = testTag,
            node = if (keyByState) node?.keyed("uploading") else node,
        )
        else -> Unit
    }
}

/**
 * The failure under a pictures row (`ComposeUploading`; EditCompose.md): the
 * failed tiles are marked, and one line under the row counts them — `One
 * picture didn't upload.`, from two up `3 pictures didn't upload.` — with
 * `Retry` and `Remove it` / `Remove them`.
 */
@Composable
internal fun EditUploadErrorLine(
    gallery: EditGallery,
    onRetry: () -> Unit,
    onRemove: () -> Unit,
    testTag: String,
    node: DataNode? = null,
) {
    val failed = gallery.pictures.count { it is EditPicture.Added && it.asset.upload is AssetUpload.Failed }
    if (failed == 0) return
    UploadErrorLine(
        message = failedPicturesLine(failed),
        onRetry = onRetry,
        onRemove = onRemove,
        removeLabel = removeFailedLabel(failed),
        testTag = testTag,
        node = node,
    )
}

/**
 * The files the add control turned away (`RefusedFile`): each a marked tile
 * beside its own words, on the media row where it was offered — NEVER a
 * dialog — and `Remove it` the one way out, since asking again cannot make a
 * file readable or the body roomier.
 */
@Composable
internal fun RefusedFileRows(refused: List<RefusedPick>, onDismiss: (Int) -> Unit, testTagPrefix: String) {
    if (refused.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        refused.forEachIndexed { index, file ->
            Row(
                modifier = Modifier.testTag("${testTagPrefix}_refused_row_$index"),
                horizontalArrangement = Arrangement.spacedBy(Space.x2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MediaThumb(
                    item = MediaItem(file.uri, 1f),
                    badge = ThumbBadge.Failed,
                    video = file.isVideo,
                    contentDescription = stringResource(R.string.content_refused_file),
                    testTag = "${testTagPrefix}_refused_thumb_$index",
                )
                UploadErrorLine(
                    message = file.reason.text(),
                    onRemove = { onDismiss(index) },
                    modifier = Modifier.weight(1f),
                    testTag = "${testTagPrefix}_refused_$index",
                )
            }
        }
    }
}

/**
 * The write rule's notice in the commit's place (copy-voice, *Faults by
 * code*): `You can't sign right now`, its fact ending on what is true of an
 * edit, its "?" — `Why signing waits`, the edit's clause — and `Not now` back
 * to the edit with the changes as they were. NEVER Retry, and never a kept
 * draft (EditCompose.md, CommentEdit.md).
 */
@Composable
internal fun EditWriteRuleNotice(onHelp: (HelpTopic) -> Unit, onNotNow: () -> Unit, testTagPrefix: String) {
    NoticePanel(
        title = WRITE_RULE_TITLE,
        helpLabel = HelpTopic.WhySigningWaitsAtEdit.title,
        onHelp = { onHelp(HelpTopic.WhySigningWaitsAtEdit) },
        helpTestTag = "${testTagPrefix}_write_rule_help",
        testTag = "${testTagPrefix}_write_rule",
    ) { NoticeLine(EDIT_WRITE_RULE_FACT) }
    CograButton(
        text = "Not now",
        onClick = onNotNow,
        kind = ButtonKind.Text,
        modifier = Modifier.fillMaxWidth(),
        testTag = "${testTagPrefix}_not_now",
    )
}

/** What the crop stage asks of its edit. */
internal data class EditCropActions(
    val onBack: () -> Unit,
    val onLeave: () -> Unit,
    val onNext: () -> Unit,
    val onFrameAsset: (Int) -> Unit = {},
    val onShapeChange: (DraftShape) -> Unit = {},
    val onCropsChanged: (Map<String, CropSpec>) -> Unit = {},
    val onCoverCropChanged: (CropSpec) -> Unit = {},
)

/**
 * The crop an edit raises — `ComposeCrop` locked to the post's one shape for
 * pictures on their way in, or `CoverCrop` locked to the clip's (the
 * comment's square) for its face. A stage of the edit, as the wizard's crop
 * is a stage of the wizard: its back arrow returns to the edit with the
 * picture unused, its X is the edit's own X (`Leave — the edit is
 * discarded`), asking first where the batch holds an act (CoverCrop.md).
 */
@Composable
internal fun EditCropStage(crop: EditCrop, actions: EditCropActions, testTagPrefix: String) {
    // The two crops are registered boards of their own: `ComposeCrop` for
    // pictures on their way in, `CoverCrop` for a clip's face.
    val node = if (crop is EditCrop.Cover) COVER_CROP else COMPOSE_CROP
    Column(
        modifier = Modifier
            .fillMaxSize()
            .testTag(if (crop is EditCrop.Cover) "${testTagPrefix}_cover_crop" else "${testTagPrefix}_crop"),
    ) {
        WizardHeader(
            title = if (crop is EditCrop.Cover) "The cover" else "Crop",
            onBack = actions.onBack,
            backContentDescription = "Back to the edit",
            onLeave = actions.onLeave,
            leaveContentDescription = EDIT_LEAVE_LABEL,
            testTag = "${testTagPrefix}_crop_header",
            node = node / "header",
        )
        when (crop) {
            is EditCrop.Pictures -> WizardBody(scrollable = true, bottom = 0.dp) {
                CropFrames(
                    picked = crop.picked,
                    crops = crop.crops,
                    shape = crop.shape,
                    framingIndex = crop.framingIndex,
                    onShapeChange = actions.onShapeChange,
                    onFrameAsset = actions.onFrameAsset,
                    onCropsChanged = actions.onCropsChanged,
                    locked = crop.locked,
                    testTagPrefix = testTagPrefix,
                    node = COMPOSE_CROP,
                )
            }
            // `CoverCrop`: the column stands `8px 24px` under the header, 12 apart.
            is EditCrop.Cover -> WizardBody(scrollable = true, gap = Space.x3, top = Space.x2, bottom = 0.dp) {
                CoverCropBody(crop, actions.onCoverCropChanged, testTagPrefix)
            }
        }
        WizardFooter {
            CograButton(
                text = "Next",
                onClick = actions.onNext,
                modifier = Modifier.fillMaxWidth(),
                testTag = (node / "next").tag,
            )
        }
    }
}

@Composable
private fun CoverCropBody(crop: EditCrop.Cover, onChanged: (CropSpec) -> Unit, testTagPrefix: String) {
    val state = rememberCropState(initial = crop.crop.toFraming())
    // Reported after every composition, as the post crop's framings are: a
    // process death between the last nudge and Next would otherwise upload a
    // framing the author never saw.
    val spec = state.framing.let { CropSpec(crop.ratio, CropWindow(it.left, it.top, it.right, it.bottom)) }
    SideEffect { onChanged(spec) }
    LockedCrop(
        item = MediaItem(crop.asset.uri, crop.asset.sourceRatio ?: 0f, null),
        window = CropAspect.of(crop.ratio),
        state = state,
        notes = listOf(CROP_HOW_TO_LINE, COVER_CROP_LINE),
        testTag = "${testTagPrefix}_cover_crop_view",
        node = COVER_CROP,
    )
}

/** `CoverCrop`'s registered prefix: the step every flow that crops a clip's cover shares. */
internal val COVER_CROP = DataNode("coverCrop")
