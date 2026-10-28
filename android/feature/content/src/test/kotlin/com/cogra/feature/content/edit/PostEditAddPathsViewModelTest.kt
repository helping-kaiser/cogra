// The post edit's add paths and its clip's new face, through the ViewModel —
// EditCompose.md, EditWords.md, EditComposeVideo.md and CoverCrop.md: the
// screening, the locked crop, the held press at the upload gate and the
// placement a new face rides. The surface's half is PostEditAddPathsScreenTest.

package com.cogra.feature.content.edit

import com.cogra.crypto.ActorKey
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.MediaAssetView
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.PreparedContentView
import com.cogra.domain.SelfMarkView
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.signing.ContentShape
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.SentContent
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.postEdit
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.TEST_POST_ID
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.cogra.domain.testing.ThrowingTopicRepository
import com.cogra.domain.testing.faithfulContent
import com.cogra.domain.testing.fakeUpload
import com.cogra.domain.testing.testGraphId
import com.cogra.domain.testing.testPost
import com.cogra.feature.content.wizard.UploadFailure
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PostEditAddPathsViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)

    /** A post as loaded, and a faithful prepare of the edit record it is sent. */
    private val content = object : ThrowingContentRepository() {
        var loadedAttachments: List<MediaAssetView> = emptyList()
        var editCalls = 0
        var lastEditAttachments: List<AttachmentClaim> = emptyList()

        /** A media post's body is no words; a words post's is its words. */
        val loadedBody: String get() = if (loadedAttachments.isEmpty()) "Loaded body" else ""

        override suspend fun postBacking(id: String) = Outcome.Success(null)

        override suspend fun postSelfMark(id: String): Outcome<SelfMarkView?> =
            Outcome.Success(SelfMarkView(sensitive = false, reason = null))

        override suspend fun post(
            id: String,
            commentsFirst: Int,
            commentsAfter: String?,
            includePending: Boolean,
        ): Outcome<PostDetail?> = Outcome.Success(
            PostDetail(
                post = testPost(id, title = "Loaded title", body = loadedBody)
                    .copy(attachments = loadedAttachments),
                comments = Page(emptyList(), null, hasNextPage = false),
            ),
        )

        override suspend fun preparePostEdit(
            id: String,
            title: String?,
            description: String?,
            content: String?,
            attachments: List<AttachmentClaim>,
            sensitive: Boolean,
            sensitiveReason: String?,
            pDirected: Double,
        ): Outcome<PreparedContentView> {
            editCalls += 1
            lastEditAttachments = attachments
            val sent = SentContent(title, description, content, attachments, sensitive, sensitiveReason)
            return Outcome.Success(
                PreparedContentView(
                    id,
                    sealer.stageFaithful(
                        Expectation(
                            listOf(postEdit(testGraphId(id), faithfulContent(id, sent, ContentShape.POST), pDirected)),
                        ),
                    ),
                ),
            )
        }
    }

    private val media = GatedMedia()
    private val pictures = ScriptedPictures(media)

    private fun opened(): PostEditViewModel {
        val vm = PostEditViewModel(
            content,
            ThrowingTopicRepository(),
            ThrowingReferenceRepository(),
            WriteSigner(sealer, identity),
            identity,
            media,
            pictures,
            ScriptedClips(),
        )
        vm.start(TEST_POST_ID)
        dispatcher.scheduler.advanceUntilIdle()
        return vm
    }

    private fun PostEditViewModel.signed() {
        onSign()
        dispatcher.scheduler.advanceUntilIdle()
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun tall(id: String) = fakeUpload(id).copy(aspectRatio = 4f / 5f)

    private val clip = fakeUpload("v1").copy(aspectRatio = 9f / 16f, cover = fakeUpload("p9"), coverTaken = true)

    /** Pictures picked, cropped and back on the row, their uploads sent. */
    private fun PostEditViewModel.added(vararg uris: String) {
        onAddPictures(uris.toList())
        dispatcher.scheduler.advanceUntilIdle()
        onCropDone()
        dispatcher.scheduler.advanceUntilIdle()
    }

    @Test
    fun picturesAddedToAPicturePostPassTheCropLockedToItsOneShape() = runTest(dispatcher) {
        content.loadedAttachments = listOf(tall("m1"))
        val vm = opened()

        vm.onAddPictures(listOf("a.jpg"))
        dispatcher.scheduler.advanceUntilIdle()

        val crop = vm.state.value.cropping as EditCrop.Pictures
        assertThat(crop.locked).isTrue()
        assertThat(crop.shape).isEqualTo(DraftShape.Tall)
        vm.onCropDone()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.cropping).isNull()
        assertThat(vm.state.value.gallery.pictures.map { it.key }).containsExactly("m1", "a.jpg").inOrder()
        assertThat(vm.state.value.recordStaged).isTrue()
        // Only the cropped export leaves the device, cut to the post's shape.
        assertThat(media.crops.single().targetRatio).isWithin(RATIO).of(4f / 5f)
    }

    @Test
    fun aWordsPostsCropOffersTheChipsAndThePicturesReplaceItsWords() = runTest(dispatcher) {
        val vm = opened()
        assertThat(vm.state.value.body).isEqualTo("Loaded body")

        vm.onAddPictures(listOf("a.jpg"))
        dispatcher.scheduler.advanceUntilIdle()
        assertThat((vm.state.value.cropping as EditCrop.Pictures).locked).isFalse()
        vm.onCropShapeChange(DraftShape.Wide)
        vm.onCropDone()

        assertThat(vm.state.value.mediaBody).isTrue()
        assertThat(vm.state.value.body).isEmpty()
        assertThat(vm.state.value.shape).isEqualTo(DraftShape.Wide)
    }

    @Test
    fun theCapOfTenIsRefusedOnTheRowNeverInADialog() = runTest(dispatcher) {
        content.loadedAttachments = (1..9).map { tall("m$it") }
        val vm = opened()

        vm.onAddPictures(listOf("a.jpg", "b.jpg", "c.jpg"))
        dispatcher.scheduler.advanceUntilIdle()

        assertThat((vm.state.value.cropping as EditCrop.Pictures).picked.map { it.uri }).containsExactly("a.jpg")
        assertThat(vm.state.value.refused.map { it.reason })
            .containsExactly(UploadFailure.POST_PICTURE_COUNT, UploadFailure.POST_PICTURE_COUNT)
    }

    @Test
    fun aFileNothingHereReadsIsRefusedOnTheRow() = runTest(dispatcher) {
        content.loadedAttachments = listOf(tall("m1"))
        val vm = opened()

        vm.onAddPictures(listOf("bad.heic"))
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.cropping).isNull()
        assertThat(vm.state.value.refused.single().reason).isEqualTo(UploadFailure.UNREADABLE_FILE)
        vm.onDismissRefusal(0)
        assertThat(vm.state.value.refused).isEmpty()
    }

    /** The undrawn VIDEO_AT_EDIT line, mirrored from the web (a deviation candidate). */
    @Test
    fun aClipPickedAtTheWordsEditIsRefusedInTheEditsOwnLine() = runTest(dispatcher) {
        val vm = opened()

        vm.onAddPictures(listOf("video.mp4"))
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.cropping).isNull()
        assertThat(vm.state.value.refused.single().reason).isEqualTo(UploadFailure.VIDEO_AT_EDIT)
        assertThat(vm.state.value.body).isEqualTo("Loaded body")
    }

    @Test
    fun theCropsBackArrowReturnsToTheEditWithThePictureUnused() = runTest(dispatcher) {
        content.loadedAttachments = listOf(tall("m1"))
        val vm = opened()
        vm.onAddPictures(listOf("a.jpg"))
        dispatcher.scheduler.advanceUntilIdle()

        vm.onCropBack()

        assertThat(vm.state.value.cropping).isNull()
        assertThat(vm.state.value.gallery.size).isEqualTo(1)
        assertThat(vm.state.value.recordStaged).isFalse()
        assertThat(media.sent).isEqualTo(0)
    }

    // -- The held press (EditCompose.md: the upload gate) --

    @Test
    fun aPressWhileAnUploadRunsIsHeldAndSignsWhenTheLastLands() = runTest(dispatcher) {
        content.loadedAttachments = listOf(tall("m1"))
        val vm = opened()
        vm.added("a.jpg")
        assertThat(vm.state.value.canSign).isTrue()

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.heldPress).isTrue()
        assertThat(vm.state.value.pressed).isTrue()
        assertThat(content.editCalls).isEqualTo(0)
        // A second press is refused, and never a second signing.
        vm.onSign()

        media.land(0)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.saved).isTrue()
        assertThat(content.editCalls).isEqualTo(1)
        assertThat(content.lastEditAttachments.map { it.mediaId }).containsExactly("m1", "m-1").inOrder()
    }

    @Test
    fun aFailedUploadDropsTheHeldPressAndNothingSigns() = runTest(dispatcher) {
        content.loadedAttachments = listOf(tall("m1"))
        val vm = opened()
        vm.added("a.jpg")
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        media.fail(0)
        dispatcher.scheduler.advanceUntilIdle()

        val s = vm.state.value
        assertThat(s.pressed).isFalse()
        assertThat(s.gallery.uploadsFailed).isEqualTo(1)
        // Disabled at the gate's fault reading.
        assertThat(s.canSign).isFalse()
        assertThat(content.editCalls).isEqualTo(0)
    }

    @Test
    fun retryRunsTheGateAgainButNeverSignsUntilPressedAgain() = runTest(dispatcher) {
        content.loadedAttachments = listOf(tall("m1"))
        val vm = opened()
        vm.added("a.jpg")
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        media.fail(0)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onRetryUploads()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(media.sent).isEqualTo(2)
        media.land(1)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.editCalls).isEqualTo(0)
        assertThat(vm.state.value.saved).isFalse()
        vm.signed()
        assertThat(vm.state.value.saved).isTrue()
    }

    @Test
    fun removingTheFailedPictureUngatesSign() = runTest(dispatcher) {
        content.loadedAttachments = listOf(tall("m1"))
        val vm = opened()
        vm.added("a.jpg")
        media.fail(0)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.canSign).isFalse()

        vm.onRemoveFailed()

        assertThat(vm.state.value.gallery.uploadsFailed).isEqualTo(0)
        assertThat(vm.state.value.gallery.size).isEqualTo(1)
        assertThat(vm.state.value.canSign).isTrue()
    }

    @Test
    fun theLastUploadLandingUnpressedLeavesSignAsItWas() = runTest(dispatcher) {
        content.loadedAttachments = listOf(tall("m1"))
        val vm = opened()
        vm.added("a.jpg")

        media.land(0)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.editCalls).isEqualTo(0)
        assertThat(vm.state.value.gallery.uploadsPending).isEqualTo(0)
        assertThat(vm.state.value.canSign).isTrue()
    }

    @Test
    fun theSlowLineCountsFromThePressHeldAtTheGate() = runTest(dispatcher) {
        content.loadedAttachments = listOf(tall("m1"))
        val vm = opened()
        vm.added("a.jpg")

        vm.onSign()
        dispatcher.scheduler.advanceTimeBy(PostEditViewModel.SLOW_SIGNING_MS + 1)
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.slow).isTrue()

        media.land(0)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.slow).isFalse()
    }

    // -- The clip's cover (EditComposeVideo.md, CoverCrop.md) --

    @Test
    fun aTakenFrameOffersTheDoorAndANewFaceRidesTheClipsPlacement() = runTest(dispatcher) {
        content.loadedAttachments = listOf(clip)
        val vm = opened()
        assertThat(vm.state.value.gallery.coverChosen).isFalse()

        vm.onPickCover("face.jpg")
        val crop = vm.state.value.cropping as EditCrop.Cover
        // Locked to the clip's own shape.
        assertThat(crop.ratio).isWithin(RATIO).of(9f / 16f)
        vm.onCoverCropDone()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.gallery.coverChosen).isTrue()
        assertThat(vm.state.value.recordStaged).isTrue()
        assertThat(media.crops.single().targetRatio).isWithin(RATIO).of(9f / 16f)
        vm.onSign()
        media.land(0)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.lastEditAttachments)
            .containsExactly(AttachmentClaim("v1", null, coverMediaId = "m-1", coverTaken = false))
    }

    @Test
    fun removingAFailedNewFaceReadsTheFieldAsItStood() = runTest(dispatcher) {
        content.loadedAttachments = listOf(clip)
        val vm = opened()
        vm.onPickCover("face.jpg")
        vm.onCoverCropDone()
        dispatcher.scheduler.advanceUntilIdle()
        media.fail(0)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.canSign).isFalse()

        vm.onRemoveCover()

        assertThat(vm.state.value.gallery.newCover).isNull()
        assertThat(vm.state.value.gallery.coverChosen).isFalse()
        assertThat(vm.state.value.canSign).isTrue()
    }

    @Test
    fun theClipLeavingWholeLeavesTheWordsEditWithItsFieldEmpty() = runTest(dispatcher) {
        content.loadedAttachments = listOf(clip)
        val vm = opened()

        vm.onRemovePicture(0)

        assertThat(vm.state.value.mediaBody).isFalse()
        assertThat(vm.state.value.body).isEmpty()
    }

    private companion object {
        const val RATIO = 0.001f
    }
}
