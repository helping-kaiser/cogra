package com.cogra.feature.content.reply

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.compose.CommentPictureTray
import com.cogra.core.designsystem.v2.compose.DescribeCounter
import com.cogra.core.designsystem.v2.compose.DescribeSubject
import com.cogra.core.designsystem.v2.compose.UploadErrorLine
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.media.CoverRow
import com.cogra.core.designsystem.v2.media.CoverRowDefaults
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.MediaThumb
import com.cogra.core.designsystem.v2.media.ThumbBadge
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.CoverChoice
import com.cogra.feature.content.wizard.inFlight
import com.cogra.feature.content.wizard.percentOrNull
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.RefusedPick
import com.cogra.feature.content.wizard.formatDuration
import com.cogra.feature.content.wizard.toPick

/**
 * `ReplyCompose`, `ReplyPictures`, `ReplyVideo` and `ReplyMediaErrors` —
 * the reply's words, and whatever has joined them.
 *
 * **One stage, four boards.** Each is the first with something more: the
 * target card, the words, the add affordance and the closing hint are
 * the same elements throughout, and the tray, the clip, or the refusal
 * list appear between them once there is anything to show. Every edge
 * out of the four boards is the same edge in `graph.json`.
 *
 * **Comments have no pick stage** (jakob 2026-08-31): the add
 * affordance opens the platform's own picker, never the post wizard's
 * grid. A clip is picked the same way and given its face *here* — the
 * comment composer is one screen, so the cover row is inlined rather
 * than reached through the post wizard's `ComposeCover` stage. There is
 * still no crop: a comment's media never crops.
 */
@Composable
internal fun ColumnScope.ReplyComposeStepBody(
    state: ReplyWizardState,
    onBodyChange: (String) -> Unit,
    onOpenPicker: () -> Unit,
    onRemovePickAt: (Int) -> Unit,
    onDescribePictures: () -> Unit,
    onPickCoverFrame: (Int) -> Unit,
    onPickCoverPicture: () -> Unit,
    onDismissRefusal: (Int) -> Unit,
    onRetryUpload: (String) -> Unit,
) {
    state.target?.let { TargetCard(it) }

    // Where the slack goes. The words fill the screen while they are the
    // only thing on it; once a clip or a refusal is below them the board
    // gives the words their natural height and puts a spacer under the
    // media instead — otherwise a 220dp frame, its cover row and the
    // pill would be pushed off a composer that does not scroll.
    val wordsFill = !state.isVideoComment && state.refused.isEmpty()
    CograTextField(
        value = state.body,
        onValueChange = onBodyChange,
        label = "Your reply",
        singleLine = false,
        fillHeight = wordsFill,
        modifier = Modifier
            .fillMaxWidth()
            .then(if (wordsFill) Modifier.weight(1f) else Modifier),
        testTag = "reply_body",
    )

    if (state.hasPictures) {
        CommentPictureTray(
            pictures = state.pickedPictures(),
            onRemove = onRemovePickAt,
            testTag = "reply_tray",
        )
        DescribeCounter(
            described = state.describedCount,
            total = state.picked.size,
            onDescribe = onDescribePictures,
            testTag = "reply_describe_counter",
        )
    }

    state.video?.let { clip ->
        ReplyClip(
            clip = clip,
            state = state,
            onRemove = { onRemovePickAt(0) },
            onRetry = { onRetryUpload(clip.uri) },
            onDescribe = onDescribePictures,
            onPickCoverFrame = onPickCoverFrame,
            onPickCoverPicture = onPickCoverPicture,
        )
    }

    RefusedFiles(refused = state.refused, onDismiss = onDismissRefusal)

    // The board writes the cap into the label the moment there is
    // anything to count — "+ Add pictures · 2 of 4" — so an author meets
    // the limit before they hit it rather than after. A clip carries no
    // add control at all: a comment is pictures or a video, and a button
    // that could only refuse is worse than no button.
    state.addLabel?.let { label ->
        InlineAction(
            text = label,
            onClick = onOpenPicker,
            enabled = state.canAddPicture,
            testTag = "reply_add_pictures",
        )
    }

    // The board's own `flex: 1` — the gap that pushes the hint and the
    // pill to the bottom once the words have stopped doing it.
    if (!wordsFill) Spacer(Modifier.weight(1f))

    // The footer goes with the upload it described: on a failed clip the
    // error line is the state, and a second sentence promising the
    // upload is happening would contradict it.
    if (state.video?.upload is AssetUpload.Failed) return

    Text(
        // The media half of the sentence only becomes true once
        // something is uploading, which is exactly when the later boards
        // say it.
        text = when {
            state.isVideoComment ->
                "Words first — a video can join them, and it uploads while you write."
            state.hasPictures ->
                "Words first — pictures can join them, and they upload while you write."
            else -> "Words first — pictures can join them."
        },
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.testTag("reply_hint"),
    )
}

/**
 * The composer's video state (`ReplyVideo`): the clip, its one
 * description, and its face.
 *
 * The frame is the comment pager's fixed square at comment scale, the
 * whole clip fitted inside it — a comment never turns into a post. The
 * cover row is `ComposeCover`'s, scaled down and inlined, because the
 * comment composer is one screen and there is no stage to pick a face
 * in.
 */
