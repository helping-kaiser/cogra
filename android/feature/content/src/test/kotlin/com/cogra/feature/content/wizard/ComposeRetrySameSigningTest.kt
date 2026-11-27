package com.cogra.feature.content.wizard

import com.cogra.crypto.ActorKey
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.AuthTokens
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedContentView
import com.cogra.domain.WriteState
import com.cogra.domain.media.DeviceMedia
import com.cogra.domain.media.DeviceMediaSource
import com.cogra.domain.references.ReferenceClaim
import com.cogra.domain.signing.ContentShape
import com.cogra.domain.signing.SentContent
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.postExpectation
import com.cogra.domain.testing.AnswerLosingWriteRepository
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.InMemoryComposeDraftStore
import com.cogra.domain.testing.InMemorySealedDraftStore
import com.cogra.domain.testing.ScriptedSearchRepository
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.TEST_ACCOUNT_ID
import com.cogra.domain.testing.TEST_NODE_ID
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingMediaProcessor
import com.cogra.domain.testing.ThrowingMediaRepository
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.cogra.domain.testing.ThrowingSettingsRepository
import com.cogra.domain.testing.ThrowingVideoProcessor
import com.cogra.domain.testing.faithfulContent
import com.cogra.domain.testing.signedInSession
import com.cogra.domain.testing.testGraphIds
import com.cogra.domain.topics.TagClaim
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

