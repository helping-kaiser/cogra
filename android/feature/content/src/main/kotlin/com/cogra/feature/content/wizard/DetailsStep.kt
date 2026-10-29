package com.cogra.feature.content.wizard

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.compose.DescribeCounter
import com.cogra.core.designsystem.v2.compose.DescribeSubject
import com.cogra.core.designsystem.v2.compose.PickedRow
import com.cogra.core.designsystem.v2.compose.UploadErrorLine
import com.cogra.core.designsystem.v2.compose.failedPicturesLine
import com.cogra.core.designsystem.v2.compose.removeFailedLabel
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.MediaThumb
import com.cogra.core.designsystem.v2.media.REMOVE_VIDEO
import com.cogra.core.designsystem.v2.media.ThumbBadge
import com.cogra.core.designsystem.v2.token.TypeTokens
import com.cogra.domain.content.MAX_DESCRIPTION_CHARS
import com.cogra.domain.content.MAX_TITLE_CHARS
import com.cogra.domain.datelineWords
import com.cogra.feature.content.R
import java.time.Instant

/**
 * `ComposeDetails` / `ComposeUploading` — the optional title and
 * description, the topics and references sections, and (on the media path)
 * the picked row with its description counter.
 *
 * **The row carries no "Crop" or "Edit" links** (jakob 2026-08-31: "none").
 * Tapping it opens the Show all sheet, which is the one per-picture
 * manager; the crop step is reached with Back, because the wizard is linear
 * and a second entrance to the same step is the two-menus pattern the
 * system refuses.
 */
@Composable
internal fun ColumnScope.DetailsStepBody(
    state: ComposeWizardState,
    onTitleChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onRetryUpload: (String) -> Unit,
    onRemovePick: (Int) -> Unit,
    onManagePictures: () -> Unit,
    onDescribePictures: () -> Unit,
    onCover: () -> Unit,
    /** The already-published marker's door: opens the post it names (ComposeDetailsReused.md). */
    onOpenPublished: (String) -> Unit,
    topics: @Composable () -> Unit,
    references: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .weight(1f)
            .verticalScroll(rememberScrollState()),
        // The details board's own rhythm, which sits off the 4dp grid.
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        val clip = state.video
        if (state.mode == BodyMode.Media && clip != null) {
            ClipBlock(state, clip, onRetryUpload, onRemovePick, onDescribePictures)
            PublishedLine(state.publishedMarker, onOpenPublished)
        } else if (state.mode == BodyMode.Media) {
            // A gallery: the row opens the Show all sheet (a clip has its own
            // block above — one clip is not a set).
            PickedRow(
                pictures = state.pickedPictures(),
                caption = "${ComposeWizardState.pictureCount(state.picked.size)} — the body",
                onManage = onManagePictures,
                testTag = "wizard_picked_row",
                node = COMPOSE_DETAILS / "mediaRow",
            )
            PublishedLine(state.publishedMarker, onOpenPublished)
            UploadFailures(state, onRetryUpload, onRemovePick)
            DescribeCounter(
                described = state.describedCount,
                total = state.picked.size,
                onDescribe = onDescribePictures,
                subject = DescribeSubject.Pictures,
                testTag = "wizard_describe_counter",
                // The row is a block across the stage (`DescribeCounter.jsx`).
                modifier = Modifier.fillMaxWidth(),
                node = COMPOSE_DETAILS / "describeRow",
            )
        }

        // The vertical/no-cover default's door only — a clip that SKIPPED
        // the cover step for its shape. A clip that came through the step
        // shows no door: its face is chosen, or declined, and the step is
        // one Back away (`ComposeDetailsVideo.jsx:19-21`). Once a face is
        // chosen through the door it rides the clip's own tile above
        // instead, never a second field (design/readme.md §13 "The cover's
        // tile"). A gallery has no such field: its cover is its order.
        if (state.skipsCoverStep && state.coverModel() == null) {
            CoverDoor(onOpen = onCover, testTag = "wizard_cover_door")
        }

        TitleField(state.title, state.titleTooLong, onTitleChange)
        // THE WORDS PATH COMPOSES NO DESCRIPTION (K8.1/D4;
        // ComposeDetailsWords.md:3, ComposeCited.md:15): a description is
        // how words stand beside pictures, and the server refuses one
        // beside words.
        if (state.mode == BodyMode.Media) {
            // ComposeDetailsVideo draws the clip's description two rows deep, the
            // gallery's three (ComposeDetailsBody).
            DescriptionField(
                value = state.description,
                tooLong = state.descriptionTooLong,
                onValueChange = onDescriptionChange,
                rows = if (clip != null) CLIP_DESCRIPTION_ROWS else GALLERY_DESCRIPTION_ROWS,
            )
        }

        topics()
        references()
    }
}

