package com.cogra.feature.content.wizard

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.AskDialog
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.compose.DescribeSheet
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.PickedSheet
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.LicenseChoice
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MAX_ALT_TEXT_CHARS
import com.cogra.feature.content.CitedSheet
import com.cogra.feature.content.ParkedPadWash
import com.cogra.feature.content.R
import com.cogra.feature.content.ReferenceCandidateRow
import com.cogra.feature.content.ReferenceEntry
import com.cogra.feature.content.TagsSheet
import com.cogra.feature.content.TopicEntry
import com.cogra.feature.content.UnreachableStartConfirm
import com.cogra.feature.content.parkedPadPlacement

/**
 * The compose wizard's route: one destination, four stages, and the
 * outcomes the surfaces around it act on.
 *
 * `ComposeLanded` and `ComposeExpired` are not drawn here. Both boards
 * put their notice on the surface the author returns to — the signed
 * post carries the snackbar, the feed carries the "didn't land" card —
 * so the wizard reports the outcome and leaves.
 */
@Composable
fun ComposeWizardRoute(
    referenceTargetId: String?,
    onSigned: (nodeId: String) -> Unit,
    onExpired: (label: String) -> Unit,
    onLeave: () -> Unit,
    onRestoreKey: () -> Unit,
    /**
     * The husk banner the shell rides above every write surface until
     * the key is restored. The seal's own `ComposeKeyAbsent` card is
     * the *last* word on a missing key; this is the first, and a
     * writer should learn before they have filled in four stages.
     */
    keyBanner: @Composable () -> Unit = {},
    /** The deletion band, while the account's confirmed deletion is in its grace (`FeedDeleting.md:3`). */
    deletionBand: @Composable () -> Unit = {},
    viewModel: ComposeWizardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.start(referenceTargetId) }

    // The last moment the process is guaranteed to be alive. The draft is
    // already written continuously as the author works; this closes the
    // window between the final keystroke and a background kill.
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { viewModel.persistNow() }

    LaunchedEffect(state.outcome) {
        when (val outcome = state.outcome) {
            is WizardOutcome.Landed -> {
                viewModel.onOutcomeConsumed()
                onSigned(outcome.nodeId)
            }
            is WizardOutcome.Expired -> {
                viewModel.onOutcomeConsumed()
                onExpired(outcome.label)
            }
            WizardOutcome.DraftKept, WizardOutcome.Discarded -> {
                viewModel.onOutcomeConsumed()
                onLeave()
            }
            null -> Unit
        }
    }

    // The system photo picker, behind the board's own "Your photos app"
    // tile — the second way in, beside the in-app grid, and the one that
    // never needs a permission
    // (developer.android.com/training/data-storage/shared/photopicker).
    // It lives on the route rather than in the screen so the screen
    // stays stateless and previewable.
    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(ComposeWizardState.MAX_POST_ASSETS),
    ) { uris -> viewModel.onPickBatch(uris.map { it.toString() }) }

    // `ComposeCover`'s "A picture" tile: one picture, images only. A
    // cover is a still by contract — "it must be an image rather than
    // another video" — so this launcher says so rather than filtering a
    // video out after the fact.
    val coverPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri -> uri?.let { viewModel.onPickCoverPicture(it.toString()) } }

    // The in-app grid's permission, which the pick stage draws around
    // the grid rather than in front of it.
    val permission = rememberMediaPermission(onGranted = viewModel::onMediaPermissionGranted)

    ComposeWizardScreen(
        state = state,
        permission = permission,
        onBodyChange = viewModel::onBodyChange,
        onModeChange = viewModel::onModeChange,
        onOpenPicker = {
            // Pictures *and* video: "Pick one picture, several, or one
            // video" (`ComposePick`). The one-video-or-ten-pictures rule
            // is the toggle's, not the picker's — the system picker has
            // no way to express it.
            picker.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo),
            )
        },
        onTogglePick = viewModel::onTogglePick,
        onShapeChange = viewModel::onShapeChange,
        onFrameAsset = viewModel::onFrameAsset,
        onCropsChanged = viewModel::onCropsCommitted,
        onPickCoverFrame = viewModel::onPickCoverFrame,
        onOpenCoverPicker = {
            coverPicker.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
            )
        },
        onOpenCoverStep = viewModel::onOpenCoverStep,
        onDismissRefusal = viewModel::onDismissRefusal,
        onTitleChange = viewModel::onTitleChange,
        onDescriptionChange = viewModel::onDescriptionChange,
        onAltTextChange = viewModel::onAltTextChange,
        onRetryUpload = viewModel::onRetryUpload,
        onOpenSheet = viewModel::onOpenSheet,
        onCloseSheet = viewModel::onCloseSheet,
        onLicenseChange = viewModel::onLicenseChange,
        onPDirectedChange = viewModel::onPDirectedChange,
        onSetStance = viewModel::onSetStance,
        onKeepAdjusting = viewModel::onKeepAdjusting,
        onSetUnreachable = viewModel::onSetUnreachable,
        onSensitiveChange = viewModel::onSensitiveChange,
        onSensitiveReasonChange = viewModel::onSensitiveReasonChange,
        onNext = viewModel::onNext,
        onBack = { if (!viewModel.onBack()) viewModel.onLeave() },
        onLeave = viewModel::onLeave,
        onSealBack = viewModel::onSealBack,
        onManagePictures = viewModel::onOpenPickedSheet,
        onDescribePictures = viewModel::onDescribeFirst,
        onDescribeAt = viewModel::onDescribe,
        onMovePick = viewModel::onMovePick,
        onRemovePickAt = viewModel::onRemovePickAt,
        onOpenHelp = viewModel::onOpenHelp,
        onCloseHelp = viewModel::onCloseHelp,
        onSign = viewModel::onSign,
        onRetryFailedUploads = viewModel::onRetryFailedUploads,
        onDiscardPost = viewModel::onDiscardPost,
        onKeepPost = viewModel::onKeepPost,
        onDiscardConfirmed = viewModel::onDiscardConfirmed,
        onKeepBody = viewModel::onKeepBody,
        onDiscardBody = viewModel::onDiscardBody,
        onAskDiscardDraft = viewModel::onAskDiscardDraft,
        onKeepDraftOffer = viewModel::onKeepDraftOffer,
        onContinueDraft = viewModel::onContinueDraft,
        onDiscardDraft = viewModel::onDiscardDraft,
        onRestoreKey = onRestoreKey,
        onKeepDraft = viewModel::onLeave,
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
        keyBanner = keyBanner,
        deletionBand = deletionBand,
    )
}

