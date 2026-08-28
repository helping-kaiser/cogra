package com.cogra.feature.content.wizard

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.LicenseChoice
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.media.CropSpec
import com.cogra.feature.content.ReferenceCandidateRow
import com.cogra.feature.content.ReferenceEntry
import com.cogra.feature.content.TopicEntry

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
    viewModel: ComposeWizardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.start(referenceTargetId) }

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
            WizardOutcome.DraftKept -> {
                viewModel.onOutcomeConsumed()
                onLeave()
            }
            null -> Unit
        }
    }

    // The system photo picker: no permission, no MediaStore query, and
    // the reader hands over exactly the pictures they meant to
    // (developer.android.com/training/data-storage/shared/photopicker).
    // It lives on the route rather than in the screen so the screen
    // stays stateless and previewable.
    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(ComposeWizardState.MAX_POST_ASSETS),
    ) { uris -> uris.forEach { viewModel.onTogglePick(it.toString()) } }

    ComposeWizardScreen(
        state = state,
        onBodyChange = viewModel::onBodyChange,
        onModeChange = viewModel::onModeChange,
        onOpenPicker = {
            picker.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
            )
        },
        onTogglePick = viewModel::onTogglePick,
        onShapeChange = viewModel::onShapeChange,
        onFrameAsset = viewModel::onFrameAsset,
        onCropsChanged = viewModel::onCropsCommitted,
        onTitleChange = viewModel::onTitleChange,
        onDescriptionChange = viewModel::onDescriptionChange,
        onAltTextChange = viewModel::onAltTextChange,
        onRetryUpload = viewModel::onRetryUpload,
        onOpenSheet = viewModel::onOpenSheet,
        onCloseSheet = viewModel::onCloseSheet,
        onLicenseChange = viewModel::onLicenseChange,
        onPDirectedChange = viewModel::onPDirectedChange,
        onNext = viewModel::onNext,
        onBack = { if (!viewModel.onBack()) viewModel.onLeave() },
        onSign = viewModel::onSign,
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
    onBodyChange: (String) -> Unit,
    onModeChange: (BodyMode) -> Unit,
    onOpenPicker: () -> Unit,
    onTogglePick: (String) -> Unit,
    onShapeChange: (DraftShape) -> Unit,
    onFrameAsset: (Int) -> Unit,
    onCropsChanged: (Map<String, CropSpec>) -> Unit,
    onTitleChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onAltTextChange: (String, String) -> Unit,
    onRetryUpload: (String) -> Unit,
    onOpenSheet: (SealSheet) -> Unit,
    onCloseSheet: () -> Unit,
    onLicenseChange: (LicenseChoice) -> Unit,
    onPDirectedChange: (Double) -> Unit,
    onNext: () -> Unit,
    onBack: () -> Unit,
    onSign: () -> Unit,
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
) {
    // Back is the header's arrow and the system gesture alike: one
    // stage at a time, and out of the wizard from the first.
    BackHandler(onBack = onBack)

    Column(
        modifier = modifier
            .fillMaxSize()
            .testTag("compose_wizard"),
    ) {
        WizardHeader(
            title = state.headerTitle(),
            onBack = onBack,
            backContentDescription = "Back",
            actionText = state.headerAction(),
            onAction = onNext,
            actionEnabled = state.headerActionEnabled(),
            trailingNote = if (state.step == WizardStep.Seal) "Last step" else null,
            testTag = "wizard_header",
        )

        keyBanner()

        state.draftOffer?.let { held ->
            DraftOffer(draft = held, onContinue = onContinueDraft, onDiscard = onDiscardDraft)
        }

        // The board dims what is behind the offer: the offer is the
        // question to answer first.
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .alpha(if (state.draftOffer != null) DIMMED else 1f),
        ) {
            when (state.step) {
                WizardStep.Body -> BodyStage(
                    state = state,
                    onBodyChange = onBodyChange,
                    onModeChange = onModeChange,
                    onOpenPicker = onOpenPicker,
                    onTogglePick = onTogglePick,
                )

                WizardStep.Crop -> WizardBody(scrollable = true) {
                    CropStepBody(
                        state = state,
                        onShapeChange = onShapeChange,
                        onFrameAsset = onFrameAsset,
                        onAltTextChange = onAltTextChange,
                        onCropsChanged = onCropsChanged,
                    )
                }

                WizardStep.Details -> WizardBody {
                    DetailsStepBody(
                        state = state,
                        onTitleChange = onTitleChange,
                        onDescriptionChange = onDescriptionChange,
                        onRetryUpload = onRetryUpload,
                        onEditBody = onBack,
                        onEditCrop = onBack,
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
                            )
                        },
                    )
                    CograButton(
                        text = "Next",
                        onClick = onNext,
                        modifier = Modifier.fillMaxWidth(),
                        testTag = "wizard_details_next",
                    )
                }

                WizardStep.Seal -> WizardBody(gap = Space.x4) {
                    SealStepBody(
                        state = state,
                        onOpenSheet = onOpenSheet,
                        onSign = onSign,
                        onBack = onBack,
                        onRestoreKey = onRestoreKey,
                        onKeepDraft = onKeepDraft,
                    )
                }
            }

            state.problem()?.let { message ->
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Layout.ScreenGutter, vertical = Space.x2)
                        .testTag("wizard_problem")
                        // A refusal has to reach a reader who is not
                        // looking at the bottom of the screen.
                        .semantics { liveRegion = LiveRegionMode.Assertive },
                )
            }
        }
    }

    if (state.sheet != SealSheet.None) {
        val sheetState = rememberModalBottomSheetState()
        ModalBottomSheet(onDismissRequest = onCloseSheet, sheetState = sheetState) {
            when (state.sheet) {
                SealSheet.License -> LicenseSheet(state.license, onLicenseChange, onCloseSheet)
                SealSheet.Stance -> StanceSheet(
                    pDirected = state.pDirected,
                    onChange = onPDirectedChange,
                    onDone = onCloseSheet,
                    onCancel = onCloseSheet,
                )
                SealSheet.None -> Unit
            }
        }
    }
}

