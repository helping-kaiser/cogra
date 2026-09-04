package com.cogra.feature.content.wizard

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.semantics.SemanticsActions
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.DraftAsset
import com.cogra.domain.compose.DraftBodyKind
import com.cogra.domain.media.DeviceMedia
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.media.VideoFrame
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
    private var leaves = 0
    private var helps = mutableListOf<HelpTopic>()
    private var manages = 0
    private var describes = 0
    private var describedAt = mutableListOf<Int>()
    private var moves = mutableListOf<Pair<Int, Int>>()
    private var removals = mutableListOf<Int>()
    private var sealBacks = 0
    private var coverFrames = mutableListOf<Int>()
    private var coverPickers = 0
    private var dismissedRefusals = mutableListOf<Int>()

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
            onPickCoverFrame = { coverFrames += it },
            onOpenCoverPicker = { coverPickers += 1 },
            onDismissRefusal = { dismissedRefusals += it },
            onTitleChange = {},
            onDescriptionChange = {},
            onAltTextChange = { _, _ -> },
            onRetryUpload = { retries += it },
            onOpenSheet = { sheets += it },
            onCloseSheet = {},
            onLicenseChange = {},
            onPDirectedChange = {},
            onSensitiveChange = {},
            onSensitiveReasonChange = {},
            onNext = { nexts += 1 },
            onBack = { backs += 1 },
            onLeave = { leaves += 1 },
            onSealBack = { sealBacks += 1 },
            onOpenHelp = { helps += it },
            onCloseHelp = {},
            onManagePictures = { manages += 1 },
            onDescribePictures = { describes += 1 },
            onDescribeAt = { describedAt += it },
            onMovePick = { from, to -> moves += (from to to) },
            onRemovePickAt = { removals += it },
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
        deviceMedia = listOf(DeviceMedia("a", 1f), DeviceMedia("b", 1f), DeviceMedia("c", 1f)),
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
        compose.onNodeWithTag("wizard_words_next").assertIsNotEnabled()
    }

    @Test
    fun theNextPillWaitsForAPick() {
        compose.setContent { Wizard(ComposeWizardState()) }
        compose.onNodeWithTag("wizard_pick_next").assertIsNotEnabled()
    }

    @Test
    fun aTypedBodyEnablesTheNextPill() {
        compose.setContent { Wizard(words.copy(body = "Salt maps")) }
        compose.onNodeWithTag("wizard_words_next").assertIsEnabled()
        compose.onNodeWithTag("wizard_words_next").performClick()
        assertThat(nexts).isEqualTo(1)
    }

    @Test
    fun theCropStagePutsItsForwardActionAtTheBottomRatherThanTheHeader() {
        // The corner means "leave" for the whole flow: it used to mean
        // Next on the early stages, and an author trained on it left the
        // flow by reaching for Next (jakob 2026-09-01).
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Crop)) }

        compose.onNodeWithTag("wizard_header_action").assertDoesNotExist()
        compose.onNodeWithTag("wizard_crop_next").assertIsDisplayed()
        compose.onNodeWithTag("wizard_header_leave").assertIsDisplayed()
    }

    @Test
    fun thePickStageAlsoCarriesItsNextAtTheBottom() {
        compose.setContent { Wizard(withPicks) }

        compose.onNodeWithTag("wizard_header_action").assertDoesNotExist()
        compose.onNodeWithTag("wizard_pick_next").assertIsDisplayed()
    }

    @Test
    fun theSealSaysWhereTheSensitiveMarkStands() {
        compose.setContent { Wizard(words.copy(step = WizardStep.Seal)) }
        compose.onNodeWithText("Not marked").assertExists()
        compose.onNodeWithTag("wizard_seal_sensitive_action").performClick()
        assertThat(sheets).containsExactly(SealSheet.Sensitive)
    }

    @Test
    fun aMarkedSealSaysSoAndOffersToChangeIt() {
        compose.setContent {
            Wizard(words.copy(step = WizardStep.Seal, sensitive = true))
        }
        compose.onNodeWithText("Marked").assertExists()
        // Bound to the tag, not the word: the license row says "Change" too.
        compose.onNodeWithTag("wizard_seal_sensitive_action").assertIsDisplayed()
    }

    @Test
    fun theReasonIsOnlyLiveOnceTheMarkIs() {
        // The contract refuses a reason without the mark, so the field is
        // not offered before the switch is on.
        compose.setContent {
            Wizard(words.copy(step = WizardStep.Seal, sheet = SealSheet.Sensitive))
        }
        compose.onNodeWithTag("wizard_sensitive_reason").assertIsNotEnabled()

        compose.onNodeWithText(
            "Veils the pictures and the description until a reader chooses to look.",
        ).assertExists()
    }

    @Test
    fun theArrowStepsAndTheXLeaves() {
        // Two ways out, each doing one thing (jakob 2026-08-31). The X is
        // wired to leaving, not to the stage-stepping arrow.
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Details)) }

        compose.onNodeWithTag("wizard_header_leave").performClick()
        assertThat(leaves).isEqualTo(1)
        assertThat(backs).isEqualTo(0)

        compose.onNodeWithTag("wizard_header_back").performClick()
        assertThat(backs).isEqualTo(1)
        assertThat(leaves).isEqualTo(1)
    }

    @Test
    fun theSealCarriesTheOneQuestionMarkAndTheKeyAbsentSealDoesNot() {
        compose.setContent { Wizard(words.copy(step = WizardStep.Seal)) }
        compose.onNodeWithTag("wizard_header_help").performClick()
        assertThat(helps).containsExactly(HelpTopic.SignedActions)
    }

    @Test
    fun theKeyStoryOutranksTheSealStoryWhenTheKeyIsGone() {
        // One `?` per screen: on the key-absent seal it belongs to the key
        // notice, so the header carries none.
        compose.setContent { Wizard(words.copy(step = WizardStep.Seal, keyAbsent = true)) }
        compose.onNodeWithTag("wizard_header_help").assertDoesNotExist()
    }

    @Test
    fun thePickStageShowsTheTrayAndOpensTheShowAllSheet() {
        compose.setContent { Wizard(withPicks) }
        compose.onNodeWithTag("wizard_picked_count").assertIsDisplayed()
        compose.onNodeWithTag("wizard_tray_0").assertIsDisplayed()
        compose.onNodeWithTag("wizard_tray_1").assertIsDisplayed()

        // The tray shows; the sheet manages.
        compose.onNodeWithTag("wizard_show_all").performClick()
        assertThat(manages).isEqualTo(1)
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
        // is an offer rather than a warning. The grid scrolls — the stage
        // ends on its Next pill, so the later rows are reached rather than
        // always on screen.
        compose.onNodeWithTag("wizard_pick_grid")
            .performScrollToNode(hasTestTag("wizard_grid_c"))
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
    fun theCropStageCarriesNoKeyboard() {
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Crop)) }

        // Never from the crop step: a geometry step is no place for a
        // keyboard. Descriptions are authored on Details, in DescribeSheet.
        compose.onNodeWithTag("wizard_alt_0").assertDoesNotExist()
        compose.onNodeWithTag("wizard_describe_sheet").assertDoesNotExist()
    }

    @Test
    fun aFailedUploadCarriesItsWordsAndBothWaysOut() {
        val state = withPicks
            .copy(step = WizardStep.Details)
            .withUpload("b", AssetUpload.Failed(UploadFailure.PICTURE_TOO_BIG))
        compose.setContent { Wizard(state) }

        // The line carries the failure's words; the tile only wears the
        // badge, because retry does not fit in 48dp.
        compose.onNodeWithTag("wizard_upload_failed_1").performScrollTo().assertExists()
        compose.onNodeWithText("too big", substring = true).assertExists()
    }

    @Test
    fun thePickedRowOpensTheShowAllSheetAndCarriesNoCropOrEditLinks() {
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Details)) }

        // "none" (jakob 2026-08-31): managing the set is the sheet's job,
        // and the crop step is reached with Back.
        compose.onNodeWithTag("wizard_details_crop").assertDoesNotExist()
        compose.onNodeWithTag("wizard_details_edit").assertDoesNotExist()

        compose.onNodeWithTag("wizard_picked_row").performScrollTo().performClick()
        assertThat(manages).isEqualTo(1)
        assertThat(backs).isEqualTo(0)
    }

    @Test
    fun theDetailsStageCountsWhatHasBeenDescribed() {
        val state = withPicks
            .copy(step = WizardStep.Details)
            .withAltText("a", "A salt crust")
        compose.setContent { Wizard(state) }

        compose.onNodeWithText("· 1 of 2 described").performScrollTo().assertExists()
        compose.onNodeWithTag("wizard_describe_counter").performScrollTo().performClick()
        assertThat(describes).isEqualTo(1)
    }

    @Test
    fun theShowAllSheetManagesOneSetAndNothingElseDoes() {
        val state = withPicks.copy(step = WizardStep.Details, pickedSheetOpen = true)
        compose.setContent { Wizard(state) }

        compose.onNodeWithText("The first one is the cover — drag to reorder.").assertExists()
        compose.onNodeWithTag("wizard_picked_sheet_row_1_describe").performClick()
        assertThat(describedAt).containsExactly(1)

        compose.onNodeWithTag("wizard_picked_sheet_row_1_remove").performClick()
        assertThat(removals).containsExactly(1)
    }

    @Test
    fun theDescribeSheetIsWhereAltTextIsAuthored() {
        val state = withPicks.copy(step = WizardStep.Details, describingIndex = 0)
        compose.setContent { Wizard(state) }

        compose.onNodeWithTag("wizard_describe_sheet_field").assertExists()
        compose.onNodeWithText(
            "Read aloud to people who can't see it, and shown if the picture can't load.",
        ).assertExists()
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
    fun theSealCarriesTheAuthorsOwnSensitiveMark() {
        // The contract carries the self-mark now, so the row is real: it
        // says where the mark stands and opens the sheet that sets it.
        compose.setContent { Wizard(ComposeWizardState(body = "x", step = WizardStep.Seal)) }
        compose.onNodeWithTag("wizard_seal_sensitive").assertIsDisplayed()
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

    // -- The cover stage (`ComposeCover`) --

    private val onCover = ComposeWizardState(
        mode = BodyMode.Media,
        step = WizardStep.Cover,
        picked = listOf(PickedAsset("clip", 0.5625f, durationMs = 42_000)),
        coverFrames = List(3) {
            VideoFrame(it * 1_000, ProcessedPicture(ByteArray(4), 108, 192))
        },
    )

    @Test
    fun theCoverStageOffersEveryFrameAndAPictureOfYourOwn() {
        compose.setContent { Wizard(onCover) }
        compose.onNodeWithTag("wizard_cover_preview").assertIsDisplayed()
        // The preview is 342dp tall, so the tile row sits below the fold
        // on a test viewport and the stage scrolls to reach it.
        repeat(3) {
            compose.onNodeWithTag("wizard_cover_frame_$it").performScrollTo().assertIsDisplayed()
        }
        compose.onNodeWithTag("wizard_cover_picture").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("wizard_cover_next").assertIsDisplayed()
    }

    @Test
    fun tappingAFrameChoosesIt() {
        compose.setContent { Wizard(onCover) }
        compose.onNodeWithTag("wizard_cover_frame_2").performScrollTo().performClick()
        assertThat(coverFrames).containsExactly(2)
    }

    @Test
    fun thePictureTileHandsTheChoiceToTheDevice() {
        compose.setContent { Wizard(onCover) }
        compose.onNodeWithTag("wizard_cover_picture").performScrollTo().performClick()
        assertThat(coverPickers).isEqualTo(1)
    }

    @Test
    fun theCoverStageSaysItIsForVideoOnly() {
        compose.setContent { Wizard(onCover) }
        compose.onNodeWithText("Video only").assertIsDisplayed()
        compose.onNodeWithText("The video's face").assertIsDisplayed()
    }

    // -- Files the step would not take (`ComposePickedErrors`) --

    @Test
    fun aRefusedFileIsListedUnderTheTrayWithItsOwnWords() {
        val state = withPicks.copy(
            refused = listOf(
                RefusedPick(null, UploadFailure.UNREADABLE_FILE),
            ),
        )
        compose.setContent { Wizard(state) }

        compose.onNodeWithTag("wizard_refused_0").assertIsDisplayed()
        compose.onNodeWithTag("wizard_refused_thumb_0").assertIsDisplayed()
        // The accepted batch is untouched — a refused file never joined it.
        compose.onNodeWithTag("wizard_picked_count").assertIsDisplayed()
        compose.onNodeWithTag("wizard_pick_next").assertIsEnabled()
    }

    @Test
    fun aRefusalOffersNoRetryBecauseRetryingCannotHelp() {
        val state = withPicks.copy(refused = listOf(RefusedPick(null, UploadFailure.PICTURE_TOO_BIG)))
        compose.setContent { Wizard(state) }

        compose.onNodeWithText("Retry", substring = true).assertDoesNotExist()
        compose.onNodeWithText("Remove it", substring = true).assertIsDisplayed()
    }

    @Test
    fun theStepStaysUsableWithNothingPickedButSomethingRefused() {
        val state = ComposeWizardState(
            mode = BodyMode.Media,
            refused = listOf(RefusedPick(null, UploadFailure.REFUSED_PICTURE)),
        )
        compose.setContent { Wizard(state) }

        compose.onNodeWithTag("wizard_refused_0").assertIsDisplayed()
        compose.onNodeWithTag("wizard_pick_grid").assertIsDisplayed()
        // Nothing accepted yet, so there is nowhere to go on to.
        compose.onNodeWithTag("wizard_pick_next").assertIsNotEnabled()
    }

    @Test
    fun theRunningTimeIsWrittenTheWayTheBoardWritesIt() {
        assertThat(formatDuration(42_000)).isEqualTo("0:42")
        assertThat(formatDuration(95_000)).isEqualTo("1:35")
        // No duration cap, so an hour is a case rather than an accident.
        assertThat(formatDuration(3_725_000)).isEqualTo("1:02:05")
    }
}