/**
 * The stateless wizard.
 *
 * The header's title and trailing action come from the stage, exactly
 * as the boards draw them: `New post` with `Next` on the body, `Crop`
 * with `Next`, `Details` with no header action (its `Next` is the pill
 * at the bottom), and `What you sign` with `Last step` as a note rather
 * than an action.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ComposeWizardScreen(
    state: ComposeWizardState,
    permission: MediaPermissionController,
    onBodyChange: (String) -> Unit,
    onModeChange: (BodyMode) -> Unit,
    onOpenPicker: () -> Unit,
    onTogglePick: (String) -> Unit,
    onShapeChange: (DraftShape) -> Unit,
    onFrameAsset: (Int) -> Unit,
    onCropsChanged: (Map<String, CropSpec>) -> Unit,
    onPickCoverFrame: (Int) -> Unit,
    onOpenCoverPicker: () -> Unit,
    onOpenCoverStep: () -> Unit,
    onDismissRefusal: (Int) -> Unit,
    onTitleChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onAltTextChange: (String, String) -> Unit,
    onRetryUpload: (String) -> Unit,
    onOpenSheet: (SealSheet) -> Unit,
    onCloseSheet: () -> Unit,
    onLicenseChange: (LicenseChoice) -> Unit,
    onPDirectedChange: (Double) -> Unit,
    onSetStance: () -> Unit,
    onKeepAdjusting: () -> Unit,
    onSetUnreachable: () -> Unit,
    onSensitiveChange: (Boolean) -> Unit,
    onSensitiveReasonChange: (String) -> Unit,
    onNext: () -> Unit,
    onBack: () -> Unit,
    onLeave: () -> Unit,
    onSealBack: () -> Unit,
    onManagePictures: () -> Unit,
    onDescribePictures: () -> Unit,
    onDescribeAt: (Int) -> Unit,
    onMovePick: (Int, Int) -> Unit,
    onRemovePickAt: (Int) -> Unit,
    onOpenHelp: (HelpTopic) -> Unit,
    onCloseHelp: () -> Unit,
    onSign: () -> Unit,
    onRetryFailedUploads: () -> Unit,
    onDiscardPost: () -> Unit,
    onKeepPost: () -> Unit,
    onDiscardConfirmed: () -> Unit,
    onKeepBody: () -> Unit,
    onDiscardBody: () -> Unit,
    onAskDiscardDraft: () -> Unit,
    onKeepDraftOffer: () -> Unit,
    onContinueDraft: () -> Unit,
    onDiscardDraft: () -> Unit,
    onRestoreKey: () -> Unit,
    onKeepDraft: () -> Unit,
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
    keyBanner: @Composable () -> Unit = {},
    modifier: Modifier = Modifier,
    deletionBand: @Composable () -> Unit = {},
) {
    // Back is the header's arrow and the system gesture alike, and both
    // step back one stage (jakob 2026-08-31). Leaving happens from the
    // first stage, where there is no earlier stage to reach; the draft
    // survives either way, being written continuously rather than on exit.
    BackHandler(onBack = onBack)

    Box(modifier = modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize().testTag("compose_wizard").dataNodeSurface()) {
            WizardHeader(
                title = state.headerTitle(),
                onBack = onBack,
                // THE FIRST STAGE'S ARROW LEAVES THE FLOW, so it is named
                // `Back`, never `Back a step` (round 22, seam 245 ask 13 D;
                // ComposePick.md): there is no stage behind it.
                backContentDescription = if (state.step == WizardStep.Body) "Back" else "Back a step",
                // The X leaves from any stage, draft kept, nothing to confirm.
                onLeave = onLeave,
                // `ComposeSeal` says "Last step"; `ComposeCover` says
                // "Video only" — each board's own trailing note.
                trailingNote = when (state.step) {
                    WizardStep.Seal -> "Last step"
                    WizardStep.Cover -> "Video only"
                    else -> null
                },
                // The seal's `?`, `How signing works`. It stays beside a notice
                // that carries its own (the stopper exception, ComposeKeyAbsent),
                // and stays live while the seal signs (SealSigning.md).
                onHelp = if (state.step == WizardStep.Seal) {
                    { onOpenHelp(HelpTopic.HowSigningWorks) }
                } else {
                    null
                },
                helpContentDescription = HelpTopic.HowSigningWorks.title,
                testTag = "wizard_header",
                // Only the details stage is a registered board; the other
                // stages' header keeps its wizard tags.
                node = (COMPOSE_DETAILS / "header").takeIf { state.step == WizardStep.Details },
            )

            // Directly under the header (FeedDeleting.md:5).
            deletionBand()

            keyBanner()

            state.draftOffer?.let { held ->
                DraftOffer(draft = held, onContinue = onContinueDraft, onDiscard = onDiscardDraft)
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
            ) {
                when (state.step) {
                    WizardStep.Body -> BodyStage(
                        state = state,
                        permission = permission,
                        onBodyChange = onBodyChange,
                        onModeChange = onModeChange,
                        onOpenPicker = onOpenPicker,
                        onTogglePick = onTogglePick,
                        onManagePictures = onManagePictures,
                        onDismissRefusal = onDismissRefusal,
                        onNext = onNext,
                        onAskDiscardDraft = onAskDiscardDraft,
                    )

                    WizardStep.Crop -> {
                        WizardBody(scrollable = true, bottom = 0.dp) {
                            CropStepBody(
                                state = state,
                                onShapeChange = onShapeChange,
                                onFrameAsset = onFrameAsset,
                                onCropsChanged = onCropsChanged,
                            )
                        }
                        // `ComposeCrop` ends on the pill. It sits below the
                        // scrolling body rather than inside it: the stage
                        // scrolls so the crop's required non-drag route stays
                        // reachable (D17), and a weighted spacer cannot push
                        // anything to the bottom of a column of unbounded
                        // height. Where the stage fits, this is the board.
                        WizardFooter {
                            CograButton(
                                text = "Next",
                                onClick = onNext,
                                modifier = Modifier.fillMaxWidth(),
                                testTag = "wizard_crop_next",
                            )
                        }
                    }

                    WizardStep.Cover -> {
                        // `ComposeCover`: the column stands `16px 24px` under the header.
                        WizardBody(scrollable = true, top = Space.x4, bottom = 0.dp) {
                            CoverStepBody(
                                state = state,
                                onPickFrame = onPickCoverFrame,
                                onPickPicture = onOpenCoverPicker,
                            )
                        }
                        // `ComposeCover` ends on the pill, below the body for
                        // the same reason the crop stage does.
                        WizardFooter {
                            CograButton(
                                text = "Next",
                                onClick = onNext,
                                modifier = Modifier.fillMaxWidth(),
                                testTag = "wizard_cover_next",
                            )
                        }
                    }

                    WizardStep.Details -> WizardBody(top = Space.x3, bottom = Space.x4) {
                        DetailsStepBody(
                            state = state,
                            onTitleChange = onTitleChange,
                            onDescriptionChange = onDescriptionChange,
                            onRetryUpload = onRetryUpload,
                            onRemovePick = onRemovePickAt,
                            onManagePictures = onManagePictures,
                            onDescribePictures = onDescribePictures,
                            // The door opens the step a vertical clip
                            // skipped (`give-a-vertical-clip-a-cover`).
                            onCover = onOpenCoverStep,
                            topics = {
                                // The 2.3 section, embedded rather than
                                // rebuilt: only its surroundings changed.
                                TopicEntry(
                                    section = state.tagSection,
                                    testTagPrefix = "wizard",
                                    onTagInputChange = onTagInputChange,
                                    onAddTag = onAddTag,
                                    onRemoveTag = onRemoveTag,
                                    onTuneTag = onTuneTag,
                                    onDoneTuningTag = onDoneTuningTag,
                                    onTagRelevanceChange = onTagRelevanceChange,
                                    onTagConfidenceChange = onTagConfidenceChange,
                                    // A chip opens `TagPadCompose`'s sheet (ComposeDetails.md).
                                    pairSheet = true,
                                    staged = true,
                                    node = COMPOSE_DETAILS / "tags",
                                )
                            },
                            references = {
                                ReferenceEntry(
                                    section = state.referenceSection,
                                    testTagPrefix = "wizard",
                                    onOpenFinder = onOpenFinder,
                                    onCloseFinder = onCloseFinder,
                                    onFinderQueryChange = onFinderQueryChange,
                                    onPickReference = onPickReference,
                                    onRemoveReference = onRemoveReference,
                                    onTuneReference = onTuneReference,
                                    onDoneTuningReference = onDoneTuningReference,
                                    onReferenceRelevanceChange = onReferenceRelevanceChange,
                                    onReferenceSupportChange = onReferenceSupportChange,
                                    // A staged citation opens `RefPair`'s sheet.
                                    pairSheet = true,
                                    staged = true,
                                    node = COMPOSE_DETAILS / "references",
                                )
                            },
                        )
                        // `ComposeUploading`: the aside stands ABOVE Next, out of the
                        // scrolling body, only while an upload runs.
                        if (state.mode == BodyMode.Media && state.uploadsRunning) UploadAside()
                        CograButton(
                            text = "Next",
                            onClick = onNext,
                            enabled = !state.titleTooLong && !state.descriptionTooLong,
                            modifier = Modifier.fillMaxWidth(),
                            testTag = (COMPOSE_DETAILS / "next").tag,
                        )
                    }

                    WizardStep.Seal -> {
                        SealStage(
                            state = state,
                            actions = SealActions(
                                onOpenSheet = onOpenSheet,
                                onSign = onSign,
                                onBack = onSealBack,
                                onRestoreKey = onRestoreKey,
                                onKeepDraft = onKeepDraft,
                                onHelp = onOpenHelp,
                                onRetryUploads = onRetryFailedUploads,
                                onRemoveRefused = onRemoveReference,
                                // The report page Settings opens is not built
                                // on android (HAND TO FABLE).
                                onReport = {},
                                onDiscardPost = onDiscardPost,
                            ),
                        )
                    }
                }
            }
        }

        // THE PAD PARKS OVER THE PAGE, and the wash covers the seal
        // beneath it — `ComposePad.jsx:31-47`, under the rule
        // design/readme.md §"Fixed elements" gives every pad in the
        // product: the lower centre of the viewport, the same place every
        // time, because muscle memory is part of the control.
        //
        // It is deliberately NOT in the sheet host: a drawer would draw a
        // second sheet chrome around it (F2-10) and would park it wherever
        // the drawer happened to stop. The reply seal's pad already works
        // this way.
        if (state.padOpen) {
            // The wash is the outside press: it stages nothing.
            ParkedPadWash(onDismiss = onCloseSheet, testTag = "wizard_pad_wash")
            ComposePad(
                pDirected = state.stagedPDirected,
                onChange = onPDirectedChange,
                onSet = onSetStance,
                onCancel = onCloseSheet,
                onHelp = { onOpenHelp(HelpTopic.YourBackingOnYourPost) },
                modifier = parkedPadPlacement(),
            )
            // Set at exactly 0.00 asks first; the pad stays parked beneath.
            if (state.confirmingUnreachable) {
                UnreachableStartConfirm(
                    onKeepAdjusting = onKeepAdjusting,
                    onSetAnyway = onSetUnreachable,
                    testTag = "wizard_unreachable",
                )
            }
        }
    }

    // Every drawer over the wizard, one at a time. `PickedSheet` and
    // `DescribeSheet` open over the pick and details stages; the license
    // and the sensitive mark over the seal.
    if (state.anySheetOpen) {
        CograSheetHost(onDismissRequest = onCloseSheet) {
            val describing = state.describingIndex?.let { state.picked.getOrNull(it) }
            when {
                describing != null -> DescribeSheet(
                    item = MediaItem(
                        describing.uri,
                        describing.sourceRatio ?: 1f,
                        describing.altText.ifBlank { null },
                        // Describing the picture the post will carry —
                        // the framed one, not the original it came from.
                        state.crops[describing.uri].toFraming(),
                    ),
                    value = describing.altText,
                    onValueChange = { onAltTextChange(describing.uri, it) },
                    onDone = onCloseSheet,
                    onHelp = { onOpenHelp(HelpTopic.DescribingPictures) },
                    video = describing.isVideo,
                    cap = MAX_ALT_TEXT_CHARS,
                    tooLongMessage = describeTooLong(describing.isVideo),
                    testTag = "wizard_describe_sheet",
                )

                state.pickedSheetOpen -> PickedSheet(
                    pictures = state.pickedPictures(),
                    onDescribe = onDescribeAt,
                    onRemove = onRemovePickAt,
                    onMove = onMovePick,
                    onDone = onCloseSheet,
                    testTag = "wizard_picked_sheet",
                )

                // Staged: Done carries the pair to the seal's row; every
                // other way out discards (ComposeLicense.md).
                state.sheet == SealSheet.License ->
                    LicenseSheet(
                        license = state.license,
                        onDone = { picked ->
                            onLicenseChange(picked)
                            onCloseSheet()
                        },
                        onHelp = { onOpenHelp(HelpTopic.License) },
                    )

                state.sheet == SealSheet.Sensitive -> SensitiveSheet(
                    marked = state.sensitive,
                    reason = state.sensitiveReason,
                    onMarkedChange = onSensitiveChange,
                    onReasonChange = onSensitiveReasonChange,
                    onDone = onCloseSheet,
                    onHelp = { onOpenHelp(HelpTopic.MarkingAsSensitive) },
                )

                // `ComposeCitations` — what the seal's "N cited" row opens. It
                // manages the set the details stage staged and never offers
                // another pick.
                state.sheet == SealSheet.Cited -> CitedSheet(
                    section = state.referenceSection,
                    onRemoveReference = onRemoveReference,
                    onTuneReference = onTuneReference,
                    onDoneTuningReference = onDoneTuningReference,
                    onReferenceRelevanceChange = onReferenceRelevanceChange,
                    onReferenceSupportChange = onReferenceSupportChange,
                    onDone = onCloseSheet,
                    testTag = "wizard_cited_sheet",
                )

                // `ComposeTags` — what the seal's "N tags" row opens.
                state.sheet == SealSheet.Tags -> TagsSheet(
                    section = state.tagSection,
                    onRemoveTag = onRemoveTag,
                    onTuneTag = onTuneTag,
                    onDoneTuningTag = onDoneTuningTag,
                    onTagRelevanceChange = onTagRelevanceChange,
                    onTagConfidenceChange = onTagConfidenceChange,
                    onDone = onCloseSheet,
                    testTag = "wizard_tags_sheet",
                )

                else -> Unit
            }
        }
    }

    // `Discard the words?` / `the pictures?` / `the video?` — the body fork's
    // ask (ComposeBodyDiscard.md): the rest of the draft stays.
    state.askingBodySwitch?.let { next ->
        val clip = next == BodyMode.Words && state.isVideoPost
        AskDialog(
            title = when {
                next == BodyMode.Media -> "Discard the words?"
                clip -> "Discard the video?"
                else -> "Discard the pictures?"
            },
            body = "The rest of the draft stays.",
            keepLabel = if (clip) "Keep it" else "Keep them",
            discardLabel = "Discard",
            onKeep = onKeepBody,
            onDiscard = onDiscardBody,
            testTag = "wizard_body_discard",
        )
    }

    // `Discard your draft?`, raised from the dimmed roll (ComposeDraftDiscard).
    if (state.askingDraftDiscard) {
        AskDialog(
            title = "Discard your draft?",
            body = "Picking pictures starts a new post, and this draft is what stands in the way. " +
                "Discarding is the only thing that loses it.",
            keepLabel = "Keep the draft",
            discardLabel = "Discard it",
            onKeep = onKeepDraftOffer,
            onDiscard = onDiscardDraft,
            testTag = "wizard_draft_discard_ask",
        )
    }

    // `Discard this post?` over the seal's bug notice (SealDiscardConfirm):
    // the keep answer filled, the scrim and Back keep the draft.
    if (state.discardingPost) {
        AskDialog(
            title = "Discard this post?",
            body = "The draft goes, with its pictures, tags and citations. Nothing was signed, " +
                "so nothing else changes.",
            keepLabel = "Keep the draft",
            discardLabel = "Discard it",
            onKeep = onKeepPost,
            onDiscard = onDiscardConfirmed,
            testTag = "wizard_discard_post_ask",
        )
    }

    // The screen's one `?`, over whatever is showing. A dialog rather than
    // a sheet: it explains the surface behind it rather than continuing it.
    state.help?.let { topic ->
        HelpDialog(
            title = topic.title,
            paragraphs = topic.paragraphs,
            onClose = onCloseHelp,
            testTag = "wizard_help_dialog",
        )
    }
}

/**
 * `ComposeWords` and `ComposePick` share the caption band above them,
 * and nothing else: the words half sits in the 24dp screen gutter like
 * a form, and the picker's grid runs to a 4dp margin like a sheet of
 * pictures, so the pick stage lays itself out rather than borrowing
 * [WizardBody].
 */
