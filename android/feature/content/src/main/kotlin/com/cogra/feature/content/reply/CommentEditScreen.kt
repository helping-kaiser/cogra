package com.cogra.feature.content.reply

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.DiscardConfirm
import com.cogra.core.designsystem.v2.atom.DiscardSubject
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.InlineSize
import com.cogra.core.designsystem.v2.atom.NoticeLine
import com.cogra.core.designsystem.v2.atom.NoticePanel
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.SettingRow
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.compose.DescribeCounter
import com.cogra.core.designsystem.v2.compose.DescribeSheet
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.UploadErrorLine
import com.cogra.core.designsystem.v2.compose.licenseName
import com.cogra.core.designsystem.v2.media.MediaThumb
import com.cogra.core.designsystem.v2.media.ThumbBadge
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.content.MAX_COMMENT_BODY_CHARS
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MAX_ALT_TEXT_CHARS
import com.cogra.feature.content.R
import com.cogra.feature.content.ReferenceCandidateRow
import com.cogra.feature.content.ReferenceEntry
import com.cogra.feature.content.TopicEntry
import com.cogra.feature.content.edit.ActsFooter
import com.cogra.feature.content.edit.ActsSheet
import com.cogra.feature.content.edit.ClipField
import com.cogra.feature.content.edit.CoverField
import com.cogra.feature.content.edit.EDIT_COUNT_CHANGED_LINE
import com.cogra.feature.content.edit.EDIT_SLOW_LINE
import com.cogra.feature.content.edit.EditCropActions
import com.cogra.feature.content.edit.EditCropStage
import com.cogra.feature.content.edit.EditFieldGroup
import com.cogra.feature.content.edit.EditUploadErrorLine
import com.cogra.feature.content.edit.EditUploadGate
import com.cogra.feature.content.edit.EditWriteRuleNotice
import com.cogra.feature.content.edit.FIELD_GAP
import com.cogra.feature.content.edit.LockedLicenseRow
import com.cogra.feature.content.edit.RefusedFileRows
import com.cogra.feature.content.edit.WithdrawnLine
import com.cogra.feature.content.edit.describeItem
import com.cogra.feature.content.edit.isClip
import com.cogra.feature.content.edit.label
import com.cogra.feature.content.edit.rememberSlowAnswer
import com.cogra.feature.content.edit.signLabel
import com.cogra.feature.content.edit.withdrawn
import com.cogra.feature.content.wizard.SEAL_BUG_FACT
import com.cogra.feature.content.wizard.SEAL_BUG_TITLE
import com.cogra.feature.content.wizard.SealFault
import com.cogra.feature.content.wizard.SensitiveSheet
import com.cogra.feature.content.wizard.WizardBody
import com.cogra.feature.content.wizard.WizardFooter
import com.cogra.feature.content.wizard.describeTooLong
import com.cogra.feature.content.wizard.unlandedLine

/** The header X's name: the edit keeps no draft, so leaving discards (CommentEdit board). */
const val COMMENT_EDIT_LEAVE_LABEL = "Leave — the edit is discarded"

/** A comment edit's tile: the 56 square, the whole frame contained in it (`CommentEditBody`). */
private val COMMENT_TILE = 56.dp

