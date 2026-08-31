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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.compose.DescribeCounter
import com.cogra.core.designsystem.v2.compose.PickedRow
import com.cogra.core.designsystem.v2.compose.UploadErrorLine
import com.cogra.core.designsystem.v2.token.Space

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
            PickedRow(
                pictures = state.pickedPictures(),
                caption = "${ComposeWizardState.pictureCount(state.picked.size)} — the body",
                onManage = onManagePictures,
                testTag = "wizard_picked_row",
            )
            UploadFailures(state, onRetryUpload, onRemovePick)
            DescribeCounter(
                described = state.describedCount,
                total = state.picked.size,
                onDescribe = onDescribePictures,
                testTag = "wizard_describe_counter",
            )
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

        if (state.mode == BodyMode.Media) {
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
            // The server's own words where it gave any, so a refusal that
            // names the file says so rather than reading as a generic fault.
            message = failure.message,
            onRetry = { onRetry(asset.uri) },
            onRemove = { onRemove(index) },
            testTag = "wizard_upload_failed_$index",
        )
    }
}
