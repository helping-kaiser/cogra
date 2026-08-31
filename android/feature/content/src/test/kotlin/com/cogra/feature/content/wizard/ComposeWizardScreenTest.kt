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
import androidx.compose.ui.semantics.SemanticsActions
import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.DraftAsset
import com.cogra.domain.compose.DraftBodyKind
import com.cogra.domain.media.DeviceImage
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

    private var permissionRequests = 0
    private var editBodies = 0
    private var editCrops = 0
    private var sealBacks = 0

    @Composable
    private fun Wizard(
        state: ComposeWizardState,
        permission: MediaPermission = MediaPermission.Granted(partial = false),
    ) {
        ComposeWizardScreen(
            state = state,
            permission = MediaPermissionController(
                permission = permission,
                request = { permissionRequests += 1 },
                openSettings = {},
            ),
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
            onSealBack = { sealBacks += 1 },
            onEditBody = { editBodies += 1 },
            onEditCrop = { editCrops += 1 },
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
        deviceImages = listOf(DeviceImage("a", 1f), DeviceImage("b", 1f), DeviceImage("c", 1f)),
    )

    private val words = ComposeWizardState(mode = BodyMode.Words)

    // -- The body stage --

    @Test
    fun aFreshComposerOpensOnThePictures() {
        compose.setContent { Wizard(ComposeWizardState()) }

        // Images-first: the picker grid, not the words field.
        compose.onNodeWithTag("wizard_pick_grid").assertIsDisplayed()
        compose.onNodeWithTag("wizard_body").assertDoesNotExist()
        compose.onNodeWithTag("wizard_switch_words").performClick()
        assertThat(modeChanges).containsExactly(BodyMode.Words)
    }

    @Test
    fun theWordsStageOffersTheOtherHalf() {
        compose.setContent { Wizard(words) }
        compose.onNodeWithTag("wizard_body").assertIsDisplayed()
        compose.onNodeWithTag("wizard_switch_media").performClick()
        assertThat(modeChanges).containsExactly(BodyMode.Media)
    }

    @Test
    fun theNextPillWaitsForABody() {
        compose.setContent { Wizard(words) }
        compose.onNodeWithTag("wizard_header_action").assertIsNotEnabled()
    }

    @Test
    fun theNextPillWaitsForAPick() {
        compose.setContent { Wizard(ComposeWizardState()) }
        compose.onNodeWithTag("wizard_header_action").assertIsNotEnabled()
    }

    @Test
    fun aTypedBodyEnablesTheNextPill() {
        compose.setContent { Wizard(words.copy(body = "Salt maps")) }
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
    fun theGridDrawsTheDevicesOwnPicturesAndTogglesThemInPlace() {
        compose.setContent { Wizard(withPicks) }

        // Every device picture is a tile, picked or not — the board's grid
        // is a set you browse, not a list of what you already chose.
        compose.onNodeWithTag("wizard_grid_c").assertIsDisplayed()
        compose.onNodeWithTag("wizard_grid_a").performClick()
        compose.onNodeWithTag("wizard_grid_c").performClick()

        assertThat(picked).containsExactly("a", "c").inOrder()
    }

    @Test
    fun theBoardsPhotosAppTileSurvivesEveryPermissionAnswer() {
        compose.setContent { Wizard(ComposeWizardState(), MediaPermission.Refused) }

        // A refusal is never a dead end: the system picker needs no
        // permission, so the tile the board draws still opens it.
        compose.onNodeWithTag("wizard_open_picker").assertIsDisplayed()
        compose.onNodeWithTag("wizard_pick_permission_settings").assertIsDisplayed()
    }

    @Test
    fun anUnaskedGridOffersTheWayToFillIt() {
        compose.setContent { Wizard(ComposeWizardState(), MediaPermission.Unrequested) }

        compose.onNodeWithTag("wizard_pick_permission_grant").performClick()

        assertThat(permissionRequests).isEqualTo(1)
    }

    @Test
    fun aPartialGrantIsAnAnswerRatherThanAFailure() {
        compose.setContent {
            Wizard(withPicks, MediaPermission.Granted(partial = true))
        }

        // The grid still draws what was shared, and the way to share more
        // is an offer rather than a warning.
        compose.onNodeWithTag("wizard_grid_c").assertIsDisplayed()
        compose.onNodeWithTag("wizard_pick_permission_more").assertIsDisplayed()
    }

    @Test
    fun aFullGrantSaysNothingAtAll() {
        compose.setContent { Wizard(withPicks) }

        compose.onNodeWithTag("wizard_pick_permission").assertDoesNotExist()
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

        // The board re-words the stage behind the offer and drops the
        // branch: the question on the table is the draft.
        compose.onNodeWithText("Or start fresh —").assertExists()
        compose.onNodeWithTag("wizard_switch_words").assertDoesNotExist()
    }

    // -- The crop stage --

    @Test
    fun theCropStageOffersTheThreeShapesAndANonDragRoute() {
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Crop)) }
        compose.onNodeWithTag("crop_shape_tall").assertIsDisplayed()
        compose.onNodeWithTag("crop_shape_square").assertIsDisplayed()
        compose.onNodeWithTag("crop_shape_wide").assertIsDisplayed()

        // D17: completable without a gesture. The board draws no controls
        // under the crop, so the route is named actions in the semantics
        // tree — nothing visible to scroll to.
        val actions = compose.onNodeWithTag("wizard_crop")
            .fetchSemanticsNode()
            .config[SemanticsActions.CustomActions]
            .map { it.label }
        assertThat(actions).containsAtLeast("Nudge left", "Zoom in", "Reset framing")
        compose.onNodeWithTag("wizard_crop_left").assertDoesNotExist()
        compose.onNodeWithTag("wizard_crop_zoom_in").assertDoesNotExist()
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

    @Test
    fun theDetailsRowsTwoWaysBackGoToTwoDifferentPlaces() {
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Details)) }

        compose.onNodeWithTag("wizard_details_crop").performScrollTo().performClick()
        compose.onNodeWithTag("wizard_details_edit").performScrollTo().performClick()

        // The board draws Crop and Edit side by side because they are two
        // destinations; wiring both to the same one made them a duplicate.
        assertThat(editCrops).isEqualTo(1)
        assertThat(editBodies).isEqualTo(1)
        assertThat(backs).isEqualTo(0)
    }

    // -- The seal --

    @Test
    fun theSealsBackPillStepsBackWhileTheArrowLeaves() {
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Seal)) }

        compose.onNodeWithTag("wizard_seal_back").performClick()
        compose.onNodeWithTag("wizard_header_back").performClick()

        assertThat(sealBacks).isEqualTo(1)
        assertThat(backs).isEqualTo(1)
    }

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
