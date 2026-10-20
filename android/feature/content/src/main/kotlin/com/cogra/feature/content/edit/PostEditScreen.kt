package com.cogra.feature.content.edit

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.AttachmentReadout
import com.cogra.core.designsystem.BACKING_UNREAD_MARK
import com.cogra.core.designsystem.BackingValue
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.DiscardConfirm
import com.cogra.core.designsystem.v2.atom.DiscardSubject
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.SettingRow
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.compose.DescribeSheet
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.PickedPicture
import com.cogra.core.designsystem.v2.compose.PickedRow
import com.cogra.core.designsystem.v2.compose.PickedSheet
import com.cogra.core.designsystem.v2.compose.licenseName
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.content.MAX_DESCRIPTION_CHARS
import com.cogra.domain.content.MAX_POST_BODY_CHARS
import com.cogra.domain.content.MAX_TITLE_CHARS
import com.cogra.domain.media.MAX_ALT_TEXT_CHARS
import com.cogra.feature.content.BackingEdit
import com.cogra.feature.content.BackingPad
import com.cogra.feature.content.ParkedPadWash
import com.cogra.feature.content.R
import com.cogra.feature.content.ReferenceCandidateRow
import com.cogra.feature.content.ReferenceEntry
import com.cogra.feature.content.TopicEntry
import com.cogra.feature.content.parkedPadPlacement
import com.cogra.feature.content.toItem
import com.cogra.feature.content.wizard.SensitiveSheet
import com.cogra.feature.content.wizard.WizardBody
import com.cogra.feature.content.wizard.WizardFooter

/** The board's own line under the words when they pass their cap (EditWords.md). */
const val WORDS_OVER_CAP_LINE = "A post's words are at most 5,000 characters."

/** The rule the body field carries on every edit (EditCompose.md, EditWords.md). */
const val BODY_RULE_LINE = "A post's body is words or media, never both."

/** The header X's accessible name: the edit keeps no draft (EditCompose, EditWords boards). */
const val EDIT_LEAVE_LABEL = "Leave — the edit is discarded"

/**
 * The post edit's route: reads the post, wires the batch, and returns to the
 * post once the edit is signed (it opens with the edit settling).
 *
 * THE EDIT KEEPS NO DRAFT. The back arrow and the X leave at once with an
 * empty batch; with an act in the batch they raise `Discard the changes?`,
 * and Discard leaves toward where the edit began with the post as it was —
 * the ViewModel is scoped to this back-stack entry, so nothing outlives it.
 *
 * DRIFT (registration-gated, feed-card-rework §16): no Edit* board is in
 * nodes.json yet, so this surface carries test tags, not node paths; the
 * structural diff waits on registration.
 *
 * DRIFT (FC-8 remainder, named in the PR): the edit's own add paths — `+ Add
 * pictures · N of 10` through the device picker and the locked crop, the
 * upload gate's lines, and a clip's `Change the cover` — are not built here;
 * the media this edit authors is the post's own pictures, reordered,
 * re-covered, described or removed. When the crops land, their X raises the
 * same ask the edit's own X does (ComposeCrop.md, CoverCrop.md).
 */