/**
 * The post seal's Retry asks THE SAME signing again (SealSigning.md:31 "WHEN
 * press Retry -> the same signing is asked again"; SigningAfterClose.md:27 "AND
 * NEVER anything else is signed"). A fresh prepare stages a second post beside
 * the first, whose material Home's Resume would still approve: two posts, two
 * prices. web's twin: `wizard-view.test.tsx` and `write-signer.retry.test.ts`.
 *
 * Every test runs the REAL signer against the fake host, which can lose an
 * answer it already took ([AnswerLosingWriteRepository]).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ComposeRetrySameSigningTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)
    private val host = AnswerLosingWriteRepository(sealer)
    private val session = signedInSession()

    /** A faithful prepare that counts itself: every call stages a NEW batch. */
    private val content = object : ThrowingContentRepository() {
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
            pDirected: Double,
        ): Outcome<PreparedContentView> {
            calls += 1
            val sent = SentContent(title, description, content, attachments, sensitive, sensitiveReason)
            val ordered = postExpectation(
                pDirected,
                license,
                faithfulContent(TEST_NODE_ID, sent, ContentShape.POST),
                tags,
                references,
                testGraphIds(references.map { it.targetId }),
            )
            return Outcome.Success(PreparedContentView(TEST_NODE_ID, sealer.stageFaithful(ordered)))
        }
    }

    private val drafts = InMemoryComposeDraftStore()
    private val seals = InMemorySealedDraftStore(drafts)

    private val deviceMedia = object : DeviceMediaSource {
        override suspend fun newestMedia(limit: Int): List<DeviceMedia> = emptyList()
    }

    private val settings = object : ThrowingSettingsRepository() {
        override suspend fun defaultLicense(): Outcome<LicenseChoice?> = Outcome.Success(null)
    }

    private fun viewModel() = ComposeWizardViewModel(
        content = content,
        references = ThrowingReferenceRepository(),
        media = ThrowingMediaRepository(),
        processor = ThrowingMediaProcessor(),
        video = ThrowingVideoProcessor(),
        deviceMedia = deviceMedia,
        drafts = drafts,
        seals = seals,
        signer = WriteSigner(host, identity),
        stagedWrites = host,
        settings = settings,
        search = ScriptedSearchRepository(),
        identity = identity,
        tokens = session,
    )

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun settle() = dispatcher.scheduler.advanceUntilIdle()

    /** A words post walked to its seal and signed once. */
    private fun signedOnce(): ComposeWizardViewModel = viewModel().apply {
        start()
        settle()
        onModeChange(BodyMode.Words)
        onBodyChange("Salt maps of the coast road")
        onNext() // body -> details
        onNext() // details -> seal
        onSign()
        settle()
    }

    /** The seal's Retry: the commit pressed again (SealStep's fault foot). */
    private fun ComposeWizardViewModel.retry() {
        onSign()
        settle()
    }

    /** (a) The pre-commitment was taken, its answer lost: Retry approves THAT write. */
    @Test
    fun aLostSubmitAnswerRetriedAsksTheSameWritesAndPreparesNothing() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = signedOnce()
        assertThat(vm.state.value.fault).isEqualTo(SealFault.Offline)
        val first = host.submitted.toList()

        vm.retry()

        assertThat(content.calls).isEqualTo(1)
        assertThat(host.read).containsAtLeastElementsIn(first)
        assertThat(host.submitted).isEqualTo(first)
        assertThat(host.approved).isEqualTo(first)
        assertThat(vm.state.value.outcome).isEqualTo(WizardOutcome.Landed(TEST_NODE_ID))
    }

    /** (b) The approval was taken, its answer lost: Retry closes as taken, nothing signed twice. */
    @Test
    fun aFirstAttemptAlreadyTakenClosesAsTakenOnRetry() = runTest(dispatcher) {
        host.loseApproves = 1
        val vm = signedOnce()
        assertThat(vm.state.value.fault).isEqualTo(SealFault.Offline)
        val first = host.approved.toList()

        vm.retry()

        assertThat(content.calls).isEqualTo(1)
        assertThat(host.approved).isEqualTo(first)
        assertThat(host.submitted).isEqualTo(first)
        assertThat(vm.state.value.outcome).isEqualTo(WizardOutcome.Landed(TEST_NODE_ID))
        // Still relaying: the draft is sealed out of the composer, as any taken post's is.
        assertThat(seals.copies.single().writes).isEqualTo(first)
    }

    /** (b) The same, once the first batch has already landed: no copy is kept. */
    @Test
    fun aFirstAttemptAlreadyLandedClosesAsTakenAndKeepsNoCopy() = runTest(dispatcher) {
        host.loseApproves = 1
        val vm = signedOnce()
        host.hostSays(host.approved.single(), WriteState.LANDED)

        vm.retry()

        assertThat(content.calls).isEqualTo(1)
        assertThat(host.approved).hasSize(1)
        assertThat(vm.state.value.outcome).isEqualTo(WizardOutcome.Landed(TEST_NODE_ID))
        assertThat(seals.copies).isEmpty()
        assertThat(drafts.held).isNull()
    }

    /**
     * (c) A CHANGED draft is a new intent: the first attempt, never approved, is
     * retired — this device forgets its material, so it can never land — and the
     * changed post is prepared afresh.
     */
    @Test
    fun aChangedDraftRetiresTheUnapprovedFirstAttemptAndPreparesAnew() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = signedOnce()
        val first = host.submitted.single()

        vm.onLicenseChange(LicenseChoice(1.0, 0.5))
        vm.retry()

        assertThat(content.calls).isEqualTo(2)
        assertThat(identity.handshakes.keys).doesNotContain(first)
        assertThat(host.approved).doesNotContain(first)
        assertThat(vm.state.value.outcome).isEqualTo(WizardOutcome.Landed(TEST_NODE_ID))
    }

    /**
     * (c) A changed draft over a first attempt this device already approved: the
     * first post is landing. INTERIM, the web's (#655): it opens as a success
     * does, and the changed words stay the working draft with no signing of
     * their own.
     */
    @Test
    fun aChangedDraftOverAnApprovedFirstAttemptOpensTheFirstPostAndKeepsTheWords() = runTest(dispatcher) {
        host.loseApproves = 1
        val vm = signedOnce()

        vm.onLicenseChange(LicenseChoice(1.0, 0.5))
        vm.retry()

        assertThat(content.calls).isEqualTo(1)
        assertThat(host.approved).hasSize(1)
        assertThat(vm.state.value.outcome).isEqualTo(WizardOutcome.Landed(TEST_NODE_ID))
        assertThat(drafts.held?.body).isEqualTo("Salt maps of the coast road")
        assertThat(seals.copies).isEmpty()
    }

    /** (d) A first attempt collected unlanded is nothing to ask again: it falls back to a fresh prepare. */
    @Test
    fun anExpiredFirstAttemptFallsBackToAFreshPrepare() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = signedOnce()
        val first = host.submitted.single()
        host.hostSays(first, WriteState.EXPIRED)

        vm.retry()

        // Asked first, found expired, and only then prepared anew.
        assertThat(host.read).contains(first)
        assertThat(content.calls).isEqualTo(2)
        assertThat(identity.handshakes.keys).doesNotContain(first)
        assertThat(vm.state.value.outcome).isEqualTo(WizardOutcome.Landed(TEST_NODE_ID))
    }

    /** A Retry whose read does not answer decides nothing and signs nothing: the fault stands again. */
    @Test
    fun aRetryWhoseReadDoesNotAnswerPreparesNothing() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = signedOnce()
        host.readsFail = true

        vm.retry()

        assertThat(content.calls).isEqualTo(1)
        assertThat(host.approved).isEmpty()
        assertThat(vm.state.value.fault).isEqualTo(SealFault.Offline)
    }

    /**
     * The attempt rides the kept draft: leaving after the fault and coming back
     * to the draft still asks the SAME signing, never a second post (web #655:
     * "a reload followed by a press still asks the same signing").
     */
    @Test
    fun theKeptDraftCarriesTheAttemptAcrossALeave() = runTest(dispatcher) {
        host.loseApproves = 1
        val vm = signedOnce()
        vm.onLeave()
        settle()

        val again = viewModel()
        again.start()
        settle()
        again.onContinueDraft()
        settle()
        again.onNext() // body -> details
        again.onNext() // details -> seal
        again.retry()

        assertThat(content.calls).isEqualTo(1)
        assertThat(host.approved).hasSize(1)
        assertThat(again.state.value.outcome).isEqualTo(WizardOutcome.Landed(TEST_NODE_ID))
    }

    private fun switchTo(account: String) {
        session.tokens.value = AuthTokens("access-$account", "refresh-$account", account)
    }

    /**
     * (e) Another account active between the press and the Retry: nothing runs
     * under it — no read, no prepare, no signature — and the attempt is not
     * erased: under its own account again, the Retry asks it (auth.md
     * "Multi-account device custody").
     */
    @Test
    fun aRetryUnderAnotherAccountRunsNothingAndTheAttemptStandsForItsOwn() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = signedOnce()
        val first = host.submitted.toList()
        val readsBefore = host.read.size
        switchTo("acct-b")

        vm.retry()

        assertThat(content.calls).isEqualTo(1)
        assertThat(host.read).hasSize(readsBefore)
        assertThat(host.approved).isEmpty()
        assertThat(identity.handshakes.keys).containsExactlyElementsIn(first)
        assertThat(vm.state.value.submitting).isFalse()
        assertThat(vm.state.value.outcome).isNull()

        switchTo(TEST_ACCOUNT_ID)
        vm.retry()

        assertThat(content.calls).isEqualTo(1)
        assertThat(host.approved).isEqualTo(first)
        assertThat(vm.state.value.outcome).isEqualTo(WizardOutcome.Landed(TEST_NODE_ID))
    }

    /** (e) A first press with no account active prepares nothing. */
    @Test
    fun aPressWithNoSessionPreparesNothing() = runTest(dispatcher) {
        session.tokens.value = null
        val vm = signedOnce()

        assertThat(content.calls).isEqualTo(0)
        assertThat(vm.state.value.submitting).isFalse()
    }
}