/** `ComposeWords` and `ComposePick` share the caption band above them. */
@Composable
private fun ColumnScope.BodyStage(
    state: ComposeWizardState,
    onBodyChange: (String) -> Unit,
    onModeChange: (BodyMode) -> Unit,
    onOpenPicker: () -> Unit,
    onTogglePick: (String) -> Unit,
) {
    when (state.mode) {
        BodyMode.Words -> {
            WizardCaption(
                text = "The body is your words.",
                actionText = "Add pictures instead",
                onAction = { onModeChange(BodyMode.Media) },
                actionTestTag = "wizard_switch_media",
            )
            WizardBody(gap = Space.x1) { WordsStepBody(state, onBodyChange) }
        }
        BodyMode.Media -> {
            WizardCaption(
                text = "Pick one picture, several, or one video.",
                actionText = "Write words instead",
                onAction = { onModeChange(BodyMode.Words) },
                actionTestTag = "wizard_switch_words",
            )
            WizardBody(gap = Space.x2) { PickStepBody(state, onOpenPicker, onTogglePick) }
        }
    }
}

private const val DIMMED = 0.55f

/** The stage's own name — no step counter, per design/readme.md §13. */
internal fun ComposeWizardState.headerTitle(): String = when (step) {
    WizardStep.Body -> "New post"
    WizardStep.Crop -> "Crop"
    WizardStep.Details -> "Details"
    WizardStep.Seal -> "What you sign"
}

/** The header's trailing pill; the details stage puts its Next at the bottom. */
internal fun ComposeWizardState.headerAction(): String? = when (step) {
    WizardStep.Body, WizardStep.Crop -> "Next"
    WizardStep.Details, WizardStep.Seal -> null
}

internal fun ComposeWizardState.headerActionEnabled(): Boolean = when (step) {
    WizardStep.Body -> bodyReady
    else -> true
}

/**
 * The one problem line the stage shows, if any. A refusal that named a
 * chip already sits on the chip; this carries what nothing else could.
 */
internal fun ComposeWizardState.problem(): String? = when {
    refusal != null -> refusal
    transportFailed -> "That could not reach the server. Try again."
    signingFailed -> "The signature did not go through. Nothing was published."
    else -> null
}