@Composable
fun PostEditRoute(
    postId: String,
    /** The edit signed; the caller returns to the post. */
    onSaved: () -> Unit,
    /** Leaves the edit toward where it began. */
    onBack: () -> Unit,
    /** The key-absent seal, standing in the commit's place. */
    keyCard: @Composable () -> Unit = {},
    /** The deletion band, while the account's confirmed deletion is in its grace (`FeedDeleting.md:3`). */
    deletionBand: @Composable () -> Unit = {},
    viewModel: PostEditViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(postId) { viewModel.start(postId) }
    LaunchedEffect(state.saved) {
        if (state.saved) {
            onSaved()
            viewModel.onSavedConsumed()
        }
    }
    PostEditScreen(
        state = state,
        actions = PostEditActions(
            onTitleChange = viewModel::onTitleChange,
            onDescriptionChange = viewModel::onDescriptionChange,
            onBodyChange = viewModel::onBodyChange,
            onOpenPicked = viewModel::onOpenPicked,
            onMovePicture = viewModel::onMovePicture,
            onRemovePicture = viewModel::onRemovePicture,
            onDescribePicture = viewModel::onDescribePicture,
            onAltTextChange = viewModel::onAltTextChange,
            onOpenSensitive = viewModel::onOpenSensitive,
            onSensitiveChange = viewModel::onSensitiveChange,
            onSensitiveReasonChange = viewModel::onSensitiveReasonChange,
            onOpenActs = viewModel::onOpenActs,
            onCloseSheet = viewModel::onCloseSheet,
            onSign = viewModel::onSign,
            onLeave = { if (viewModel.onLeaveRequested()) onBack() },
            onKeepWriting = viewModel::onKeepWriting,
            onDiscard = onBack,
            onTagInputChange = viewModel::onTagInputChange,
            onAddTag = viewModel::onAddTag,
            onRemoveTag = viewModel::onRemoveTag,
            onTuneTag = viewModel::onTuneTag,
            onDoneTuningTag = viewModel::onDoneTuningTag,
            onTagRelevanceChange = viewModel::onTagRelevanceChange,
            onTagConfidenceChange = viewModel::onTagConfidenceChange,
            onUndoTagWithdrawal = viewModel::onUndoTagWithdrawal,
            onOpenFinder = viewModel::onOpenFinder,
            onCloseFinder = viewModel::onCloseFinder,
            onFinderQueryChange = viewModel::onFinderQueryChange,
            onPickReference = viewModel::onPickReference,
            onRemoveReference = viewModel::onRemoveReference,
            onTuneReference = viewModel::onTuneReference,
            onDoneTuningReference = viewModel::onDoneTuningReference,
            onReferenceRelevanceChange = viewModel::onReferenceRelevanceChange,
            onReferenceSupportChange = viewModel::onReferenceSupportChange,
            onUndoReferenceWithdrawal = viewModel::onUndoReferenceWithdrawal,
            onOpenBackingPad = viewModel::onOpenBackingPad,
            onBackingPickChange = viewModel::onBackingPickChange,
            onWalkBack = viewModel::onWalkBack,
            onSetBacking = viewModel::onSetBacking,
            onCancelBackingPad = viewModel::onCancelBackingPad,
        ),
        keyCard = keyCard,
        deletionBand = deletionBand,
    )
}

/** Everything the edit's surface can ask for, in one value rather than forty parameters. */
data class PostEditActions(
    val onTitleChange: (String) -> Unit = {},
    val onDescriptionChange: (String) -> Unit = {},
    val onBodyChange: (String) -> Unit = {},
    val onOpenPicked: () -> Unit = {},
    val onMovePicture: (Int, Int) -> Unit = { _, _ -> },
    val onRemovePicture: (Int) -> Unit = {},
    val onDescribePicture: (Int) -> Unit = {},
    val onAltTextChange: (Int, String) -> Unit = { _, _ -> },
    val onOpenSensitive: () -> Unit = {},
    val onSensitiveChange: (Boolean) -> Unit = {},
    val onSensitiveReasonChange: (String) -> Unit = {},
    val onOpenActs: () -> Unit = {},
    val onCloseSheet: () -> Unit = {},
    val onSign: () -> Unit = {},
    /** The back arrow, the X and the platform back: the batch decides whether it asks. */
    val onLeave: () -> Unit = {},
    val onKeepWriting: () -> Unit = {},
    val onDiscard: () -> Unit = {},
    val onTagInputChange: (String) -> Unit = {},
    val onAddTag: () -> Unit = {},
    val onRemoveTag: (String) -> Unit = {},
    val onTuneTag: (String) -> Unit = {},
    val onDoneTuningTag: () -> Unit = {},
    val onTagRelevanceChange: (String, Double) -> Unit = { _, _ -> },
    val onTagConfidenceChange: (String, Double) -> Unit = { _, _ -> },
    val onUndoTagWithdrawal: (String) -> Unit = {},
    val onOpenFinder: () -> Unit = {},
    val onCloseFinder: () -> Unit = {},
    val onFinderQueryChange: (String) -> Unit = {},
    val onPickReference: (ReferenceCandidateRow) -> Unit = {},
    val onRemoveReference: (String) -> Unit = {},
    val onTuneReference: (String) -> Unit = {},
    val onDoneTuningReference: () -> Unit = {},
    val onReferenceRelevanceChange: (String, Double) -> Unit = { _, _ -> },
    val onReferenceSupportChange: (String, Double) -> Unit = { _, _ -> },
    val onUndoReferenceWithdrawal: (String) -> Unit = {},
    val onOpenBackingPad: () -> Unit = {},
    val onBackingPickChange: (Double) -> Unit = {},
    val onWalkBack: () -> Unit = {},
    val onSetBacking: () -> Unit = {},
    val onCancelBackingPad: () -> Unit = {},
)