@Composable
private fun ReplyClip(
    clip: PickedAsset,
    state: ReplyWizardState,
    onRemove: () -> Unit,
    onRetry: () -> Unit,
    onDescribe: () -> Unit,
    onPickCoverFrame: (Int) -> Unit,
    onPickCoverPicture: () -> Unit,
) {
    // **A failed upload is not a refused file** (`ReplyVideoFailed`). A
    // refusal is an answer and retrying cannot change it; a fault means
    // the file was fine and the network wasn't, so it gets Retry the way
    // every other transport fault does. The tile then loses its × —
    // Remove it lives in the error line, and the two removals must never
    // sit two pixels apart meaning the same thing.
    val failure = (clip.upload as? AssetUpload.Failed)?.message
    MediaThumb(
        item = MediaItem(clip.uri, clip.sourceRatio ?: 1f, clip.altText.ifBlank { null }),
        width = if (failure != null) CLIP_FRAME_FAILED else CLIP_FRAME,
        height = if (failure != null) CLIP_FRAME_FAILED else CLIP_FRAME,
        // Fitted whole rather than cropped: a comment's media never
        // crops, and a clip is no exception.
        fit = ContentScale.Fit,
        badge = if (failure != null) ThumbBadge.Failed else ThumbBadge.Remove(onRemove),
        // The composer names the running time; the reading surfaces do
        // not — there, presence on screen is the whole policy. A failed
        // clip drops it too: the error line is the state now.
        duration = clip.durationMs
            ?.takeIf { failure == null }
            ?.let { formatDuration(it) },
        uploading = clip.upload.inFlight,
        // Re-encoding and sending both count up, so the ring keeps
        // moving across the whole journey rather than resetting between
        // its two halves — and a part being retried behind the scenes
        // reads as a pause rather than as a failure.
        progress = clip.upload.percentOrNull?.let { it / 100f },
        contentDescription = "The video on this reply",
        testTag = "reply_clip",
    )
    // The fault's words and both ways out, beside the row rather than
    // inside 200dp of preview — retry does not fit in a tile.
    failure?.let { message ->
        UploadErrorLine(
            message = message,
            onRetry = onRetry,
            onRemove = onRemove,
            testTag = "reply_clip_failed",
        )
    }
    // One description for the whole clip; its cover takes none of its
    // own, being the video's face rather than a second picture.
    // **It stays through a failure**: the frames were cut on the device,
    // so describing and choosing a face are not waiting on the bytes.
    DescribeCounter(
        described = state.describedCount,
        total = 1,
        onDescribe = onDescribe,
        subject = DescribeSubject.Video,
        testTag = "reply_describe_counter",
    )
    CoverRow(
        frames = state.coverFrames.map { it.picture.bytes },
        picked = state.coverChoice.toPick(),
        onPickFrame = onPickCoverFrame,
        onPickOwnPicture = onPickCoverPicture,
        ownPicture = (state.coverChoice as? CoverChoice.Picture)?.uri,
        tileSize = CoverRowDefaults.CommentTileSize,
        // No room for the caption at comment scale; the icon carries it.
        labelOwnPicture = false,
        testTagPrefix = "reply_cover",
    )
}

/**
 * The files the composer would not take (`ReplyMediaErrors`).
 *
 * Drawn where the file was offered — never in a dialog, never in a
 * snackbar: a snackbar confirms what happened, and an error sits on the
 * surface it happened on. There is no Retry, because asking again cannot
 * make a file smaller or a format readable.
 */
@Composable
private fun RefusedFiles(refused: List<RefusedPick>, onDismiss: (Int) -> Unit) {
    if (refused.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(Space.x3)) {
        refused.forEachIndexed { index, file ->
            Row(
                horizontalArrangement = Arrangement.spacedBy(Space.x2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MediaThumb(
                    item = MediaItem(file.uri, 1f),
                    badge = ThumbBadge.Failed,
                    contentDescription = "A refused file",
                    testTag = "reply_refused_thumb_$index",
                )
                UploadErrorLine(
                    message = file.message,
                    onRemove = { onDismiss(index) },
                    modifier = Modifier.weight(1f),
                    testTag = "reply_refused_$index",
                )
            }
        }
    }
}

/** The comment pager's square, at comment scale (`ReplyVideo`). */
private val CLIP_FRAME = 220.dp

/** `ReplyVideoFailed` draws the frame a little smaller. */
private val CLIP_FRAME_FAILED = 200.dp

/**
 * What the reply answers, pinned above the words.
 *
 * The same card on both entries: "Add a comment" pins the post, "Reply"
 * pins the comment (graph.json `ReplyEntry` 5 and 7). It is not a
 * control — nothing on the composer navigates away from what is being
 * answered — so it carries no click target.
 */
@Composable
private fun TargetCard(target: ReplyTarget) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 56.dp)
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .padding(horizontal = Space.x3, vertical = Space.x2)
            .testTag("reply_target"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        CograAvatar(
            name = target.authorHandle,
            size = Space.x8,
            url = target.avatarUrl,
            contentDescription = null,
        )
        Column(Modifier.weight(1f)) {
            Text(
                text = "${target.title} — @${target.authorHandle}",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = target.snippet,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
