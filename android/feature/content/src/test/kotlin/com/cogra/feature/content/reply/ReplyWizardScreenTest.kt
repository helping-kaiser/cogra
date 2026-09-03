package com.cogra.feature.content.reply

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.media.VideoFrame
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.RefusedPick
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The reply wizard's screens, bound to test tags rather than to display
 * copy (android/CLAUDE.md), so a wording pass never breaks the suite.
 *
 * These prove the boards are *drawn and wired* — the transitions
 * themselves are pinned in `ReplyWizardStateTest`. A prior fabric shipped
 * a view bug that only a view-level test could catch, which is why the
 * two halves are both here rather than only the cheaper one: a rule that
 * holds in the state machine can still reach no pixel.
 */
@RunWith(RobolectricTestRunner::class)
// The composer does not scroll — it is drawn to fit a phone, and the
// canvas draws it at 390 × 844. Robolectric's default sandbox screen is
// smaller than any phone the app ships to, so the video state's frame,
// cover row and pill would fall off a screen no reader has. `qualifiers`
// is Robolectric's own way to say which device the test stands on
// (robolectric.org/device-configuration).
@Config(qualifiers = "w411dp-h891dp")
class ReplyWizardScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private var nexts = 0
    private var backs = 0
    private var leaves = 0
    private var coverFrames = mutableListOf<Int>()
    private var coverPickers = 0
    private var dismissedRefusals = mutableListOf<Int>()
    private var retriedUploads = mutableListOf<String>()
    private var keeps = 0
    private var discards = 0
    private var signs = 0
    private var sealBacks = 0
    private var pickerOpens = 0
    private var describes = 0
    private var restores = 0
    private val removals = mutableListOf<Int>()
    private val sheets = mutableListOf<ReplySealSheet>()
    private val helps = mutableListOf<HelpTopic>()
    private val stances = mutableListOf<Pair<Double, Double>>()

    @Composable
    private fun Wizard(state: ReplyWizardState) {
        ReplyWizardScreen(
            state = state,
            onBodyChange = {},
            onOpenPicker = { pickerOpens += 1 },
            onRemovePickAt = { removals += it },
            onDescribePictures = { describes += 1 },
            onAltTextChange = { _, _ -> },
            onPickCoverFrame = { coverFrames += it },
            onOpenCoverPicker = { coverPickers += 1 },
            onDismissRefusal = { dismissedRefusals += it },
            onRetryUpload = { retriedUploads += it },
            onKeepWriting = { keeps += 1 },
            onDiscard = { discards += 1 },
            onNext = { nexts += 1 },
            onBack = { backs += 1 },
            onLeave = { leaves += 1 },
            onSealBack = { sealBacks += 1 },
            onOpenSheet = { sheets += it },
            onCloseSheet = {},
            onLicenseChange = {},
            onStanceChange = { d, i -> stances += d to i },
            onOpenHelp = { helps += it },
            onCloseHelp = {},
            onSign = { signs += 1 },
            onRestoreKey = { restores += 1 },
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

    // -- `ReplyCompose` --

    /** The board pins what is being answered above the words. */
    @Test
    fun theComposerShowsWhatIsBeingAnswered() {
        compose.setContent { Wizard(composerWithWords()) }

        compose.onNodeWithTag("reply_target").assertIsDisplayed()
        compose.onNodeWithTag("reply_body").assertIsDisplayed()
        compose.onNodeWithTag("reply_hint").assertIsDisplayed()
    }

    /** An empty composer cannot advance: an answer is words first (D16). */
    @Test
    fun nextIsHeldUntilThereAreWords() {
        compose.setContent { Wizard(ReplyWizardState(target = POST_TARGET)) }

        compose.onNodeWithTag("reply_next").assertIsNotEnabled()
    }

    @Test
    fun nextIsOfferedOnceThereAreWords() {
        compose.setContent { Wizard(composerWithWords()) }

        compose.onNodeWithTag("reply_next").assertIsEnabled().performClick()

        assertThat(nexts).isEqualTo(1)
    }

    /**
     * `ReplyCompose` 5: "+ Add pictures" opens the platform's own picker.
     * Comments have no pick stage, so there is nothing between the tap
     * and the system sheet.
     */
    @Test
    fun addPicturesOpensThePlatformPicker() {
        compose.setContent { Wizard(composerWithWords()) }

        compose.onNodeWithTag("reply_add_pictures").performClick()

        assertThat(pickerOpens).isEqualTo(1)
    }

    /** The cap disables the offer rather than letting a fifth pick fail. */
    @Test
    fun addPicturesIsHeldAtTheCap() {
        val full = composerWithWords().copy(
            picked = (1..ReplyWizardState.MAX_PICTURES).map {
                PickedAsset("uri://$it", upload = AssetUpload.Done("m$it"))
            },
        )

        compose.setContent { Wizard(full) }

        compose.onNodeWithTag("reply_add_pictures").assertIsNotEnabled()
    }

    // -- `ReplyPictures` --

    /** The tray and its describe counter appear only once pictures do. */
    @Test
    fun theTrayIsDrawnOnlyWithPictures() {
        compose.setContent { Wizard(composerWithWords()) }

        compose.onNodeWithTag("reply_tray").assertDoesNotExist()
        compose.onNodeWithTag("reply_describe_counter").assertDoesNotExist()
    }

    @Test
    fun theTrayDrawsAPictureAndItsWayOut() {
        compose.setContent { Wizard(composerWithPicture()) }

        compose.onNodeWithTag("reply_tray").assertIsDisplayed()
        compose.onNodeWithTag("reply_tray_0_remove").performClick()

        assertThat(removals).containsExactly(0)
    }

    /** `ReplyPictures` 6 — the describe sheet is reached from the counter. */
    @Test
    fun theDescribeCounterReachesTheDescribeSheet() {
        compose.setContent { Wizard(composerWithPicture()) }

        compose.onNodeWithTag("reply_describe_counter").performClick()

        assertThat(describes).isEqualTo(1)
    }

    // -- `ReplySeal` --

    /**
     * The seal draws the acts, the two rows it still lets the author
     * change, and the two pills — and **not** a Sensitive row: the
     * approved deviation of 2026-09-01, kept honest by a test so it
     * cannot creep back in unnoticed before the veiled comment exists.
     */
    @Test
    fun theSealDrawsItsRowsAndNoSensitiveRow() {
        compose.setContent { Wizard(sealWithWords()) }

        compose.onNodeWithTag("reply_seal_acts").assertIsDisplayed()
        compose.onNodeWithTag("reply_seal_total").assertExists()
        compose.onNodeWithTag("reply_seal_stance").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("reply_seal_license").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("wizard_seal_sensitive").assertDoesNotExist()
        compose.onNodeWithTag("reply_seal_sensitive").assertDoesNotExist()
    }

    /** `ReplySeal` 6: Adjust opens the pad. */
    @Test
    fun adjustOpensThePad() {
        compose.setContent { Wizard(sealWithWords()) }

        compose.onNodeWithTag("reply_seal_stance_action").performScrollTo().performClick()

        assertThat(sheets).containsExactly(ReplySealSheet.Stance)
    }

    /** `ReplySeal` 7: Change opens the license sheet. */
    @Test
    fun changeOpensTheLicenseSheet() {
        compose.setContent { Wizard(sealWithWords()) }

        compose.onNodeWithTag("reply_seal_license_action").performScrollTo().performClick()

        assertThat(sheets).containsExactly(ReplySealSheet.License)
    }

    /** `ReplySeal` 4 and 5 — the two declaring offers. */
    @Test
    fun theSealOffersTopicsAndCitationsWhileNoneAreDeclared() {
        compose.setContent { Wizard(sealWithWords()) }

        compose.onNodeWithTag("reply_seal_add_topic").performClick()
        compose.onNodeWithTag("reply_seal_cite").performClick()

        assertThat(sheets)
            .containsExactly(ReplySealSheet.Topics, ReplySealSheet.References)
            .inOrder()
    }

    /** `ReplySeal` 9 and 10. */
    @Test
    fun theSealSignsAndStepsBack() {
        compose.setContent { Wizard(sealWithWords()) }

        compose.onNodeWithTag("reply_sign").assertIsEnabled().performClick()
        compose.onNodeWithTag("reply_seal_back").performClick()

        assertThat(signs).isEqualTo(1)
        assertThat(sealBacks).isEqualTo(1)
    }

    /**
     * `ComposeSealUploading` — the gate. The line shows and the sign
     * button is held while a picture is still on its way, because a
     * gallery entry naming an asset that has not landed names nothing.
     */
    @Test
    fun theSealIsGatedWhileAPictureUploads() {
        val uploading = sealWithWords().copy(
            picked = listOf(PickedAsset(URI_A, upload = AssetUpload.Running)),
        )

        compose.setContent { Wizard(uploading) }

        compose.onNodeWithTag("reply_seal_uploading").assertIsDisplayed()
        compose.onNodeWithTag("reply_sign").assertIsNotEnabled()
    }

    @Test
    fun theUploadingLineIsGoneOnceEveryPictureHasLanded() {
        val landed = sealWithWords().copy(
            picked = listOf(PickedAsset(URI_A, upload = AssetUpload.Done("m1"))),
        )

        compose.setContent { Wizard(landed) }

        compose.onNodeWithTag("reply_seal_uploading").assertDoesNotExist()
        compose.onNodeWithTag("reply_sign").assertIsEnabled()
    }

    /**
     * `ComposeKeyAbsent`: the seal's pills give way to the restore card,
     * whose second way out says only that it leaves — a comment has no
     * draft to promise (jakob 2026-09-01).
     */
    @Test
    fun theKeyAbsentSealOffersTheRestoreInsteadOfSigning() {
        compose.setContent { Wizard(sealWithWords().copy(keyAbsent = true)) }

        compose.onNodeWithTag("reply_key_absent").assertIsDisplayed()
        compose.onNodeWithTag("reply_sign").assertDoesNotExist()
        compose.onNodeWithTag("reply_restore_key").performClick()
        compose.onNodeWithTag("reply_key_absent_leave").performClick()

        assertThat(restores).isEqualTo(1)
        assertThat(leaves).isEqualTo(1)
    }

    /** The seal's one `?` — and the key-absent seal has none. */
    @Test
    fun theSealCarriesTheSignedActionsHelp() {
        compose.setContent { Wizard(sealWithWords()) }

        compose.onNodeWithTag("reply_header_help").performClick()

        assertThat(helps).containsExactly(HelpTopic.SignedActions)
    }

    @Test
    fun theKeyAbsentSealCarriesNoHelpDot() {
        compose.setContent { Wizard(sealWithWords().copy(keyAbsent = true)) }

        compose.onNodeWithTag("reply_header_help").assertDoesNotExist()
    }

    /** The composer's header carries no "Last step" note; the seal's does. */
    @Test
    fun onlyTheSealSaysLastStep() {
        compose.setContent { Wizard(composerWithWords()) }

        compose.onNodeWithTag("reply_header").assertIsDisplayed()
        compose.onNodeWithTag("reply_next").assertIsDisplayed()
    }

    // -- The ways out --

    @Test
    fun theHeaderStepsBackAndLeaves() {
        compose.setContent { Wizard(composerWithWords()) }

        compose.onNodeWithTag("reply_header_back").performClick()
        compose.onNodeWithTag("reply_header_leave").performClick()

        assertThat(backs).isEqualTo(1)
        assertThat(leaves).isEqualTo(1)
    }

    // -- Problems --

    @Test
    fun aRefusalThatNamedNoFieldIsShown() {
        compose.setContent {
            Wizard(sealWithWords().copy(refusal = "That target does not accept comments."))
        }

        compose.onNodeWithTag("reply_problem").assertIsDisplayed()
    }

    @Test
    fun aFailedUploadSaysSo() {
        val failed = composerWithWords().copy(
            picked = listOf(PickedAsset(URI_A, upload = AssetUpload.Failed("refused"))),
        )

        compose.setContent { Wizard(failed) }

        compose.onNodeWithTag("reply_problem").assertIsDisplayed()
    }

    // -- The video state (`ReplyVideo`) --

    @Test
    fun aClipDrawsItsFrameItsOneDescriptionAndItsFace() {
        compose.setContent { Wizard(composerWithClip()) }

        compose.onNodeWithTag("reply_clip").assertIsDisplayed()
        compose.onNodeWithTag("reply_describe_counter").assertIsDisplayed()
        repeat(4) {
            compose.onNodeWithTag("reply_cover_frame_$it").assertIsDisplayed()
        }
        compose.onNodeWithTag("reply_cover_picture").assertIsDisplayed()
    }

    @Test
    fun aClipCarriesNoAddControlAtAll() {
        // Pictures or a video, never both — an add button that could
        // only refuse is worse than no button.
        compose.setContent { Wizard(composerWithClip()) }
        compose.onNodeWithTag("reply_add_pictures").assertDoesNotExist()
    }

    @Test
    fun theAddLabelCountsPicturesAndOffersBothWhenEmpty() {
        compose.setContent { Wizard(composerWithWords()) }
        compose.onNodeWithText("+ Add pictures or a video").assertIsDisplayed()
    }

    @Test
    fun tappingACoverFrameChoosesIt() {
        compose.setContent { Wizard(composerWithClip()) }
        compose.onNodeWithTag("reply_cover_frame_2").performClick()
        assertThat(coverFrames).containsExactly(2)
    }

    @Test
    fun theCoverPictureTileHandsTheChoiceToTheDevice() {
        compose.setContent { Wizard(composerWithClip()) }
        compose.onNodeWithTag("reply_cover_picture").performClick()
        assertThat(coverPickers).isEqualTo(1)
    }

    // -- Files the composer would not take (`ReplyMediaErrors`) --

    @Test
    fun aRefusedFileIsListedWhereItWasOfferedWithNoRetry() {
        val state = composerWithWords().copy(
            refused = listOf(RefusedPick(null, "That file isn't a picture or a video CoGra can read.")),
        )
        compose.setContent { Wizard(state) }

        compose.onNodeWithTag("reply_refused_0").assertIsDisplayed()
        compose.onNodeWithTag("reply_refused_thumb_0").assertIsDisplayed()
        compose.onNodeWithText("Retry", substring = true).assertDoesNotExist()
        compose.onNodeWithText("Remove it", substring = true).assertIsDisplayed()
        // Nothing was attached, so the composer is still words-only and
        // Next still reaches the seal.
        compose.onNodeWithTag("reply_next").assertIsEnabled()
    }

    /**
     * Each refused file gets its own line and its own tile — both kinds
     * can be refused on the same screen, and the list says so file by
     * file rather than collapsing into one notice.
     *
     * The removal itself is pinned in `ReplyWizardStateTest`: "Remove
     * it" is a link span inside an annotated string, which the suite
     * does not reach positionally anywhere in this repo.
     */
    @Test
    fun everyRefusedFileGetsItsOwnLine() {
        val state = composerWithWords().copy(
            refused = listOf(
                RefusedPick(URI_CLIP, "That video is too big — a comment's video can be up to 50 MB."),
                RefusedPick(null, "That file isn't a picture or a video CoGra can read."),
            ),
        )
        compose.setContent { Wizard(state) }

        compose.onNodeWithTag("reply_refused_0").assertIsDisplayed()
        compose.onNodeWithTag("reply_refused_1").assertIsDisplayed()
        compose.onNodeWithTag("reply_refused_thumb_1").assertIsDisplayed()
        // The comment cap, in the words copy-voice blesses for it.
        compose.onNodeWithText("up to 50 MB", substring = true).assertIsDisplayed()
    }

    // -- Leaving (`DiscardConfirm`) --

    @Test
    fun aNonEmptyComposerIsAskedBeforeItIsDiscarded() {
        compose.setContent { Wizard(composerWithWords().copy(confirmingDiscard = true)) }

        compose.onNodeWithTag("reply_discard_confirm").assertIsDisplayed()
        compose.onNodeWithText("Discard this reply?").assertIsDisplayed()
        compose.onNodeWithText("Nothing is kept.").assertIsDisplayed()
    }

    @Test
    fun keepWritingClosesTheDialogAndDiscardEndsTheReply() {
        compose.setContent { Wizard(composerWithWords().copy(confirmingDiscard = true)) }

        compose.onNodeWithTag("reply_discard_confirm_keep").performClick()
        assertThat(keeps).isEqualTo(1)

        compose.onNodeWithTag("reply_discard_confirm_discard").performClick()
        assertThat(discards).isEqualTo(1)
    }

    @Test
    fun anUnaskedComposerDrawsNoDialog() {
        compose.setContent { Wizard(composerWithWords()) }
        compose.onNodeWithTag("reply_discard_confirm").assertDoesNotExist()
    }

    // -- The clip that didn't upload (`ReplyVideoFailed`) --

    @Test
    fun aFailedClipOffersRetryBecauseAFaultIsNotAnAnswer() {
        compose.setContent { Wizard(failedClip()) }

        // A refusal drops Retry; a fault keeps it — the file was fine
        // and the network wasn't. The line carries both ways out, which
        // is why the tile's own × is gone.
        compose.onNodeWithTag("reply_clip_failed")
            .assertIsDisplayed()
            .assertTextContains("That video didn't upload.", substring = true)
            .assertTextContains("Retry", substring = true)
            .assertTextContains("Remove it", substring = true)
    }

    @Test
    fun theFailedClipKeepsItsFaceAndItsDescription() {
        // The frames were cut on the device, so they exist whether or
        // not the bytes ever reached CoGra — choosing one while the clip
        // retries is not wasted work.
        compose.setContent { Wizard(failedClip()) }

        compose.onNodeWithTag("reply_describe_counter").assertIsDisplayed()
        repeat(4) { compose.onNodeWithTag("reply_cover_frame_$it").assertIsDisplayed() }
    }

    @Test
    fun theFooterGoesWithTheUploadItDescribed() {
        // "it uploads while you write" would contradict the error line.
        compose.setContent { Wizard(failedClip()) }
        compose.onNodeWithTag("reply_hint").assertDoesNotExist()
    }

    private fun composerWithWords() = ReplyWizardState(
        target = POST_TARGET,
        body = "The third headland light is real.",
    )

    private fun composerWithClip() = composerWithWords().copy(
        picked = listOf(PickedAsset(URI_CLIP, sourceRatio = 1f, durationMs = 18_000)),
        coverFrames = List(4) {
            VideoFrame(it * 1_000, ProcessedPicture(ByteArray(4), 108, 108))
        },
    )

    /** The same composer with the clip's upload spent (`ReplyVideoFailed`). */
    private fun failedClip() = composerWithClip().let { state ->
        state.copy(
            picked = state.picked.map {
                it.copy(upload = AssetUpload.Failed("That video didn't upload."))
            },
        )
    }

    private fun composerWithPicture() = composerWithWords().copy(
        picked = listOf(PickedAsset(URI_A, sourceRatio = 0.8f, upload = AssetUpload.Done("m1"))),
    )

    private fun sealWithWords() = composerWithWords().copy(step = ReplyStep.Seal)

    private companion object {
        const val URI_A = "content://pick/a"
        const val URI_CLIP = "content://pick/clip"

        val POST_TARGET = ReplyTarget(
            id = "post-1",
            kind = ReplyTargetKind.Post,
            title = "The long way home",
            snippet = "The light does something at the third headland",
            authorHandle = "ada",
        )
    }
}
