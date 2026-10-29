package com.cogra.feature.content.edit

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.AttachmentReadout
import com.cogra.core.designsystem.BACKING_UNREAD_MARK
import com.cogra.core.designsystem.BackingValue
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.DiscardConfirm
import com.cogra.core.designsystem.v2.atom.DiscardSubject
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.InlineSize
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.SettingRow
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.compose.DescribeSheet
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.PickedRow
import com.cogra.core.designsystem.v2.compose.PickedSheet
import com.cogra.core.designsystem.v2.compose.licenseName
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.content.MAX_DESCRIPTION_CHARS
import com.cogra.domain.content.MAX_POST_BODY_CHARS
import com.cogra.domain.content.MAX_TITLE_CHARS
import com.cogra.domain.media.CropSpec
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
import com.cogra.feature.content.wizard.describeTooLong

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
 * THE ADD PATHS OPEN THE DEVICE'S OWN PICKER, never a pick stage
 * (EditCompose.md): `+ Add pictures · N of 10` takes pictures, the words
 * edit's `+ Add pictures or a video` pictures or a clip, and the cover field
 * one picture. The pickers live here, at the route, so the screen stays
 * stateless and previewable.
 *
 * DRIFT (registration-gated): no Edit* board — nor ComposeCrop or CoverCrop —
 * is in nodes.json yet, so this surface carries test tags, not node paths;
 * the structural diff waits on registration.
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
    // Never shut at the cap: a picture past ten is refused in words on the
    // row, which a picker capped at the room left would only hide.
    val addPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(PostEditUiState.MAX_PICTURES),
    ) { uris -> viewModel.onAddPictures(uris.map { it.toString() }) }
    // A cover is a still by contract, so the picker offers pictures alone.
    val coverPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let { viewModel.onPickCover(it.toString()) }
    }
    val actions = viewModel.coreActions(onBack)
        .withSections(viewModel)
        .withMedia(
            viewModel,
            onAddMedia = {
                addPicker.launch(
                    PickVisualMediaRequest(
                        // The words edit takes pictures or a clip; a picture
                        // body takes pictures (EditWords.md, EditCompose.md).
                        if (state.mediaBody) {
                            ActivityResultContracts.PickVisualMedia.ImageOnly
                        } else {
                            ActivityResultContracts.PickVisualMedia.ImageAndVideo
                        },
                    ),
                )
            },
            onPickCover = {
                coverPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
            },
        )
    PostEditScreen(state = state, actions = actions, keyCard = keyCard, deletionBand = deletionBand)
}

/** The edit's own fields, its sheets, its leaving and its signing. */
private fun PostEditViewModel.coreActions(onBack: () -> Unit) = PostEditActions(
    onTitleChange = this::onTitleChange,
    onDescriptionChange = this::onDescriptionChange,
    onBodyChange = this::onBodyChange,
    onOpenSensitive = this::onOpenSensitive,
    onSensitiveChange = this::onSensitiveChange,
    onSensitiveReasonChange = this::onSensitiveReasonChange,
    onOpenActs = this::onOpenActs,
    onCloseSheet = this::onCloseSheet,
    onSign = this::onSign,
    onLeave = { if (onLeaveRequested()) onBack() },
    onKeepWriting = this::onKeepWriting,
    onDiscard = onBack,
    onWriteRuleNotNow = this::onWriteRuleNotNow,
    onOpenBackingPad = this::onOpenBackingPad,
    onBackingPickChange = this::onBackingPickChange,
    onWalkBack = this::onWalkBack,
    onSetBacking = this::onSetBacking,
    onCancelBackingPad = this::onCancelBackingPad,
)

/** The tags and citations, their own acts beside the record. */
private fun PostEditActions.withSections(viewModel: PostEditViewModel) = copy(
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
)

