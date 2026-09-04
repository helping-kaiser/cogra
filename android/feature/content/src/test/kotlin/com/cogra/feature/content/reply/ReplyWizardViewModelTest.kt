package com.cogra.feature.content.reply

import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.ErrorCode
import com.cogra.domain.FieldStatus
import com.cogra.domain.LicenseChoice
import com.cogra.domain.MediaAssetView
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedContentView
import com.cogra.domain.UserError
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.media.ProcessedVideo
import com.cogra.domain.media.UploadProgress
import com.cogra.domain.media.VideoFrame
import com.cogra.domain.media.VideoInfo
import com.cogra.domain.references.ReferenceClaim
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingMediaProcessor
import com.cogra.domain.testing.ThrowingMediaRepository
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.cogra.domain.testing.ThrowingVideoProcessor
import com.cogra.domain.topics.TagClaim
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.UploadFailure
import com.google.common.truth.Truth.assertThat
import java.io.IOException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

/**
 * The reply wizard's flow: what a pick becomes, what reaches the wire,
 * and what each way out does.
 *
 * The video path is the interesting half — the clip transcodes at pick
 * and only uploads on `Next`, with its cover going first because an
 * asset row names its cover when it is created.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ReplyWizardViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)

    private class ScriptedContent(private val sealer: SealingWriteRepository) :
        ThrowingContentRepository() {
        var outcome: Outcome<PreparedContentView>? = null
        var lastContent: String? = null
        var lastAttachments: List<AttachmentClaim> = emptyList()
        var lastTags: List<TagClaim> = emptyList()
        var lastReferences: List<ReferenceClaim> = emptyList()
        var lastStance: Pair<Double?, Double?>? = null
        var calls = 0

        override suspend fun prepareComment(
            target: String,
            content: String,
            license: LicenseChoice,
            tags: List<TagClaim>,
            references: List<ReferenceClaim>,
            attachments: List<AttachmentClaim>,
            pDirected: Double?,
            pInterest: Double?,
        ): Outcome<PreparedContentView> {
            calls += 1
            lastContent = content
            lastAttachments = attachments
            lastTags = tags
            lastReferences = references
            lastStance = pDirected to pInterest
            return outcome
                ?: Outcome.Success(
                    PreparedContentView("c1", listOf(sealer.stage(Family.REGISTRATION))),
                )
        }
    }

    private class ScriptedMedia : ThrowingMediaRepository() {
        var still: Outcome<MediaAssetView> = Outcome.Success(asset("m1"))
        var clip: Outcome<MediaAssetView> = Outcome.Success(asset("v1"))
        val order = mutableListOf<String>()
        var aborted = mutableListOf<String>()

        /** When set, a still upload blocks here until it is completed. */
        var stillGate: CompletableDeferred<Unit>? = null

        override suspend fun uploadMedia(picture: ProcessedPicture): Outcome<MediaAssetView> {
            order += "still"
            stillGate?.await()
            return still
        }

        override suspend fun uploadVideo(
            video: ProcessedVideo,
            coverMediaId: String,
            onProgress: (UploadProgress) -> Unit,
        ): Outcome<MediaAssetView> {
            order += "clip"
            onProgress(UploadProgress("session-1", sentParts = 1, partCount = 2))
            return clip
        }

        override suspend fun abortUpload(uploadId: String) {
            aborted += uploadId
        }

        companion object {
            fun asset(id: String) =
                MediaAssetView(id, "https://media/$id", null, FieldStatus.NORMAL, 1f)
        }
    }

    private class ScriptedProcessor : ThrowingMediaProcessor() {
        var processed: ProcessedPicture? = ProcessedPicture(ByteArray(4), 100, 100)
        var ratio: Float? = 1f
        var size: Long? = 1_000

        override suspend fun process(uri: String, crop: CropSpec): ProcessedPicture? = processed
        override suspend fun aspectRatio(uri: String): Float? = ratio
        override suspend fun sizeBytes(uri: String): Long? = size
    }

    private class ScriptedVideo : ThrowingVideoProcessor() {
        var info: VideoInfo? = null
        var transcoded: ProcessedVideo? = ProcessedVideo("/tmp/clip.mp4", 1080, 1920, 4_000, 1_000)
        var frames = listOf(
            VideoFrame(atMs = 500, picture = ProcessedPicture(ByteArray(2), 10, 10)),
        )

        override suspend fun info(uri: String): VideoInfo? = info

        override suspend fun coverFrames(uri: String, count: Int): List<VideoFrame> = frames

        override suspend fun transcode(
            uri: String,
            capBytes: Long,
            onProgress: (Int) -> Unit,
        ): ProcessedVideo? {
            onProgress(50)
            return transcoded
        }
    }

    private val content = ScriptedContent(sealer)
    private val media = ScriptedMedia()
    private val processor = ScriptedProcessor()
    private val video = ScriptedVideo()
    private val references = ThrowingReferenceRepository()

    private fun viewModel() = ReplyWizardViewModel(
        content,
        references,
        media,
        processor,
        video,
        WriteSigner(sealer, identity),
    ).apply { start(target) }

    private val target = ReplyTarget(
        id = "p1",
        kind = ReplyTargetKind.Post,
        title = "A post",
        snippet = "Its words",
        authorHandle = "ada",
    )

    @Before
    fun setDispatcher() = Dispatchers.setMain(dispatcher)

    @After
    fun resetDispatcher() = Dispatchers.resetMain()

    // -- Pictures --

    @Test
    fun aPickedPictureIsUploadedWholeAtItsOwnRatio() = runTest(dispatcher) {
        processor.ratio = 0.5f
        val vm = viewModel()

        vm.onPicked("a.jpg")
        dispatcher.scheduler.advanceUntilIdle()

        val asset = vm.state.value.picked.single()
        assertThat(asset.upload).isEqualTo(AssetUpload.Done("m1"))
        assertThat(asset.sourceRatio).isEqualTo(0.5f)
        assertThat(media.order).containsExactly("still")
    }

    @Test
    fun aFileThatIsNeitherPictureNorVideoIsRefusedWhereItWasOffered() = runTest(dispatcher) {
        processor.ratio = null
        val vm = viewModel()

        vm.onPicked("mystery.bin")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.picked).isEmpty()
        val refused = vm.state.value.refused.single()
        assertThat(refused.reason).isEqualTo(UploadFailure.UNREADABLE_FILE)
        // Nothing to preview: the tile is empty on purpose.
        assertThat(refused.uri).isNull()
    }

    @Test
    fun anOversizePictureIsRefusedBeforeAByteLeaves() = runTest(dispatcher) {
        processor.size = ReplyWizardViewModel.MAX_PICTURE_BYTES + 1
        val vm = viewModel()

        vm.onPicked("huge.jpg")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(media.order).isEmpty()
        val refused = vm.state.value.refused.single()
        assertThat(refused.reason).isEqualTo(UploadFailure.PICTURE_TOO_BIG)
        // It is a readable picture, so the row can preview it.
        assertThat(refused.uri).isEqualTo("huge.jpg")
    }

    @Test
    fun theSamePickTwiceIsOnePick() = runTest(dispatcher) {
        val vm = viewModel()

        vm.onPicked("a.jpg")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onPicked("a.jpg")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.picked).hasSize(1)
        assertThat(media.order).containsExactly("still")
    }

    @Test
    fun aFailedPictureUploadIsRetriedOnItsOwn() = runTest(dispatcher) {
        media.still = Outcome.Failed(IOException("down"))
        val vm = viewModel()
        vm.onPicked("a.jpg")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.picked.single().upload)
            .isEqualTo(AssetUpload.Failed(UploadFailure.TRANSPORT))

        media.still = Outcome.Success(ScriptedMedia.asset("m9"))
        vm.onRetryUpload("a.jpg")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.picked.single().upload).isEqualTo(AssetUpload.Done("m9"))
    }

    @Test
    fun removingAPickTakesItOutOfTheBatch() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onPicked("a.jpg")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onRemovePickAt(0)

        assertThat(vm.state.value.picked).isEmpty()
    }

    // -- The clip --

    @Test
    fun aPickedClipTranscodesAtPickAndDoesNotUploadYet() = runTest(dispatcher) {
        video.info = VideoInfo(durationMs = 4_000, aspectRatio = 0.5625f)
        val vm = viewModel()

        vm.onBodyChange("Words")
        vm.onPicked("clip.mp4")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.isVideoComment).isTrue()
        assertThat(vm.state.value.coverFrames).hasSize(1)
        // Nothing has been sent: the cover is still being chosen.
        assertThat(media.order).isEmpty()
        assertThat(vm.state.value.picked.single().upload).isEqualTo(AssetUpload.Idle)
    }

    @Test
    fun aClipThatWillNotTranscodeIsRefusedRatherThanStaged() = runTest(dispatcher) {
        video.info = VideoInfo(durationMs = 4_000, aspectRatio = 0.5625f)
        video.transcoded = null
        val vm = viewModel()

        vm.onBodyChange("Words")
        vm.onPicked("clip.mp4")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.picked).isEmpty()
        assertThat(vm.state.value.refused.single().reason)
            .isEqualTo(UploadFailure.UNREADABLE_FILE)
    }

    /** The cap is judged on what would be sent, not on what was picked. */
    @Test
    fun aClipStillOverTheCapAfterReEncodingIsRefused() = runTest(dispatcher) {
        video.info = VideoInfo(durationMs = 4_000, aspectRatio = 0.5625f)
        video.transcoded = ProcessedVideo(
            "/tmp/clip.mp4",
            1080,
            1920,
            4_000,
            ReplyWizardViewModel.MAX_VIDEO_BYTES + 1,
        )
        val vm = viewModel()

        vm.onBodyChange("Words")
        vm.onPicked("clip.mp4")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.picked).isEmpty()
        assertThat(vm.state.value.refused.single().reason)
            .isEqualTo(UploadFailure.COMMENT_VIDEO_TOO_BIG)
    }

    /** An asset row names its cover when it is created, so the face goes first. */
    @Test
    fun theCoverIsUploadedBeforeTheClipItNames() = runTest(dispatcher) {
        video.info = VideoInfo(durationMs = 4_000, aspectRatio = 0.5625f)
        val vm = viewModel()
        vm.onBodyChange("Words")
        vm.onPicked("clip.mp4")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onNext()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(media.order).containsExactly("still", "clip").inOrder()
        assertThat(vm.state.value.picked.single().upload).isEqualTo(AssetUpload.Done("v1"))
    }

    @Test
    fun aRefusedClipCarriesTheServersOwnWords() = runTest(dispatcher) {
        video.info = VideoInfo(durationMs = 4_000, aspectRatio = 0.5625f)
        media.clip = Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "not H.264")))
        val vm = viewModel()
        vm.onBodyChange("Words")
        vm.onPicked("clip.mp4")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onNext()
        dispatcher.scheduler.advanceUntilIdle()

        val failed = vm.state.value.picked.single().upload as AssetUpload.Failed
        assertThat(failed.reason).isEqualTo(UploadFailure.REFUSED_VIDEO)
        assertThat(failed.serverMessage).isEqualTo("not H.264")
    }

    // -- The seal --

    @Test
    fun theSealSendsTheWordsTheGalleryAndTheStance() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onBodyChange("Well answered")
        vm.onPicked("a.jpg")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAltTextChange("a.jpg", "A picture")
        vm.onNext()
        vm.onStanceChange(0.4, -0.2)

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.lastContent).isEqualTo("Well answered")
        assertThat(content.lastAttachments)
            .containsExactly(AttachmentClaim("m1", "A picture"))
        assertThat(content.lastStance).isEqualTo(0.4 to -0.2)
        assertThat(vm.state.value.outcome).isEqualTo(ReplyOutcome.Signed("c1"))
    }

    @Test
    fun anUploadStillInFlightHoldsTheSeal() = runTest(dispatcher) {
        val gate = CompletableDeferred<Unit>()
        media.stillGate = gate
        val vm = viewModel()
        vm.onBodyChange("Words")
        vm.onPicked("a.jpg")
        dispatcher.scheduler.advanceUntilIdle()
        // The pick is staged; its bytes are still on their way.

        assertThat(vm.state.value.picked).hasSize(1)
        assertThat(vm.state.value.canSign).isFalse()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.calls).isEqualTo(0)

        gate.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.canSign).isTrue()
    }

    @Test
    fun aRefusalOnAChipLandsOnThatChipRatherThanTheWholeReply() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onBodyChange("Words")
        vm.onTagInputChange("rust")
        vm.onAddTag()
        vm.onNext()
        content.outcome = Outcome.Refused(
            listOf(UserError(ErrorCode.BAD_INPUT, "no such topic", field = listOf("tags", "0"))),
        )

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.tagSection.tags.single().error).isEqualTo("no such topic")
        assertThat(vm.state.value.refusal).isNull()
        assertThat(vm.state.value.submitting).isFalse()
    }

    @Test
    fun aTransportFaultAtPrepareIsNotARefusal() = runTest(dispatcher) {
        content.outcome = Outcome.Failed(IOException("down"))
        val vm = viewModel()
        vm.onBodyChange("Words")
        vm.onNext()

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(vm.state.value.refusal).isNull()
        assertThat(vm.state.value.submitting).isFalse()
    }

    // -- Leaving --

    @Test
    fun anEmptyComposerLeavesWithoutAsking() = runTest(dispatcher) {
        val vm = viewModel()

        vm.onLeaveRequested()

        assertThat(vm.state.value.confirmingDiscard).isFalse()
        assertThat(vm.state.value.outcome).isEqualTo(ReplyOutcome.Left)
    }

    @Test
    fun aStartedComposerIsAskedFirstAndKeepWritingCancelsIt() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onBodyChange("Half a thought")

        vm.onLeaveRequested()
        assertThat(vm.state.value.confirmingDiscard).isTrue()
        assertThat(vm.state.value.outcome).isNull()

        vm.onKeepWriting()
        assertThat(vm.state.value.confirmingDiscard).isFalse()
        assertThat(vm.state.value.outcome).isNull()
    }

    /** A discarded reply is not coming back for its parts. */
    @Test
    fun leavingGivesBackTheResumableSession() = runTest(dispatcher) {
        video.info = VideoInfo(durationMs = 4_000, aspectRatio = 0.5625f)
        val vm = viewModel()
        vm.onBodyChange("Words")
        vm.onPicked("clip.mp4")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onNext()
        dispatcher.scheduler.advanceUntilIdle()

        vm.onLeave()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(media.aborted).containsExactly("session-1")
        assertThat(vm.state.value.outcome).isEqualTo(ReplyOutcome.Left)
    }

    @Test
    fun leavingASignedReplyChangesNothing() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onBodyChange("Words")
        vm.onNext()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        vm.onLeaveRequested()

        assertThat(vm.state.value.outcome).isEqualTo(ReplyOutcome.Signed("c1"))
    }
}
