package com.cogra.feature.content.reply

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.DiscardConfirm
import com.cogra.core.designsystem.v2.atom.DiscardSubject
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.compose.DescribeSheet
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.feature.content.ReferenceEntry
import com.cogra.feature.content.TopicEntry
import com.cogra.feature.content.wizard.LicenseSheet
import com.cogra.feature.content.wizard.WizardBody
import com.cogra.feature.content.wizard.WizardFooter

/**
 * The reply wizard, wired.
 *
 * [target] is what the thread pinned: the post for "Add a comment", the
 * comment for "Reply" (graph.json `ReplyEntry` 5 and 7).
 */
@Composable
fun ReplyWizardRoute(
    target: ReplyTarget,
    onSigned: (nodeId: String) -> Unit,
    onLeave: () -> Unit,
    onRestoreKey: () -> Unit,
    modifier: Modifier = Modifier,
    keyBanner: @Composable () -> Unit = {},
    viewModel: ReplyWizardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(target.id) { viewModel.start(target) }

    LaunchedEffect(state.outcome) {
        when (val outcome = state.outcome) {
            is ReplyOutcome.Signed -> {
                viewModel.onOutcomeConsumed()
                onSigned(outcome.nodeId)
            }
            ReplyOutcome.Left -> {
                viewModel.onOutcomeConsumed()
                onLeave()
            }
            null -> Unit
        }
    }

    // The platform's own picker, straight from "+ Add pictures":
    // **comments have no pick stage** (jakob 2026-08-31), and this path
    // needs no media permission at all
    // (developer.android.com/training/data-storage/shared/photopicker).
    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(ReplyWizardState.MAX_PICTURES),
    ) { uris -> uris.forEach { viewModel.onPicked(it.toString()) } }

    // The clip's own face, when the author wants one of their own. A
    // cover is a still by contract, so the launcher says so rather than
    // filtering a video out afterwards.
    val coverPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri -> uri?.let { viewModel.onPickCoverPicture(it.toString()) } }

    ReplyWizardScreen(
        state = state,
        onBodyChange = viewModel::onBodyChange,
        onOpenPicker = {
            // Pictures **and** video: "+ Add pictures or a video". Which
            // kind was chosen is the composer's question, not the
            // picker's — a system picker cannot say "four of these or
            // one of those".
            picker.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo),
            )
        },
        onRemovePickAt = viewModel::onRemovePickAt,
        onDescribePictures = viewModel::onDescribeFirst,
        onAltTextChange = viewModel::onAltTextChange,
        onPickCoverFrame = viewModel::onPickCoverFrame,
        onOpenCoverPicker = {
            coverPicker.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
            )
        },
        onDismissRefusal = viewModel::onDismissRefusal,
        onRetryUpload = viewModel::onRetryUpload,
        onKeepWriting = viewModel::onKeepWriting,
        onDiscard = viewModel::onLeave,
        onNext = viewModel::onNext,
        // Back and X are the same departure by two routes, so both ask
        // the same question: the composer keeps no draft, and a
        // non-empty one is asked before it is lost.
        onBack = { if (!viewModel.onBack()) viewModel.onLeaveRequested() },
        onLeave = viewModel::onLeaveRequested,
        onSealBack = viewModel::onSealBack,
        onOpenSheet = viewModel::onOpenSheet,
        onCloseSheet = viewModel::onCloseSheet,
        onLicenseChange = viewModel::onLicenseChange,
        onStanceChange = viewModel::onStanceChange,
        onOpenHelp = viewModel::onOpenHelp,
        onCloseHelp = viewModel::onCloseHelp,
        onSign = viewModel::onSign,
        onRestoreKey = onRestoreKey,
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
        modifier = modifier,
    )
}