/**
 * `CommentEdit`, wired.
 *
 * [parentTitle] is the caption's words and nothing else; everything the
 * edit signs is read from the comment itself. The pickers live here, at the
 * route — comments have no pick stage: `+ Add pictures` and the cover field
 * open the platform's own picker (jakob 2026-08-31; CommentEdit.md).
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

    // Never shut at the cap: a fifth picture is refused in words, which a
    // picker capped at the room left would only hide.
    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(CommentEditState.MAX_PICTURES),
    ) { uris -> viewModel.onPicked(uris.map { it.toString() }) }
    val coverPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let { viewModel.onPickCover(it.toString()) }
    }

    CommentEditScreen(
        state = state,
        actions = CommentEditActions(
            onBodyChange = viewModel::onBodyChange,
            onOpenPicker = {
                picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
            },
            onRemovePickAt = viewModel::onRemovePickAt,
            onDismissRefusal = viewModel::onDismissRefusal,
            onRetryUploads = viewModel::onRetryUploads,
            onRemoveFailed = viewModel::onRemoveFailed,
            onPickCover = {
                coverPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
            },
            onRemoveCover = viewModel::onRemoveCover,
            onCropBack = viewModel::onCropBack,
            onCoverCropNext = viewModel::onCoverCropDone,
            onCoverCropChanged = viewModel::onCoverCropChanged,
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
            onDiscardAsked = viewModel::onDiscardAsked,
            onNotNow = viewModel::onNotNow,
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
        ),
        modifier = modifier,
    )
}

/** Everything the comment edit's surface can ask for, in one value. */
data class CommentEditActions(
    val onBodyChange: (String) -> Unit = {},
    /** `+ Add pictures · N of 4`: the platform's own picker. */
    val onOpenPicker: () -> Unit = {},
    val onRemovePickAt: (Int) -> Unit = {},
    val onDismissRefusal: (Int) -> Unit = {},
    val onRetryUploads: () -> Unit = {},
    val onRemoveFailed: () -> Unit = {},
    /** `Add a cover` / `Change the cover`: the platform's own picker, one picture. */
    val onPickCover: () -> Unit = {},
    val onRemoveCover: () -> Unit = {},
    val onCropBack: () -> Unit = {},
    val onCoverCropNext: () -> Unit = {},
    val onCoverCropChanged: (CropSpec) -> Unit = {},
    val onDescribePictures: () -> Unit = {},
    val onAltTextChange: (String, String) -> Unit = { _, _ -> },
    val onOpenActs: () -> Unit = {},
    val onOpenSensitive: () -> Unit = {},
    val onSensitiveChange: (Boolean) -> Unit = {},
    val onSensitiveReasonChange: (String) -> Unit = {},
    val onCloseSheet: () -> Unit = {},
    val onOpenHelp: (HelpTopic) -> Unit = {},
    val onCloseHelp: () -> Unit = {},
    val onSign: () -> Unit = {},
    val onLeave: () -> Unit = {},
    val onKeepWriting: () -> Unit = {},
    val onDiscard: () -> Unit = {},
    /** `Discard the edit` under the bug notice: asks first. */
    val onDiscardAsked: () -> Unit = {},
    /** `Not now` under the write rule's notice. */
    val onNotNow: () -> Unit = {},
    /**
     * `Report a problem` under the bug notice. The report page Settings opens
     * is not built on android — the word stands where the board draws it, as
     * it does on the post seal (`SealStep`).
     */
    val onReport: () -> Unit = {},
    val onTagInputChange: (String) -> Unit = {},
    val onAddTag: () -> Unit = {},
    val onRemoveTag: (String) -> Unit = {},
    val onTuneTag: (String) -> Unit = {},
    val onDoneTuningTag: () -> Unit = {},
    val onTagRelevanceChange: (String, Double) -> Unit = { _, _ -> },
    val onTagConfidenceChange: (String, Double) -> Unit = { _, _ -> },
    val onOpenFinder: () -> Unit = {},
    val onCloseFinder: () -> Unit = {},
    val onFinderQueryChange: (String) -> Unit = {},
    val onPickReference: (ReferenceCandidateRow) -> Unit = {},
    val onRemoveReference: (String) -> Unit = {},
    val onTuneReference: (String) -> Unit = {},
    val onDoneTuningReference: () -> Unit = {},
    val onReferenceRelevanceChange: (String, Double) -> Unit = { _, _ -> },
    val onReferenceSupportChange: (String, Double) -> Unit = { _, _ -> },
    val onUndoTagWithdrawal: (String) -> Unit = {},
    val onUndoReferenceWithdrawal: (String) -> Unit = {},
)