/** The body's media: the manager, the add paths, the uploads' faults, the crops and the cover. */
private fun PostEditActions.withMedia(
    viewModel: PostEditViewModel,
    onAddMedia: () -> Unit,
    onPickCover: () -> Unit,
) = copy(
    onOpenPicked = viewModel::onOpenPicked,
    onMovePicture = viewModel::onMovePicture,
    onRemovePicture = viewModel::onRemovePicture,
    onDescribePicture = viewModel::onDescribePicture,
    onAltTextChange = viewModel::onAltTextChange,
    onAddMedia = onAddMedia,
    onDismissRefusal = viewModel::onDismissRefusal,
    onRetryUploads = viewModel::onRetryUploads,
    onRemoveFailed = viewModel::onRemoveFailed,
    onPickCover = onPickCover,
    onRemoveCover = viewModel::onRemoveCover,
    onCropBack = viewModel::onCropBack,
    onCropNext = viewModel::onCropDone,
    onCoverCropNext = viewModel::onCoverCropDone,
    onFrameAsset = viewModel::onFrameAsset,
    onCropShapeChange = viewModel::onCropShapeChange,
    onCropsChanged = viewModel::onCropsChanged,
    onCoverCropChanged = viewModel::onCoverCropChanged,
)

/** Everything the edit's surface can ask for, in one value rather than fifty parameters. */
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
    /** `Not now` under the write rule's notice. */
    val onWriteRuleNotNow: () -> Unit = {},
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
    /** `+ Add pictures · N of 10` / `+ Add pictures or a video`: the device's own picker. */
    val onAddMedia: () -> Unit = {},
    val onDismissRefusal: (Int) -> Unit = {},
    val onRetryUploads: () -> Unit = {},
    val onRemoveFailed: () -> Unit = {},
    /** `Add a cover` / `Change the cover`: the device's own picker, one picture. */
    val onPickCover: () -> Unit = {},
    val onRemoveCover: () -> Unit = {},
    val onCropBack: () -> Unit = {},
    val onCropNext: () -> Unit = {},
    val onCoverCropNext: () -> Unit = {},
    val onFrameAsset: (Int) -> Unit = {},
    val onCropShapeChange: (DraftShape) -> Unit = {},
    val onCropsChanged: (Map<String, CropSpec>) -> Unit = {},
    val onCoverCropChanged: (CropSpec) -> Unit = {},
)

/**
 * `EditCompose` / `EditComposeVideo` / `EditWords` / `EditComposeUnchanged`:
 * the post edit, one screen and one batch (`_shared.jsx` `EditComposeBody`,
 * `EditWords.jsx`, `EditComposeVideo.jsx`). The license is locked and shown
 * by name; the mark is the author's ongoing judgment and opens the seal's own
 * sheet (ruling 42). A crop raised over it — `ComposeCrop` for added
 * pictures, `CoverCrop` for the clip's face — is a stage of the edit.
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
    // The 200ms label swap counts from the press, held at the upload gate or
    // not; while it stands the back arrow and the X refuse a press and never
    // dim (EditCompose.md).
    val slowAnswer = rememberSlowAnswer(state.pressed)
    var help by remember { mutableStateOf<HelpTopic?>(null) }
    val leave = { if (!slowAnswer) actions.onLeave() }
    BackHandler(onBack = leave)
    // The system's Back over the parked pad closes it and stages nothing
    // (EditPad.md); composed after the leave handler, so it answers first.
    BackHandler(enabled = state.backingPadOpen, onBack = actions.onCancelBackingPad)
    // Over a crop, Back is the crop's own back arrow: the picture goes unused.
    BackHandler(enabled = state.cropping != null, onBack = actions.onCropBack)

    if (state.confirmingDiscard) {
        DiscardConfirm(
            subject = DiscardSubject.Edit,
            onKeepWriting = actions.onKeepWriting,
            onDiscard = actions.onDiscard,
            testTag = "post_edit_discard_confirm",
        )
    }

    val cropping = state.cropping
    if (cropping != null) {
        PostEditCrop(cropping, actions, leave)
        return
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
    // THE OPENING FOCUS (EditCompose.md: "focus lands on the stage's heading
    // AND NEVER the keyboard rises before a field is tapped"; EditWords.md:
    // "the body takes focus with its caret at the end AND the keyboard
    // rises"). The words edit's body is the one field it exists for.
    val heading = remember { FocusRequester() }
    val words = remember { FocusRequester() }
    val opened = !state.loading && !state.notFound
    val wordsStage = opened && !state.mediaBody
    LaunchedEffect(opened) {
        if (opened) runCatching { (if (wordsStage) words else heading).requestFocus() }
    }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .testTag("post_edit")
            .dataNodeSurface(),
    ) {
        WizardHeader(
            title = "Edit post",
            onBack = leave,
            backContentDescription = "Back to the post",
            onLeave = leave,
            leaveContentDescription = EDIT_LEAVE_LABEL,
            onHelp = { onHelp(HelpTopic.Editing) },
            helpContentDescription = HelpTopic.Editing.title,
            titleFocus = heading,
            testTag = "post_edit_header",
            node = POST_EDIT / "header",
        )
        // Directly under the header (FeedDeleting.md:5).
        deletionBand()

        WizardBody(gap = FIELD_GAP, top = Space.x3, bottom = Space.x2, scrollable = true) {
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
                else -> EditFields(state, actions, words)
            }
        }

        WizardFooter(gap = FIELD_GAP) { EditFoot(state, actions, slowAnswer, keyCard, onHelp) }
    }
}

/**
 * The foot: the gate over the count over the commit — or, in the commit's
 * place, the key-absent seal or the write rule's notice.
 */