/**
 * The stateless reply wizard.
 *
 * The header's title comes from the stage exactly as the boards draw it:
 * `Reply` over the words and the pictures alike — they are one stage —
 * and `What you sign` with `Last step` as a note over the seal.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ReplyWizardScreen(
    state: ReplyWizardState,
    onBodyChange: (String) -> Unit,
    onOpenPicker: () -> Unit,
    onRemovePickAt: (Int) -> Unit,
    onDescribePictures: () -> Unit,
    onAltTextChange: (String, String) -> Unit,
    onPickCoverFrame: (Int) -> Unit,
    onOpenCoverPicker: () -> Unit,
    onDismissRefusal: (Int) -> Unit,
    onRetryUpload: (String) -> Unit,
    onKeepWriting: () -> Unit,
    onDiscard: () -> Unit,
    onNext: () -> Unit,
    onBack: () -> Unit,
    onLeave: () -> Unit,
    onSealBack: () -> Unit,
    onOpenSheet: (ReplySealSheet) -> Unit,
    onCloseSheet: () -> Unit,
    onLicenseChange: (com.cogra.domain.LicenseChoice) -> Unit,
    onStanceChange: (Double, Double) -> Unit,
    onOpenHelp: (HelpTopic) -> Unit,
    onCloseHelp: () -> Unit,
    onSign: () -> Unit,
    onRestoreKey: () -> Unit,
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
    onPickReference: (com.cogra.feature.content.ReferenceCandidateRow) -> Unit,
    onRemoveReference: (String) -> Unit,
    onTuneReference: (String) -> Unit,
    onDoneTuningReference: () -> Unit,
    onReferenceRelevanceChange: (String, Double) -> Unit,
    onReferenceSupportChange: (String, Double) -> Unit,
    keyBanner: @Composable () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    // Back is the header's arrow and the system gesture alike, and both
    // step back one stage. From the composer there is no earlier stage,
    // so back leaves — and leaving discards, because comments keep no
    // drafts (jakob 2026-09-01), which is why a non-empty composer is
    // asked before it goes.
    BackHandler(onBack = onBack)

    if (state.confirmingDiscard) {
        DiscardConfirm(
            subject = DiscardSubject.Reply,
            onKeepWriting = onKeepWriting,
            onDiscard = onDiscard,
            testTag = "reply_discard_confirm",
        )
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .testTag("reply_wizard"),
    ) {
        WizardHeader(
            title = if (state.step == ReplyStep.Seal) "What you sign" else "Reply",
            onBack = onBack,
            // The X leaves from any stage. The post wizard's default
            // wording promises a kept draft; a comment has none, so the
            // label says what will happen to what is written.
            onLeave = onLeave,
            leaveContentDescription = "Leave — the reply is discarded",
            trailingNote = if (state.step == ReplyStep.Seal) "Last step" else null,
            onHelp = if (state.step == ReplyStep.Seal && !state.keyAbsent) {
                { onOpenHelp(HelpTopic.SignedActions) }
            } else {
                null
            },
            helpContentDescription = HelpTopic.SignedActions.title,
            testTag = "reply_header",
        )

        keyBanner()

        Column(modifier = Modifier.fillMaxWidth().weight(1f)) {
            when (state.step) {
                ReplyStep.Compose -> {
                    WizardBody(gap = Space.x4) {
                        ReplyComposeStepBody(
                            state = state,
                            onBodyChange = onBodyChange,
                            onOpenPicker = onOpenPicker,
                            onRemovePickAt = onRemovePickAt,
                            onDescribePictures = onDescribePictures,
                            onPickCoverFrame = onPickCoverFrame,
                            onPickCoverPicture = onOpenCoverPicker,
                            onDismissRefusal = onDismissRefusal,
                            onRetryUpload = onRetryUpload,
                        )
                    }
                    WizardFooter {
                        CograButton(
                            text = "Next",
                            onClick = onNext,
                            enabled = state.bodyReady,
                            modifier = Modifier.fillMaxWidth(),
                            testTag = "reply_next",
                        )
                    }
                }

                ReplyStep.Seal -> {
                    WizardBody(gap = Space.x3, scrollable = true, bottom = Space.x2) {
                        ReplySealStepBody(
                            state = state,
                            onOpenSheet = onOpenSheet,
                            onAddTopic = { onOpenSheet(ReplySealSheet.Topics) },
                            onCite = { onOpenSheet(ReplySealSheet.References) },
                        )
                    }
                    WizardFooter {
                        ReplySealActions(
                            state = state,
                            onSign = onSign,
                            onBack = onSealBack,
                            onRestoreKey = onRestoreKey,
                            onLeave = onLeave,
                        )
                    }
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
                        .testTag("reply_problem")
                        // A refusal has to reach a reader who is not
                        // looking at the bottom of the screen.
                        .semantics { liveRegion = LiveRegionMode.Assertive },
                )
            }
        }
    }

    if (state.anySheetOpen) {
        val sheetState = rememberModalBottomSheetState()
        ModalBottomSheet(onDismissRequest = onCloseSheet, sheetState = sheetState) {
            val describing = state.describingIndex?.let { state.picked.getOrNull(it) }
            when {
                describing != null -> DescribeSheet(
                    // Comment pictures never crop, so the picture being
                    // described is the whole frame that was picked.
                    item = MediaItem(
                        describing.uri,
                        describing.sourceRatio ?: 1f,
                        describing.altText.ifBlank { null },
                    ),
                    value = describing.altText,
                    onValueChange = { onAltTextChange(describing.uri, it) },
                    onDone = onCloseSheet,
                    onHelp = { onOpenHelp(HelpTopic.DescribingPictures) },
                    testTag = "reply_describe_sheet",
                )

                state.sheet == ReplySealSheet.License ->
                    LicenseSheet(state.license, onLicenseChange, onCloseSheet)

                state.sheet == ReplySealSheet.Stance -> ReplyPadSheet(
                    target = state.target,
                    pDirected = state.pDirected,
                    pInterest = state.pInterest,
                    onChange = onStanceChange,
                    onSet = onCloseSheet,
                    onCancel = onCloseSheet,
                )

                state.sheet == ReplySealSheet.Topics -> CograSheetSurface(testTag = "reply_topics_sheet") {
                    SheetTitle("Topics")
                    TopicEntry(
                        section = state.tagSection,
                        testTagPrefix = "reply",
                        onTagInputChange = onTagInputChange,
                        onAddTag = onAddTag,
                        onRemoveTag = onRemoveTag,
                        onTuneTag = onTuneTag,
                        onDoneTuningTag = onDoneTuningTag,
                        onTagRelevanceChange = onTagRelevanceChange,
                        onTagConfidenceChange = onTagConfidenceChange,
                        showHeading = false,
                    )
                    CograButton("Done", onCloseSheet, testTag = "reply_topics_done")
                }

                state.sheet == ReplySealSheet.References ->
                    CograSheetSurface(testTag = "reply_references_sheet") {
                        SheetTitle("References")
                        ReferenceEntry(
                            section = state.referenceSection,
                            testTagPrefix = "reply",
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
                        CograButton("Done", onCloseSheet, testTag = "reply_references_done")
                    }

                else -> Unit
            }
        }
    }

    state.help?.let { topic ->
        HelpDialog(
            title = topic.title,
            paragraphs = topic.paragraphs,
            onClose = onCloseHelp,
            testTag = "reply_help_dialog",
        )
    }
}

/**
 * The one line the wizard shows when a submit did not go through.
 *
 * A refusal the server placed on a field is already drawn on that field;
 * this is for the ones that named nothing, and for the two failures that
 * are about the attempt rather than the content.
 */
internal fun ReplyWizardState.problem(): String? = when {
    refusal != null -> refusal
    transportFailed -> "That could not reach the server. Try again."
    signingFailed -> "That could not be signed. Try again."
    uploadsFailed -> "A picture did not upload. Remove it, or try again."
    else -> null
}