/**
 * `EditCompose` / `EditComposeVideo` / `EditWords` / `EditComposeUnchanged`:
 * the post edit, one screen and one batch (`_shared.jsx` `EditComposeBody`,
 * `EditWords.jsx`). The license is locked and shown by name; the mark is the
 * author's ongoing judgment and opens the seal's own sheet (ruling 42).
 */
@Composable
fun PostEditScreen(
    state: PostEditUiState,
    actions: PostEditActions,
    modifier: Modifier = Modifier,
    keyCard: @Composable () -> Unit = {},
    /** The deletion band, while the account's confirmed deletion is in its grace (`FeedDeleting.md:3`). */
    deletionBand: @Composable () -> Unit = {},
) {
    val slowAnswer = rememberSlowAnswer(state.submitting)
    var help by remember { mutableStateOf<HelpTopic?>(null) }
    // While the signing holds the reader, the back arrow and the X refuse a
    // press and never dim (EditCompose.md).
    val leave = { if (!slowAnswer) actions.onLeave() }
    BackHandler(onBack = leave)
    // The system's Back over the parked pad closes it and stages nothing
    // (EditPad.md); composed after the leave handler, so it answers first.
    BackHandler(enabled = state.backingPadOpen, onBack = actions.onCancelBackingPad)

    if (state.confirmingDiscard) {
        DiscardConfirm(
            subject = DiscardSubject.Edit,
            onKeepWriting = actions.onKeepWriting,
            onDiscard = actions.onDiscard,
            testTag = "post_edit_discard_confirm",
        )
    }

    Box(modifier = modifier.fillMaxSize()) {
        PostEditColumn(state, actions, slowAnswer, leave, keyCard, deletionBand, onHelp = { help = it })

        // THE BACKING PAD PARKS OVER THE EDIT (`EditPad`): the wash covers the
        // edit, which goes inert; only the pad is live.
        if (state.backingPadOpen) {
            ParkedPadWash(onDismiss = actions.onCancelBackingPad, testTag = "post_edit_pad_wash")
            BackingPad(
                pick = state.stagedPick,
                onPickChange = actions.onBackingPickChange,
                onSet = actions.onSetBacking,
                onCancel = actions.onCancelBackingPad,
                onHelp = { help = HelpTopic.YourBackingOnYourPost },
                testTagPrefix = "post_edit_backing",
                modifier = parkedPadPlacement(),
                edit = BackingEdit(
                    current = state.backingCurrent,
                    rawSum = state.backingRaw,
                    canWalkBack = state.canWalkBack,
                    onWalkBack = actions.onWalkBack,
                ),
            )
        }
    }

    PostEditSheets(state, actions, onHelp = { help = it })

    help?.let { topic ->
        HelpDialog(
            title = topic.title,
            paragraphs = topic.paragraphs,
            onClose = { help = null },
            testTag = "post_edit_help_dialog",
        )
    }
}

/** The edit itself: the header, the fields, and the foot. */
@Composable
private fun PostEditColumn(
    state: PostEditUiState,
    actions: PostEditActions,
    slowAnswer: Boolean,
    leave: () -> Unit,
    keyCard: @Composable () -> Unit,
    deletionBand: @Composable () -> Unit,
    onHelp: (HelpTopic) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .testTag("post_edit"),
    ) {
        WizardHeader(
            title = "Edit post",
            onBack = leave,
            backContentDescription = "Back to the post",
            onLeave = leave,
            leaveContentDescription = EDIT_LEAVE_LABEL,
            onHelp = { onHelp(HelpTopic.Editing) },
            helpContentDescription = HelpTopic.Editing.title,
            testTag = "post_edit_header",
        )
        // Directly under the header (FeedDeleting.md:5).
        deletionBand()

        WizardBody(gap = Space.x3, top = Space.x3, bottom = Space.x2, scrollable = true) {
            when {
                state.loading -> Text(
                    text = "Loading…",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.testTag("post_edit_loading"),
                )
                state.notFound -> Text(
                    text = stringResource(R.string.content_error_not_found),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("post_edit_not_found"),
                )
                else -> EditFields(state, actions)
            }
        }

        WizardFooter { EditFoot(state, actions, slowAnswer, keyCard) }
    }
}