@Composable
private fun EditFoot(
    state: PostEditUiState,
    actions: PostEditActions,
    slowAnswer: Boolean,
    keyCard: @Composable () -> Unit,
    onHelp: (HelpTopic) -> Unit,
) {
    EditUploadGate(
        gallery = state.gallery,
        onRetry = actions.onRetryUploads,
        testTag = "post_edit_gate",
        node = POST_EDIT / "gate",
        // EditCompose draws the pictures' gate once per upload state; the
        // clip's (EditComposeVideo) is drawn once.
        keyByState = state.gallery.clip == null,
    )
    ActsFooter(
        count = state.signedActionCount,
        onOpen = actions.onOpenActs,
        testTag = "post_edit_acts_footer",
        node = (POST_EDIT / "acts").keyed(state.actsKey()),
        sublinePart = "slow".takeIf { state.slow },
        subline = when {
            state.slow -> EDIT_SLOW_LINE
            state.countChanged -> EDIT_COUNT_CHANGED_LINE
            else -> null
        },
    )
    when {
        state.keyAbsent -> keyCard()
        // The write rule's notice takes the commit's place, its fact ending
        // on what is true for an edit, `Not now` its way out and no Retry
        // (EditCompose.md).
        state.writeRuleRefused -> EditWriteRuleNotice(
            onHelp = onHelp,
            onNotNow = actions.onWriteRuleNotNow,
            testTagPrefix = "post_edit",
        )
        // Inert, never hidden, at an empty batch; enabled while uploads run —
        // a press there is held — and disabled at the gate's fault reading;
        // a press while the signing is out or held is refused without the
        // button dimming.
        else -> CograButton(
            text = signLabel(slowAnswer),
            onClick = { if (!state.pressed) actions.onSign() },
            enabled = state.canSign || state.pressed,
            modifier = Modifier.fillMaxWidth(),
            testTag = (POST_EDIT / "sign").keyed(state.signKey()).tag,
        )
    }
}

@Composable
private fun EditFields(state: PostEditUiState, actions: PostEditActions, words: FocusRequester) {
    WordsOrMedia(state, actions, words)
    TitleAndDescription(state, actions)
    TagsAndReferences(state, actions)
    Terms(state, actions)
}

@Composable
private fun WordsOrMedia(state: PostEditUiState, actions: PostEditActions, words: FocusRequester) {
    val clip = state.gallery.clip
    when {
        clip != null -> {
            // `EditComposeVideo`: the clip, which stays or leaves whole, and
            // its cover — a new face is a new picture, never a new clip.
            ClipField(
                clip = clip,
                onRemove = { actions.onRemovePicture(0) },
                onDescribe = { actions.onDescribePicture(0) },
                testTagPrefix = "post_edit",
                note = CLIP_WHOLE_POST_LINE,
                node = POST_EDIT / "video",
            )
            CoverField(
                gallery = state.gallery,
                onPick = actions.onPickCover,
                onRetry = actions.onRetryUploads,
                onRemoveCover = actions.onRemoveCover,
                testTagPrefix = "post_edit",
                doorNote = true,
                node = POST_EDIT / "cover",
            )
        }
        state.mediaBody -> PicturesBody(state, actions)
        else -> WordsBody(state, actions, words)
    }
}

/**
 * `EditCompose`'s body: the picked row — the edit's row is the compose row,
 * the first tile its cover, and the whole row opens Show all (`EditPicked`) —
 * then what failed, what was refused, the add control and the body's rule.
 */