/**
 * `CommentEdit` / `CommentEditVideo` — the whole comment on one screen, in
 * one batch (`_shared.jsx` `CommentEditBody`, `CommentEditVideo.jsx`).
 *
 * The post's one-screen-one-batch scaled to a comment's anatomy: words,
 * pictures (whole, four max, described through the same counter line the
 * reply composer wears) or the one clip and its cover, tags, citations,
 * **and the license shown locked** — an edit can never change it — and the
 * Sensitive row beside it, which is not locked.
 *
 * The edit contract is complete-state, so every field the row leaves
 * standing rides the edit whether or not the author touched it: an edit
 * that omitted the mark would unmark ([CommentEditState.sensitive]).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun CommentEditScreen(
    state: CommentEditState,
    actions: CommentEditActions,
    modifier: Modifier = Modifier,
) {
    // The 200ms label swap counts from the press, held at the upload gate or
    // not; while it stands the ways out refuse a press (CommentEdit.md).
    val slowAnswer = rememberSlowAnswer(state.pressed)
    val leave = { if (!slowAnswer) actions.onLeave() }
    BackHandler(onBack = leave)
    // Over the cover's crop, Back is the crop's own back arrow.
    BackHandler(enabled = state.cropping != null, onBack = actions.onCropBack)

    if (state.confirmingDiscard) {
        DiscardConfirm(
            subject = DiscardSubject.Edit,
            onKeepWriting = actions.onKeepWriting,
            onDiscard = actions.onDiscard,
            testTag = "comment_edit_discard_confirm",
        )
    }

    val cropping = state.cropping
    if (cropping != null) {
        EditCropStage(
            crop = cropping,
            actions = EditCropActions(
                onBack = actions.onCropBack,
                onLeave = leave,
                onNext = actions.onCoverCropNext,
                onCoverCropChanged = actions.onCoverCropChanged,
            ),
            testTagPrefix = "comment_edit",
        )
        return
    }

    // THE OPENING FOCUS (CommentEdit.md: "focus lands on the stage's heading
    // AND NEVER the keyboard rises before a field is tapped").
    val heading = remember { FocusRequester() }
    LaunchedEffect(state.loading) {
        if (!state.loading) runCatching { heading.requestFocus() }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .testTag("comment_edit"),
    ) {
        WizardHeader(
            title = "Edit comment",
            onBack = leave,
            onLeave = leave,
            // Leaving discards: comments keep no drafts (jakob
            // 2026-09-01), so the master's "your draft is kept" would be
            // a promise nothing here makes.
            leaveContentDescription = COMMENT_EDIT_LEAVE_LABEL,
            onHelp = { actions.onOpenHelp(HelpTopic.Editing) },
            helpContentDescription = HelpTopic.Editing.title,
            titleFocus = heading,
            testTag = "comment_edit_header",
        )

        WizardBody(gap = FIELD_GAP, top = Space.x3, bottom = Space.x2, scrollable = true) {
            QuietNote(
                text = "Your comment on \"${state.parentTitle}\".",
                modifier = Modifier.testTag("comment_edit_caption"),
            )

            CograTextField(
                value = state.body,
                onValueChange = actions.onBodyChange,
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

            Media(state, actions)
            Sections(state, actions)
            Terms(state, actions)
        }

        WizardFooter { Foot(state, actions, slowAnswer) }
    }

    CommentEditSheets(state, actions)

    state.help?.let { topic ->
        HelpDialog(
            title = topic.title,
            paragraphs = topic.paragraphs,
            onClose = actions.onCloseHelp,
            testTag = "comment_edit_help_dialog",
        )
    }
}

/**
 * The comment's media: its pictures — each the 56 square with its own ×,
 * the add control beside them — or its one clip, which stays or leaves
 * whole, and the clip's cover field (`CommentEditVideo`).
 */
@Composable
private fun Media(state: CommentEditState, actions: CommentEditActions) {
    val clip = state.gallery.clip
    if (clip != null) {
        ClipField(
            clip = clip,
            onRemove = { actions.onRemovePickAt(0) },
            onDescribe = actions.onDescribePictures,
            testTagPrefix = "comment_edit",
            squareTile = COMMENT_TILE,
        )
        CoverField(
            gallery = state.gallery,
            onPick = actions.onPickCover,
            onRetry = actions.onRetryUploads,
            onRemoveCover = actions.onRemoveCover,
            testTagPrefix = "comment_edit",
            doorNote = false,
            squareTile = COMMENT_TILE,
        )
        return
    }
    EditFieldGroup(label = "Pictures") {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            state.gallery.pickedPictures().forEachIndexed { index, picture ->
                MediaThumb(
                    item = picture.item,
                    size = COMMENT_TILE,
                    // Comment pictures never crop: the whole frame, contained.
                    fit = ContentScale.Fit,
                    badge = ThumbBadge.Failed.takeIf { picture.failed },
                    uploading = picture.uploading,
                    progress = picture.progress,
                    onRemove = { actions.onRemovePickAt(index) },
                    removeTestTag = "comment_edit_tray_${index}_remove",
                    testTag = "comment_edit_tray_$index",
                )
            }
            InlineAction(
                // The same words the reply composer counts with: one add
                // label across the two comment surfaces.
                text = "+ Add pictures · ${state.gallery.size} of ${CommentEditState.MAX_PICTURES}",
                onClick = actions.onOpenPicker,
                size = InlineSize.Small,
                testTag = "comment_edit_add",
            )
        }
        EditUploadErrorLine(
            gallery = state.gallery,
            onRetry = actions.onRetryUploads,
            onRemove = actions.onRemoveFailed,
            testTag = "comment_edit_upload_error",
        )
        RefusedFileRows(state.refused, actions.onDismissRefusal, testTagPrefix = "comment_edit")
        if (state.hasPictures) {
            DescribeCounter(
                described = state.gallery.describedCount,
                total = state.gallery.size,
                onDescribe = actions.onDescribePictures,
                testTag = "comment_edit_describe_counter",
            )
        }
    }
}

