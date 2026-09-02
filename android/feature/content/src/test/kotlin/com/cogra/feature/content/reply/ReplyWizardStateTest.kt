package com.cogra.feature.content.reply

import com.cogra.core.designsystem.v2.media.CropFraming
import com.cogra.feature.content.ReferenceRow
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagRow
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.RefusedPick
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The reply wizard's transitions, read off the canonical boards and
 * `graph.json`'s edges out of `ReplyCompose`, `ReplyPictures` and
 * `ReplySeal`.
 *
 * These are pure functions on the state, so every branch of the flow is
 * a JVM test rather than a UI one — the same split the post wizard's
 * `ComposeWizardStateTest` makes.
 */
class ReplyWizardStateTest {

    // -- Stage movement ------------------------------------------------

    /** `ReplyCompose` 3: `Next` reaches the seal. */
    @Test
    fun nextFromTheComposerReachesTheSeal() {
        val state = composerWithWords()

        assertThat(state.advanced()?.step).isEqualTo(ReplyStep.Seal)
    }

    /**
     * A comment is words **plus** optional pictures (D16), so the words
     * alone gate the advance: an answer is words first.
     */
    @Test
    fun theComposerWillNotAdvanceWithoutWords() {
        val state = ReplyWizardState(target = POST_TARGET)

        assertThat(state.advanced()).isNull()
    }

    /** Pictures never stand in for the words a comment answers with. */
    @Test
    fun picturesAloneDoNotUnlockNext() {
        val state = ReplyWizardState(
            target = POST_TARGET,
            picked = listOf(PickedAsset(URI_A, upload = AssetUpload.Done(MEDIA_A))),
        )

        assertThat(state.advanced()).isNull()
    }

    /** The seal advances by signing, never by `Next`. */
    @Test
    fun theSealDoesNotAdvance() {
        val state = composerWithWords().copy(step = ReplyStep.Seal)

        assertThat(state.advanced()).isNull()
    }

    /** `ReplySeal` 1 and 10 — the arrow and the `Back` pill reach the words. */
    @Test
    fun backFromTheSealReachesTheComposer() {
        val state = composerWithWords().copy(step = ReplyStep.Seal)

        assertThat(state.retreated()?.step).isEqualTo(ReplyStep.Compose)
    }

    /**
     * The composer is the one place back leaves the flow from, which is
     * what makes null the signal to leave rather than a stage to draw.
     */
    @Test
    fun backFromTheComposerLeavesTheFlow() {
        assertThat(composerWithWords().retreated()).isNull()
    }

    /** A sheet is a drawer over the stage: it closes before the stage moves. */
    @Test
    fun aDrawerClosesBeforeTheStageMoves() {
        val state = composerWithWords()
            .copy(step = ReplyStep.Seal, sheet = ReplySealSheet.License)

        val back = state.retreated()

        assertThat(back?.step).isEqualTo(ReplyStep.Seal)
        assertThat(back?.sheet).isEqualTo(ReplySealSheet.None)
    }

    /** The describe sheet is a drawer too — the same rule reaches it. */
    @Test
    fun theDescribeSheetClosesBeforeTheStageMoves() {
        val state = composerWithWords().copy(describingIndex = 0)

        val back = state.retreated()

        assertThat(back?.step).isEqualTo(ReplyStep.Compose)
        assertThat(back?.describingIndex).isNull()
    }

    // -- The tray ------------------------------------------------------

    /**
     * `ReplyPictures` 7 draws the cap into the label — "+ Add pictures ·
     * 2 of 4" — and api-spec.md `PrepareCommentInput` enforces it: at
     * most four per comment (D9).
     */
    @Test
    fun theTrayStopsAtFourPictures() {
        val full = ReplyWizardState(
            target = POST_TARGET,
            picked = (1..ReplyWizardState.MAX_PICTURES).map { PickedAsset("uri://$it") },
        )

        assertThat(full.canAddPicture).isFalse()
        assertThat(full.addPick("uri://spill").picked).hasSize(ReplyWizardState.MAX_PICTURES)
    }

