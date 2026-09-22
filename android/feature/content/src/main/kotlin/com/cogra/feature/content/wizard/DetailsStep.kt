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
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.compose.DescribeCounter
import com.cogra.core.designsystem.v2.compose.DescribeSubject
import com.cogra.core.designsystem.v2.compose.PickedPicture
import com.cogra.core.designsystem.v2.compose.PickedRow
import com.cogra.core.designsystem.v2.compose.UploadErrorLine
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
        if (state.mode == BodyMode.Media) {
            PickedRow(
                // ONE ATTACHMENT IS ONE TILE (`ComposePickVideoCover.jsx:
                // 12-19`): a chosen cover rides the clip's own tile as its
                // inset corner mark rather than a second attachment.
                pictures = state.pickedRowPictures(),
                // THE BOARD NAMES THE CLIP, IT DOES NOT COUNT IT
                // (`ComposeDetailsVideo`). A gallery reads "3 pictures —
                // the body" because the count is the thing to know; a clip
                // is the whole body and there is only ever one of it, so
                // the label is the word "Video". Counting it as a picture
                // presented a video post as a picture post.
                caption = if (state.isVideoPost) {
                    "Video"
                } else {
                    "${ComposeWizardState.pictureCount(state.picked.size)} — the body"
                },
                // A CLIP HAS NO MANAGER (jakob's ruling 2026-09-15: "one
                // clip is not a set") — the row opens the Show all sheet
                // for a gallery only; the video tile wears its own × via
                // onRemove instead (`ComposeDetailsVideo.jsx` 23-32).
                onManage = if (state.isVideoPost) null else onManagePictures,
                onRemove = if (state.isVideoPost) {
                    { onRemovePick(0) }
                } else {
                    null
                },
                testTag = "wizard_picked_row",
            )
            UploadFailures(state, onRetryUpload, onRemovePick)
            DescribeCounter(
                described = state.describedCount,
                total = state.picked.size,
                onDescribe = onDescribePictures,
                // A clip takes one description for the whole thing
                // (CW-17, web's `details-step.tsx:235` conforms already).
                subject = if (state.isVideoPost) DescribeSubject.Video else DescribeSubject.Pictures,
                testTag = "wizard_describe_counter",
            )
        }

        // The vertical/no-cover default's door only. Once a face is
        // chosen the cover rides the clip's own tile above instead, never
        // a second field (`ComposeDetailsVideo.jsx:19-21`, design/readme.md
        // §13 "The cover's tile"). A gallery has no such field: its cover
        // is its order.
        if (state.isVideoPost && state.coverModel() == null) CoverField(onCover)

        TitleField(state.title, state.titleTooLong, onTitleChange)
        DescriptionField(state.description, state.descriptionTooLong, onDescriptionChange)

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
 * The vertical/no-cover default's door — the details board's Cover field
 * where no face has been chosen (`ComposeDetailsVideo.jsx` lines 19-21,
 * design/readme.md §13 "The cover's tile"). A clip that walked the cover
 * step and has a face shows no Cover section at all — the caller only
 * reaches here when [ComposeWizardState.coverModel] is null.
 */
@Composable
private fun CoverField(onCover: () -> Unit) {
    // The details board's own section rhythm, off the 4dp grid like the
    // column that holds it.
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = "Cover",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurface,
        )
        InlineAction(
            text = "Add a cover",
            onClick = onCover,
            testTag = "wizard_cover_door",
        )
        Text(
            text = "It plays the moment it is on screen, so it starts on its own first frame.",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * The picked row's pictures, plus a video's chosen cover riding the
 * clip's own tile as its inset corner mark (`state.coverModel()`) —
 * never a second attachment. Only a video post ever carries one.
 */
private fun ComposeWizardState.pickedRowPictures(): List<PickedPicture> {
    val pictures = pickedPictures()
    return if (isVideoPost) pictures.map { it.copy(coverSrc = coverModel()) } else pictures
}

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
            stringResource(R.string.content_error_title_too_long, MAX_TITLE_CHARS)
        } else {
            null
        },
        testTag = "wizard_title",
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
            stringResource(R.string.content_error_description_too_long, MAX_DESCRIPTION_CHARS)
        } else {
            null
        },
        testTag = "wizard_description",
    )
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
            message = failure.text(),
            onRetry = { onRetry(asset.uri) },
            onRemove = { onRemove(index) },
            testTag = "wizard_upload_failed_$index",
        )
    }
}
