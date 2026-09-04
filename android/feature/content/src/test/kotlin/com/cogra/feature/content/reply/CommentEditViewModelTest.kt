package com.cogra.feature.content.reply

import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.CommentForEdit
import com.cogra.domain.ErrorCode
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedContentView
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.SelfMarkView
import com.cogra.domain.TopicClaimView
import com.cogra.domain.UserError
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingMediaProcessor
import com.cogra.domain.testing.ThrowingMediaRepository
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.cogra.domain.testing.ThrowingTopicRepository
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testHashtag
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.UploadFailure
import com.google.common.truth.Truth.assertThat
import java.io.IOException
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
 * `CommentEdit`'s flow.
 *
 * Two rules carry the weight here and neither was covered: the edit is
 * complete-state on every axis — so the standing sensitive mark has to
 * ride back untouched or the edit silently unveils the comment — and
 * topics and citations are never edit fields, so each change is its own
 * staged act beside the edit record.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class CommentEditViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)

    private class ScriptedContent(private val sealer: SealingWriteRepository) :
        ThrowingContentRepository() {
        var loaded: Outcome<CommentForEdit?> = Outcome.Success(
            CommentForEdit(
                comment = testComment("c1", body = "As it stands"),
                selfMark = SelfMarkView(sensitive = false, reason = null),
            ),
        )
        var editOutcome: Outcome<PreparedContentView>? = null
        var editCalls = 0
        var lastBody: String? = null
        var lastAttachments: List<AttachmentClaim> = emptyList()
        var lastSensitive: Boolean? = null
        var lastSensitiveReason: String? = null

        override suspend fun commentForEdit(id: String): Outcome<CommentForEdit?> = loaded

        override suspend fun prepareCommentEdit(
            id: String,
            content: String,
            attachments: List<AttachmentClaim>,
            sensitive: Boolean,
            sensitiveReason: String?,
        ): Outcome<PreparedContentView> {
            editCalls += 1
            lastBody = content
            lastAttachments = attachments
            lastSensitive = sensitive
            lastSensitiveReason = sensitiveReason
            return editOutcome
                ?: Outcome.Success(
                    PreparedContentView(id, listOf(sealer.stage(Family.REGISTRATION))),
                )
        }
    }

    private class ScriptedTopics(private val sealer: SealingWriteRepository) :
        ThrowingTopicRepository() {
        val staged = mutableListOf<Triple<String, String, Double?>>()
        var outcome: Outcome<List<PreparedWriteView>>? = null

        override suspend fun prepareTag(
            artifact: String,
            name: String,
            pDirected: Double?,
            pInterest: Double?,
        ): Outcome<List<PreparedWriteView>> {
            staged += Triple(artifact, name, pDirected)
            return outcome ?: Outcome.Success(listOf(sealer.stage(Family.REGISTRATION)))
        }
    }

    private class ScriptedMedia : ThrowingMediaRepository() {
        var outcome: Outcome<MediaAssetView> = Outcome.Success(
            MediaAssetView("m1", "https://media/m1", null, FieldStatus.NORMAL, 1f),
        )
        var calls = 0

        override suspend fun uploadMedia(picture: ProcessedPicture): Outcome<MediaAssetView> {
            calls += 1
            return outcome
        }
    }

    private class ScriptedProcessor : ThrowingMediaProcessor() {
        var processed: ProcessedPicture? = ProcessedPicture(ByteArray(4), 100, 100)
        var ratio: Float? = 1f

        override suspend fun process(uri: String, crop: CropSpec): ProcessedPicture? = processed
        override suspend fun aspectRatio(uri: String): Float? = ratio
    }

    private val content = ScriptedContent(sealer)
    private val topics = ScriptedTopics(sealer)
    private val media = ScriptedMedia()
    private val processor = ScriptedProcessor()
    private val references = ThrowingReferenceRepository()

    private fun opened(): CommentEditViewModel {
        val vm = CommentEditViewModel(
            content,
            references,
            media,
            processor,
            WriteSigner(sealer, identity),
            topics,
        )
        vm.start("c1", "A post")
        dispatcher.scheduler.advanceUntilIdle()
        return vm
    }

    @Before
    fun setDispatcher() = Dispatchers.setMain(dispatcher)

    @After
    fun resetDispatcher() = Dispatchers.resetMain()

    // -- Opening --

    @Test
    fun theEditOpensOnTheCommentAsItStands() = runTest(dispatcher) {
        val vm = opened()

        val s = vm.state.value
        assertThat(s.loading).isFalse()
        assertThat(s.body).isEqualTo("As it stands")
        assertThat(s.loadedBody).isEqualTo("As it stands")
        assertThat(s.parentTitle).isEqualTo("A post")
        // Nothing moved yet, so there is nothing to sign.
        assertThat(s.canSign).isFalse()
    }

    /** The editor opens on real stored parameters, not a fresh chip's defaults. */
    @Test
    fun standingTopicsOpenAtTheirOwnParameters() = runTest(dispatcher) {
        content.loaded = Outcome.Success(
            CommentForEdit(
                comment = testComment("c1").copy(
                    topics = listOf(
                        TopicClaimView(testHashtag("rust"), relevance = 0.8, confidence = 0.6, pending = false),
                    ),
                ),
                selfMark = SelfMarkView(sensitive = false, reason = null),
            ),
        )
        val vm = opened()

        val tag = vm.state.value.tagSection.tags.single()
        assertThat(tag.name).isEqualTo("rust")
        assertThat(tag.relevance).isEqualTo(0.8)
        assertThat(tag.confidence).isEqualTo(0.6)
        // Loaded as the baseline, so leaving it alone re-declares nothing.
        assertThat(vm.state.value.tagSection.adds).isEmpty()
    }

    @Test
    fun aCommentThatIsNoLongerThereSaysSoRatherThanLoadingForever() = runTest(dispatcher) {
        content.loaded = Outcome.Success(null)
        val vm = opened()

        assertThat(vm.state.value.loading).isFalse()
        assertThat(vm.state.value.refusal).isNotNull()
    }

    @Test
    fun aFailedReadIsATransportFaultRatherThanAMissingComment() = runTest(dispatcher) {
        content.loaded = Outcome.Failed(IOException("down"))
        val vm = opened()

        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(vm.state.value.refusal).isNull()
    }

    // -- Signing --

    /** The rule the class exists to keep. */
    @Test
    fun theStandingSensitiveMarkRidesBackUntouched() = runTest(dispatcher) {
        content.loaded = Outcome.Success(
            CommentForEdit(
                comment = testComment("c1", body = "As it stands"),
                selfMark = SelfMarkView(sensitive = true, reason = "graphic"),
            ),
        )
        val vm = opened()
        vm.onBodyChange("Reworded")

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.lastSensitive).isTrue()
        assertThat(content.lastSensitiveReason).isEqualTo("graphic")
        assertThat(vm.state.value.saved).isTrue()
    }

    @Test
    fun anEditThatChangedOnlyATopicStagesNoEditRecord() = runTest(dispatcher) {
        val vm = opened()
        vm.onTagInputChange("rust")
        vm.onAddTag()

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.editCalls).isEqualTo(0)
        assertThat(topics.staged).hasSize(1)
        assertThat(vm.state.value.saved).isTrue()
    }

    /** A topic taken off is a further Tag at relevance 0 (hashtag.md §4). */
    @Test
    fun aRemovedTopicIsStagedAsAWithdrawalRatherThanADeletion() = runTest(dispatcher) {
        content.loaded = Outcome.Success(
            CommentForEdit(
                comment = testComment("c1").copy(
                    topics = listOf(
                        TopicClaimView(testHashtag("rust"), relevance = 0.8, confidence = 0.6, pending = false),
                    ),
                ),
                selfMark = SelfMarkView(sensitive = false, reason = null),
            ),
        )
        val vm = opened()
        vm.onRemoveTag("rust")

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        val staged = topics.staged.single()
        assertThat(staged.second).isEqualTo("rust")
        assertThat(staged.third).isEqualTo(0.0)
    }

    @Test
    fun anEditThatChangedNothingSignsNothing() = runTest(dispatcher) {
        val vm = opened()

        assertThat(vm.state.value.signedActionCount).isEqualTo(0)
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.editCalls).isEqualTo(0)
        assertThat(topics.staged).isEmpty()
    }

    @Test
    fun theGalleryIsSentComplete() = runTest(dispatcher) {
        val vm = opened()
        vm.onPicked("a.jpg")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAltTextChange("a.jpg", "A picture")

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.lastAttachments).containsExactly(AttachmentClaim("m1", "A picture"))
    }

    @Test
    fun aRefusalOnAChipLandsOnThatChip() = runTest(dispatcher) {
        val vm = opened()
        vm.onBodyChange("Reworded")
        vm.onTagInputChange("rust")
        vm.onAddTag()
        topics.outcome = Outcome.Refused(
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
        content.editOutcome = Outcome.Failed(IOException("down"))
        val vm = opened()
        vm.onBodyChange("Reworded")

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(vm.state.value.submitting).isFalse()
        assertThat(vm.state.value.saved).isFalse()
    }

    // -- Pictures --

    @Test
    fun bytesThatDoNotDecodeNeverReachTheWire() = runTest(dispatcher) {
        processor.processed = null
        val vm = opened()

        vm.onPicked("a.jpg")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(media.calls).isEqualTo(0)
        assertThat(vm.state.value.picked.single().upload)
            .isEqualTo(AssetUpload.Failed(UploadFailure.UNREADABLE_PICTURE))
        assertThat(vm.state.value.uploadsFailed).isTrue()
    }

    @Test
    fun removingAPickTakesItOutOfTheGallery() = runTest(dispatcher) {
        val vm = opened()
        vm.onPicked("a.jpg")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onRemovePickAt(0)

        assertThat(vm.state.value.picked).isEmpty()
    }

    // -- Leaving --

    @Test
    fun anUntouchedEditLeavesWithoutAsking() = runTest(dispatcher) {
        val vm = opened()

        // True is "you may go now" — nothing was changed.
        assertThat(vm.onLeaveRequested()).isTrue()
        assertThat(vm.state.value.confirmingDiscard).isFalse()
    }

    @Test
    fun aChangedEditIsAskedFirst() = runTest(dispatcher) {
        val vm = opened()
        vm.onBodyChange("Reworded")

        assertThat(vm.onLeaveRequested()).isFalse()
        assertThat(vm.state.value.confirmingDiscard).isTrue()

        vm.onKeepWriting()
        assertThat(vm.state.value.confirmingDiscard).isFalse()
    }

    @Test
    fun theSavedFlagIsAOneShot() = runTest(dispatcher) {
        val vm = opened()
        vm.onBodyChange("Reworded")
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.saved).isTrue()

        vm.onSavedConsumed()

        assertThat(vm.state.value.saved).isFalse()
    }
}
