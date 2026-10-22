package com.cogra.feature.content.reply

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.DiscardConfirm
import com.cogra.core.designsystem.v2.atom.DiscardSubject
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.SettingRow
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.compose.CommentEditThumbHeight
import com.cogra.core.designsystem.v2.compose.CommentPictureTray
import com.cogra.core.designsystem.v2.compose.DescribeCounter
import com.cogra.core.designsystem.v2.compose.DescribeSheet
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.licenseName
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.content.MAX_COMMENT_BODY_CHARS
import com.cogra.domain.media.MAX_ALT_TEXT_CHARS
import com.cogra.feature.content.R
import com.cogra.feature.content.wizard.describeTooLong
import com.cogra.feature.content.ReferenceCandidateRow
import com.cogra.feature.content.ReferenceEntry
import com.cogra.feature.content.TopicEntry
import com.cogra.feature.content.edit.ActsFooter
import com.cogra.feature.content.edit.ActsSheet
import com.cogra.feature.content.edit.LockedLicenseRow
import com.cogra.feature.content.edit.WithdrawnLine
import com.cogra.feature.content.edit.label
import com.cogra.feature.content.edit.rememberSlowAnswer
import com.cogra.feature.content.edit.signLabel
import com.cogra.feature.content.edit.withdrawn
import com.cogra.feature.content.wizard.SensitiveSheet
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
        onOpenSensitive = viewModel::onOpenSensitive,
        onSensitiveChange = viewModel::onSensitiveChange,
        onSensitiveReasonChange = viewModel::onSensitiveReasonChange,
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
        onUndoTagWithdrawal = viewModel::onUndoTagWithdrawal,
        onUndoReferenceWithdrawal = viewModel::onUndoReferenceWithdrawal,
        modifier = modifier,
    )
}

/**
 * `CommentEdit` — the whole comment on one screen, in one batch.
 *
 * The post's one-screen-one-batch scaled to a comment's anatomy: words,
 * pictures (uncropped, four max, described through the same counter line
 * the reply composer wears), topics, citations, **and the license shown
 * locked** — an edit can never change it — and the Sensitive row beside
 * it, which is not locked.
 *
 * The edit contract is complete-state, so every field the row leaves
 * standing rides the edit whether or not the author touched it: an edit
 * that omitted the mark would unmark ([CommentEditState.sensitive]).
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
    onOpenSensitive: () -> Unit,
    onSensitiveChange: (Boolean) -> Unit,
    onSensitiveReasonChange: (String) -> Unit,
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
    onUndoTagWithdrawal: (String) -> Unit = {},
    onUndoReferenceWithdrawal: (String) -> Unit = {},
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
                cap = MAX_COMMENT_BODY_CHARS,
                error = if (state.bodyTooLong) {
                    stringResource(R.string.content_error_comment_body_too_long, MAX_COMMENT_BODY_CHARS)
                } else {
                    null
                },
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
                state.tagSection.withdrawn().forEach { name ->
                    WithdrawnLine(
                        name = "#$name",
                        onUndo = { onUndoTagWithdrawal(name) },
                        testTag = "comment_edit_withdrawn_tag_$name",
                    )
                }
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
                state.referenceSection.withdrawn().forEach { row ->
                    WithdrawnLine(
                        name = row.label(),
                        onUndo = { onUndoReferenceWithdrawal(row.targetId) },
                        testTag = "comment_edit_withdrawn_reference_${row.targetId}",
                    )
                }
            }

            LockedLicenseRow(
                name = licenseName(state.license.attribution, state.license.provenance),
                testTag = "comment_edit_license",
            )
            // The license keeps its lock; this row does not. The
            // license is fixed by contract the moment it is signed,
            // while the mark is the author's ongoing judgment about
            // their own words (design/backlog.md item 25 part 2).
            SettingRow(
                label = "Sensitive",
                value = if (state.sensitive) "Marked" else "Not marked",
                actionText = if (state.sensitive) "Change" else "Mark",
                onAction = onOpenSensitive,
                testTag = "comment_edit_sensitive",
            )
            Hairline()

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
            ActsFooter(
                count = state.signedActionCount,
                onOpen = onOpenActs,
                testTag = "comment_edit_acts_footer",
            )
            // Inert, never hidden, at an empty batch; a press while the
            // signing is out is refused without the button dimming, and past
            // 200ms it reads `Signing the edit…` in its own place.
            val slow = rememberSlowAnswer(state.submitting)
            CograButton(
                text = signLabel(slow),
                onClick = { if (!state.submitting) onSign() },
                enabled = state.canSign || state.submitting,
                modifier = Modifier.fillMaxWidth(),
                testTag = "comment_edit_sign",
            )
        }
    }

    CommentEditSheets(
        state = state,
        onAltTextChange = onAltTextChange,
        onSensitiveChange = onSensitiveChange,
        onSensitiveReasonChange = onSensitiveReasonChange,
        onCloseSheet = onCloseSheet,
        onOpenHelp = onOpenHelp,
    )

    state.help?.let { topic ->
        HelpDialog(
            title = topic.title,
            paragraphs = topic.paragraphs,
            onClose = onCloseHelp,
            testTag = "comment_edit_help_dialog",
        )
    }
}

/**
 * Every drawer the edit can open, in one place.
 *
 * They are one at a time by construction ([CommentEditState.anySheetOpen]),
 * so they share the one `ModalBottomSheet` rather than each mounting a
 * sheet of its own.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CommentEditSheets(
    state: CommentEditState,
    onAltTextChange: (String, String) -> Unit,
    onSensitiveChange: (Boolean) -> Unit,
    onSensitiveReasonChange: (String) -> Unit,
    onCloseSheet: () -> Unit,
    onOpenHelp: (HelpTopic) -> Unit,
) {
    if (!state.anySheetOpen) return
    CograSheetHost(onDismissRequest = onCloseSheet) {
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
                cap = MAX_ALT_TEXT_CHARS,
                tooLongMessage = describeTooLong(describing.isVideo),
                testTag = "comment_edit_describe_sheet",
            )

            state.actsOpen -> ActsSheet(
                rows = state.actRows,
                onDone = onCloseSheet,
                testTag = "comment_edit_acts_sheet",
            )

            // The post seal's own sheet — one sheet for every surface
            // that marks (ruling 42).
            state.sensitiveOpen -> SensitiveSheet(
                marked = state.sensitive,
                reason = state.sensitiveReason.orEmpty(),
                onMarkedChange = onSensitiveChange,
                onReasonChange = onSensitiveReasonChange,
                onDone = onCloseSheet,
                onHelp = { onOpenHelp(HelpTopic.MarkingAsSensitive) },
                testTagPrefix = "comment_edit",
            )

            else -> Unit
        }
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

/** The one line the edit shows when a submit did not go through. */
internal fun CommentEditState.problem(): String? = when {
    refusal != null -> refusal
    transportFailed -> "That could not reach the server. Try again."
    signingFailed -> "That could not be signed. Try again."
    uploadsFailed -> "A picture did not upload. Remove it, or try again."
    keyAbsent -> "Your key isn't in this app, so nothing was signed."
    else -> null
}