@Composable
private fun Sections(state: CommentEditState, actions: CommentEditActions) {
    EditFieldGroup(label = "Tags") {
        TopicEntry(
            section = state.tagSection,
            testTagPrefix = "comment_edit",
            onTagInputChange = actions.onTagInputChange,
            onAddTag = actions.onAddTag,
            onRemoveTag = actions.onRemoveTag,
            onTuneTag = actions.onTuneTag,
            onDoneTuningTag = actions.onDoneTuningTag,
            onTagRelevanceChange = actions.onTagRelevanceChange,
            onTagConfidenceChange = actions.onTagConfidenceChange,
            showHeading = false,
        )
        state.tagSection.withdrawn().forEach { name ->
            WithdrawnLine(
                name = "#$name",
                onUndo = { actions.onUndoTagWithdrawal(name) },
                testTag = "comment_edit_withdrawn_tag_$name",
            )
        }
    }

    EditFieldGroup(label = "References") {
        ReferenceEntry(
            section = state.referenceSection,
            testTagPrefix = "comment_edit",
            onOpenFinder = actions.onOpenFinder,
            onCloseFinder = actions.onCloseFinder,
            onFinderQueryChange = actions.onFinderQueryChange,
            onPickReference = actions.onPickReference,
            onRemoveReference = actions.onRemoveReference,
            onTuneReference = actions.onTuneReference,
            onDoneTuningReference = actions.onDoneTuningReference,
            onReferenceRelevanceChange = actions.onReferenceRelevanceChange,
            onReferenceSupportChange = actions.onReferenceSupportChange,
            showHeading = false,
        )
        // CommentEdit.md: a staged citation whose cited post never landed
        // reads `This post didn't land, so it can't be cited.` followed by
        // `Remove it` — NEVER Retry.
        val refused = (state.fault as? SealFault.Row)?.targetId?.let { id ->
            state.referenceSection.references.firstOrNull { it.targetId == id }
        }
        if (refused != null) {
            UploadErrorLine(
                message = unlandedLine(refused),
                onRemove = { actions.onRemoveReference(refused.targetId) },
                testTag = "comment_edit_unlanded",
            )
        }
        state.referenceSection.withdrawn().forEach { row ->
            WithdrawnLine(
                name = row.label(),
                onUndo = { actions.onUndoReferenceWithdrawal(row.targetId) },
                testTag = "comment_edit_withdrawn_reference_${row.targetId}",
            )
        }
    }
}

