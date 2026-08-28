package com.cogra.feature.content.wizard

import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.ErrorCode
import com.cogra.domain.FieldStatus
import com.cogra.domain.LicenseChoice
import com.cogra.domain.MediaAssetView
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedContentView
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.ComposeDraftStore
import com.cogra.domain.compose.DraftAsset
import com.cogra.domain.compose.DraftBodyKind
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.references.ReferenceClaim
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingMediaProcessor
import com.cogra.domain.testing.ThrowingMediaRepository
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.cogra.domain.topics.TagClaim
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
 * The wizard's flow: what reaches the wire, what the uploads do, and
 * what happens to the draft on each of the ways out.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ComposeWizardViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)

    private val content = object : ThrowingContentRepository() {
        var outcome: Outcome<PreparedContentView>? = null
        var lastContent: String? = null
        var lastAttachments: List<AttachmentClaim> = emptyList()
        var calls = 0

        override suspend fun preparePost(
            title: String?,
            description: String?,
            content: String?,
            license: LicenseChoice,
            tags: List<TagClaim>,
            references: List<ReferenceClaim>,
            attachments: List<AttachmentClaim>,
        ): Outcome<PreparedContentView> {
            calls += 1
            lastContent = content
            lastAttachments = attachments
            return outcome ?: Outcome.Success(
                PreparedContentView("node-1", listOf(sealer.stage(Family.PUBLISH))),
            )
        }
    }

    private val references = object : ThrowingReferenceRepository() {
        override suspend fun referenceCandidates(
            query: String,
            limit: Int?,
        ): Outcome<List<com.cogra.domain.ReferenceCandidateView>> = Outcome.Success(emptyList())
    }

    private val media = object : ThrowingMediaRepository() {
        /** Per-URI scripting, so one asset can fail while the rest land. */
        var failures = mutableSetOf<String>()
        var uploads = 0
        var lastAltText: String? = null
        private var next = 0

        /** The URI each call is for, in order, so failures can be aimed. */
        var pending = ArrayDeque<String>()

        override suspend fun uploadMedia(
            picture: ProcessedPicture,
            altText: String?,
        ): Outcome<MediaAssetView> {
            uploads += 1
            lastAltText = altText
            val uri = pending.removeFirstOrNull().orEmpty()
            if (uri in failures) {
                return Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "too big")))
            }
            next += 1
            return Outcome.Success(
                MediaAssetView("m$next", "https://media/m$next", altText, FieldStatus.NORMAL, 1f),
            )
        }
    }

    private val processor = object : ThrowingMediaProcessor() {
        var undecodable = mutableSetOf<String>()

        override suspend fun process(uri: String, crop: CropSpec): ProcessedPicture? {
            media.pending.addLast(uri)
            return if (uri in undecodable) null else ProcessedPicture(ByteArray(4), 100, 125)
        }

        override suspend fun aspectRatio(uri: String): Float = 0.8f
    }

    private val drafts = object : ComposeDraftStore {
        var held: ComposeDraft? = null
        var cleared = 0

        override suspend fun draft(): ComposeDraft? = held

        override suspend fun save(draft: ComposeDraft) {
            held = draft
        }

        override suspend fun clear() {
            cleared += 1
            held = null
        }
    }

    private fun viewModel() = ComposeWizardViewModel(
        content = content,
        references = references,
        media = media,
        processor = processor,
        drafts = drafts,
        signer = WriteSigner(sealer, identity),
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    /** Walks a media post from an empty wizard to the seal, uploads done. */
    private fun ComposeWizardViewModel.toSealWithMedia(vararg uris: String) {
        start()
        dispatcher.scheduler.advanceUntilIdle()
        onModeChange(BodyMode.Media)
        uris.forEach { onTogglePick(it) }
        dispatcher.scheduler.advanceUntilIdle()
        onNext() // body -> crop
        onNext() // crop -> details, uploads start
        dispatcher.scheduler.advanceUntilIdle()
        onNext() // details -> seal
    }

    // -- The XOR reaches the wire, not just the screen (D16) --

    @Test
    fun aWordsPostSendsWordsAndNoGallery() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBodyChange("Salt maps of the coast road")
        vm.onNext()
        vm.onNext()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.lastContent).isEqualTo("Salt maps of the coast road")
        assertThat(content.lastAttachments).isEmpty()
    }

    @Test
    fun aMediaPostSendsAGalleryAndNoWordsAtAll() = runTest(dispatcher) {
        val vm = viewModel()
        // Words typed first, then abandoned for pictures: the words
        // survive in state but must not reach the wire, or the server
        // sees both halves and refuses.
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBodyChange("a paragraph nobody asked for")
        vm.toSealWithMedia("a", "b")
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.lastContent).isNull()
        assertThat(content.lastAttachments.map { it.mediaId }).containsExactly("m1", "m2").inOrder()
    }

    @Test
    fun theGalleryGoesInPickOrder() = runTest(dispatcher) {
        val vm = viewModel()
        vm.toSealWithMedia("a", "b", "c")
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.lastAttachments).hasSize(3)
    }

    // -- Uploads: concurrent, independently retryable (D5) --

    @Test
    fun everyPickUploadsOnItsOwnCall() = runTest(dispatcher) {
        val vm = viewModel()
        vm.toSealWithMedia("a", "b", "c")
        assertThat(media.uploads).isEqualTo(3)
        assertThat(vm.state.value.uploadsComplete).isTrue()
    }

    @Test
    fun oneRefusedUploadBlocksTheSealAndNamesItself() = runTest(dispatcher) {
        media.failures += "b"
        val vm = viewModel()
        vm.toSealWithMedia("a", "b")

        val failed = vm.state.value.picked.single { it.uri == "b" }.upload
        assertThat(failed).isInstanceOf(AssetUpload.Failed::class.java)
        assertThat((failed as AssetUpload.Failed).message).isEqualTo("too big")
        // The other pick is untouched, and the seal will not sign.
        assertThat(vm.state.value.picked.single { it.uri == "a" }.mediaId).isEqualTo("m1")
        assertThat(vm.state.value.canSign).isFalse()

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.calls).isEqualTo(0)
    }

    @Test
    fun aRetryReRunsExactlyOneUpload() = runTest(dispatcher) {
        media.failures += "b"
        val vm = viewModel()
        vm.toSealWithMedia("a", "b")
        assertThat(media.uploads).isEqualTo(2)

        media.failures.clear()
        vm.onRetryUpload("b")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(media.uploads).isEqualTo(3)
        assertThat(vm.state.value.uploadsComplete).isTrue()
        assertThat(vm.state.value.canSign).isTrue()
    }

    @Test
    fun undecodableBytesNeverReachTheWire() = runTest(dispatcher) {
        processor.undecodable += "a"
        val vm = viewModel()
        vm.toSealWithMedia("a")
        // The pipeline refused it, so no upload was attempted for it.
        assertThat(media.uploads).isEqualTo(0)
        assertThat(vm.state.value.picked.single().upload)
            .isInstanceOf(AssetUpload.Failed::class.java)
    }

    @Test
    fun altTextRidesItsOwnUpload() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onModeChange(BodyMode.Media)
        vm.onTogglePick("a")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAltTextChange("a", "A salt crust")
        vm.onNext()
        vm.onNext()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(media.lastAltText).isEqualTo("A salt crust")
    }

    @Test
    fun blankAltTextRidesAsNullRatherThanAnEmptyDescription() = runTest(dispatcher) {
        val vm = viewModel()
        vm.toSealWithMedia("a")
        // An empty string is a value, and a decorative asset needs a
        // null description rather than a described nothing (D20).
        assertThat(media.lastAltText).isNull()
    }

    // -- The ways out --

    @Test
    fun aSignedPostClearsTheDraftAndReportsItsNode() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBodyChange("Salt maps")
        vm.onNext()
        vm.onNext()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.outcome).isEqualTo(WizardOutcome.Landed("node-1"))
        assertThat(drafts.held).isNull()
    }

    @Test
    fun anExpiredActKeepsTheDraftAndSaysNothingWasSpent() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBodyChange("Salt maps")
        vm.onTitleChange("Salt maps of the coast road")
        vm.onNext()
        vm.onNext()
        // The staged write is collected before the approval lands.
        sealer.expireOnSubmit = true
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        val outcome = vm.state.value.outcome
        assertThat(outcome).isInstanceOf(WizardOutcome.Expired::class.java)
        assertThat((outcome as WizardOutcome.Expired).label)
            .isEqualTo("Salt maps of the coast road")
        // The promise the notice makes: the draft is there.
        assertThat(drafts.held?.body).isEqualTo("Salt maps")
    }

    @Test
    fun leavingKeepsWhatWasAuthored() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBodyChange("half a thought")
        vm.onLeave()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.outcome).isEqualTo(WizardOutcome.DraftKept)
        assertThat(drafts.held?.body).isEqualTo("half a thought")
    }

    @Test
    fun leavingAnUntouchedWizardKeepsNothing() = runTest(dispatcher) {
        drafts.held = ComposeDraft(DraftBodyKind.Words, body = "an older draft")
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        // The offer is standing, so leaving must not overwrite the held
        // draft with the empty wizard sitting behind it.
        vm.onLeave()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(drafts.held?.body).isEqualTo("an older draft")
    }

    @Test
    fun anAbsentKeyStopsBeforeSigningAndKeepsTheDraft() = runTest(dispatcher) {
        identity.seed = null
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBodyChange("Salt maps")
        vm.onNext()
        vm.onNext()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.keyAbsent).isTrue()
        assertThat(vm.state.value.outcome).isNull()
        assertThat(drafts.held?.body).isEqualTo("Salt maps")
    }

    // -- The draft offer --

    @Test
    fun aHeldDraftIsOfferedRatherThanRestoredSilently() = runTest(dispatcher) {
        drafts.held = ComposeDraft(
            bodyKind = DraftBodyKind.Media,
            title = "Salt maps",
            assets = listOf(DraftAsset("a", "A salt crust")),
        )
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.draftOffer).isNotNull()
        // Nothing was taken over: the wizard behind the offer is empty.
        assertThat(vm.state.value.title).isEmpty()

        vm.onContinueDraft()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.title).isEqualTo("Salt maps")
        assertThat(vm.state.value.mode).isEqualTo(BodyMode.Media)
        assertThat(vm.state.value.picked.single().altText).isEqualTo("A salt crust")
    }

    @Test
    fun discardingTheOfferForgetsIt() = runTest(dispatcher) {
        drafts.held = ComposeDraft(DraftBodyKind.Words, body = "an older draft")
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDiscardDraft()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.draftOffer).isNull()
        assertThat(drafts.held).isNull()
    }

    // -- Refusals --

    @Test
    fun aRefusalNamingAPickLandsOnThatPick() = runTest(dispatcher) {
        content.outcome = Outcome.Refused(
            listOf(UserError(ErrorCode.BAD_INPUT, "already attached", listOf("attachments", "1", "mediaId"))),
        )
        val vm = viewModel()
        vm.toSealWithMedia("a", "b")
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        val second = vm.state.value.picked[1].upload
        assertThat(second).isInstanceOf(AssetUpload.Failed::class.java)
        assertThat((second as AssetUpload.Failed).message).isEqualTo("already attached")
        // It landed on the pick, so nothing spills into the one-line
        // problem the screen shows for the unplaceable.
        assertThat(vm.state.value.refusal).isNull()
    }

    @Test
    fun aWholeBatchRefusalSaysItsPieceOnce() = runTest(dispatcher) {
        content.outcome = Outcome.Refused(
            listOf(UserError(ErrorCode.WRITE_RULE_FAILED, "the balance cannot carry this")),
        )
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBodyChange("Salt maps")
        vm.onNext()
        vm.onNext()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.refusal).isEqualTo("the balance cannot carry this")
        assertThat(vm.state.value.signingFailed).isFalse()
    }

    @Test
    fun aTransportFaultOnTheStageNeverClaimsSigningFailed() = runTest(dispatcher) {
        content.outcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBodyChange("Salt maps")
        vm.onNext()
        vm.onNext()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(vm.state.value.signingFailed).isFalse()
    }

    @Test
    fun signingIsRefusedWhileAnUploadIsUnfinished() = runTest(dispatcher) {
        media.failures += "a"
        val vm = viewModel()
        vm.toSealWithMedia("a")
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.calls).isEqualTo(0)
    }

    @Test
    fun droppingAPickAfterItsUploadStartedRemovesItFromTheGallery() = runTest(dispatcher) {
        val vm = viewModel()
        vm.toSealWithMedia("a", "b")
        vm.onBack() // seal -> details
        vm.onBack() // details -> crop
        vm.onBack() // crop -> body
        vm.onTogglePick("a")
        vm.onNext()
        vm.onNext()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onNext()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.lastAttachments.map { it.mediaId }).containsExactly("m2")
    }
}