@Composable
private fun ColumnScope.BodyStage(
    state: ComposeWizardState,
    permission: MediaPermissionController,
    onBodyChange: (String) -> Unit,
    onModeChange: (BodyMode) -> Unit,
    onOpenPicker: () -> Unit,
    onTogglePick: (String) -> Unit,
    onManagePictures: () -> Unit,
    onDismissRefusal: (Int) -> Unit,
    onNext: () -> Unit,
    onAskDiscardDraft: () -> Unit,
) {
    when (state.mode) {
        BodyMode.Words -> {
            WizardCaption(
                text = "The body is your words.",
                actionText = "Add pictures instead",
                onAction = { onModeChange(BodyMode.Media) },
                actionTestTag = "wizard_switch_media",
            )
            WizardBody(gap = Space.x1) {
                WordsStepBody(state, onBodyChange)
                // `ComposeWords` closes the field's own column with the
                // pill, 12dp under the field — the column's 4dp rhythm
                // plus this 8.
                CograButton(
                    text = "Next",
                    onClick = onNext,
                    enabled = state.forwardEnabled(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = Space.x2),
                    testTag = "wizard_words_next",
                )
            }
        }
        BodyMode.Media -> {
            WizardCaption(
                // `ComposeDraft` re-words the caption behind its offer and
                // drops the branch: with a draft on the table the question
                // is that draft, and the grid below it is the alternative.
                // The short form is jakob's (2026-08-31) — the dash points
                // at the grid, which says "pick pictures" better than a
                // sentence repeating the fresh-composer caption could.
                text = if (state.draftOffer != null) {
                    "Or start fresh —"
                } else {
                    "Pick one picture, several, or one video."
                },
                actionText = "Write words instead".takeIf { state.draftOffer == null },
                onAction = { onModeChange(BodyMode.Words) },
                actionTestTag = "wizard_switch_words",
            )
            PickHalf(
                state = state,
                permission = permission,
                onOpenPicker = onOpenPicker,
                onTogglePick = onTogglePick,
                onManagePictures = onManagePictures,
                onDismissRefusal = onDismissRefusal,
                onNext = onNext,
                onAskDiscardDraft = onAskDiscardDraft,
            )
        }
    }
}