    /** The contract refuses a gallery carrying one asset twice. */
    @Test
    fun theSameAssetIsNeverStagedTwice() {
        val state = ReplyWizardState(target = POST_TARGET).addPick(URI_A).addPick(URI_A)

        assertThat(state.picked).hasSize(1)
    }

    /** `ReplyPictures` 5: the picture leaves the tray. */
    @Test
    fun removingAPictureTakesItOutOfTheTray() {
        val state = ReplyWizardState(target = POST_TARGET).addPick(URI_A).addPick(URI_B)

        assertThat(state.removePick(URI_A).picked.map { it.uri }).containsExactly(URI_B)
    }

    /** A sheet describing the removed picture has nothing left to describe. */
    @Test
    fun removingAPictureClosesTheDescribeSheet() {
        val state = ReplyWizardState(target = POST_TARGET)
            .addPick(URI_A)
            .copy(describingIndex = 0)

        assertThat(state.removePick(URI_A).describingIndex).isNull()
    }

    /** `DescribeCounter`'s count — descriptions are authored, never invented. */
    @Test
    fun describedCountsOnlyTheDescribedPictures() {
        val state = ReplyWizardState(target = POST_TARGET)
            .addPick(URI_A)
            .addPick(URI_B)
            .withAltText(URI_A, "A person holding a film camera")

        assertThat(state.describedCount).isEqualTo(1)
        // Blank is not a description.
        assertThat(state.withAltText(URI_B, "   ").describedCount).isEqualTo(1)
    }

    /** The composer draws its pictures state once anything is in the tray. */
    @Test
    fun theComposerKnowsWhenItIsDrawingPictures() {
        assertThat(composerWithWords().hasPictures).isFalse()
        assertThat(composerWithWords().addPick(URI_A).hasPictures).isTrue()
    }

    // -- Uploads -------------------------------------------------------

    /**
     * `ComposeSealUploading`: signing waits for the pictures, because a
     * gallery entry naming an asset that has not landed names nothing.
     */
    @Test
    fun theSealWillNotSignWhileAPictureIsStillUploading() {
        val state = composerWithWords()
            .addPick(URI_A)
            .withUpload(URI_A, AssetUpload.Running)
            .copy(step = ReplyStep.Seal)

        assertThat(state.uploadsRunning).isTrue()
        assertThat(state.uploadsComplete).isFalse()
        assertThat(state.canSign).isFalse()
    }

    @Test
    fun theSealSignsOnceEveryPictureHasLanded() {
        val state = composerWithWords()
            .addPick(URI_A)
            .withUpload(URI_A, AssetUpload.Done(MEDIA_A))
            .copy(step = ReplyStep.Seal)

        assertThat(state.uploadsDone).isEqualTo(1)
        assertThat(state.uploadsComplete).isTrue()
        assertThat(state.canSign).isTrue()
    }

    /** A comment with no pictures at all has nothing to wait for. */
    @Test
    fun aWordsOnlyReplyIsSignableImmediately() {
        assertThat(composerWithWords().copy(step = ReplyStep.Seal).canSign).isTrue()
    }

    @Test
    fun aFailedUploadIsVisibleToTheSeal() {
        val state = composerWithWords()
            .addPick(URI_A)
            .withUpload(URI_A, AssetUpload.Failed("refused"))

        assertThat(state.uploadsFailed).isTrue()
        assertThat(state.canSign).isFalse()
    }

    /** The key-absent seal never signs — it offers the restore instead. */
    @Test
    fun theKeyAbsentSealDoesNotSign() {
        assertThat(composerWithWords().copy(keyAbsent = true).canSign).isFalse()
    }

    @Test
    fun aSubmitInFlightDoesNotSignTwice() {
        assertThat(composerWithWords().copy(submitting = true).canSign).isFalse()
    }

    // -- The seal's arithmetic ----------------------------------------

