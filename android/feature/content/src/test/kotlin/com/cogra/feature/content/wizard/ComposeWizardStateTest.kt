package com.cogra.feature.content.wizard

import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.DraftAsset
import com.cogra.domain.compose.DraftBodyKind
import com.cogra.domain.compose.DraftShape
import com.cogra.feature.content.TagRow
import com.cogra.feature.content.TagSectionState
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The wizard's transitions, pinned as pure functions.
 *
 * Every branch is here rather than in a UI test because the state
 * machine is where the XOR, the cap and the two path lengths actually
 * live — a UI test would prove the buttons are wired, not that the
 * rules hold.
 */
class ComposeWizardStateTest {

    private val words = ComposeWizardState(mode = BodyMode.Words, body = "Salt maps")
    private val media = ComposeWizardState(
        mode = BodyMode.Media,
        picked = listOf(PickedAsset("a"), PickedAsset("b")),
    )

    // -- The two path lengths --

    @Test
    fun theWordsPathSkipsTheCropStage() {
        val next = words.advanced()
        assertThat(next?.step).isEqualTo(WizardStep.Details)
    }

    @Test
    fun theMediaPathCropsBeforeDetails() {
        val next = media.advanced()
        assertThat(next?.step).isEqualTo(WizardStep.Crop)
        assertThat(next?.advanced()?.step).isEqualTo(WizardStep.Details)
    }

    @Test
    fun aFreshComposerStartsOnThePictures() {
        // Images-first: `ComposeDraft` captions the stage behind its offer
        // "Or start fresh — pick one picture…", which is the picker.
        assertThat(ComposeWizardState().mode).isEqualTo(BodyMode.Media)
        assertThat(ComposeWizardState().step).isEqualTo(WizardStep.Body)
    }

    @Test
    fun theSealsBackPillRetracesTheSamePathItCameBy() {
        val atDetails = media.advanced()!!.advanced()!!
        assertThat(atDetails.retreated()?.step).isEqualTo(WizardStep.Crop)

        val wordsAtDetails = words.advanced()!!
        assertThat(wordsAtDetails.retreated()?.step).isEqualTo(WizardStep.Body)
    }

    @Test
    fun thereIsNoStageBeforeTheBody() {
        assertThat(words.retreated()).isNull()
    }

    // -- The details board's two ways back --

    @Test
    fun cropAndEditReachTwoDifferentStages() {
        val atDetails = media.advanced()!!.advanced()!!

        assertThat(atDetails.returnedTo(WizardStep.Crop).step).isEqualTo(WizardStep.Crop)
        assertThat(atDetails.returnedTo(WizardStep.Body).step).isEqualTo(WizardStep.Body)
    }

    @Test
    fun aWordsPostHasNoCropToReturnTo() {
        val atDetails = words.advanced()!!

        assertThat(atDetails.returnedTo(WizardStep.Crop).step).isEqualTo(WizardStep.Details)
    }

    @Test
    fun aJumpNeverSkipsForward() {
        // Forward is the `Next` pill's business, and only it knows whether
        // the stage is ready.
        assertThat(media.returnedTo(WizardStep.Seal).step).isEqualTo(WizardStep.Body)
        assertThat(media.returnedTo(WizardStep.Body).step).isEqualTo(WizardStep.Body)
    }

    @Test
    fun leavingTheSealForAnEarlierStageClosesItsSheet() {
        val sealed = words.copy(step = WizardStep.Seal, sheet = SealSheet.License)

        assertThat(sealed.returnedTo(WizardStep.Details).sheet).isEqualTo(SealSheet.None)
    }

    @Test
    fun backFromTheSealClosesAnOpenSheetFirst() {
        val sealed = words.copy(step = WizardStep.Seal, sheet = SealSheet.License)
        val once = sealed.retreated()
        assertThat(once?.sheet).isEqualTo(SealSheet.None)
        assertThat(once?.step).isEqualTo(WizardStep.Seal)
        assertThat(once?.retreated()?.step).isEqualTo(WizardStep.Details)
    }

    @Test
    fun theSealNeverAdvances() {
        assertThat(words.copy(step = WizardStep.Seal).advanced()).isNull()
    }