/**
 * The pick stage under its caption: the roll and its Next, or — while a kept
 * draft is offered — the roll waiting under its shield (`ComposeDraftBody`).
 */
@Suppress("LongParameterList") // one callback per thing the stage answers
@Composable
private fun ColumnScope.PickHalf(
    state: ComposeWizardState,
    permission: MediaPermissionController,
    onOpenPicker: () -> Unit,
    onTogglePick: (String) -> Unit,
    onManagePictures: () -> Unit,
    onDismissRefusal: (Int) -> Unit,
    onNext: () -> Unit,
    onAskDiscardDraft: () -> Unit,
) {
    if (state.draftOffer != null) {
        // THE ROLL, WAITING (`ComposeDraftBody`): dimmed to 55% and out
        // of reach, with ONE control over it named for what it will
        // ask — so a tap, a keyboard and a screen reader reach the same
        // answer (ComposeDraft.md), and the tiles underneath stay
        // unreachable.
        Box(Modifier.fillMaxWidth().weight(1f)) {
            Column(
                Modifier
                    .fillMaxSize()
                    .alpha(DIMMED)
                    .clearAndSetSemantics { },
            ) {
                PickStage(
                    state = state,
                    permission = permission.permission,
                    onRequestPermission = permission.request,
                    onOpenSettings = permission.openSettings,
                    onOpenPicker = onOpenPicker,
                    onTogglePick = onTogglePick,
                    onShowAll = onManagePictures,
                    onDismissRefusal = onDismissRefusal,
                )
            }
            Box(
                Modifier
                    .matchParentSize()
                    .clickable(role = Role.Button, onClick = onAskDiscardDraft)
                    .semantics { contentDescription = "Answer your draft before starting a new post" }
                    .testTag("wizard_draft_shield"),
            )
        }
    } else {
        PickStage(
            state = state,
            permission = permission.permission,
            onRequestPermission = permission.request,
            onOpenSettings = permission.openSettings,
            onOpenPicker = onOpenPicker,
            onTogglePick = onTogglePick,
            onShowAll = onManagePictures,
            onDismissRefusal = onDismissRefusal,
        )
        // `ComposePick` and `ComposePicked` both close on the pill in
        // its own band under the grid — the grid runs to its own
        // margin, so the band carries the screen gutter itself.
        WizardFooter {
            CograButton(
                text = "Next",
                onClick = onNext,
                enabled = state.forwardEnabled(),
                modifier = Modifier.fillMaxWidth(),
                testTag = "wizard_pick_next",
            )
        }
    }
}

private const val DIMMED = 0.55f

/** The stage's own name — no step counter, per design/readme.md §13. */
internal fun ComposeWizardState.headerTitle(): String = when (step) {
    WizardStep.Body -> "New post"
    WizardStep.Crop -> "Crop"
    WizardStep.Cover -> "The video's face"
    WizardStep.Details -> "Details"
    WizardStep.Seal -> "What you sign"
}

/**
 * Whether the stage's bottom Next may be taken.
 *
 * The body can be unready and the details can carry an over-long title;
 * the crop stage always has somewhere to go, and the seal commits by
 * signing rather than by Next.
 */
internal fun ComposeWizardState.forwardEnabled(): Boolean = when (step) {
    WizardStep.Body -> bodyReady
    WizardStep.Details -> !titleTooLong && !descriptionTooLong
    else -> true
}