    /**
     * A gallery adds no acts: attaching media mints nothing, which is
     * why the canonical board reads "1 signed action" beside two
     * pictures (api-spec.md `PrepareContentPayload`).
     */
    @Test
    fun picturesAddNoSignedActions() {
        val state = composerWithWords()
            .addPick(URI_A)
            .addPick(URI_B)

        assertThat(state.signedActionCount).isEqualTo(1)
    }

    /** One Tag record per declared topic, one Reference per citation. */
    @Test
    fun everyTopicAndCitationIsItsOwnAct() {
        val state = composerWithWords().copy(
            tagSection = TagSectionState(tags = listOf(TagRow("glovebox"), TagRow("coastroad"))),
            referenceSection = ReferenceSectionState(
                references = listOf(ReferenceRow(targetId = "ref-1", target = null)),
            ),
        )

        assertThat(state.signedActionCount).isEqualTo(4)
    }

    /** The seal's caption, as `ReplySeal` draws it. */
    @Test
    fun theSealCaptionNamesTheTargetAndCountsTheCharacters() {
        val state = ReplyWizardState(target = POST_TARGET, body = "ab")

        assertThat(state.sealSummary).isEqualTo("Reply to \"The long way home\" — 2 characters")
    }

    /** One character reads as one, not as "1 characters". */
    @Test
    fun theSealCaptionSaysOneCharacterInTheSingular() {
        val state = ReplyWizardState(target = POST_TARGET, body = "a")

        assertThat(state.sealSummary).isEqualTo("Reply to \"The long way home\" — 1 character")
    }

    // -- The target ----------------------------------------------------

    /** `ReplyEntry` 7: "Add a comment" pins the post. */
    @Test
    fun aReplyToThePostSaysSoOnTheSeal() {
        assertThat(POST_TARGET.actLabel).isEqualTo("Reply to @ada's post")
    }

    /** `ReplyEntry` 5: "Reply" on a comment pre-targets that comment. */
    @Test
    fun aReplyToACommentSaysSoOnTheSeal() {
        assertThat(COMMENT_TARGET.actLabel).isEqualTo("Reply to @tobias's comment")
    }

    // -- The parameters ------------------------------------------------

    /** Both parameters start at the low-defaults policy value (+0.1). */
    @Test
    fun theStanceStartsAtTheLowDefault() {
        val state = ReplyWizardState()

        assertThat(state.pDirected).isEqualTo(ReplyWizardState.DEFAULT_P)
        assertThat(state.pInterest).isEqualTo(ReplyWizardState.DEFAULT_P)
    }

    // -- The component mapping -----------------------------------------

    /**
     * Comment pictures never crop (jakob 2026-08-31), so every picked
     * picture reaches the components whole.
     */
    @Test
    fun everyPickedPictureReachesTheComponentsWhole() {
        val state = composerWithWords()
            .addPick(URI_A, sourceRatio = 0.8f)
            .withAltText(URI_A, "A person holding a film camera")

        val picture = state.pickedPictures().single()

        assertThat(picture.item.framing).isEqualTo(CropFraming.Whole)
        assertThat(picture.item.aspectRatio).isEqualTo(0.8f)
        assertThat(picture.item.altText).isEqualTo("A person holding a film camera")
        assertThat(picture.described).isTrue()
    }

    @Test
    fun anUploadingPictureIsMarkedForTheTray() {
        val state = composerWithWords()
            .addPick(URI_A)
            .withUpload(URI_A, AssetUpload.Running)

        assertThat(state.pickedPictures().single().uploading).isTrue()
    }

    @Test
    fun anAssetsOwnRatioIsRecordedOnceRead() {
        val state = composerWithWords().addPick(URI_A).withSourceRatio(URI_A, 1.5f)

        assertThat(state.picked.single().sourceRatio).isEqualTo(1.5f)
    }

    // -- Pictures or a video, never both --

    @Test
    fun aClipReplacesTheTrayAndTheTrayReplacesTheClip() {
        val withPictures = composerWithWords()
            .addPick("a", 1f)
            .addPick("b", 1f)
        assertThat(withPictures.picked).hasSize(2)

        val withClip = withPictures.addPick("clip", 1f, durationMs = 18_000)
        assertThat(withClip.picked.map { it.uri }).containsExactly("clip")
        assertThat(withClip.isVideoComment).isTrue()
        assertThat(withClip.hasPictures).isFalse()

        val backToPictures = withClip.addPick("c", 1f)
        assertThat(backToPictures.picked.map { it.uri }).containsExactly("c")
        assertThat(backToPictures.isVideoComment).isFalse()
    }