@Composable
private fun Terms(state: CommentEditState, actions: CommentEditActions) {
    LockedLicenseRow(
        name = licenseName(state.license.attribution, state.license.provenance),
        testTag = "comment_edit_license",
    )
    // The license keeps its lock; this row does not. The license is fixed
    // by contract the moment it is signed, while the mark is the author's
    // ongoing judgment about their own words (design/backlog.md item 25
    // part 2).
    SettingRow(
        label = "Sensitive",
        value = if (state.sensitive) "Marked" else "Not marked",
        actionText = if (state.sensitive) "Change" else "Mark",
        onAction = actions.onOpenSensitive,
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

/**
 * The foot: the gate over the count over the commit — or, in the commit's
 * place, the write rule's notice or the bug notice (CommentEdit.md).
 */
@Composable
private fun Foot(state: CommentEditState, actions: CommentEditActions, slowAnswer: Boolean) {
    EditUploadGate(state.gallery, onRetry = actions.onRetryUploads, testTag = "comment_edit_gate")
    ActsFooter(
        count = state.signedActionCount,
        onOpen = actions.onOpenActs,
        testTag = "comment_edit_acts_footer",
        subline = when {
            state.slow -> EDIT_SLOW_LINE
            state.countChanged -> EDIT_COUNT_CHANGED_LINE
            else -> null
        },
    )
    when (state.fault) {
        SealFault.WriteRule -> EditWriteRuleNotice(
            onHelp = actions.onOpenHelp,
            onNotNow = actions.onNotNow,
            testTagPrefix = "comment_edit",
        )
        SealFault.Bug -> BugNotice(actions)
        // Inert, never hidden, at an empty batch; enabled while uploads run —
        // a press there is held — and disabled at the gate's fault reading; a
        // press while the signing is out is refused without the button
        // dimming, and past 200ms it reads `Signing the edit…` in its place.
        else -> CograButton(
            text = signLabel(slowAnswer),
            onClick = { if (!state.pressed) actions.onSign() },
            enabled = state.canSign || state.pressed,
            modifier = Modifier.fillMaxWidth(),
            testTag = "comment_edit_sign",
        )
    }
}

/**
 * `This shouldn't have happened` (CommentEdit.md): the notice in the bug's
 * own words, `Try again` in the panel, and `Report a problem` and `Discard
 * the edit` under it — the discard asking first.
 */
@Composable
private fun BugNotice(actions: CommentEditActions) {
    NoticePanel(title = SEAL_BUG_TITLE, testTag = "comment_edit_bug") {
        NoticeLine(SEAL_BUG_FACT)
        CograButton(
            text = "Try again",
            onClick = actions.onSign,
            kind = ButtonKind.Inverse,
            modifier = Modifier.fillMaxWidth(),
            testTag = "comment_edit_try_again",
        )
    }
    Column(Modifier.fillMaxWidth()) {
        CograButton(
            text = "Report a problem",
            onClick = actions.onReport,
            kind = ButtonKind.Text,
            modifier = Modifier.fillMaxWidth(),
            testTag = "comment_edit_report",
        )
        CograButton(
            text = "Discard the edit",
            onClick = actions.onDiscardAsked,
            kind = ButtonKind.Text,
            modifier = Modifier.fillMaxWidth(),
            testTag = "comment_edit_discard",
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
private fun CommentEditSheets(state: CommentEditState, actions: CommentEditActions) {
    if (!state.anySheetOpen) return
    CograSheetHost(onDismissRequest = actions.onCloseSheet) {
        val describing = state.describingIndex?.let { state.gallery.pictures.getOrNull(it) }
        when {
            describing != null -> DescribeSheet(
                item = describing.describeItem(),
                value = describing.altText,
                onValueChange = { actions.onAltTextChange(describing.key, it) },
                onDone = actions.onCloseSheet,
                onHelp = { actions.onOpenHelp(HelpTopic.DescribingPictures) },
                video = describing.isClip(),
                cap = MAX_ALT_TEXT_CHARS,
                tooLongMessage = describeTooLong(describing.isClip()),
                testTag = "comment_edit_describe_sheet",
            )

            state.actsOpen -> ActsSheet(
                rows = state.actRows,
                onDone = actions.onCloseSheet,
                testTag = "comment_edit_acts_sheet",
            )

            // The post seal's own sheet — one sheet for every surface
            // that marks (ruling 42).
            state.sensitiveOpen -> SensitiveSheet(
                marked = state.sensitive,
                reason = state.sensitiveReason.orEmpty(),
                onMarkedChange = actions.onSensitiveChange,
                onReasonChange = actions.onSensitiveReasonChange,
                onDone = actions.onCloseSheet,
                onHelp = { actions.onOpenHelp(HelpTopic.MarkingAsSensitive) },
                testTagPrefix = "comment_edit",
            )

            else -> Unit
        }
    }
}

/** The one line the edit shows when a submit did not go through. */
internal fun CommentEditState.problem(): String? = when {
    refusal != null -> refusal
    transportFailed -> "That could not reach the server. Try again."
    signingFailed -> "That could not be signed. Try again."
    keyAbsent -> "Your key isn't in this app, so nothing was signed."
    else -> null
}
