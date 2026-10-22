package com.cogra.feature.content.wizard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.compose.DescribeCounter
import com.cogra.core.designsystem.v2.compose.DescribeSubject
import com.cogra.core.designsystem.v2.compose.PickedRow
import com.cogra.core.designsystem.v2.compose.UploadErrorLine
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.MediaThumb
import com.cogra.core.designsystem.v2.media.REMOVE_VIDEO
import com.cogra.core.designsystem.v2.media.ThumbBadge
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.content.MAX_DESCRIPTION_CHARS
import com.cogra.domain.content.MAX_TITLE_CHARS
import com.cogra.feature.content.R

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
            DescriptionField(state.description, state.descriptionTooLong, onDescriptionChange)
        }

        topics()
        references()

        // The aside stands only while an upload runs (`ComposeUploading`);
        // the details stage at rest draws none.
        if (state.mode == BodyMode.Media && state.uploadsRunning) {
            Text(
                text = "Pictures upload while you write — signing waits for them.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = Space.x2)
                    .testTag("wizard_upload_footnote"),
            )
        }
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
    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
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
            testTag = "wizard_video_tile",
        )
        UploadFailures(state, onRetry, onRemove)
        DescribeCounter(
            described = state.describedCount,
            total = 1,
            onDescribe = onDescribe,
            subject = DescribeSubject.Video,
            testTag = "wizard_describe_counter",
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

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
private fun DescriptionField(value: String, tooLong: Boolean, onValueChange: (String) -> Unit) {
    CograTextField(
        value = value,
        onValueChange = onValueChange,
        label = "Description",
        optional = true,
        singleLine = false,
        minLines = 3,
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
 * The failure's words, one line per picture that did not upload.
 *
 * The tile itself wears the badge; this carries Retry and Remove it,
 * because retry does not fit in 48dp
 * (`design/components/compose/UploadNotice.jsx`). Tile and line always
 * appear together.
 */
@Composable
private fun UploadFailures(
    state: ComposeWizardState,
    onRetry: (String) -> Unit,
    onRemove: (Int) -> Unit,
) {
    state.picked.forEachIndexed { index, asset ->
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