/** The count over the commit — or, in the commit's place, the key-absent seal or the write rule's notice. */
@Composable
private fun EditFoot(
    state: PostEditUiState,
    actions: PostEditActions,
    slowAnswer: Boolean,
    keyCard: @Composable () -> Unit,
) {
    ActsFooter(
        count = state.signedActionCount,
        onOpen = actions.onOpenActs,
        testTag = "post_edit_acts_footer",
        subline = when {
            state.slow -> EDIT_SLOW_LINE
            state.countChanged -> EDIT_COUNT_CHANGED_LINE
            else -> null
        },
    )
    when {
        state.keyAbsent -> keyCard()
        // The write rule's notice takes the commit's place, with no Retry
        // beside it (EditCompose.md).
        state.writeRuleRefused -> Text(
            text = "You can't sign right now.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .testTag("post_edit_write_rule")
                .semantics { liveRegion = LiveRegionMode.Polite },
        )
        // Inert, never hidden, at an empty batch; a press while the signing
        // is out is refused without the button dimming.
        else -> CograButton(
            text = signLabel(slowAnswer),
            onClick = { if (!state.submitting) actions.onSign() },
            enabled = state.canSign || state.submitting,
            modifier = Modifier.fillMaxWidth(),
            testTag = "post_edit_sign",
        )
    }
}

@Composable
private fun EditFields(state: PostEditUiState, actions: PostEditActions) {
    WordsOrMedia(state, actions)
    TitleAndDescription(state, actions)
    TagsAndReferences(state, actions)
    Terms(state, actions)
}

@Composable
private fun WordsOrMedia(state: PostEditUiState, actions: PostEditActions) {
    if (state.mediaBody) {
        MediaBody(state, actions)
    } else {
        CograTextField(
            value = state.body,
            onValueChange = actions.onBodyChange,
            label = "What do you want to publish?",
            singleLine = false,
            minLines = 6,
            modifier = Modifier.fillMaxWidth(),
            cap = MAX_POST_BODY_CHARS,
            error = WORDS_OVER_CAP_LINE.takeIf { state.bodyTooLong },
            testTag = "post_edit_words",
        )
        BodyRule()
    }
}

@Composable
private fun TitleAndDescription(state: PostEditUiState, actions: PostEditActions) {
    CograTextField(
        value = state.title,
        onValueChange = actions.onTitleChange,
        label = "Title",
        optional = true,
        modifier = Modifier.fillMaxWidth(),
        cap = MAX_TITLE_CHARS,
        error = stringResource(R.string.content_error_title_too_long, MAX_TITLE_CHARS).takeIf { state.titleTooLong },
        testTag = "post_edit_title",
    )

    // THE WORDS EDIT CARRIES NO DESCRIPTION (EditWords.md:7; K8.1/D4): a
    // description is how words stand beside pictures.
    if (state.mediaBody) {
        CograTextField(
            value = state.description,
            onValueChange = actions.onDescriptionChange,
            label = "Description",
            optional = true,
            singleLine = false,
            minLines = 2,
            modifier = Modifier.fillMaxWidth(),
            cap = MAX_DESCRIPTION_CHARS,
            error = stringResource(R.string.content_error_description_too_long, MAX_DESCRIPTION_CHARS)
                .takeIf { state.descriptionTooLong },
            testTag = "post_edit_description",
        )
    }
}

@Composable
private fun TagsAndReferences(state: PostEditUiState, actions: PostEditActions) {
    FieldGroup(label = "Tags") {
        TopicEntry(
            section = state.tagSection,
            testTagPrefix = "post_edit",
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
                testTag = "post_edit_withdrawn_tag_$name",
            )
        }
    }

    FieldGroup(label = "References") {
        ReferenceEntry(
            section = state.referenceSection,
            testTagPrefix = "post_edit",
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
        state.referenceSection.withdrawn().forEach { row ->
            WithdrawnLine(
                name = row.label(),
                onUndo = { actions.onUndoReferenceWithdrawal(row.targetId) },
                testTag = "post_edit_withdrawn_reference_${row.targetId}",
            )
        }
    }
}

/**
 * The terms rows, in the seal's order: the license, shown and locked; the
 * author's backing (`EditBackingRow`); then the author's own mark.
 */
