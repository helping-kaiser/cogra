package com.cogra.feature.content.reply

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.DiscardConfirm
import com.cogra.core.designsystem.v2.atom.DiscardSubject
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.SummaryRow
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.compose.CommentEditThumbHeight
import com.cogra.core.designsystem.v2.compose.CommentPictureTray
import com.cogra.core.designsystem.v2.compose.DescribeCounter
import com.cogra.core.designsystem.v2.compose.DescribeSheet
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.feature.content.R
import com.cogra.feature.content.ReferenceCandidateRow
import com.cogra.feature.content.ReferenceEntry
import com.cogra.feature.content.TopicEntry
import com.cogra.feature.content.wizard.WizardBody
import com.cogra.feature.content.wizard.WizardFooter

/**
 * `CommentEdit`, wired.
 *
 * [parentTitle] is the caption's words and nothing else; everything the
 * edit signs is read from the comment itself.
 */
@Composable
fun CommentEditRoute(
    commentId: String,
    parentTitle: String,
    onSaved: () -> Unit,
    onLeave: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: CommentEditViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(commentId) { viewModel.start(commentId, parentTitle) }

    LaunchedEffect(state.saved) {
        if (state.saved) {
            viewModel.onSavedConsumed()
            onSaved()
        }
    }

    // Comments have no pick stage: "+ Add" opens the platform's own
    // picker (jakob 2026-08-31).
    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(CommentEditState.MAX_PICTURES),
    ) { uris -> uris.forEach { viewModel.onPicked(it.toString()) } }

    CommentEditScreen(
        state = state,
        onBodyChange = viewModel::onBodyChange,
        onOpenPicker = {
            picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        },
        onRemovePickAt = viewModel::onRemovePickAt,
        onDescribePictures = viewModel::onDescribeFirst,
        onAltTextChange = viewModel::onAltTextChange,
        onOpenActs = viewModel::onOpenActs,
        onCloseSheet = viewModel::onCloseSheet,
        onOpenHelp = viewModel::onOpenHelp,
        onCloseHelp = viewModel::onCloseHelp,
        onSign = viewModel::onSign,
        // The edit keeps no draft, so leaving discards — and an edit
        // that changed something is asked before it goes.
        onLeave = { if (viewModel.onLeaveRequested()) onLeave() },
        onKeepWriting = viewModel::onKeepWriting,
        onDiscard = onLeave,
        onTagInputChange = viewModel::onTagInputChange,
        onAddTag = viewModel::onAddTag,
        onRemoveTag = viewModel::onRemoveTag,
        onTuneTag = viewModel::onTuneTag,
        onDoneTuningTag = viewModel::onDoneTuningTag,
        onTagRelevanceChange = viewModel::onTagRelevanceChange,
        onTagConfidenceChange = viewModel::onTagConfidenceChange,
        onOpenFinder = viewModel::onOpenFinder,
        onCloseFinder = viewModel::onCloseFinder,
        onFinderQueryChange = viewModel::onFinderQueryChange,
        onPickReference = viewModel::onPickReference,
        onRemoveReference = viewModel::onRemoveReference,
        onTuneReference = viewModel::onTuneReference,
        onDoneTuningReference = viewModel::onDoneTuningReference,
        onReferenceRelevanceChange = viewModel::onReferenceRelevanceChange,
        onReferenceSupportChange = viewModel::onReferenceSupportChange,
        modifier = modifier,
    )
}