/**
 * `ComposeDetailsVideo`'s clip block: `FieldLabel` `Video`, the clip as one
 * 54×96 tile wearing its play disc and its own × (`Remove this video`) —
 * one clip is not a set, so no manager opens from it — and the describe row
 * reading the clip, 6 apart. A chosen cover rides the tile's corner, and a
 * failed upload says so under it (`That video didn't upload.`, Retry).
 */
@Composable
private fun ClipBlock(
    state: ComposeWizardState,
    clip: PickedAsset,
    onRetry: (String) -> Unit,
    onRemove: (Int) -> Unit,
    onDescribe: () -> Unit,
) {
    // The clip's block IS the media row on this path (web's twin registers it
    // `composeDetails.mediaRow`), its one tile the row's first thumb.
    Column(
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.fillMaxWidth().dataNode(COMPOSE_DETAILS / "mediaRow"),
    ) {
        Text(
            text = "Video",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.testTag("wizard_video_label"),
        )
        val failed = clip.upload is AssetUpload.Failed
        MediaThumb(
            item = MediaItem(clip.uri, clip.sourceRatio ?: 1f, clip.altText.ifBlank { null }),
            width = CLIP_TILE_WIDTH,
            height = CLIP_TILE_HEIGHT,
            video = true,
            badge = ThumbBadge.Failed.takeIf { failed },
            uploading = clip.upload.inFlight,
            progress = clip.upload.percentOrNull?.let { it / PERCENT },
            coverSrc = state.coverModel(),
            onRemove = { onRemove(0) },
            removeLabel = REMOVE_VIDEO,
            removeTestTag = "wizard_video_remove",
            contentDescription = stringResource(R.string.content_tray_video),
            testTag = CLIP_TILE_NODE.tag,
        )
        UploadFailures(state, onRetry, onRemove)
        DescribeCounter(
            described = state.describedCount,
            total = 1,
            onDescribe = onDescribe,
            subject = DescribeSubject.Video,
            testTag = "wizard_describe_counter",
            modifier = Modifier.fillMaxWidth(),
            node = COMPOSE_DETAILS / "describeRow",
        )
    }
}

/**
 * `ComposeUploading`'s aside: `Pictures upload while you write — signing
 * waits for them.`, label-small at the ground weight, centred, standing
 * directly above Next while an upload runs (the board's `flex: 1` pushes it
 * there).
 */
@Composable
internal fun UploadAside() {
    Text(
        text = "Pictures upload while you write — signing waits for them.",
        style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .testTag("wizard_upload_footnote"),
    )
}

/** The clip's tile, the media row's first thumb (`composeDetails.mediaRow.thumb`, keyed by place). */
internal val CLIP_TILE_NODE: DataNode get() = (COMPOSE_DETAILS / "mediaRow" / "thumb").keyed("1")

/** `ComposeDetailsVideo` draws the clip's description 2 rows deep; the gallery's `ComposeDetailsBody` 3. */
private const val CLIP_DESCRIPTION_ROWS = 2
private const val GALLERY_DESCRIPTION_ROWS = 3

/** `ComposeDetailsVideo.jsx`: the clip tile, `width={54} height={96}`. */
private val CLIP_TILE_WIDTH = 54.dp
private val CLIP_TILE_HEIGHT = 96.dp
private const val PERCENT = 100f

/**
 * The title and the one refusal it can earn — the field's own cap
 * (post.md §1). The atom carries its own error state and late counter now
 * (the caps-affordance round, closing design/backlog.md item 52's
 * web/Android divergence), so this no longer draws a house line beside it.
 */
@Composable
private fun TitleField(value: String, tooLong: Boolean, onValueChange: (String) -> Unit) {
    CograTextField(
        value = value,
        onValueChange = onValueChange,
        label = "Title",
        optional = true,
        cap = MAX_TITLE_CHARS,
        error = if (tooLong) {
            stringResource(R.string.content_error_title_too_long)
        } else {
            null
        },
        testTag = "wizard_title",
        node = COMPOSE_DETAILS / "title",
    )
}

/**
 * The description and the one refusal it can earn — the same atom-drawn
 * error state and counter the title wears.
 */