@Composable
private fun Terms(state: PostEditUiState, actions: PostEditActions) {
    LockedLicenseRow(
        name = licenseName(state.license.attribution, state.license.provenance),
        testTag = "post_edit_license",
    )
    // `Your backing` — one number: where the post's backing stands WITH the
    // edit (EditCompose.md). The edit's record is an ordinary-role Publish,
    // the family that minted the post, so it carries the same one free
    // parameter; its pick adds to the backing, 0.00 until moved, and rides
    // the edit's own record — no row in the acts, nothing on the count.
    SettingRow(
        label = "Your backing",
        actionText = "Adjust",
        onAction = actions.onOpenBackingPad,
        testTag = "post_edit_backing",
    ) {
        when (val withEdit = state.backingWithEdit) {
            is BackingValue.Read -> AttachmentReadout(pDirected = withEdit.value, testTag = "post_edit_backing_value")
            // SERVER GAP (seam 233): nothing serves the Publish bundle's net
            // yet, so the row draws it unread rather than guess.
            BackingValue.Unread -> Text(
                text = BACKING_UNREAD_MARK,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag("post_edit_backing_unread"),
            )
        }
    }
    SettingRow(
        label = "Sensitive",
        value = if (state.sensitive) "Marked" else "Not marked",
        actionText = if (state.sensitive) "Change" else "Mark",
        onAction = actions.onOpenSensitive,
        testTag = "post_edit_sensitive",
    )
    Hairline()

    state.problem()?.let { message ->
        Text(
            text = message,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier
                .fillMaxWidth()
                .testTag("post_edit_problem")
                .semantics { liveRegion = LiveRegionMode.Assertive },
        )
    }
}

/**
 * The picture body: the picked row, whose whole row opens Show all
 * (`EditPicked`), or the one clip with its own remove control and
 * description (`EditComposeVideo`) — the clip itself never changes at an
 * edit.
 */
@Composable
private fun MediaBody(state: PostEditUiState, actions: PostEditActions) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        val pictures = state.attachments.map { asset ->
            PickedPicture(item = asset.toItem(), described = !asset.altText.isNullOrBlank())
        }
        if (state.clipBody) {
            PickedRow(
                pictures = pictures,
                caption = "Video",
                onManage = null,
                onRemove = { actions.onRemovePicture(0) },
                testTag = "post_edit_clip",
            )
            SettingRow(
                label = "Description",
                value = if (state.attachments.first().altText.isNullOrBlank()) "None" else "Described",
                actionText = "Describe the video",
                onAction = { actions.onDescribePicture(0) },
                testTag = "post_edit_describe_clip",
            )
            Text(
                text = "A video is the whole post.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            val count = pictures.size
            PickedRow(
                pictures = pictures,
                caption = "${if (count == 1) "1 picture" else "$count pictures"} — the body",
                onManage = actions.onOpenPicked,
                manageLabel = if (count == 1) "Manage the picture" else "Manage the $count pictures",
                testTag = "post_edit_picked",
            )
            BodyRule()
        }
    }
}

@Composable
private fun BodyRule() {
    Text(
        text = BODY_RULE_LINE,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.testTag("post_edit_body_rule"),
    )
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

/** Every drawer the edit can open — one at a time, in the one sheet host. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PostEditSheets(state: PostEditUiState, actions: PostEditActions, onHelp: (HelpTopic) -> Unit) {
    if (!state.anySheetOpen) return
    CograSheetHost(onDismissRequest = actions.onCloseSheet) {
        val describing = state.describingIndex?.let { state.attachments.getOrNull(it) }
        when {
            describing != null -> DescribeSheet(
                item = describing.toItem(),
                value = describing.altText.orEmpty(),
                onValueChange = { text -> actions.onAltTextChange(state.describingIndex ?: 0, text) },
                onDone = actions.onCloseSheet,
                video = describing.isVideo,
                cap = MAX_ALT_TEXT_CHARS,
                testTag = "post_edit_describe_sheet",
            )
            state.pickedOpen -> PickedSheet(
                pictures = state.attachments.map { asset ->
                    PickedPicture(item = asset.toItem(), described = !asset.altText.isNullOrBlank())
                },
                onDescribe = actions.onDescribePicture,
                onRemove = actions.onRemovePicture,
                onMove = actions.onMovePicture,
                onDone = actions.onCloseSheet,
                testTag = "post_edit_picked_sheet",
            )
            state.actsOpen -> ActsSheet(rows = state.actRows, onDone = actions.onCloseSheet, testTag = "post_edit_acts")
            state.sensitiveOpen -> SensitiveSheet(
                marked = state.sensitive,
                reason = state.sensitiveReason.orEmpty(),
                onMarkedChange = actions.onSensitiveChange,
                onReasonChange = actions.onSensitiveReasonChange,
                onDone = actions.onCloseSheet,
                onHelp = { onHelp(HelpTopic.MarkingAsSensitive) },
                testTagPrefix = "post_edit",
            )
            else -> Unit
        }
    }
}

/** The one line the edit shows when a submit did not go through. */
internal fun PostEditUiState.problem(): String? = when {
    refusal != null -> refusal
    transportFailed -> "Can't reach the server. Check the connection and retry."
    signingFailed -> "Signing did not finish — the write stays pending."
    else -> null
}