/**
 * `CommentEdit` — the whole comment on one screen, in one batch.
 *
 * The post's one-screen-one-batch scaled to a comment's anatomy: words,
 * pictures (uncropped, four max, described through the same counter line
 * the reply composer wears), topics, citations, **and the license shown
 * locked** — an edit can never change it.
 *
 * **No sensitive Mark row, and that is the board.** Unlike `ReplySeal`,
 * where the row is drawn and this lane deliberately does not build it,
 * `CommentEdit` has no such row to draw: `graph.json` gives it twelve
 * edges and none is a mark. What the screen does carry is the standing
 * mark itself, unseen, because the contract is complete-state — see
 * [CommentEditState.sensitive].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun CommentEditScreen(
    state: CommentEditState,
    onBodyChange: (String) -> Unit,
    onOpenPicker: () -> Unit,
    onRemovePickAt: (Int) -> Unit,
    onDescribePictures: () -> Unit,
    onAltTextChange: (String, String) -> Unit,
    onOpenActs: () -> Unit,
    onCloseSheet: () -> Unit,
    onOpenHelp: (HelpTopic) -> Unit,
    onCloseHelp: () -> Unit,
    onSign: () -> Unit,
    onLeave: () -> Unit,
    onKeepWriting: () -> Unit,
    onDiscard: () -> Unit,
    onTagInputChange: (String) -> Unit,
    onAddTag: () -> Unit,
    onRemoveTag: (String) -> Unit,
    onTuneTag: (String) -> Unit,
    onDoneTuningTag: () -> Unit,
    onTagRelevanceChange: (String, Double) -> Unit,
    onTagConfidenceChange: (String, Double) -> Unit,
    onOpenFinder: () -> Unit,
    onCloseFinder: () -> Unit,
    onFinderQueryChange: (String) -> Unit,
    onPickReference: (ReferenceCandidateRow) -> Unit,
    onRemoveReference: (String) -> Unit,
    onTuneReference: (String) -> Unit,
    onDoneTuningReference: () -> Unit,
    onReferenceRelevanceChange: (String, Double) -> Unit,
    onReferenceSupportChange: (String, Double) -> Unit,
    modifier: Modifier = Modifier,
) {
    BackHandler(onBack = onLeave)

    if (state.confirmingDiscard) {
        DiscardConfirm(
            subject = DiscardSubject.Edit,
            onKeepWriting = onKeepWriting,
            onDiscard = onDiscard,
            testTag = "comment_edit_discard_confirm",
        )
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .testTag("comment_edit"),
    ) {
        WizardHeader(
            title = "Edit comment",
            onBack = onLeave,
            onLeave = onLeave,
            // Leaving discards: comments keep no drafts (jakob
            // 2026-09-01), so the master's "your draft is kept" would be
            // a promise nothing here makes.
            leaveContentDescription = "Leave — the edit is discarded",
            onHelp = { onOpenHelp(HelpTopic.Editing) },
            helpContentDescription = HelpTopic.Editing.title,
            testTag = "comment_edit_header",
        )

        WizardBody(gap = Space.x3, top = Space.x3, bottom = Space.x2, scrollable = true) {
            Text(
                text = "Your comment on \"${state.parentTitle}\".",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag("comment_edit_caption"),
            )

            CograTextField(
                value = state.body,
                onValueChange = onBodyChange,
                label = "Words",
                singleLine = false,
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
                testTag = "comment_edit_body",
            )

            FieldGroup(label = "Pictures") {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Space.x2),
                ) {
                    if (state.hasPictures) {
                        CommentPictureTray(
                            pictures = state.pickedPictures(),
                            onRemove = onRemovePickAt,
                            thumbHeight = CommentEditThumbHeight,
                            testTag = "comment_edit_tray",
                        )
                    }
                    InlineAction(
                        // The same words the reply composer counts with
                        // (`CommentEdit` 6): one add label across the
                        // two comment surfaces, so a reader meets the
                        // same sentence wherever they meet it.
                        text = "+ Add pictures · ${state.picked.size} of ${CommentEditState.MAX_PICTURES}",
                        onClick = onOpenPicker,
                        enabled = state.canAddPicture,
                        testTag = "comment_edit_add",
                    )
                }
                if (state.hasPictures) {
                    DescribeCounter(
                        described = state.describedCount,
                        total = state.picked.size,
                        onDescribe = onDescribePictures,
                        testTag = "comment_edit_describe_counter",
                    )
                }
            }

            FieldGroup(label = "Topics") {
                TopicEntry(
                    section = state.tagSection,
                    testTagPrefix = "comment_edit",
                    onTagInputChange = onTagInputChange,
                    onAddTag = onAddTag,
                    onRemoveTag = onRemoveTag,
                    onTuneTag = onTuneTag,
                    onDoneTuningTag = onDoneTuningTag,
                    onTagRelevanceChange = onTagRelevanceChange,
                    onTagConfidenceChange = onTagConfidenceChange,
                    showHeading = false,
                )
            }

            FieldGroup(label = "References") {
                ReferenceEntry(
                    section = state.referenceSection,
                    testTagPrefix = "comment_edit",
                    onOpenFinder = onOpenFinder,
                    onCloseFinder = onCloseFinder,
                    onFinderQueryChange = onFinderQueryChange,
                    onPickReference = onPickReference,
                    onRemoveReference = onRemoveReference,
                    onTuneReference = onTuneReference,
                    onDoneTuningReference = onDoneTuningReference,
                    onReferenceRelevanceChange = onReferenceRelevanceChange,
                    onReferenceSupportChange = onReferenceSupportChange,
                    showHeading = false,
                )
            }

            LockedLicenseRow()

            state.problem()?.let { message ->
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("comment_edit_problem")
                        .semantics { liveRegion = LiveRegionMode.Assertive },
                )
            }
        }

        WizardFooter {
            ActsFooter(count = state.signedActionCount, onClick = onOpenActs)
            CograButton(
                text = "Sign the edit",
                onClick = onSign,
                enabled = state.canSign,
                modifier = Modifier.fillMaxWidth(),
                testTag = "comment_edit_sign",
            )
        }
    }

    if (state.anySheetOpen) {
        val sheetState = rememberModalBottomSheetState()
        ModalBottomSheet(onDismissRequest = onCloseSheet, sheetState = sheetState) {
            val describing = state.describingIndex?.let { state.picked.getOrNull(it) }
            when {
                describing != null -> DescribeSheet(
                    item = MediaItem(
                        describing.uri,
                        describing.sourceRatio ?: 1f,
                        describing.altText.ifBlank { null },
                    ),
                    value = describing.altText,
                    onValueChange = { onAltTextChange(describing.uri, it) },
                    onDone = onCloseSheet,
                    onHelp = { onOpenHelp(HelpTopic.DescribingPictures) },
                    testTag = "comment_edit_describe_sheet",
                )

                state.actsOpen -> CommentEditActsSheet(state = state, onDone = onCloseSheet)

                else -> Unit
            }
        }
    }

    state.help?.let { topic ->
        HelpDialog(
            title = topic.title,
            paragraphs = topic.paragraphs,
            onClose = onCloseHelp,
            testTag = "comment_edit_help_dialog",
        )
    }
}

/** One labelled group, as the board stacks them at 6dp. */
@Composable
private fun FieldGroup(label: String, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurface,
        )
        content()
    }
}