@Composable
private fun PicturesBody(state: PostEditUiState, actions: PostEditActions) {
    val body = POST_EDIT / "body"
    Column(Modifier.fillMaxWidth().dataNode(body), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        val count = state.gallery.size
        PickedRow(
            pictures = state.gallery.pickedPictures(),
            caption = "${if (count == 1) "1 picture" else "$count pictures"} — the body",
            onManage = actions.onOpenPicked,
            manageLabel = if (count == 1) "Manage the picture" else "Manage the $count pictures",
            testTag = "post_edit_picked",
            node = (body / "mediaRow").keyed(state.gallery.uploadKey()),
        )
        EditUploadErrorLine(
            gallery = state.gallery,
            onRetry = actions.onRetryUploads,
            onRemove = actions.onRemoveFailed,
            testTag = "post_edit_upload_error",
            node = body / "uploadError",
        )
        RefusedFileRows(state.refused, actions.onDismissRefusal, testTagPrefix = "post_edit")
        InlineAction(
            text = "+ Add pictures · $count of ${PostEditUiState.MAX_PICTURES}",
            onClick = actions.onAddMedia,
            size = InlineSize.Small,
            testTag = "post_edit_add_pictures",
            node = body / "add",
        )
        BodyRule(body)
    }
}

/** `EditWords`' body: the words, and the way back to a media body under them. */
@Composable
private fun WordsBody(state: PostEditUiState, actions: PostEditActions, words: FocusRequester) {
    val body = POST_EDIT / "body"
    Column(Modifier.fillMaxWidth().dataNode(body), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        CograTextField(
            value = state.body,
            onValueChange = actions.onBodyChange,
            label = "What do you want to publish?",
            singleLine = false,
            minLines = 6,
            modifier = Modifier.fillMaxWidth(),
            cap = MAX_POST_BODY_CHARS,
            error = WORDS_OVER_CAP_LINE.takeIf { state.bodyTooLong },
            focusRequester = words,
            testTag = "post_edit_words",
            node = body / "words",
        )
        RefusedFileRows(state.refused, actions.onDismissRefusal, testTagPrefix = "post_edit")
        InlineAction(
            text = "+ Add pictures or a video",
            onClick = actions.onAddMedia,
            size = InlineSize.Small,
            testTag = "post_edit_add_media",
        )
        BodyRule(body)
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
        error = stringResource(R.string.content_error_title_too_long).takeIf { state.titleTooLong },
        testTag = "post_edit_title",
        node = POST_EDIT / "title",
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
            error = stringResource(R.string.content_error_description_too_long)
                .takeIf { state.descriptionTooLong },
            testTag = "post_edit_description",
            node = POST_EDIT / "description",
        )
    }
}

