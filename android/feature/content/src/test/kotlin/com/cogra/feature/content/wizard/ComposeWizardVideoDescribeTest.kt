package com.cogra.feature.content.wizard

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The video body's describe surface — CW-16 (the sheet's video shape) and
 * CW-17 (the details step's subject pass-through), 2026-09-08 UI audit.
 *
 * Its own file rather than a further addition to `ComposeWizardScreenTest`,
 * which detekt's `LargeClass` rule already sits at the edge of.
 */
@RunWith(RobolectricTestRunner::class)
class ComposeWizardVideoDescribeTest {

    @get:Rule
    val compose = createComposeRule()

    @Composable
    private fun Wizard(state: ComposeWizardState) {
        ComposeWizardScreen(
            state = state,
            permission = MediaPermissionController(
                permission = MediaPermission.Granted(partial = false),
                request = {},
                openSettings = {},
            ),
            onBodyChange = {},
            onModeChange = {},
            onOpenPicker = {},
            onTogglePick = {},
            onShapeChange = {},
            onFrameAsset = {},
            onCropsChanged = {},
            onPickCoverFrame = {},
            onOpenCoverPicker = {},
            onDismissRefusal = {},
            onTitleChange = {},
            onDescriptionChange = {},
            onAltTextChange = { _, _ -> },
            onRetryUpload = {},
            onOpenSheet = {},
            onCloseSheet = {},
            onLicenseChange = {},
            onPDirectedChange = {},
            onSensitiveChange = {},
            onSensitiveReasonChange = {},
            onNext = {},
            onBack = {},
            onLeave = {},
            onSealBack = {},
            onOpenHelp = {},
            onCloseHelp = {},
            onManagePictures = {},
            onDescribePictures = {},
            onDescribeAt = {},
            onMovePick = { _, _ -> },
            onRemovePickAt = {},
            onSign = {},
            onContinueDraft = {},
            onDiscardDraft = {},
            onRestoreKey = {},
            onKeepDraft = {},
            onTagInputChange = {},
            onAddTag = {},
            onRemoveTag = {},
            onTuneTag = {},
            onDoneTuningTag = {},
            onTagRelevanceChange = { _, _ -> },
            onTagConfidenceChange = { _, _ -> },
            onOpenFinder = {},
            onCloseFinder = {},
            onFinderQueryChange = {},
            onPickReference = {},
            onRemoveReference = {},
            onTuneReference = {},
            onDoneTuningReference = {},
            onReferenceRelevanceChange = { _, _ -> },
            onReferenceSupportChange = { _, _ -> },
        )
    }

    private val onVideoDetails = ComposeWizardState(
        mode = BodyMode.Media,
        step = WizardStep.Details,
        picked = listOf(PickedAsset("clip", 0.5625f, durationMs = 42_000)),
    )

    // CW-17: DetailsStep passes DescribeSubject.Video for a video post,
    // matching web's already-shipped details-step.tsx:235.
    @Test
    fun theVideoBodysCounterAsksForOneDescriptionOfTheClip() {
        compose.setContent { Wizard(onVideoDetails) }

        compose.onNodeWithText("Describe the video").performScrollTo().assertExists()
        compose.onNodeWithText("· 0 of 1 described").performScrollTo().assertExists()
    }

    // CW-16: both composers open the video shape for a clip.
    @Test
    fun theVideoBodysDescribeSheetIsTheVideoShape() {
        val state = onVideoDetails.copy(describingIndex = 0)
        compose.setContent { Wizard(state) }

        // Unique to the sheet — the counter behind it also reads "Describe
        // the video", so the field label and the disc are what disambiguate.
        compose.onNodeWithText("What's in the video").assertExists()
        compose.onNodeWithTag("wizard_describe_sheet_play_disc").assertExists()
    }
}
