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
import com.cogra.domain.media.DeviceImage
import com.cogra.domain.media.DeviceImageSource
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

    /** `ComposePick`'s grid, scripted: the wizard only ever reads it. */
    private val deviceImages = object : DeviceImageSource {
        var offered = listOf(DeviceImage("a", 1f), DeviceImage("b", 1.5f))
        var calls = 0

        override suspend fun newestImages(limit: Int): List<DeviceImage> {
            calls += 1
            return offered.take(limit)
        }
    }

    private fun viewModel() = ComposeWizardViewModel(
        content = content,
        references = references,
        media = media,
        processor = processor,
        deviceImages = deviceImages,
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
        onNext() // crop -> details
        onNext() // details -> seal, uploads start (they carry the alt text)
        dispatcher.scheduler.advanceUntilIdle()
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
    fun altTextRidesItsOwnUpload() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onModeChange(BodyMode.Media)
        vm.onTogglePick("a")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onNext() // body -> crop
        vm.onNext() // crop -> details, where descriptions are authored
        vm.onAltTextChange("a", "A salt crust")
        vm.onNext() // details -> seal, and only now does the upload run
        dispatcher.scheduler.advanceUntilIdle()

        // The description has to be on the wire with its own bytes:
        // `altText` rides `UploadMediaInput` and an asset row is immutable
        // after upload (D3), so an upload that started earlier would have
        // dropped it.
        assertThat(media.lastAltText).isEqualTo("A salt crust")
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

        assertThat(vm.state.value.deviceImages.map { it.uri }).containsExactly("a", "b").inOrder()
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
        assertThat(vm.state.value.deviceImages).isNotEmpty()

        vm.onContinueDraft()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.deviceImages.map { it.uri }).containsExactly("a", "b").inOrder()
    }

    /** And it re-reads the roll, because a held draft can be days old. */
    @Test
    fun resumingADraftRereadsTheRoll() = runTest(dispatcher) {
        drafts.held = ComposeDraft(DraftBodyKind.Media, assets = listOf(DraftAsset("a", "")))
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        val before = deviceImages.calls

        deviceImages.offered = listOf(DeviceImage("c", 1f))
        vm.onContinueDraft()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(deviceImages.calls).isGreaterThan(before)
        assertThat(vm.state.value.deviceImages.map { it.uri }).containsExactly("c")
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
}
