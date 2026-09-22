package com.cogra.feature.content.wizard

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.assertHasNoClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The video body's describe surface — CW-16 (the sheet's video shape) and
 * CW-17 (the details step's subject pass-through), 2026-09-08 UI audit —
 * plus findings 6+7 of jakob's round-three review, 2026-09-22
 * (design/readme.md §13 "The cover's tile"): the Details tile is one tile
 * with no manager.
 *
 * Its own file rather than a further addition to `ComposeWizardScreenTest`,
 * which detekt's `LargeClass` rule already sits at the edge of.
 */
@RunWith(RobolectricTestRunner::class)
class ComposeWizardVideoDescribeTest {

    @get:Rule
    val compose = createComposeRule()

    private var removals = mutableListOf<Int>()

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
            onSetStance = {},
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
            onRemovePickAt = { removals += it },
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

    // Finding 7, jakob's ruling 2026-09-15 re-confirmed 2026-09-22: "one
    // clip is not a set" — the picked-media sheet is a picture-path
    // surface only, so the video tile carries no tap-to-manage affordance
    // and opens nothing.
    @Test
    fun theVideoTileCarriesNoManagerAndOpensNoSheet() {
        compose.setContent { Wizard(onVideoDetails) }

        compose.onNodeWithTag("wizard_picked_row").assertHasNoClickAction()
    }

    // Finding 7 (`ComposeDetailsVideo.jsx` lines 23-32): the tile's only
    // affordances are its own x — the same one the pick tray already
    // draws on this same clip — and the Describe entry beneath it.
    @Test
    fun theVideoTileWearsItsOwnRemoveAndTheDescribeEntryBelowIt() {
        compose.setContent { Wizard(onVideoDetails) }

        compose.onNodeWithTag("media_thumb_remove_badge", useUnmergedTree = true)
            .assertIsDisplayed()
            .performClick()
        assertThat(removals).containsExactly(0)

        compose.onNodeWithText("Describe the video").assertExists()
    }
}
