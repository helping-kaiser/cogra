package com.cogra.feature.content.wizard

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.MediaThumb
import com.cogra.core.designsystem.v2.token.Space

/**
 * `ComposeDetails` — the optional title and description, the topics and
 * references sections, and (on the media path) the picked row.
 *
 * One thing here is an addition to the board rather than a match, and
 * it is named where it is built: the per-asset upload state. The
 * pictures' descriptions live on the crop stage, beside the picture
 * being described.
 */
@Composable
internal fun ColumnScope.DetailsStepBody(
    state: ComposeWizardState,
    onTitleChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onRetryUpload: (String) -> Unit,
    onEditBody: () -> Unit,
    onEditCrop: () -> Unit,
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
        if (state.mode == BodyMode.Media) {
            PickedRow(state, onEditBody, onEditCrop)
            UploadStatus(state, onRetryUpload)
        }

        CograTextField(
            value = state.title,
            onValueChange = onTitleChange,
            label = "Title",
            optional = true,
            testTag = "wizard_title",
        )
        CograTextField(
            value = state.description,
            onValueChange = onDescriptionChange,
            label = "Description",
            optional = true,
            singleLine = false,
            minLines = 3,
            testTag = "wizard_description",
        )

        topics()
        references()
    }
}

/** The board's own row: the picks, what they are, and the two ways back. */
@Composable
private fun PickedRow(
    state: ComposeWizardState,
    onEditBody: () -> Unit,
    onEditCrop: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        state.picked.take(MAX_ROW_THUMBS).forEachIndexed { index, asset ->
            MediaThumb(
                item = MediaItem(asset.uri, asset.sourceRatio ?: 1f, asset.altText.ifBlank { null }),
                contentDescription = "Picture ${index + 1}",
                testTag = "wizard_details_thumb_$index",
            )
        }
        Text(
            text = "${ComposeWizardState.pictureCount(state.picked.size)} — the body",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        InlineAction("Crop", onClick = onEditCrop, testTag = "wizard_details_crop")
        InlineAction("Edit", onClick = onEditBody, testTag = "wizard_details_edit")
    }
}

/**
 * Per-asset upload progress and retry.
 *
 * **An addition.** D5 makes each upload independently retryable and the
 * canonical boards draw no progress anywhere — so a failed picture
 * would otherwise be invisible until the seal refused to sign, with
 * nothing on screen saying which one or why. It sits here because this
 * is the stage the uploads run under, and it says nothing at all while
 * every upload is fine.
 */
@Composable
private fun UploadStatus(state: ComposeWizardState, onRetry: (String) -> Unit) {
    val failed = state.picked.withIndex().filter { it.value.upload is AssetUpload.Failed }
    val running = state.picked.count { it.upload is AssetUpload.Running }

    if (running > 0) {
        Text(
            text = if (running == 1) "Sending 1 picture…" else "Sending $running pictures…",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .testTag("wizard_upload_progress")
                // Announced rather than only drawn: the author may be
                // typing a description while these finish.
                .semantics { liveRegion = LiveRegionMode.Polite },
        )
    }

    failed.forEach { (index, asset) ->
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .testTag("wizard_upload_failed_$index"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            Text(
                text = "Picture ${index + 1}: ${(asset.upload as AssetUpload.Failed).message}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.weight(1f),
            )
            InlineAction(
                text = "Retry",
                onClick = { onRetry(asset.uri) },
                testTag = "wizard_upload_retry_$index",
            )
        }
    }
}

private const val MAX_ROW_THUMBS = 4