    // -- The body XOR (D16) --

    @Test
    fun anEmptyBodyCannotAdvance() {
        assertThat(ComposeWizardState().advanced()).isNull()
        assertThat(ComposeWizardState(body = "   ").advanced()).isNull()
    }

    @Test
    fun anEmptyPickCannotAdvance() {
        assertThat(ComposeWizardState(mode = BodyMode.Media).advanced()).isNull()
    }

    @Test
    fun switchingHalvesKeepsBothButOnlyOneIsTheBody() {
        val both = words.togglePick("a").withMode(BodyMode.Media)
        // Nothing was lost: the paragraph is still there.
        assertThat(both.body).isEqualTo("Salt maps")
        assertThat(both.picked).hasSize(1)
        // But the mode decides which half is the body, and it is the
        // mode the submit reads.
        assertThat(both.mode).isEqualTo(BodyMode.Media)
        assertThat(both.bodyReady).isTrue()
        assertThat(both.withMode(BodyMode.Words).bodyReady).isTrue()
    }

    @Test
    fun anEmptyHalfIsNotReadyEvenWhenTheOtherHalfIsFull() {
        val picksOnly = ComposeWizardState(mode = BodyMode.Media).togglePick("a")
        assertThat(picksOnly.withMode(BodyMode.Words).bodyReady).isFalse()
    }

    // -- Picking --

    @Test
    fun pickingIsOrderAndTheFirstPickLeads() {
        val picked = ComposeWizardState(mode = BodyMode.Media)
            .togglePick("a")
            .togglePick("b")
            .togglePick("c")
        assertThat(picked.picked.map { it.uri }).containsExactly("a", "b", "c").inOrder()
    }

    @Test
    fun pickingTheSameAssetTwiceRemovesIt() {
        val once = ComposeWizardState(mode = BodyMode.Media).togglePick("a")
        assertThat(once.togglePick("a").picked).isEmpty()
    }

    @Test
    fun theTenthPickIsTheLastOneTaken() {
        var state = ComposeWizardState(mode = BodyMode.Media)
        repeat(ComposeWizardState.MAX_POST_ASSETS + 3) { state = state.togglePick("a$it") }
        assertThat(state.picked).hasSize(ComposeWizardState.MAX_POST_ASSETS)
        assertThat(state.bodyReady).isTrue()
    }

    @Test
    fun removingAPickPullsTheFramingCursorBack() {
        val state = ComposeWizardState(mode = BodyMode.Media)
            .togglePick("a")
            .togglePick("b")
            .copy(framingIndex = 1)
        assertThat(state.removePick("b").framingIndex).isEqualTo(0)
    }

    // -- Uploads (D5) --

    @Test
    fun oneFailedUploadLeavesTheOthersAlone() {
        val state = media
            .withUpload("a", AssetUpload.Done("m1"))
            .withUpload("b", AssetUpload.Failed("nope"))
        assertThat(state.uploadedIds).containsExactly("m1")
        assertThat(state.uploadsFailed).isTrue()
        assertThat(state.uploadsComplete).isFalse()
    }

    @Test
    fun signingWaitsUntilEveryPickHasAnId() {
        val half = media.copy(step = WizardStep.Seal).withUpload("a", AssetUpload.Done("m1"))
        assertThat(half.canSign).isFalse()
        val whole = half.withUpload("b", AssetUpload.Done("m2"))
        assertThat(whole.canSign).isTrue()
    }

    @Test
    fun aWordsPostNeverWaitsForAnUpload() {
        assertThat(words.copy(step = WizardStep.Seal).canSign).isTrue()
    }

    @Test
    fun anAbsentKeyBlocksSigningWhateverElseIsReady() {
        assertThat(words.copy(step = WizardStep.Seal, keyAbsent = true).canSign).isFalse()
    }

    // -- The seal's arithmetic --

    @Test
    fun aGalleryAddsNoActs() {
        // Attaching media mints nothing (api-spec.md
        // `PrepareContentPayload`), so ten pictures cost what one
        // Publish costs.
        assertThat(media.signedActionCount).isEqualTo(1)
    }