@Composable
private fun DescriptionField(value: String, tooLong: Boolean, onValueChange: (String) -> Unit, rows: Int) {
    CograTextField(
        value = value,
        onValueChange = onValueChange,
        label = "Description",
        optional = true,
        singleLine = false,
        minLines = rows,
        cap = MAX_DESCRIPTION_CHARS,
        error = if (tooLong) {
            stringResource(R.string.content_error_description_too_long)
        } else {
            null
        },
        testTag = "wizard_description",
        node = COMPOSE_DETAILS / "description",
    )
}

/**
 * The details stage's registered prefix (`ComposeDetails` in
 * `design/designs/canonical/nodes.json`): every element the board names
 * wears its `composeDetails.…` path.
 */
internal val COMPOSE_DETAILS = DataNode("composeDetails")

/**
 * The failure's words under the row.
 *
 * The tile itself wears the badge; this carries Retry and Remove it,
 * because retry does not fit in 48dp
 * (`design/components/compose/UploadNotice.jsx`). Tile and line always
 * appear together.
 *
 * ONE LINE COUNTS THE PICTURES A FAULT STOPPED (round 22, seam 245 ask 13 G;
 * ComposeUploading.md): `One picture didn't upload.`, from two up `2
 * pictures didn't upload.`, with `Retry` (each tries again) and `Remove it` /
 * `Remove them` (each leaves). A refusal no retry can change keeps its own
 * line and its own reason.
 */
@Composable
private fun UploadFailures(
    state: ComposeWizardState,
    onRetry: (String) -> Unit,
    onRemove: (Int) -> Unit,
) {
    val faults = state.picked.withIndex().filter { (_, asset) ->
        val failure = asset.upload as? AssetUpload.Failed
        failure != null && !asset.isVideo && failure.reason == UploadFailure.TRANSPORT && failure.retryable
    }
    if (faults.isNotEmpty()) {
        UploadErrorLine(
            message = failedPicturesLine(faults.size),
            onRetry = { faults.forEach { (_, asset) -> onRetry(asset.uri) } },
            // Highest first, so each index still names its picture.
            onRemove = { faults.map { it.index }.sortedDescending().forEach(onRemove) },
            removeLabel = removeFailedLabel(faults.size),
            testTag = "wizard_upload_failed",
        )
    }
    val counted = faults.map { it.index }.toSet()
    state.picked.forEachIndexed { index, asset ->
        if (index in counted) return@forEachIndexed
        val failure = asset.upload as? AssetUpload.Failed ?: return@forEachIndexed
        UploadErrorLine(
            // A FAULT reads the board's line (`ComposeUploading`: `One picture
            // didn't upload.`; copy-voice: `That video didn't upload.`) — Retry
            // stands beside it, so it never says "try again" twice. A
            // REFUSAL no retry can change keeps its own reason, the server's
            // words where it gave any.
            message = if (failure.reason == UploadFailure.TRANSPORT) {
                if (asset.isVideo) "That video didn't upload." else "One picture didn't upload."
            } else {
                failure.text()
            },
            // Not retryable once the server accepted the bytes and only
            // then refused them on inspection (a PROCESSING asset gone
            // FAILED): the same bytes would only earn the same answer, so
            // the way out is picking a different file, not this link.
            onRetry = { onRetry(asset.uri) }.takeIf { failure.retryable },
            onRemove = { onRemove(index) },
            testTag = "wizard_upload_failed_$index",
        )
    }
}

/** The marker's words, which are also the door's accessible name (copy-voice *The already-published marker*). */
internal fun publishedMarkerText(date: String): String = "Already in your post from $date."

/**
 * THE ALREADY-PUBLISHED MARKER (ComposeDetailsReused.md): one soft line under
 * the media row in the honesty-marker ink, in the tappable form `Edited`
 * wears — `label-small`, quiet, underlined, answering at 48 — named by its own
 * words, its date the matched post's dateline (`12 September`, the year only
 * when it is not this one). It opens the post it names; nothing asks, nothing
 * gates, and Next stays as live as at rest.
 */
@Composable
private fun PublishedLine(marker: PublishedMarker?, onOpen: (String) -> Unit, now: Instant = Instant.now()) {
    marker ?: return
    Text(
        text = publishedMarkerText(datelineWords(marker.publishedAt, now)),
        style = MaterialTheme.typography.labelSmall.copy(textDecoration = TextDecoration.Underline),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .dataNode(COMPOSE_DETAILS / "published")
            .hitTarget(
                interactive = Modifier.clickable(role = Role.Button) { onOpen(marker.postId) },
                drawnHeight = MARKER_LINE,
            ),
    )
}

/** `label-small`'s line, the marker's drawn height. */
private val MARKER_LINE = 16.dp