/**
 * The license, shown and locked.
 *
 * It is on the screen rather than off it because the reader is deciding
 * what the edit changes, and the terms not changing is part of that
 * answer — the lock says so without offering a control that would be
 * refused. `PrepareCommentEditInput` carries no license field at all.
 */
@Composable
private fun LockedLicenseRow() {
    Column(Modifier.fillMaxWidth()) {
        Hairline()
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = 44.dp)
                .testTag("comment_edit_license"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            Text(
                text = "License",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "Public domain",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Icon(
                imageVector = Icons.Filled.Lock,
                contentDescription = stringResource(R.string.content_license_locked),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp),
            )
        }
        Hairline()
    }
}

/**
 * The acts footer: what the edit signs, and the way into the sheet that
 * itemises it (`CommentEditActs`).
 */
@Composable
private fun ActsFooter(count: Int, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(role = Role.Button, onClick = onClick)
            .testTag("comment_edit_acts_footer"),
        horizontalArrangement = Arrangement.spacedBy(Space.x1, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = if (count == 1) "This creates 1 signed action" else "This creates $count signed actions",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Icon(
            imageVector = Icons.Filled.ExpandMore,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(16.dp),
        )
    }
}

/**
 * `CommentEditActs` — the footer's count, opened.
 *
 * The sheet title carries the count and the card carries the rows and
 * the all-or-nothing note: the `ActsCard` split of the comment-media
 * round, where a composer peeks at its acts in a sheet and ceremony
 * screens keep the inline card.
 */
@Composable
private fun CommentEditActsSheet(state: CommentEditState, onDone: () -> Unit) {
    val acts = state.signedActionCount
    CograSheetSurface(testTag = "comment_edit_acts_sheet") {
        SheetTitle(if (acts == 1) "1 signed action" else "$acts signed actions")
        Column(Modifier.fillMaxWidth()) {
            ActsRow(label = "Edit", value = state.body, count = "1 action")
            state.tagSection.adds.forEach { tag ->
                Hairline()
                ActsRow(label = "Topic added", value = "#${tag.name}", count = "1 action")
            }
            val citations = state.referenceSection.adds.size
            if (citations > 0) {
                Hairline()
                ActsRow(
                    label = "Citations added",
                    value = "$citations cited",
                    count = if (citations == 1) "1 action" else "$citations actions",
                )
            }
        }
        SummaryRow(
            headline = if (acts == 1) "1 signed action" else "$acts signed actions",
            detail = "They land together, or none does.".takeIf { acts > 1 },
            testTag = "comment_edit_acts_total",
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            CograButton("Done", onDone, kind = ButtonKind.Text, testTag = "comment_edit_acts_done")
        }
    }
}

@Composable
private fun ActsRow(label: String, value: String, count: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Space.x2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(96.dp),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = count,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** The one line the edit shows when a submit did not go through. */
internal fun CommentEditState.problem(): String? = when {
    refusal != null -> refusal
    transportFailed -> "That could not reach the server. Try again."
    signingFailed -> "That could not be signed. Try again."
    uploadsFailed -> "A picture did not upload. Remove it, or try again."
    keyAbsent -> "Your key isn't on this device, so nothing was signed."
    else -> null
}