@Composable
private fun TagsAndReferences(state: PostEditUiState, actions: PostEditActions) {
    val tags = POST_EDIT / "tags"
    EditFieldGroup(label = "Tags", node = tags) {
        TopicEntry(
            section = state.tagSection,
            testTagPrefix = "post_edit",
            node = tags,
            wearsRoot = false,
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
                node = tags / "withdrawn",
            )
        }
    }

    val references = POST_EDIT / "references"
    EditFieldGroup(label = "References", node = references) {
        ReferenceEntry(
            section = state.referenceSection,
            testTagPrefix = "post_edit",
            node = references,
            wearsRoot = false,
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
                node = references / "withdrawn",
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
    val facts = POST_EDIT / "facts"
    // The three rows are one block on the board (`facts`), stacked in the
    // edit's own field rhythm.
    Column(
        modifier = Modifier.fillMaxWidth().dataNode(facts),
        verticalArrangement = Arrangement.spacedBy(FIELD_GAP),
    ) {
        FactRows(state, actions, facts)
    }

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

@Composable
private fun FactRows(state: PostEditUiState, actions: PostEditActions, facts: DataNode) {
    LockedLicenseRow(
        name = licenseName(state.license.attribution, state.license.provenance),
        testTag = "post_edit_license",
        node = facts / "license",
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
        node = facts / "backing",
    ) {
        when (val withEdit = state.backingWithEdit) {
            is BackingValue.Read -> AttachmentReadout(
                pDirected = withEdit.value,
                testTag = "post_edit_backing_value",
                node = facts / "backing" / "value",
            )
            // The backing read served none or failed: the row draws it
            // unread rather than guess.
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
        node = facts / "sensitive",
    )
    Hairline()
}

/** The body's rule in the quiet voice (`QuietNote`, `_shared.jsx` `EditComposeBody`). */
@Composable
private fun BodyRule(body: DataNode) {
    QuietNote(text = BODY_RULE_LINE, modifier = Modifier.dataNode(body / "rule"))
}

/** Every drawer the edit can open — one at a time, in the one sheet host. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PostEditSheets(state: PostEditUiState, actions: PostEditActions, onHelp: (HelpTopic) -> Unit) {
    if (!state.anySheetOpen) return
    CograSheetHost(onDismissRequest = actions.onCloseSheet) {
        val describing = state.describingIndex?.let { state.gallery.pictures.getOrNull(it) }
        when {
            describing != null -> DescribeSheet(
                item = describing.describeItem(),
                value = describing.altText,
                onValueChange = { text -> actions.onAltTextChange(state.describingIndex ?: 0, text) },
                onDone = actions.onCloseSheet,
                video = describing.isClip(),
                cap = MAX_ALT_TEXT_CHARS,
                tooLongMessage = describeTooLong(describing.isClip()),
                testTag = "post_edit_describe_sheet",
            )
            state.pickedOpen -> PickedSheet(
                pictures = state.gallery.pickedPictures(),
                onDescribe = actions.onDescribePicture,
                onRemove = actions.onRemovePicture,
                onMove = actions.onMovePicture,
                onDone = actions.onCloseSheet,
                testTag = "post_edit_picked_sheet",
                node = POST_EDIT / "pickedSheet",
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

/** What the describe sheet previews: a kept picture or clip as served, an added picture as picked. */
internal fun EditPicture.describeItem(): MediaItem = when (this) {
    is EditPicture.Kept -> asset.toItem()
    is EditPicture.Added -> MediaItem(asset.uri, asset.sourceRatio ?: 1f, asset.altText.ifBlank { null })
}

/** A clip takes one description, read as the video's (DescribeSheet's other shape). */
internal fun EditPicture.isClip(): Boolean = this is EditPicture.Kept && asset.isVideo

/** The one line the edit shows when a submit did not go through. */
internal fun PostEditUiState.problem(): String? = when {
    refusal != null -> refusal
    transportFailed -> "Can't reach the server. Check the connection and retry."
    signingFailed -> "Signing did not finish — the write stays pending."
    else -> null
}

/** `EditCompose`'s registered prefix: every post edit board (seam 248). */
internal val POST_EDIT = DataNode("postEdit")

/** The board's `upload` chip value for what the edit is uploading. */
internal fun EditGallery.uploadKey(): String = when {
    uploadsFailed > 0 -> "failed"
    uploadsPending > 0 -> "uploading"
    else -> "none"
}

/**
 * The foot's key: EditCompose draws it once per `signing` value, and
 * EditComposeVideo once per `upload` value while the clip's cover goes up.
 */
private fun PostEditUiState.actsKey(): String = when {
    slow -> "slow"
    gallery.clip != null && gallery.uploadsPending > 0 -> "uploading"
    else -> "none"
}

/** The commit's key: EditCompose draws it at rest, slow, and disabled by a failed upload. */
private fun PostEditUiState.signKey(): String = when {
    slow -> "slow"
    gallery.uploadsFailed > 0 -> "failed"
    else -> "none"
}

/** The edit's fields stand 14 apart (`EditComposeBody`, `CommentEditBody`: `gap: 14`). */
internal val FIELD_GAP = 14.dp

/** A crop raised over the post edit — ComposeCrop for pictures on their way in, CoverCrop for the clip's face. */
@Composable
private fun PostEditCrop(cropping: EditCrop, actions: PostEditActions, leave: () -> Unit) {
    EditCropStage(
        crop = cropping,
        actions = EditCropActions(
            onBack = actions.onCropBack,
            onLeave = leave,
            onNext = if (cropping is EditCrop.Cover) actions.onCoverCropNext else actions.onCropNext,
            onFrameAsset = actions.onFrameAsset,
            onShapeChange = actions.onCropShapeChange,
            onCropsChanged = actions.onCropsChanged,
            onCoverCropChanged = actions.onCoverCropChanged,
        ),
        testTagPrefix = "post_edit",
    )
}