    @Test
    fun theAddLabelSaysWhatMayStillJoin() {
        assertThat(composerWithWords().addLabel).isEqualTo("+ Add pictures or a video")
        assertThat(composerWithWords().addPick("a", 1f).addLabel)
            .isEqualTo("+ Add pictures · 1 of 4")
        // A clip carries no add control at all.
        assertThat(composerWithWords().addPick("clip", 1f, durationMs = 1).addLabel).isNull()
    }

    @Test
    fun removingTheClipReturnsTheComposerToWords() {
        val withClip = composerWithWords()
            .addPick("clip", 1f, durationMs = 18_000)
            .copy(coverMediaId = "cover-1")

        val without = withClip.removePick("clip")
        assertThat(without.picked).isEmpty()
        assertThat(without.isVideoComment).isFalse()
        // The face goes with the clip it was lifted from.
        assertThat(without.coverMediaId).isNull()
    }

    @Test
    fun aClipIsNotCompleteUntilItsCoverHasLanded() {
        val uploaded = composerWithWords()
            .addPick("clip", 1f, durationMs = 18_000)
            .withUpload("clip", AssetUpload.Done("v1"))

        assertThat(uploaded.uploadsComplete).isFalse()
        assertThat(uploaded.copy(coverMediaId = "cover-1").uploadsComplete).isTrue()
    }

    @Test
    fun aTranscodeCountsAsStillOnItsWay() {
        val transcoding = composerWithWords()
            .addPick("clip", 1f, durationMs = 18_000)
            .withUpload("clip", AssetUpload.Transcoding(40))

        assertThat(transcoding.uploadsRunning).isTrue()
    }

    // -- Leaving --

    @Test
    fun onlyANonEmptyComposerHasSomethingToLose() {
        assertThat(ReplyWizardState(target = POST_TARGET).hasSomethingToLose).isFalse()
        assertThat(composerWithWords().hasSomethingToLose).isTrue()
        assertThat(
            ReplyWizardState(target = POST_TARGET).addPick("a", 1f).hasSomethingToLose,
        ).isTrue()
    }

    @Test
    fun aRefusedFileIsNotSomethingToLose() {
        // It never joined the composer, so there is nothing to ask about.
        val onlyRefusals = ReplyWizardState(target = POST_TARGET)
            .copy(refused = listOf(RefusedPick(null, "Nope.")))
        assertThat(onlyRefusals.hasSomethingToLose).isFalse()
    }

    @Test
    fun aRefusalLeavesOnRequestAndTheRestStay() {
        val two = ReplyWizardState(target = POST_TARGET).copy(
            refused = listOf(RefusedPick(null, "One."), RefusedPick(null, "Two.")),
        )
        assertThat(two.dismissedRefusal(0).refused.map { it.message }).containsExactly("Two.")
        // An index nothing is at changes nothing.
        assertThat(two.dismissedRefusal(9).refused).hasSize(2)
    }

    private fun composerWithWords() = ReplyWizardState(
        target = POST_TARGET,
        body = "The third headland light is real.",
    )

    private companion object {
        const val URI_A = "content://pick/a"
        const val URI_B = "content://pick/b"
        const val MEDIA_A = "media-a"

        val POST_TARGET = ReplyTarget(
            id = "post-1",
            kind = ReplyTargetKind.Post,
            title = "The long way home",
            snippet = "The light does something at the third headland",
            authorHandle = "ada",
        )

        val COMMENT_TARGET = ReplyTarget(
            id = "comment-1",
            kind = ReplyTargetKind.Comment,
            title = "That stretch after the second bend",
            snippet = "That stretch after the second bend is the reason",
            authorHandle = "tobias",
        )
    }
}