    @Test
    fun everyTopicAndCitationIsItsOwnAct() {
        val state = words.copy(
            tagSection = TagSectionState(tags = listOf(TagRow("fieldnotes"), TagRow("coastroad"))),
        )
        assertThat(state.signedActionCount).isEqualTo(3)
    }

    @Test
    fun theSealSummaryNamesTheBodyItIsAbout() {
        assertThat(media.copy(title = "Salt maps").sealSummary)
            .isEqualTo("Salt maps — 2 pictures")
        assertThat(media.sealSummary).isEqualTo("2 pictures")
        assertThat(words.sealSummary).isEqualTo("Salt maps — words")
    }

    // -- The draft round trip --

    @Test
    fun aDraftKeepsWhatWasAuthoredAndDropsWhatWasUploaded() {
        val state = media
            .copy(title = "Salt maps", shape = DraftShape.Wide)
            .withAltText("a", "A salt crust")
            .withUpload("a", AssetUpload.Done("m1"))

        val restored = ComposeWizardState.from(state.toDraft())

        assertThat(restored.title).isEqualTo("Salt maps")
        assertThat(restored.shape).isEqualTo(DraftShape.Wide)
        assertThat(restored.picked.map { it.altText }).containsExactly("A salt crust", "")
        // Ids are deliberately dropped: a previous session's asset may
        // have been swept as an orphan (D5), so the wizard re-uploads
        // rather than attaching something that might be gone.
        assertThat(restored.uploadedIds).isEmpty()
    }

    @Test
    fun anUntouchedWizardIsNotWorthKeeping() {
        assertThat(ComposeWizardState().toDraft().isEmpty).isTrue()
        assertThat(words.toDraft().isEmpty).isFalse()
    }

    @Test
    fun aRestoredDraftKeepsItsHalfOfTheBody() {
        val draft = ComposeDraft(
            bodyKind = DraftBodyKind.Media,
            assets = listOf(DraftAsset("a")),
        )
        assertThat(ComposeWizardState.from(draft).mode).isEqualTo(BodyMode.Media)
        assertThat(ComposeWizardState.from(draft.copy(bodyKind = DraftBodyKind.Words)).mode)
            .isEqualTo(BodyMode.Words)
    }

    // -- The header, which reads the stage rather than counting steps --

    @Test
    fun theHeaderNamesTheStageAndNeverCountsIt() {
        assertThat(words.headerTitle()).isEqualTo("New post")
        assertThat(media.advanced()!!.headerTitle()).isEqualTo("Crop")
        assertThat(words.advanced()!!.headerTitle()).isEqualTo("Details")
        assertThat(words.copy(step = WizardStep.Seal).headerTitle()).isEqualTo("What you sign")
    }

    @Test
    fun theDetailsAndSealStagesCarryNoHeaderAction() {
        assertThat(words.headerAction()).isEqualTo("Next")
        assertThat(words.advanced()!!.headerAction()).isNull()
        assertThat(words.copy(step = WizardStep.Seal).headerAction()).isNull()
    }

    @Test
    fun theHeaderActionIsDisabledUntilTheBodyIsReady() {
        assertThat(ComposeWizardState().headerActionEnabled()).isFalse()
        assertThat(words.headerActionEnabled()).isTrue()
    }

    // -- The refusal path --

    @Test
    fun anAttachmentRefusalNamesItsOwnPick() {
        assertThat(attachmentFieldIndex(listOf("attachments", "2", "mediaId"))).isEqualTo(2)
        assertThat(attachmentFieldIndex(listOf("tags", "0", "name"))).isNull()
        assertThat(attachmentFieldIndex(null)).isNull()
    }

    @Test
    fun aProblemLineSpeaksOnceAndInPriorityOrder() {
        assertThat(words.problem()).isNull()
        assertThat(words.copy(transportFailed = true).problem()).contains("reach the server")
        assertThat(words.copy(signingFailed = true).problem()).contains("Nothing was published")
        // A named refusal wins: it is the server's own words.
        assertThat(words.copy(refusal = "too many", transportFailed = true).problem())
            .isEqualTo("too many")
    }
}
