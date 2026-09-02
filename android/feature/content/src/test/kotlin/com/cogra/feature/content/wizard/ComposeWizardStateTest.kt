package com.cogra.feature.content.wizard

import com.cogra.core.designsystem.v2.media.CropFraming
import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.DraftAsset
import com.cogra.domain.compose.DraftBodyKind
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.CropWindow
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
    private val video = ComposeWizardState(
        mode = BodyMode.Media,
        picked = listOf(PickedAsset("clip", durationMs = 42_000)),
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
        // "Or start fresh —", pointing at the picker grid below it.
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

    // -- The picked-pictures manager --

    @Test
    fun reorderingCarriesTheCoverWithIt() {
        val three = media.copy(
            picked = listOf(PickedAsset("a"), PickedAsset("b"), PickedAsset("c")),
        )

        // The first one is the cover, and there is no separate cover flag
        // to fall out of step with the order.
        val moved = three.movedPick(from = 2, to = 0)

        assertThat(moved.picked.map { it.uri }).containsExactly("c", "a", "b").inOrder()
    }

    @Test
    fun aMoveOutsideTheTrayIsNoMove() {
        val two = media.copy(picked = listOf(PickedAsset("a"), PickedAsset("b")))

        assertThat(two.movedPick(0, 5).picked).isEqualTo(two.picked)
        assertThat(two.movedPick(-1, 0).picked).isEqualTo(two.picked)
        assertThat(two.movedPick(1, 1).picked).isEqualTo(two.picked)
    }

    @Test
    fun everyDrawerClosesBeforeTheStageMoves() {
        val atDetails = media.advanced()!!.advanced()!!.copy(pickedSheetOpen = true)

        val closed = atDetails.retreated()!!
        assertThat(closed.pickedSheetOpen).isFalse()
        assertThat(closed.step).isEqualTo(WizardStep.Details)

        // Only then does back walk the stages.
        assertThat(closed.retreated()?.step).isEqualTo(WizardStep.Crop)
    }

    @Test
    fun describingCountsOnlyWhatWasActuallyWritten() {
        val state = media.copy(
            picked = listOf(
                PickedAsset("a", altText = "A salt crust"),
                PickedAsset("b"),
                PickedAsset("c", altText = "   "),
            ),
        )

        // Alt text is authored, never invented — blank is not described.
        assertThat(state.describedCount).isEqualTo(1)
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

    // -- The crop, which has to survive leaving the stage --

    /** `a` framed to its left half; `b` never framed. */
    private val framed = media.copy(
        crops = mapOf("a" to CropSpec(targetRatio = 0.8f, window = CropWindow(0f, 0f, 0.5f, 1f))),
    )

    @Test
    fun theCropSurvivesSteppingForwardOffTheStageAndBackIntoIt() {
        // Jakob's round trip: crop, walk on, come back with the arrow.
        val cropped = framed.copy(step = WizardStep.Crop)

        val returned = cropped.advanced()!!.retreated()!!

        assertThat(returned.step).isEqualTo(WizardStep.Crop)
        assertThat(returned.crops).isEqualTo(cropped.crops)
    }

    @Test
    fun theCropSurvivesWalkingForwardsIntoTheStageASecondTime() {
        // The other direction he named: back to the pick stage, then
        // forward again with Next.
        val cropped = framed.copy(step = WizardStep.Crop)

        val returned = cropped.retreated()!!.advanced()!!

        assertThat(returned.step).isEqualTo(WizardStep.Crop)
        assertThat(returned.crops).isEqualTo(cropped.crops)
    }

    @Test
    fun everyLaterStagePreviewsThePictureAsItWasFramed() {
        // The details row, the picked sheet and the seal all read this.
        val pictures = framed.pickedPictures()

        assertThat(pictures[0].item.framing).isEqualTo(CropFraming(0f, 0f, 0.5f, 1f))
        // A pick nobody framed is previewed whole rather than guessed at.
        assertThat(pictures[1].item.framing).isEqualTo(CropFraming.Whole)
    }

    @Test
    fun droppingAPickDropsItsFramingWithIt() {
        // Kept, it would be handed to a re-pick of the same asset as if
        // the author had framed it this time.
        val after = framed.removePick("a")

        assertThat(after.crops).doesNotContainKey("a")
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
    fun theForwardActionIsHeldClosedUntilTheBodyIsReady() {
        assertThat(ComposeWizardState().forwardEnabled()).isFalse()
        assertThat(words.forwardEnabled()).isTrue()
    }

    @Test
    fun everyStageAfterTheBodyHasSomewhereToGo() {
        // Only the body can be unready; the crop and details stages always
        // advance, and the seal commits by signing rather than by Next.
        assertThat(words.advanced()!!.forwardEnabled()).isTrue()
        assertThat(media.advanced()!!.forwardEnabled()).isTrue()
        assertThat(words.copy(step = WizardStep.Seal).forwardEnabled()).isTrue()
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

    // -- The video path (`ComposeCover`) --

    @Test
    fun aVideoTakesTheCoverStageInsteadOfTheCrop() {
        assertThat(video.hasCoverStep).isTrue()
        assertThat(video.hasCropStep).isFalse()
        val next = video.advanced()
        assertThat(next?.step).isEqualTo(WizardStep.Cover)
        assertThat(next?.advanced()?.step).isEqualTo(WizardStep.Details)
    }

    @Test
    fun theCoverStageStepsBackToThePick() {
        val cover = video.copy(step = WizardStep.Cover)
        assertThat(cover.retreated()?.step).isEqualTo(WizardStep.Body)
        // …and details returns to the cover rather than to the crop a
        // video never passed through.
        assertThat(video.copy(step = WizardStep.Details).retreated()?.step)
            .isEqualTo(WizardStep.Cover)
    }

    @Test
    fun aClipReplacesAGalleryAndAGalleryReplacesAClip() {
        val gallery = media.togglePick("clip", durationMs = 4_000)
        assertThat(gallery.picked.map { it.uri }).containsExactly("clip")
        assertThat(gallery.isVideoPost).isTrue()

        val backToPictures = gallery.togglePick("c")
        assertThat(backToPictures.picked.map { it.uri }).containsExactly("c")
        assertThat(backToPictures.isVideoPost).isFalse()
    }

    @Test
    fun asecondClipReplacesTheFirstRatherThanJoiningIt() {
        val second = video.togglePick("other", durationMs = 9_000)
        assertThat(second.picked.map { it.uri }).containsExactly("other")
    }

    @Test
    fun changingTheBodyForgetsThePreviousClipsFace() {
        val faced = video.copy(
            coverChoice = CoverChoice.Frame(2),
            coverMediaId = "cover-1",
        )
        val swapped = faced.togglePick("other", durationMs = 1_000)
        assertThat(swapped.coverMediaId).isNull()
        assertThat(swapped.coverChoice).isEqualTo(CoverChoice.Frame(0))
    }

    @Test
    fun aVideoIsNotCompleteUntilItsCoverHasLanded() {
        val uploaded = video.withUpload("clip", AssetUpload.Done("video-1"))
        // The clip has an id and the cover does not: signing would send a
        // video naming a poster that is not there.
        assertThat(uploaded.uploadsComplete).isFalse()
        assertThat(uploaded.copy(coverMediaId = "cover-1").uploadsComplete).isTrue()
    }

    @Test
    fun theSealCallsAVideoAVideo() {
        assertThat(video.copy(title = "Low tide").sealSummary).isEqualTo("Low tide — video")
        // A gallery still counts pictures.
        assertThat(media.copy(title = "Low tide").sealSummary).isEqualTo("Low tide — 2 pictures")
    }

    @Test
    fun theFirstFrameIsTheFaceUntilTheAuthorSaysOtherwise() {
        assertThat(ComposeWizardState().coverChoice).isEqualTo(CoverChoice.Frame(0))
    }
}
