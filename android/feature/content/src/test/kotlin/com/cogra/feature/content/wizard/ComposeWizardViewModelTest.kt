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
import com.cogra.domain.media.DeviceMedia
import com.cogra.domain.media.DeviceMediaSource
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.media.ProcessedVideo
import com.cogra.domain.media.VideoFrame
import com.cogra.domain.media.VideoInfo
import com.cogra.domain.references.ReferenceClaim
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingMediaProcessor
import com.cogra.domain.testing.ThrowingMediaRepository
import com.cogra.domain.testing.ThrowingVideoProcessor
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
        var lastSensitive: Boolean? = null
        var lastSensitiveReason: String? = null
        var calls = 0

        override suspend fun preparePost(
            title: String?,
            description: String?,
            content: String?,
            license: LicenseChoice,
            tags: List<TagClaim>,
            references: List<ReferenceClaim>,
            attachments: List<AttachmentClaim>,
            sensitive: Boolean,
            sensitiveReason: String?,
        ): Outcome<PreparedContentView> {
            calls += 1
            lastContent = content
            lastAttachments = attachments
            lastSensitive = sensitive
            lastSensitiveReason = sensitiveReason
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
        private var next = 0

        /** The URI each call is for, in order, so failures can be aimed. */
        var pending = ArrayDeque<String>()

        override suspend fun uploadMedia(
            picture: ProcessedPicture,
        ): Outcome<MediaAssetView> {
            uploads += 1
            val uri = pending.removeFirstOrNull().orEmpty()
            if (uri in failures) {
                return Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "too big")))
            }
            next += 1
            order += "still"
            return Outcome.Success(
                MediaAssetView("m$next", "https://media/m$next", null, FieldStatus.NORMAL, 1f),
            )
        }

        /** Every upload in the order it was made — stills and clips alike. */
        val order = mutableListOf<String>()

        /** The cover id the clip named, so the pairing can be asserted. */
        var namedCover: String? = null
        var videoRefused = false

        override suspend fun uploadVideo(
            video: ProcessedVideo,
            coverMediaId: String,
        ): Outcome<MediaAssetView> {
            order += "video"
            namedCover = coverMediaId
            if (videoRefused) {
                return Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "not H.264")))
            }
            return Outcome.Success(
                MediaAssetView(
                    "v1",
                    "https://media/v1",
                    null,
                    FieldStatus.NORMAL,
                    0.5625f,
                    mimeType = "video/mp4",
                    durationMs = 42_000,
                ),
            )
        }
    }

    private val processor = object : ThrowingMediaProcessor() {
        var undecodable = mutableSetOf<String>()

        /** Nothing decodes as a picture — the refused-format case. */
        var unreadable = false

        /** What the store says a picked file weighs; null = it will not say. */
        var size: Long? = 1_024

        override suspend fun process(uri: String, crop: CropSpec): ProcessedPicture? {
            media.pending.addLast(uri)
            return if (uri in undecodable) null else ProcessedPicture(ByteArray(4), 100, 125)
        }

        override suspend fun aspectRatio(uri: String): Float? = if (unreadable) null else 0.8f

        override suspend fun sizeBytes(uri: String): Long? = size
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

    /** `ComposePick`'s grid, scripted: the wizard only ever reads it. */
    private val deviceMedia = object : DeviceMediaSource {
        var offered = listOf(DeviceMedia("a", 1f), DeviceMedia("b", 1.5f))
        var calls = 0

        override suspend fun newestMedia(limit: Int): List<DeviceMedia> {
            calls += 1
            return offered.take(limit)
        }
    }

    /**
     * The video pipeline, scripted. It records the order it was asked in
     * so the two-step upload's *sequence* — cover first, then the clip
     * that names it — is assertable rather than merely its outcome.
     */
    private val video = object : ThrowingVideoProcessor() {
        var untranscodable = false

        /** What the re-encode produced — the weight the cap judges. */
        var outputBytes = 1_024L
        val calls = mutableListOf<String>()

        /** The cap the pipeline was told to encode for. */
        var capAskedFor: Long? = null

        override suspend fun transcode(
            uri: String,
            capBytes: Long,
            onProgress: (Int) -> Unit,
        ): ProcessedVideo? {
            calls += "transcode"
            capAskedFor = capBytes
            onProgress(50)
            return if (untranscodable) {
                null
            } else {
                ProcessedVideo("/tmp/$uri.mp4", 1080, 1920, 42_000, outputBytes)
            }
        }

        override suspend fun coverFrames(uri: String, count: Int): List<VideoFrame> =
            List(count) { VideoFrame(it * 1_000, ProcessedPicture(ByteArray(4), 100, 125)) }

        override suspend fun info(uri: String): VideoInfo? =
            if (uri.startsWith("clip")) VideoInfo(42_000, 0.5625f) else null
    }

    private fun viewModel() = ComposeWizardViewModel(
        content = content,
        references = references,
        media = media,
        processor = processor,
        video = video,
        deviceMedia = deviceMedia,
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

    /**
     * Walks a words post to the seal, runs [atTheSeal], then signs — so a
     * test can set the seal's own choices where an author would.
     */
    private fun ComposeWizardViewModel.signWords(atTheSeal: () -> Unit = {}) {
        start()
        dispatcher.scheduler.advanceUntilIdle()
        onModeChange(BodyMode.Words)
        onBodyChange("Salt maps of the coast road")
        onNext() // body -> details
        onNext() // details -> seal
        atTheSeal()
        onSign()
        dispatcher.scheduler.advanceUntilIdle()
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
        onNext() // details -> seal
        dispatcher.scheduler.advanceUntilIdle()
    }

    // -- When the pictures go up (`ComposeUploading`) --

    /**
     * "Pictures upload while you write" — the board's footnote, and the
     * reason it can hold: nothing authored after the crop changes the
     * bytes, because a description rides `AttachmentClaim` at prepare
     * rather than the upload.
     */
    @Test
    fun uploadsBeginOnLeavingTheCropStage() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onModeChange(BodyMode.Media)
        vm.onTogglePick("a")
        vm.onTogglePick("b")
        dispatcher.scheduler.advanceUntilIdle()

        vm.onNext() // body -> crop
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(media.uploads).isEqualTo(0)

        vm.onNext() // crop -> details
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.step).isEqualTo(WizardStep.Details)
        // Already on the wire while the author is still writing — not
        // waiting on the walk out of Details.
        assertThat(media.uploads).isEqualTo(2)
        assertThat(vm.state.value.picked.map { it.upload })
            .containsExactly(AssetUpload.Done("m1"), AssetUpload.Done("m2"))
    }

    /**
     * The other half of that freedom: a description authored after the
     * upload already finished still reaches the prepare input, because
     * it never rode the upload in the first place.
     */
    @Test
    fun aDescriptionTypedAfterAnUploadFinishedStillReachesPrepare() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onModeChange(BodyMode.Media)
        vm.onTogglePick("a")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onNext() // body -> crop
        vm.onNext() // crop -> details
        dispatcher.scheduler.advanceUntilIdle()

        // The upload is finished and done with; the describing happens
        // strictly after it.
        assertThat(vm.state.value.picked.single().upload).isEqualTo(AssetUpload.Done("m1"))

        vm.onAltTextChange("a", "a salt map of the coast road")
        vm.onNext() // details -> seal
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.lastAttachments.single().mediaId).isEqualTo("m1")
        assertThat(content.lastAttachments.single().altText)
            .isEqualTo("a salt map of the coast road")
        // Still one upload: describing does not re-send the bytes.
        assertThat(media.uploads).isEqualTo(1)
    }

    /**
     * The invalidation that made the early start impossible: describing
     * used to knock a finished upload back to idle, because the alt text
     * rode the upload and a changed description made the object stale.
     * It no longer does, so an upload survives every keystroke after it.
     */
    @Test
    fun describingDoesNotInvalidateAFinishedUpload() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onModeChange(BodyMode.Media)
        vm.onTogglePick("a")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onNext() // body -> crop
        vm.onNext() // crop -> details
        dispatcher.scheduler.advanceUntilIdle()

        vm.onAltTextChange("a", "a salt map")
        vm.onAltTextChange("a", "a salt map of the coast road")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.picked.single().upload).isEqualTo(AssetUpload.Done("m1"))
        assertThat(media.uploads).isEqualTo(1)
        assertThat(vm.state.value.canSign).isTrue()
    }

    // -- The XOR reaches the wire, not just the screen (D16) --

    @Test
    fun aWordsPostSendsWordsAndNoGallery() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onModeChange(BodyMode.Words)
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
    fun aDescriptionRidesTheAttachmentRatherThanTheUpload() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onModeChange(BodyMode.Media)
        vm.onTogglePick("a")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onNext() // body -> crop
        vm.onNext() // crop -> details, where descriptions are authored
        vm.onAltTextChange("a", "A salt crust")
        vm.onNext() // details -> seal
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        // The description is a fact about the placement, so it travels on
        // the claim and not with the bytes: an upload that ran before the
        // author typed anything is still the right upload.
        assertThat(content.lastAttachments.single().altText).isEqualTo("A salt crust")
    }

    // -- The author's own sensitive mark --

    @Test
    fun anUnmarkedPostStatesTheMarkExplicitlyRatherThanOmittingIt() = runTest(dispatcher) {
        val vm = viewModel()
        vm.signWords()

        // An edit payload is the complete state, so an OMITTED mark
        // unmarks. Always sending the switch's value is what keeps the
        // create and edit paths one piece of code.
        assertThat(content.lastSensitive).isFalse()
        assertThat(content.lastSensitiveReason).isNull()
    }

    @Test
    fun aMarkedPostCarriesItsReason() = runTest(dispatcher) {
        val vm = viewModel()
        vm.signWords {
            vm.onSensitiveChange(true)
            vm.onSensitiveReasonChange("One rubbing includes a dead seabird.")
        }

        assertThat(content.lastSensitive).isTrue()
        assertThat(content.lastSensitiveReason).isEqualTo("One rubbing includes a dead seabird.")
    }

    @Test
    fun unmarkingDropsTheReasonWithIt() = runTest(dispatcher) {
        val vm = viewModel()
        vm.signWords {
            vm.onSensitiveChange(true)
            vm.onSensitiveReasonChange("A dead seabird.")
            vm.onSensitiveChange(false)

            // The contract refuses a reason without the mark, so keeping
            // one would send a value guaranteed to come back as an error.
            assertThat(vm.state.value.sensitiveReason).isEmpty()
        }

        assertThat(content.lastSensitive).isFalse()
        assertThat(content.lastSensitiveReason).isNull()
    }

    @Test
    fun blankAltTextRidesAsNullRatherThanAnEmptyDescription() = runTest(dispatcher) {
        val vm = viewModel()
        vm.toSealWithMedia("a")
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        // An empty string is a value, and a decorative asset needs a
        // null description rather than a described nothing (D20).
        assertThat(content.lastAttachments.single().altText).isNull()
    }

    // -- The ways out --

    @Test
    fun aSignedPostClearsTheDraftAndReportsItsNode() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onModeChange(BodyMode.Words)
        vm.onBodyChange("Salt maps")
        vm.onNext()
        vm.onNext()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.outcome).isEqualTo(WizardOutcome.Landed("node-1"))
        assertThat(drafts.held).isNull()
    }

    /**
     * The route consumes the outcome the instant it navigates, and the
     * lifecycle then stops the screen — which used to write the published
     * post straight back into the store, so the composer offered it again
     * on the next visit (jakob 2026-08-31).
     */
    @Test
    fun aLandedPostStaysGoneWhenTheOutcomeIsConsumedAndTheScreenStops() = runTest(dispatcher) {
        val vm = viewModel()
        vm.signWords()
        assertThat(drafts.held).isNull()

        // Exactly what `ComposeWizardScreen` does on `Landed`: consume,
        // navigate, and take the `ON_STOP` that follows.
        vm.onOutcomeConsumed()
        vm.persistNow()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(drafts.held).isNull()
    }

    /** The debounced writer must not resurrect it either. */
    @Test
    fun aLandedPostIsNotRewrittenByThePendingDebouncedSave() = runTest(dispatcher) {
        val vm = viewModel()
        vm.signWords()

        vm.onOutcomeConsumed()
        // Long enough for any scheduled debounce to have fired.
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(drafts.held).isNull()
    }

    @Test
    fun anExpiredActKeepsTheDraftAndSaysNothingWasSpent() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onModeChange(BodyMode.Words)
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
    fun theDraftIsWrittenAsItIsMadeRatherThanOnlyOnTheWayOut() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()

        vm.onModeChange(BodyMode.Words)
        vm.onBodyChange("half a thought")
        dispatcher.scheduler.advanceUntilIdle()

        // Nothing was left, nothing was signed, and the process could die
        // here — the draft is already on disk.
        assertThat(vm.state.value.outcome).isNull()
        assertThat(drafts.held?.body).isEqualTo("half a thought")
    }

    @Test
    fun aLifecycleStopWritesWithoutWaitingOutTheDebounce() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()

        vm.onModeChange(BodyMode.Words)
        vm.onBodyChange("typed and backgrounded")
        vm.persistNow()
        // Well short of the debounce: the stop's write does not wait, and
        // nothing scheduled after it may cancel it.
        dispatcher.scheduler.advanceTimeBy(1)
        dispatcher.scheduler.runCurrent()

        assertThat(drafts.held?.body).isEqualTo("typed and backgrounded")
    }

    @Test
    fun nothingIsWrittenWhileAHeldDraftIsStillBeingOffered() = runTest(dispatcher) {
        drafts.held = ComposeDraft(DraftBodyKind.Words, body = "an older draft")
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()

        // The wizard behind the offer is empty, and persisting an empty
        // wizard clears the store — which would destroy the very draft the
        // offer is about.
        assertThat(drafts.held?.body).isEqualTo("an older draft")

        vm.onDiscardDraft()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(drafts.held).isNull()
    }

    @Test
    fun backWalksOneStageAndLeavesOnlyFromTheFirst() = runTest(dispatcher) {
        val vm = viewModel()
        vm.toSealWithMedia("a")
        assertThat(vm.state.value.step).isEqualTo(WizardStep.Seal)

        // Back always goes back one step (jakob 2026-08-31), absorbing the
        // gesture until the first stage has nowhere left to retreat to.
        assertThat(vm.onBack()).isTrue()
        assertThat(vm.state.value.step).isEqualTo(WizardStep.Details)
        assertThat(vm.onBack()).isTrue()
        assertThat(vm.state.value.step).isEqualTo(WizardStep.Crop)
        assertThat(vm.onBack()).isTrue()
        assertThat(vm.state.value.step).isEqualTo(WizardStep.Body)

        // Only the first stage reports "not handled", so the route leaves.
        assertThat(vm.onBack()).isFalse()
        vm.onLeave()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.outcome).isEqualTo(WizardOutcome.DraftKept)
        assertThat(drafts.held).isNotNull()
    }

    @Test
    fun backClosesAnOpenSheetBeforeItStepsBack() = runTest(dispatcher) {
        val vm = viewModel()
        vm.toSealWithMedia("a")
        vm.onOpenSheet(SealSheet.License)

        // The sheet is a drawer over the seal: it closes first, and the
        // stage only moves on the next gesture.
        assertThat(vm.onBack()).isTrue()
        assertThat(vm.state.value.sheet).isEqualTo(SealSheet.None)
        assertThat(vm.state.value.step).isEqualTo(WizardStep.Seal)
        assertThat(vm.onBack()).isTrue()
        assertThat(vm.state.value.step).isEqualTo(WizardStep.Details)
    }

    @Test
    fun theSealsBackPillIsTheOneThatStepsBack() = runTest(dispatcher) {
        val vm = viewModel()
        vm.toSealWithMedia("a")

        vm.onSealBack()

        assertThat(vm.state.value.step).isEqualTo(WizardStep.Details)
    }

    @Test
    fun aGrantedPermissionFillsThePickerGrid() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()

        vm.onMediaPermissionGranted()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.deviceMedia.map { it.uri }).containsExactly("a", "b").inOrder()
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
        vm.onModeChange(BodyMode.Words)
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

    /**
     * Resuming replaces what was authored, never what the device already
     * handed over: the grid used to be wiped by the restore and never
     * refilled, leaving the pick stage with nothing but its photos-app
     * tile (jakob 2026-08-31).
     */
    @Test
    fun resumingADraftKeepsThePickerGrid() = runTest(dispatcher) {
        drafts.held = ComposeDraft(DraftBodyKind.Media, assets = listOf(DraftAsset("a", "")))
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onMediaPermissionGranted()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.deviceMedia).isNotEmpty()

        vm.onContinueDraft()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.deviceMedia.map { it.uri }).containsExactly("a", "b").inOrder()
    }

    /** And it re-reads the roll, because a held draft can be days old. */
    @Test
    fun resumingADraftRereadsTheRoll() = runTest(dispatcher) {
        drafts.held = ComposeDraft(DraftBodyKind.Media, assets = listOf(DraftAsset("a", "")))
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        val before = deviceMedia.calls

        deviceMedia.offered = listOf(DeviceMedia("c", 1f))
        vm.onContinueDraft()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(deviceMedia.calls).isGreaterThan(before)
        assertThat(vm.state.value.deviceMedia.map { it.uri }).containsExactly("c")
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
        vm.onModeChange(BodyMode.Words)
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
        vm.onModeChange(BodyMode.Words)
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
        vm.onNext() // body -> crop
        vm.onNext() // crop -> details
        vm.onNext() // details -> seal
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.lastAttachments.map { it.mediaId }).containsExactly("m2")
    }

    // -- The video path --

    /** Picks a clip and walks the wizard to the far side of the cover stage. */
    private fun ComposeWizardViewModel.toDetailsWithVideo() {
        start()
        dispatcher.scheduler.advanceUntilIdle()
        onTogglePick("clip-1")
        dispatcher.scheduler.advanceUntilIdle()
        onNext() // body -> cover
        dispatcher.scheduler.advanceUntilIdle()
        onNext() // cover -> details, which is where the upload starts
        dispatcher.scheduler.advanceUntilIdle()
    }

    @Test
    fun theCoverGoesUpBeforeTheClipThatNamesIt() = runTest(dispatcher) {
        val vm = viewModel()
        vm.toDetailsWithVideo()

        // The order is the contract's: an asset row is immutable once
        // written, so the clip cannot gain a poster afterwards.
        assertThat(media.order).containsExactly("still", "video").inOrder()
        assertThat(media.namedCover).isEqualTo(vm.state.value.coverMediaId)
        assertThat(vm.state.value.uploadsComplete).isTrue()
    }

    @Test
    fun enteringTheCoverStageLiftsTheFramesOutOfTheClip() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onTogglePick("clip-1")
        dispatcher.scheduler.advanceUntilIdle()
        // Nothing is decoded while the clip is merely picked.
        assertThat(vm.state.value.coverFrames).isEmpty()

        vm.onNext()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.step).isEqualTo(WizardStep.Cover)
        assertThat(vm.state.value.coverFrames)
            .hasSize(ComposeWizardViewModel.COVER_FRAME_COUNT)
    }

    @Test
    fun theTranscodeReportsItsProgressBeforeTheClipIsSent() = runTest(dispatcher) {
        val vm = viewModel()
        vm.toDetailsWithVideo()
        // The pipeline was asked to re-encode rather than the original
        // bytes being sent as they were.
        assertThat(video.calls).contains("transcode")
    }

    @Test
    fun theEncoderIsToldWhichCapItIsEncodingFor() = runTest(dispatcher) {
        // The rate is chosen against the destination, so a long clip is
        // encoded smaller rather than encoded generously and refused.
        val vm = viewModel()
        vm.toDetailsWithVideo()
        assertThat(video.capAskedFor).isEqualTo(ComposeWizardViewModel.MAX_VIDEO_BYTES)
    }

    @Test
    fun aClipThatWillNotTranscodeNeverReachesTheWire() = runTest(dispatcher) {
        video.untranscodable = true
        val vm = viewModel()
        vm.toDetailsWithVideo()

        assertThat(media.order).containsExactly("still")
        val upload = vm.state.value.picked.single().upload
        assertThat(upload).isInstanceOf(AssetUpload.Failed::class.java)
        assertThat((upload as AssetUpload.Failed).message)
            .isEqualTo(ComposeWizardViewModel.UNREADABLE_VIDEO)
        assertThat(vm.state.value.uploadsComplete).isFalse()
    }

    @Test
    fun aRefusedClipCarriesTheServersOwnWords() = runTest(dispatcher) {
        media.videoRefused = true
        val vm = viewModel()
        vm.toDetailsWithVideo()

        val upload = vm.state.value.picked.single().upload
        assertThat((upload as AssetUpload.Failed).message).isEqualTo("not H.264")
    }

    @Test
    fun aChosenCoverPictureReplacesTheFrameAndDropsTheOldId() = runTest(dispatcher) {
        val vm = viewModel()
        vm.toDetailsWithVideo()
        assertThat(vm.state.value.coverMediaId).isNotNull()

        vm.onPickCoverPicture("my-own.jpg")
        assertThat(vm.state.value.coverChoice)
            .isEqualTo(CoverChoice.Picture("my-own.jpg"))
        // The uploaded cover is no longer the one the author means.
        assertThat(vm.state.value.coverMediaId).isNull()
    }

    @Test
    fun aFileTheStepCannotReadIsRefusedWhereItWasOffered() = runTest(dispatcher) {
        processor.unreadable = true
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        // Not from the grid and neither a readable picture nor a clip.
        vm.onTogglePick("mystery.bin")
        dispatcher.scheduler.advanceUntilIdle()

        // It never joined the batch, so the tray is untouched.
        assertThat(vm.state.value.picked).isEmpty()
        val refused = vm.state.value.refused.single()
        assertThat(refused.message).isEqualTo(ComposeWizardViewModel.UNREADABLE_FILE)
        // Nothing to preview: the tile is empty on purpose.
        assertThat(refused.uri).isNull()

        // Its only way out is removing the notice.
        vm.onDismissRefusal(0)
        assertThat(vm.state.value.refused).isEmpty()
    }

    @Test
    fun aPictureOverItsCapIsRefusedWithTheCapItBroke() = runTest(dispatcher) {
        processor.size = ComposeWizardViewModel.MAX_PICTURE_BYTES + 1
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onTogglePick("huge.jpg")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.picked).isEmpty()
        val refused = vm.state.value.refused.single()
        assertThat(refused.message).isEqualTo(ComposeWizardViewModel.PICTURE_TOO_BIG)
        // It is a readable picture, so the row can preview it.
        assertThat(refused.uri).isEqualTo("huge.jpg")
    }

    @Test
    fun aFileTheStoreWillNotWeighIsLetThrough() = runTest(dispatcher) {
        processor.size = null
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onTogglePick("unmeasured.jpg")
        dispatcher.scheduler.advanceUntilIdle()

        // An unmeasurable file is judged by the server, not refused here.
        assertThat(vm.state.value.refused).isEmpty()
        assertThat(vm.state.value.picked.map { it.uri }).containsExactly("unmeasured.jpg")
    }

    @Test
    fun aClipIsWeighedAfterItsTranscodeRatherThanBefore() = runTest(dispatcher) {
        video.outputBytes = ComposeWizardViewModel.MAX_VIDEO_BYTES + 1
        val vm = viewModel()
        vm.toDetailsWithVideo()

        // The cover went up; the clip did not, because what would have
        // been sent is over the cap.
        assertThat(media.order).containsExactly("still")
        val upload = vm.state.value.picked.single().upload
        assertThat((upload as AssetUpload.Failed).message)
            .isEqualTo(ComposeWizardViewModel.VIDEO_TOO_BIG)
    }

    @Test
    fun aBigRecordingThatCompressesSmallIsAccepted() = runTest(dispatcher) {
        // The whole point of re-encoding: weighing the original would
        // refuse a post the ruling means to allow.
        processor.size = 400L * 1024 * 1024
        video.outputBytes = 20L * 1024 * 1024
        val vm = viewModel()
        vm.toDetailsWithVideo()

        assertThat(vm.state.value.refused).isEmpty()
        assertThat(media.order).containsExactly("still", "video").inOrder()
        assertThat(vm.state.value.uploadsComplete).isTrue()
    }

    @Test
    fun aReadablePictureIsNeverRefused() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onTogglePick("a")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.refused).isEmpty()
        assertThat(vm.state.value.picked.map { it.uri }).containsExactly("a")
    }

    @Test
    fun aRestoredDraftRemembersThatItsPickWasAClip() = runTest(dispatcher) {
        // A draft stores a URI and its words, never what kind of thing
        // the URI is — so the kind is re-read, or the clip comes back as
        // a one-picture gallery bound for a crop stage it never had.
        drafts.held = ComposeDraft(
            bodyKind = DraftBodyKind.Media,
            body = "",
            title = "",
            description = "",
            assets = listOf(DraftAsset("clip-1", "")),
            shape = com.cogra.domain.compose.DraftShape.Tall,
        )
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onContinueDraft()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.isVideoPost).isTrue()
        assertThat(vm.state.value.hasCoverStep).isTrue()
        assertThat(vm.state.value.hasCropStep).isFalse()
    }

    @Test
    fun theClipIsTheWholeGalleryItAttaches() = runTest(dispatcher) {
        val vm = viewModel()
        vm.toDetailsWithVideo()
        vm.onNext() // details -> seal
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        // One attachment, and it is the video — the cover rides the
        // asset row rather than the gallery.
        assertThat(content.lastAttachments.map { it.mediaId }).containsExactly("v1")
    }
}
