package com.cogra.feature.content.wizard

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.DraftAsset
import com.cogra.domain.compose.DraftBodyKind
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The wizard's screens, bound to test tags rather than to display copy
 * (android/CLAUDE.md), so a wording pass never breaks the suite.
 *
 * These prove the stages are wired to the state machine — the rules
 * themselves are pinned in `ComposeWizardStateTest`, where they belong.
 */
@RunWith(RobolectricTestRunner::class)
class ComposeWizardScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private var modeChanges = mutableListOf<BodyMode>()
    private var nexts = 0
    private var backs = 0
    private var signs = 0
    private var picked = mutableListOf<String>()
    private var retries = mutableListOf<String>()
    private var sheets = mutableListOf<SealSheet>()
    private var draftContinues = 0
    private var draftDiscards = 0

    @Composable
    private fun Wizard(state: ComposeWizardState) {
        ComposeWizardScreen(
            state = state,
            onBodyChange = {},
            onModeChange = { modeChanges += it },
            onOpenPicker = {},
            onTogglePick = { picked += it },
            onShapeChange = {},
            onFrameAsset = {},
            onCropsChanged = {},
            onTitleChange = {},
            onDescriptionChange = {},
            onAltTextChange = { _, _ -> },
            onRetryUpload = { retries += it },
            onOpenSheet = { sheets += it },
            onCloseSheet = {},
            onLicenseChange = {},
            onPDirectedChange = {},
            onNext = { nexts += 1 },
            onBack = { backs += 1 },
            onSign = { signs += 1 },
            onContinueDraft = { draftContinues += 1 },
            onDiscardDraft = { draftDiscards += 1 },
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

    private val withPicks = ComposeWizardState(
        mode = BodyMode.Media,
        picked = listOf(PickedAsset("a", 1f), PickedAsset("b", 1f)),
    )

    // -- The body stage --

    @Test
    fun theWordsStageOffersTheOtherHalf() {
        compose.setContent { Wizard(ComposeWizardState()) }
        compose.onNodeWithTag("wizard_body").assertIsDisplayed()
        compose.onNodeWithTag("wizard_switch_media").performClick()
        assertThat(modeChanges).containsExactly(BodyMode.Media)
    }

    @Test
    fun theNextPillWaitsForABody() {
        compose.setContent { Wizard(ComposeWizardState()) }
        compose.onNodeWithTag("wizard_header_action").assertIsNotEnabled()
    }

    @Test
    fun aTypedBodyEnablesTheNextPill() {
        compose.setContent { Wizard(ComposeWizardState(body = "Salt maps")) }
        compose.onNodeWithTag("wizard_header_action").assertIsEnabled()
        compose.onNodeWithTag("wizard_header_action").performClick()
        assertThat(nexts).isEqualTo(1)
    }

    @Test
    fun thePickStageShowsTheTrayAndTheCoverMark() {
        compose.setContent { Wizard(withPicks) }
        compose.onNodeWithTag("wizard_picked_count").assertIsDisplayed()
        compose.onNodeWithTag("wizard_tray_0").assertIsDisplayed()
        compose.onNodeWithTag("wizard_tray_1").assertIsDisplayed()
    }

    @Test
    fun aTileInTheGridDropsItsPick() {
        compose.setContent { Wizard(withPicks) }
        compose.onNodeWithTag("wizard_pick_0").performClick()
        assertThat(picked).containsExactly("a")
    }

    // -- The draft offer --

    @Test
    fun aHeldDraftIsOfferedWithBothAnswers() {
        val offered = ComposeWizardState(
            draftOffer = ComposeDraft(
                bodyKind = DraftBodyKind.Media,
                title = "Salt maps",
                assets = listOf(DraftAsset("a")),
            ),
        )
        compose.setContent { Wizard(offered) }
        compose.onNodeWithTag("wizard_draft_offer").assertIsDisplayed()
        compose.onNodeWithTag("wizard_draft_continue").performClick()
        compose.onNodeWithTag("wizard_draft_discard").performClick()
        assertThat(draftContinues).isEqualTo(1)
        assertThat(draftDiscards).isEqualTo(1)
    }

    // -- The crop stage --

    @Test
    fun theCropStageOffersTheThreeShapesAndANonDragRoute() {
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Crop)) }
        compose.onNodeWithTag("crop_shape_tall").assertIsDisplayed()
        compose.onNodeWithTag("crop_shape_square").assertIsDisplayed()
        compose.onNodeWithTag("crop_shape_wide").assertIsDisplayed()
        // D17: the stage has to be completable without a gesture, and
        // "reachable" is the claim — the stage scrolls, so the controls
        // are scrolled to rather than assumed to be above the fold.
        compose.onNodeWithTag("wizard_crop_left").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("wizard_crop_zoom_in").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun theFilmstripAppearsOnlyWhenThereIsMoreThanOnePicture() {
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Crop)) }
        // Existence rather than display: whether the strip sits above
        // the fold is a screen-height question the hand test answers,
        // and the claim here is that a second picture puts it there at
        // all.
        compose.onNodeWithTag("wizard_filmstrip_1").assertExists()
    }

    @Test
    fun oneAloneNeedsNoFilmstrip() {
        val single = withPicks.copy(step = WizardStep.Crop, picked = withPicks.picked.take(1))
        compose.setContent { Wizard(single) }
        compose.onNodeWithTag("wizard_filmstrip_0").assertDoesNotExist()
    }

    // -- The details stage --

    @Test
    fun theCropStageDescribesThePictureBeingFramed() {
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Crop)) }
        // The description sits beside the picture it describes, and it
        // has to exist before the bytes move: `uploadMedia` takes the
        // alt text and there is no `updateMedia`.
        compose.onNodeWithTag("wizard_alt_0").assertExists()
        // The second picture's field appears when it is the one framed.
        compose.onNodeWithTag("wizard_alt_1").assertDoesNotExist()
    }

    @Test
    fun theSecondPicturesDescriptionFollowsTheFilmstrip() {
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Crop, framingIndex = 1)) }
        compose.onNodeWithTag("wizard_alt_1").assertExists()
    }

    @Test
    fun aFailedUploadOffersARetryForThatPictureAlone() {
        val state = withPicks
            .copy(step = WizardStep.Details)
            .withUpload("b", AssetUpload.Failed("too big"))
        compose.setContent { Wizard(state) }
        compose.onNodeWithTag("wizard_upload_retry_1").performScrollTo().performClick()
        assertThat(retries).containsExactly("b")
    }

    // -- The seal --

    @Test
    fun theSealNamesEveryActAndItsCost() {
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Seal)) }
        compose.onNodeWithTag("wizard_seal_acts").assertIsDisplayed()
        compose.onNodeWithTag("wizard_seal_total").assertIsDisplayed()
    }

    @Test
    fun theSealRefusesToSignWhileAPictureIsStillOnItsWay() {
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Seal)) }
        compose.onNodeWithTag("wizard_sign").assertIsNotEnabled()
    }

    @Test
    fun aCompleteGalleryLetsTheSealSign() {
        val ready = withPicks
            .copy(step = WizardStep.Seal)
            .withUpload("a", AssetUpload.Done("m1"))
            .withUpload("b", AssetUpload.Done("m2"))
        compose.setContent { Wizard(ready) }
        compose.onNodeWithTag("wizard_sign").assertIsEnabled().performClick()
        assertThat(signs).isEqualTo(1)
    }

    @Test
    fun theSealsRowsOpenTheirOwnSheets() {
        compose.setContent { Wizard(ComposeWizardState(body = "x", step = WizardStep.Seal)) }
        compose.onNodeWithTag("wizard_seal_license_action").performClick()
        compose.onNodeWithTag("wizard_seal_stance_action").performClick()
        assertThat(sheets).containsExactly(SealSheet.License, SealSheet.Stance).inOrder()
    }

    @Test
    fun theSealOffersNoSensitiveMarkItCannotSend() {
        // The contract carries no author self-mark, so a row promising
        // one would be a lie told to the person trusting it.
        compose.setContent { Wizard(ComposeWizardState(body = "x", step = WizardStep.Seal)) }
        compose.onNodeWithTag("wizard_seal_sensitive").assertDoesNotExist()
    }

    @Test
    fun anAbsentKeyReplacesTheSignPillWithTheWayToRestoreIt() {
        val state = ComposeWizardState(body = "x", step = WizardStep.Seal, keyAbsent = true)
        compose.setContent { Wizard(state) }
        compose.onNodeWithTag("wizard_key_absent").assertIsDisplayed()
        compose.onNodeWithTag("wizard_sign").assertDoesNotExist()
    }

    @Test
    fun aRefusalIsShownWhereTheReaderIs() {
        val state = ComposeWizardState(body = "x", step = WizardStep.Seal, refusal = "no balance")
        compose.setContent { Wizard(state) }
        compose.onNodeWithTag("wizard_problem").assertIsDisplayed()
        compose.onNodeWithText("no balance").assertIsDisplayed()
    }
}
