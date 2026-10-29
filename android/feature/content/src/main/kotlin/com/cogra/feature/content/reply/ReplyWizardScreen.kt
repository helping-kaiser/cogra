package com.cogra.feature.content.reply

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.compose.DescribeSheet
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.media.MAX_ALT_TEXT_CHARS
import com.cogra.feature.content.CitedSheet
import com.cogra.feature.content.PickerInPlace
import com.cogra.feature.content.PickerOrigin
import com.cogra.feature.content.R
import com.cogra.feature.content.ReferencePairSheet
import com.cogra.feature.content.ReferencePickerHandlers
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagPickerHandlers
import com.cogra.feature.content.TagsSheet
import com.cogra.feature.content.wizard.LicenseSheet
import com.cogra.feature.content.wizard.SensitiveSheet
import com.cogra.feature.content.wizard.WizardBody
import com.cogra.feature.content.wizard.WizardFooter
import com.cogra.feature.content.wizard.describeTooLong

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
        onOpenCoverRow = viewModel::onOpenCoverRow,
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
        onSensitiveChange = viewModel::onSensitiveChange,
        onSensitiveReasonChange = viewModel::onSensitiveReasonChange,
        onOpenHelp = viewModel::onOpenHelp,
        onCloseHelp = viewModel::onCloseHelp,
        onSign = viewModel::onSign,
        onRestoreKey = onRestoreKey,
        onRemoveTag = viewModel::onRemoveTag,
        onTuneTag = viewModel::onTuneTag,
        onDoneTuningTag = viewModel::onDoneTuningTag,
        onTagRelevanceChange = viewModel::onTagRelevanceChange,
        onTagConfidenceChange = viewModel::onTagConfidenceChange,
        onRemoveReference = viewModel::onRemoveReference,
        onTuneReference = viewModel::onTuneReference,
        onDoneTuningReference = viewModel::onDoneTuningReference,
        onReferenceRelevanceChange = viewModel::onReferenceRelevanceChange,
        onReferenceSupportChange = viewModel::onReferenceSupportChange,
        tagPicker = viewModel.tagPicker,
        referencePicker = viewModel.referencePicker,
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
    onOpenCoverRow: () -> Unit,
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
    onSensitiveChange: (Boolean) -> Unit,
    onSensitiveReasonChange: (String) -> Unit,
    onOpenHelp: (HelpTopic) -> Unit,
    onCloseHelp: () -> Unit,
    onSign: () -> Unit,
    onRestoreKey: () -> Unit,
    onRemoveTag: (String) -> Unit,
    onTuneTag: (String) -> Unit,
    onDoneTuningTag: () -> Unit,
    onTagRelevanceChange: (String, Double) -> Unit,
    onTagConfidenceChange: (String, Double) -> Unit,
    onRemoveReference: (String) -> Unit,
    onTuneReference: (String) -> Unit,
    onDoneTuningReference: () -> Unit,
    onReferenceRelevanceChange: (String, Double) -> Unit,
    onReferenceSupportChange: (String, Double) -> Unit,
    tagPicker: TagPickerHandlers,
    referencePicker: ReferencePickerHandlers,
    keyBanner: @Composable () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    // Back is the header's arrow and the system gesture alike, and both
    // step back one stage. From the composer there is no earlier stage,
    // so back leaves — and leaving discards, because comments keep no
    // drafts (jakob 2026-09-01), which is why a non-empty composer is
    // asked before it goes.
    BackHandler(onBack = onBack)

    // The seal's `+ Add a tag` and `+ Cite something` open their pickers in the
    // reply's place (round 27), each pick staged into the reply at once; the
    // arrow names the comment.
    val picking = PickerInPlace(
        tags = state.tagSection,
        references = state.referenceSection,
        origin = PickerOrigin.Comment,
        tagPicker = tagPicker,
        referencePicker = referencePicker,
    )
    if (picking) return

    if (state.confirmingDiscard) {
        DiscardConfirm(
            subject = DiscardSubject.Reply,
            onKeepWriting = onKeepWriting,
            onDiscard = onDiscard,
            testTag = "reply_discard_confirm",
        )
    }

    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
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
                    { onOpenHelp(HelpTopic.HowSigningWorks) }
                } else {
                    null
                },
                helpContentDescription = HelpTopic.HowSigningWorks.title,
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
                                onOpenCoverRow = onOpenCoverRow,
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
                                onAddTag = tagPicker::onOpenTagPicker,
                                onCite = referencePicker::onOpenReferencePicker,
                                onTuneReference = onTuneReference,
                                onRemoveReference = onRemoveReference,
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

        // THE PAD PARKS OVER THE PAGE, and the wash covers the seal
        // beneath it — `ReplyPadBody` in the boards' `_shared.jsx`, under
        // the rule design/readme.md §"Fixed elements" gives every pad in
        // the product: the lower centre of the viewport, the same place
        // every time, because muscle memory is part of the control.
        //
        // It is deliberately NOT in the sheet host: a drawer would draw a
        // second sheet chrome around it (F2-10) and would park it
        // wherever the drawer happened to stop.
        if (state.padOpen) {
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .background(MaterialTheme.colorScheme.scrim.copy(alpha = PAD_WASH_ALPHA))
                    // The wash is the outside press: it stages nothing.
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onCloseSheet,
                    )
                    .testTag("reply_pad_wash"),
            )
            ReplyPad(
                target = state.target,
                pDirected = state.pDirected,
                pInterest = state.pInterest,
                onChange = onStanceChange,
                onSet = onCloseSheet,
                onCancel = onCloseSheet,
                onHelp = { onOpenHelp(HelpTopic.TowardWhatYouAnswer) },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(horizontal = PAD_SIDE_INSET)
                    .padding(bottom = PAD_BOTTOM_INSET),
            )
        }
    }

    if (state.anySheetOpen) {
        CograSheetHost(onDismissRequest = onCloseSheet) {
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
                    video = describing.isVideo,
                    cap = MAX_ALT_TEXT_CHARS,
                    tooLongMessage = describeTooLong(describing.isVideo),
                    testTag = "reply_describe_sheet",
                )

                state.sheet == ReplySealSheet.License ->
                    LicenseSheet(
                        license = state.license,
                        onDone = { picked ->
                            onLicenseChange(picked)
                            onCloseSheet()
                        },
                        onHelp = { onOpenHelp(HelpTopic.License) },
                    )

                // The post seal's own sheet, not a comment-scale copy:
                // its one line reads for both scales (ruling 42).
                state.sheet == ReplySealSheet.Sensitive -> SensitiveSheet(
                    marked = state.sensitive,
                    reason = state.sensitiveReason,
                    onMarkedChange = onSensitiveChange,
                    onReasonChange = onSensitiveReasonChange,
                    onDone = onCloseSheet,
                    onHelp = { onOpenHelp(HelpTopic.MarkingAsSensitive) },
                    testTagPrefix = "reply",
                )

                // `ComposeTags` — the post seal's own manager, behind the seal's Tags row:
                // one surface wherever staged tags are managed.
                state.sheet == ReplySealSheet.Tags -> TagsSheet(
                    section = state.tagSection,
                    onRemoveTag = onRemoveTag,
                    onTuneTag = onTuneTag,
                    onDoneTuningTag = onDoneTuningTag,
                    onTagRelevanceChange = onTagRelevanceChange,
                    onTagConfidenceChange = onTagConfidenceChange,
                    onDone = onCloseSheet,
                    testTag = "reply_tags_sheet",
                )

                // `ComposeCitations` — the post seal's own sheet, opened from
                // this seal's "N cited" door. One surface, drawn once,
                // wherever a staged collection is managed.
                state.sheet == ReplySealSheet.Cited -> CitedSheet(
                    section = state.referenceSection,
                    onRemoveReference = onRemoveReference,
                    onTuneReference = onTuneReference,
                    onDoneTuningReference = onDoneTuningReference,
                    onReferenceRelevanceChange = onReferenceRelevanceChange,
                    onReferenceSupportChange = onReferenceSupportChange,
                    onDone = onCloseSheet,
                    testTag = "reply_cited_sheet",
                )

                else -> Unit
            }
        }
    }

    // ReplyCited.md: the one staged citation's name opens its pair sheet, over the
    // seal (the Cited sheet draws its own for two or more).
    if (state.sheet != ReplySealSheet.Cited) {
        SingleCitationPair(
            section = state.referenceSection,
            onRelevanceChange = onReferenceRelevanceChange,
            onSupportChange = onReferenceSupportChange,
            onDone = onDoneTuningReference,
        )
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
 * The wash the parked pad sits over — the standard covering scrim, the
 * `rgba(0, 0, 0, 0.5)` the boards draw over the seal (`_shared.jsx`).
 */
private const val PAD_WASH_ALPHA = 0.5f

/** What the parked pad leaves of the screen on either side (`_shared.jsx`). */
private val PAD_SIDE_INSET = 30.dp

/**
 * How far the pad rides off the bottom edge.
 *
 * The `ReplyPad` board draws 24, which is also the rung the bloomed
 * stance control already parks at (`StancePad.kt`'s `PAD_BOTTOM`), so
 * both pads in the app stop in the same place.
 */
private val PAD_BOTTOM_INSET = 24.dp

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

/** The staged citation being tuned, if any, in its pair sheet (`RefPair`). */
@Composable
private fun SingleCitationPair(
    section: ReferenceSectionState,
    onRelevanceChange: (String, Double) -> Unit,
    onSupportChange: (String, Double) -> Unit,
    onDone: () -> Unit,
) {
    val row = section.references.firstOrNull { it.targetId == section.tuning } ?: return
    ReferencePairSheet(
        row = row,
        testTagPrefix = "reply_seal",
        onDone = { relevance, support ->
            onRelevanceChange(row.targetId, relevance)
            onSupportChange(row.targetId, support)
            onDone()
        },
        onDismiss = onDone,
    )
}
