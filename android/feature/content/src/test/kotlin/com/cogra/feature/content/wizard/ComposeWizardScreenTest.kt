package com.cogra.feature.content.wizard

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionContains
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertDoesNotExist
import androidx.compose.ui.test.assertHasNoClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.filterToOne
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.unit.height
import androidx.compose.ui.unit.width
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.crypto.ActorKey
import com.cogra.domain.ReferenceContentKind
import com.cogra.domain.ReferenceTargetView
import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.ComposeDraftStore
import com.cogra.domain.compose.DraftAsset
import com.cogra.domain.compose.DraftBodyKind
import com.cogra.domain.media.DeviceMedia
import com.cogra.domain.media.DeviceMediaSource
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.media.VideoFrame
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingMediaProcessor
import com.cogra.domain.testing.ThrowingMediaRepository
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.cogra.domain.testing.ThrowingVideoProcessor
import com.cogra.feature.content.ReferenceRow
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagRow
import com.cogra.feature.content.TagSectionState
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
    private var restoreKeys = 0
    private var keepDrafts = 0
    private var stanceDrags = mutableListOf<Double>()
    private var stanceSets = 0
    private var referenceRemovals = mutableListOf<String>()
    private var referenceTunings = mutableListOf<String>()

    @Composable
    private fun Wizard(
        state: ComposeWizardState,
        permission: MediaPermission = MediaPermission.Granted(partial = false),
        onTogglePick: (String) -> Unit = { picked += it },
        onRemovePickAt: (Int) -> Unit = { removals += it },
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
            onTogglePick = onTogglePick,
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
            onPDirectedChange = { stanceDrags += it },
            onSetStance = { stanceSets += 1 },
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
            onRemovePickAt = onRemovePickAt,
            onSign = { signs += 1 },
            onContinueDraft = { draftContinues += 1 },
            onDiscardDraft = { draftDiscards += 1 },
            onRestoreKey = { restoreKeys += 1 },
            onKeepDraft = { keepDrafts += 1 },
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
            onRemoveReference = { referenceRemovals += it },
            onTuneReference = { referenceTunings += it },
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

    // -- A real ViewModel, for the questions only the wiring answers --

    private val drafts = object : ComposeDraftStore {
        var held: ComposeDraft? = null

        override suspend fun draft(): ComposeDraft? = held

        override suspend fun save(draft: ComposeDraft) {
            held = draft
        }

        override suspend fun clear() {
            held = null
        }
    }

    private val roll = object : DeviceMediaSource {
        override suspend fun newestMedia(limit: Int): List<DeviceMedia> =
            listOf(DeviceMedia("a", 1f))
    }

    private val pictures = object : ThrowingMediaProcessor() {
        override suspend fun aspectRatio(uri: String): Float? = 1f
    }

    private fun viewModel(): ComposeWizardViewModel {
        val actor = ActorKey.generate()
        return ComposeWizardViewModel(
            content = ThrowingContentRepository(),
            references = ThrowingReferenceRepository(),
            media = ThrowingMediaRepository(),
            processor = pictures,
            video = ThrowingVideoProcessor(),
            deviceMedia = roll,
            drafts = drafts,
            signer = WriteSigner(
                SealingWriteRepository(actor),
                FakeIdentityStore().apply { seed = actor.seed() },
            ),
        )
    }

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
            "Veils the pictures and the words until a reader chooses to look.",
        ).assertExists()
    }

    // Visible but disabled over the cap, never hidden (the caps-affordance
    // round's ruling, PR #755's pattern) — Done stays on screen so the
    // author can trim back under the cap, rather than losing the way out.
    @Test
    fun theSensitiveDoneStaysVisibleButDisabledOverTheCap() {
        compose.setContent {
            Wizard(
                words.copy(
                    step = WizardStep.Seal,
                    sheet = SealSheet.Sensitive,
                    sensitive = true,
                    sensitiveReason = "x".repeat(141),
                ),
            )
        }
        compose.onNodeWithTag("wizard_sensitive_done").assertExists().assertIsNotEnabled()
    }

    @Test
    fun theSensitiveDoneStaysEnabledAtTheCapTheWriteSideAllows() {
        compose.setContent {
            Wizard(
                words.copy(
                    step = WizardStep.Seal,
                    sheet = SealSheet.Sensitive,
                    sensitive = true,
                    sensitiveReason = "x".repeat(140),
                ),
            )
        }
        compose.onNodeWithTag("wizard_sensitive_done").assertExists().assertIsEnabled()
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
    fun theVideoTrayShowsTheChosenCoverMarkOnceThereIsOne() {
        // ComposePickVideoCover (design/backlog.md intake 2026-09-15): the
        // back arrow from the cover stage lands here, and the tray has to
        // say the cover already exists rather than reading coverless again.
        val withCover = ComposeWizardState(
            picked = listOf(PickedAsset("clip", 0.5625f, durationMs = 42_000)),
            coverFrames = List(3) { VideoFrame(it * 1_000, ProcessedPicture(ByteArray(4), 108, 192)) },
            coverChoice = CoverChoice.Frame(0),
        )
        compose.setContent { Wizard(withCover) }
        compose.onNodeWithTag("media_thumb_cover_mark", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theVideoTrayHasNoCoverMarkBeforeAChoiceIsMade() {
        val coverless = ComposeWizardState(
            picked = listOf(PickedAsset("clip", 0.5625f, durationMs = 42_000)),
            coverFrames = List(3) { VideoFrame(it * 1_000, ProcessedPicture(ByteArray(4), 108, 192)) },
        )
        compose.setContent { Wizard(coverless) }
        compose.onNodeWithTag("media_thumb_cover_mark", useUnmergedTree = true).assertDoesNotExist()
    }

    // The details board's Cover field (`ComposeDetailsVideo`, design/readme.md
    // §13, 2026-09-22): a field with two states, never a second entrance. The
    // door reaches the same cover stage as "Change the cover" — one Back away.

    @Test
    fun theDetailsStepShowsTheCoverDoorWhenNoCoverIsChosen() {
        val withVideoNoCover = ComposeWizardState(
            step = WizardStep.Details,
            picked = listOf(PickedAsset("clip", 0.5625f, durationMs = 42_000)),
        )
        compose.setContent { Wizard(withVideoNoCover) }

        // The door reaches the cover stage the same way "Change the cover"
        // does: one Back away, never a second entrance (jakob 2026-08-31).
        compose.onNodeWithTag("wizard_cover_door").assertIsDisplayed().performClick()
        assertThat(backs).isEqualTo(1)
        compose.onNodeWithTag("wizard_cover_face", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("wizard_cover_change").assertDoesNotExist()
    }

    // Finding 6, jakob's ruling 2026-09-22 (design/readme.md §13 "The
    // cover's tile"): ONE ATTACHMENT IS ONE TILE. A clip that walked the
    // cover step draws no separate Cover section at all — the chosen
    // frame rides the picked row's own tile as its inset corner mark.
    @Test
    fun theDetailsStepMergesTheChosenCoverIntoTheVideoTilesOwnMark() {
        val withVideoCover = ComposeWizardState(
            step = WizardStep.Details,
            picked = listOf(PickedAsset("clip", 0.5625f, durationMs = 42_000)),
            coverFrames = List(3) { VideoFrame(it * 1_000, ProcessedPicture(ByteArray(4), 108, 192)) },
            coverChoice = CoverChoice.Frame(0),
        )
        compose.setContent { Wizard(withVideoCover) }

        compose.onNodeWithTag("wizard_picked_row").assertIsDisplayed()
        compose.onNodeWithTag("media_thumb_cover_mark", useUnmergedTree = true).assertIsDisplayed()
        compose.onNodeWithTag("wizard_cover_door").assertDoesNotExist()
        compose.onNodeWithTag("wizard_cover_face", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("wizard_cover_change").assertDoesNotExist()
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

    private val withVideoPicked = ComposeWizardState(
        mode = BodyMode.Media,
        picked = listOf(PickedAsset("clip", 1f, durationMs = 42_000)),
        deviceMedia = listOf(
            DeviceMedia("clip", 1f, durationMs = 42_000),
            DeviceMedia("other", 1f),
        ),
    )

    // CW-06 (`ComposePickVideo`'s `PickTray`): one clip is not a set to
    // reorder, so the tray drops Show all and carries the caption this state
    // needs instead of the sheet.
    @Test
    fun theTraySwapsInTheClipsOwnCaptionAndDropsShowAll() {
        compose.setContent { Wizard(withVideoPicked) }

        compose.onNodeWithTag("wizard_picked_count").assertTextEquals("Picked · 1")
        compose.onNodeWithText("A video is the whole post. Its cover comes next.").assertIsDisplayed()
        compose.onNodeWithTag("wizard_show_all").assertDoesNotExist()
    }

    // CW-07 (`ComposePickVideo`'s `DeadGrid`): a post carries pictures OR one
    // video, so once a clip is staged the grid — the photos-app tile and
    // every device tile alike — takes no more picks.
    @Test
    fun theGridGoesDeadOnceAClipIsStaged() {
        compose.setContent { Wizard(withVideoPicked) }

        compose.onNodeWithTag("wizard_open_picker").assertIsNotEnabled()
        compose.onNodeWithTag("wizard_grid_other").assertHasNoClickAction()
        compose.onNodeWithTag("wizard_grid_clip").assertHasNoClickAction()
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

    /**
     * Taking the caption's own invitation.
     *
     * "Or start fresh —" points at the grid, so a picture picked under
     * the offer answers it. Driven through the real ViewModel rather than
     * a hand-built state, because the defect was precisely that no
     * handler recorded the answer: the offer stayed up over the work, the
     * stage kept the dim the offer puts on it, and Continue was still
     * there to replace the new pictures with the old draft.
     */
    @Test
    fun pickingAPictureUnderTheOfferAnswersIt() {
        drafts.held = ComposeDraft(
            bodyKind = DraftBodyKind.Media,
            title = "Salt maps",
            assets = listOf(DraftAsset("old")),
        )
        val wizard = viewModel()
        wizard.start()
        wizard.onMediaPermissionGranted()

        compose.setContent {
            val state by wizard.state.collectAsState()
            Wizard(state, onTogglePick = wizard::onTogglePick)
        }
        compose.onNodeWithTag("wizard_draft_offer").assertIsDisplayed()

        compose.onNodeWithTag("wizard_grid_a").performClick()

        compose.onNodeWithTag("wizard_draft_offer").assertDoesNotExist()
        compose.onNodeWithTag("wizard_pick_next").assertIsEnabled()
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
    fun theCropStageCarriesTheQuietNoteExactlyOnce() {
        // CW-11's audit citation ("CropStep.kt — no such note anywhere in
        // the file") was true of this file's own text but not of what the
        // stage renders: `MediaCrop` already defaults its `caption` param to
        // this exact string (core/designsystem/.../media/MediaCrop.kt:62).
        // This pins ComposeCrop's caption to appearing once, not zero times
        // and not twice — a regression this lane's first draft introduced by
        // adding a second, unaware of MediaCrop's own default.
        compose.setContent { Wizard(withPicks.copy(step = WizardStep.Crop)) }
        compose
            .onAllNodesWithText("One shape for the whole post. Drag to move, pinch to zoom.")
            .assertCountEquals(1)
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

    // Finding 4 of jakob's round-four review, 2026-09-23 (jakob's
    // 2026-09-23 ruling, ComposePicked.jsx / ComposeDetails.jsx): the
    // manager's own last x behaves like the video path's — the sheet
    // closes and the pick step comes back, tray empty.
    @Test
    fun removingTheLastPictureInTheManagerClosesItAndReturnsThePickStep() {
        var state by mutableStateOf(
            withPicks.copy(
                picked = listOf(PickedAsset("a", 1f)),
                step = WizardStep.Details,
                pickedSheetOpen = true,
            ),
        )
        compose.setContent {
            Wizard(
                state = state,
                onRemovePickAt = { index -> state = state.removePick(state.picked[index].uri) },
            )
        }

        compose.onNodeWithTag("wizard_picked_sheet_row_0_remove").performClick()

        compose.onNodeWithTag("wizard_picked_sheet").assertDoesNotExist()
        compose.onNodeWithTag("wizard_pick_next").assertIsDisplayed()
    }

    @Test
    fun theDescribeSheetIsWhereAltTextIsAuthored() {
        val state = withPicks.copy(step = WizardStep.Details, describingIndex = 0)
        compose.setContent { Wizard(state) }

        compose.onNodeWithTag("wizard_describe_sheet_field").assertExists()
        // CW-15 (2026-09-08 UI audit): the reason rides under the title,
        // permanently — not an extended trailing line near the field. Two
        // matches are expected: the sheet's own line and the counter's
        // (CW-18), both still on screen behind the open sheet.
        compose.onAllNodesWithText("Read aloud to people who can't see it.")
            .assertCountEquals(2)
        compose.onNodeWithTag("wizard_describe_sheet_play_disc").assertDoesNotExist()
    }

    // The video body's describe shape (CW-16, CW-17) has its own tests in
    // ComposeWizardVideoDescribeTest — this class is already at detekt's
    // LargeClass edge.

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

    // Finding 4's upload-line guard (design/components/compose/UploadNotice.prompt.md
    // lines 1, 11): the line is strictly the in-flight gate and must never
    // draw "Uploading 0 of 0" for a media-mode batch the removal fix left
    // empty — reachable only transitionally (`canSign` already refuses an
    // empty batch on its own, see `ComposeWizardStateTest`), but the line
    // has to hold the contract regardless of how the state arrived.
    @Test
    fun theUploadLineNeverDrawsForAnEmptyBatch() {
        val emptied = ComposeWizardState(mode = BodyMode.Media, step = WizardStep.Seal)
        compose.setContent { Wizard(emptied) }

        compose.onNodeWithTag("wizard_seal_uploading").assertDoesNotExist()
    }

    @Test
    fun theSealRefusesToSignWithAnEmptyMediaBatch() {
        val emptied = ComposeWizardState(mode = BodyMode.Media, step = WizardStep.Seal)
        compose.setContent { Wizard(emptied) }

        compose.onNodeWithTag("wizard_sign").assertIsNotEnabled()
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

    // CW-22: the act block's label is "Tags", the board's word
    // (_shared.jsx:839), not "Topics".
    @Test
    fun theSealsTagRowIsLabelledTagsNotTopics() {
        val state = ComposeWizardState(
            body = "x",
            step = WizardStep.Seal,
            tagSection = TagSectionState(tags = listOf(TagRow("fieldnotes"))),
        )
        compose.setContent { Wizard(state) }
        compose.onNodeWithText("Tags").assertExists()
        compose.onNodeWithText("Topics").assertDoesNotExist()
    }

    // CW-22 (the parked half): each tag draws as its own readout-tone chip
    // (`_shared.jsx:840-845`'s `<Chip tone="readout">`), not a single
    // joined string — and a readout is shown, not pressed.
    @Test
    fun theSealsTagsEachDrawAsANonInteractiveReadoutChip() {
        val state = ComposeWizardState(
            body = "x",
            step = WizardStep.Seal,
            tagSection = TagSectionState(tags = listOf(TagRow("fieldnotes"), TagRow("coastroad"))),
        )
        compose.setContent { Wizard(state) }
        compose.onNodeWithText("#fieldnotes").assertExists().assert(hasClickAction().not())
        compose.onNodeWithText("#coastroad").assertExists().assert(hasClickAction().not())
    }

    // CW-21: the References act row reads the citation's own name and its
    // stance, not a bare count.
    @Test
    fun theSealsReferencesRowNamesTheCitationAndItsStance() {
        val target = ReferenceTargetView.Profile(id = "u1", handle = "ada", displayName = "Ada")
        val state = ComposeWizardState(
            body = "x",
            step = WizardStep.Seal,
            referenceSection = ReferenceSectionState(
                references = listOf(ReferenceRow("u1", target, relevance = 0.1, support = 0.1)),
            ),
        )
        compose.setContent { Wizard(state) }
        compose.onNodeWithText("@ada").assertExists()
        compose.onNodeWithText("1 cited").assertDoesNotExist()
    }

    // The N-cited round (jakob's rulings 2026-09-14, design backlog item 70):
    // at two the name stops being the shortest true answer, so the row counts
    // and the whole row becomes the door to the sheet that lists them.
    @Test
    fun theSealsReferencesRowCountsFromTwoAndTheWholeRowOpensTheSheet() {
        compose.setContent { Wizard(sealWithTwoCitations()) }

        val door = compose.onNodeWithTag("wizard_seal_cited")
        door.assertExists()
        compose.onNodeWithText("2 cited").assertExists()
        // The name it stopped saying is not said anywhere on the seal.
        compose.onNodeWithText("@ada").assertDoesNotExist()
        // No chevron and no trailing word: the label on the gesture is what
        // says the line is a door at all, count folded in — "Manage the N
        // citations", and at one "Manage the 1 citation" (copy-voice.md:409-419).
        assertThat(door.fetchSemanticsNode().config[SemanticsActions.OnClick].label)
            .isEqualTo("Manage the 2 citations")

        door.performClick()
        assertThat(sheets).containsExactly(SealSheet.Cited)
    }

    // `ComposeCitations`: the count opens the list, each control names its own
    // citation, and the sheet adds nothing — citations are staged where they
    // are staged.
    @Test
    fun theCitedSheetListsWhatTheRowCountsAndOffersNoSecondPick() {
        compose.setContent { Wizard(sealWithTwoCitations().copy(sheet = SealSheet.Cited)) }

        compose.onNodeWithTag("wizard_cited_sheet").assertExists()
        compose.onNodeWithText("Cited · 2").assertExists()
        compose.onNodeWithTag("wizard_cited_sheet_row_0").assertExists()
        compose.onNodeWithTag("wizard_cited_sheet_row_1").assertExists()
        compose.onNodeWithText("+ Cite something", substring = true).assertDoesNotExist()

        compose.onNodeWithTag("wizard_cited_sheet_row_0_remove").performClick()
        assertThat(referenceRemovals).containsExactly("u1")
        compose.onNodeWithTag("wizard_cited_sheet_row_1_repair").performClick()
        assertThat(referenceTunings).containsExactly("p2")
    }

    // Item 73 (jakob's ruling 2026-09-14): the digit is what the eye gets,
    // and an ear given "2" alone gets nothing — so the count's node answers
    // with the whole reading, in the ROW's own noun.
    @Test
    fun theActsRowsShowTheCountBareAndSpeakItWhole() {
        compose.setContent { Wizard(sealWithTwoCitations()) }

        compose.onNodeWithText("2").assertContentDescriptionContains("2 citations")
        compose.onNodeWithText("1").assertContentDescriptionContains("1 post")
    }

    private fun sealWithTwoCitations() = ComposeWizardState(
        body = "x",
        step = WizardStep.Seal,
        referenceSection = ReferenceSectionState(
            references = listOf(
                ReferenceRow(
                    "u1",
                    ReferenceTargetView.Profile(id = "u1", handle = "ada", displayName = "Ada"),
                    relevance = 0.1,
                    support = 0.1,
                ),
                ReferenceRow(
                    "p2",
                    ReferenceTargetView.Content(
                        kind = ReferenceContentKind.POST,
                        id = "p2",
                        title = "Tide tables",
                        snippet = null,
                        authorHandle = "juno",
                        authorDisplayName = null,
                    ),
                    relevance = -0.2,
                    support = 0.1,
                ),
            ),
        ),
    )

    // An opinion on one's own post is ONE number (jakob, 2026-09-14): the
    // second is census-fixed rather than picked, so the row that read back
    // a pair was showing a figure nobody chose. The face is the one-axis
    // table's — 🙂 at +0.10 — and the number beside it is the one number.
    @Test
    fun theSealsStanceRowReadsOneNumberNotAPair() {
        val state = ComposeWizardState(body = "x", step = WizardStep.Seal, pDirected = 0.1)
        compose.setContent { Wizard(state) }
        compose.onNodeWithTag("wizard_seal_stance").assertIsDisplayed()
        compose.onNodeWithText("🙂 +0.10", substring = true).assertExists()
        compose.onNodeWithText("+0.10 / +1.00", substring = true).assertDoesNotExist()
    }

    // CW-31/CW-32/CW-33/CW-34: the pad parks over the page with its own
    // wash, carries the blessed "?" and a drawn one-axis field, and only
    // Set moves the stance the seal reads.
    @Test
    fun theStancePadParksOverThePageRatherThanRidingTheSheetHost() {
        val state = ComposeWizardState(body = "x", step = WizardStep.Seal, sheet = SealSheet.Stance)
        compose.setContent { Wizard(state) }
        compose.onNodeWithTag("wizard_pad_wash").assertExists()
        compose.onNodeWithTag("wizard_stance_pad").assertIsDisplayed()
        compose.onNodeWithTag("wizard_stance_field").assertIsDisplayed()
        // The drawer host draws nothing for the pad any more.
        compose.onNodeWithTag("wizard_stance_sheet").assertDoesNotExist()
        compose.onNodeWithTag("wizard_stance_slider").assertDoesNotExist()
    }

    @Test
    fun thePadsHelpDotOpensTheOpinionTopic() {
        val state = ComposeWizardState(body = "x", step = WizardStep.Seal, sheet = SealSheet.Stance)
        compose.setContent { Wizard(state) }
        compose.onNodeWithTag("wizard_stance_help").performClick()
        assertThat(helps).containsExactly(HelpTopic.YourOpinionOnYourPost)
    }

    @Test
    fun thePadReadsTheStagedValueAndCommitsOnlyOnSet() {
        val state = ComposeWizardState(
            body = "x",
            step = WizardStep.Seal,
            sheet = SealSheet.Stance,
            pDirected = 0.1,
            stagedPDirected = 0.6,
        )
        compose.setContent { Wizard(state) }
        // The pad shows what the finger has, not what the seal is holding.
        compose.onNodeWithTag("wizard_stance_reading")
            .assertContentDescriptionContains("Like this, For or against +0.60")
        assertThat(stanceSets).isEqualTo(0)

        compose.onNodeWithTag("wizard_stance_set").performClick()
        assertThat(stanceSets).isEqualTo(1)
    }

    // CW-27: the license sheet's "?" opens the same house explanation the
    // sensitive sheet's own "?" already opens through.
    //
    // Two "?"s coexist here — the header's own (`wizard_header_help`,
    // "Signed actions") is unconditional on the seal step regardless of
    // any sheet open over it, a pre-existing condition this finding did
    // not touch — so the sheet's is picked out by excluding that tag.
    @Test
    fun theLicenseSheetsHelpOpensItsTopic() {
        val state = ComposeWizardState(body = "x", step = WizardStep.Seal, sheet = SealSheet.License)
        compose.setContent { Wizard(state) }
        compose.onAllNodesWithText("?").filterToOne(hasTestTag("wizard_header_help").not()).performClick()
        assertThat(helps).containsExactly(HelpTopic.License)
    }

    // CW-29: the audit clause the board carries on both non-zero
    // provenance degrees, and the credit degree's "everything else is
    // free" clause.
    @Test
    fun theLicenseSheetsHintsCarryTheirAuditClause() {
        val state = ComposeWizardState(body = "x", step = WizardStep.Seal, sheet = SealSheet.License)
        compose.setContent { Wizard(state) }
        compose.onNodeWithText("Commercial uses credit you; everything else is free.").assertExists()
        compose.onNodeWithText("Commercial uses are logged publicly and stay open to audit.").assertExists()
        compose.onNodeWithText("Every use is logged publicly and stays open to audit.").assertExists()
    }

    @Test
    fun anAbsentKeyReplacesTheSignPillWithTheWayToRestoreIt() {
        val state = ComposeWizardState(body = "x", step = WizardStep.Seal, keyAbsent = true)
        compose.setContent { Wizard(state) }
        compose.onNodeWithTag("wizard_key_absent").assertIsDisplayed()
        compose.onNodeWithTag("wizard_sign").assertDoesNotExist()
    }

    // CW-36: the key-absent seal reads back only the license — the stance
    // and sensitive rows the sign flow still lets a reader adjust are gone,
    // and a live seal still shows all three.
    @Test
    fun theKeyAbsentSealShowsOnlyTheLicenseRow() {
        val absent = ComposeWizardState(body = "x", step = WizardStep.Seal, keyAbsent = true)
        compose.setContent { Wizard(absent) }
        compose.onNodeWithTag("wizard_seal_license").assertIsDisplayed()
        compose.onNodeWithTag("wizard_seal_stance").assertDoesNotExist()
        compose.onNodeWithTag("wizard_seal_sensitive").assertDoesNotExist()
    }

    @Test
    fun aLiveSealStillShowsAllThreeTerms() {
        val live = ComposeWizardState(body = "x", step = WizardStep.Seal, keyAbsent = false)
        compose.setContent { Wizard(live) }
        compose.onNodeWithTag("wizard_seal_license").assertIsDisplayed()
        compose.onNodeWithTag("wizard_seal_stance").assertIsDisplayed()
        compose.onNodeWithTag("wizard_seal_sensitive").assertIsDisplayed()
    }

    // CW-37/38: the panel carries its own inverse "?" (opening the "Your
    // key" topic) and an inverse restore action.
    @Test
    fun theKeyAbsentPanelCarriesItsOwnHelpAndRestoresTheKey() {
        val state = ComposeWizardState(body = "x", step = WizardStep.Seal, keyAbsent = true)
        compose.setContent { Wizard(state) }

        compose.onNodeWithTag("wizard_key_help").performClick()
        assertThat(helps).containsExactly(HelpTopic.Key)

        compose.onNodeWithTag("wizard_restore_key").performClick()
        assertThat(restoreKeys).isEqualTo(1)
    }

    // CW-39/40: keep-draft is a sibling below the panel — reachable and
    // wired to its own callback, distinct from the seal's ordinary back
    // (`onKeepDraft` leaves the wizard; `wizard-view.tsx`'s web counterpart
    // wires the same shape to `leaveFlow` rather than `dispatch({type:
    // "back"})`).
    @Test
    fun keepDraftSitsBesideThePanelAndLeavesRatherThanSteppingBack() {
        val state = ComposeWizardState(body = "x", step = WizardStep.Seal, keyAbsent = true)
        compose.setContent { Wizard(state) }

        compose.onNodeWithTag("wizard_key_absent").assertIsDisplayed()
        compose.onNodeWithTag("wizard_keep_draft").assertIsDisplayed()
        compose.onNodeWithTag("wizard_keep_draft").performClick()

        assertThat(keepDrafts).isEqualTo(1)
        assertThat(sealBacks).isEqualTo(0)
        assertThat(backs).isEqualTo(0)
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
        // The preview is as tall as the clip's frame — 4:5 for this
        // vertical one — so the tile row sits below the fold on a test
        // viewport and the stage scrolls to reach it.
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

    /**
     * The preview's measured frame, as a width ÷ height ratio.
     *
     * Read off the laid-out node rather than from the state: the finding
     * this pins was a preview that *computed* nothing wrong and still
     * drew a square, because its height was a constant.
     */
    private fun previewRatio(): Float {
        val bounds = compose.onNodeWithTag("wizard_cover_preview").getUnclippedBoundsInRoot()
        return bounds.width.value / bounds.height.value
    }

    @Test
    fun aWideClipIsPreviewedWide() {
        val clip = PickedAsset("clip", 16f / 9f, durationMs = 42_000)
        compose.setContent { Wizard(onCover.copy(picked = listOf(clip))) }
        assertThat(previewRatio()).isWithin(TOLERANCE).of(16f / 9f)
    }

    @Test
    fun aSquareClipIsPreviewedSquare() {
        val clip = PickedAsset("clip", 1f, durationMs = 42_000)
        compose.setContent { Wizard(onCover.copy(picked = listOf(clip))) }
        assertThat(previewRatio()).isWithin(TOLERANCE).of(1f)
    }

    /**
     * A phone's own recording is 9:16, and the reel round clamps it:
     * "anything taller than 4:5 centre-crops to 4:5". The preview is the
     * frame the post will have, so it clamps with it.
     */
    @Test
    fun aVerticalClipIsPreviewedAtTheFourFiveClamp() {
        compose.setContent { Wizard(onCover) }
        assertThat(previewRatio()).isWithin(TOLERANCE).of(0.8f)
    }

    /**
     * The header is read a beat after the pick, and the preview cannot
     * wait for it — nor may it hand `Modifier.aspectRatio` a number that
     * would throw.
     */
    @Test
    fun aClipThatHasNotSaidItsShapeIsPreviewedSquare() {
        assertThat(coverPreviewRatio(null)).isEqualTo(1f)
        assertThat(coverPreviewRatio(0f)).isEqualTo(1f)
        assertThat(coverPreviewRatio(-2f)).isEqualTo(1f)
        assertThat(coverPreviewRatio(Float.NaN)).isEqualTo(1f)
        assertThat(coverPreviewRatio(Float.POSITIVE_INFINITY)).isEqualTo(1f)
    }

    @Test
    fun theClampIsOnlyEverAFloor() {
        // Wider than 4:5 keeps its own shape; taller is raised to it.
        assertThat(coverPreviewRatio(1.91f)).isWithin(TOLERANCE).of(1.91f)
        assertThat(coverPreviewRatio(0.8f)).isWithin(TOLERANCE).of(0.8f)
        assertThat(coverPreviewRatio(0.5625f)).isWithin(TOLERANCE).of(0.8f)
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

/**
 * A laid-out frame is measured in whole pixels, so its ratio lands a
 * rounding away from the number that produced it.
 */
private const val TOLERANCE = 0.02f
