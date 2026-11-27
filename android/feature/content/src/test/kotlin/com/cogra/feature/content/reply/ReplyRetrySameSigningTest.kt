package com.cogra.feature.content.reply

import com.cogra.crypto.ActorKey
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.AuthTokens
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedContentView
import com.cogra.domain.WriteState
import com.cogra.domain.references.ReferenceClaim
import com.cogra.domain.signing.ContentShape
import com.cogra.domain.signing.SentContent
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.commentExpectation
import com.cogra.domain.testing.AnswerLosingWriteRepository
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.ScriptedSearchRepository
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.TEST_ACCOUNT_ID
import com.cogra.domain.testing.TEST_NODE_ID
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.ThrowingMediaProcessor
import com.cogra.domain.testing.ThrowingMediaRepository
import com.cogra.domain.testing.ThrowingReferenceRepository
import com.cogra.domain.testing.ThrowingVideoProcessor
import com.cogra.domain.testing.faithfulContent
import com.cogra.domain.testing.signedInSession
import com.cogra.domain.testing.testGraphId
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
 * The reply seal's Retry asks THE SAME signing again (SealSigning.md:31,
 * SigningAfterClose.md:27 "AND NEVER anything else is signed"; ReplySeal.md:19
 * puts the fault line and Retry in Sign comment's place). A reply keeps no
 * draft (SigningAfterClose.md:45), so the attempt lives with the wizard. web's
 * twin: `reply-wizard-view.test.tsx`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ReplyRetrySameSigningTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)
    private val host = AnswerLosingWriteRepository(sealer)
    private val session = signedInSession()

    /** A faithful comment prepare that counts itself: every call stages a NEW batch. */
    private val content = object : ThrowingContentRepository() {
        var calls = 0

        override suspend fun prepareComment(
            target: String,
            content: String,
            license: LicenseChoice,
            tags: List<TagClaim>,
            references: List<ReferenceClaim>,
            attachments: List<AttachmentClaim>,
            pDirected: Double,
            pInterest: Double,
            sensitive: Boolean,
            sensitiveReason: String?,
        ): Outcome<PreparedContentView> {
            calls += 1
            val ordered = commentExpectation(
                parentGraphId = testGraphId(target),
                pDirected = pDirected,
                pInterest = pInterest,
                license = license,
                content = faithfulContent(
                    TEST_NODE_ID,
                    SentContent(
                        content = content,
                        attachments = attachments,
                        sensitive = sensitive,
                        sensitiveReason = sensitiveReason,
                    ),
                    ContentShape.COMMENT,
                ),
                tags = tags,
                references = references,
                graphIds = testGraphIds(listOf(target) + references.map { it.targetId }),
            )
            return Outcome.Success(PreparedContentView(TEST_NODE_ID, sealer.stageFaithful(ordered)))
        }
    }

    private val target = ReplyTarget(
        id = "p1",
        kind = ReplyTargetKind.Post,
        title = "A post",
        snippet = "Its words",
        authorHandle = "ada",
    )

    private fun viewModel() = ReplyWizardViewModel(
        content = content,
        references = ThrowingReferenceRepository(),
        media = ThrowingMediaRepository(),
        processor = ThrowingMediaProcessor(),
        video = ThrowingVideoProcessor(),
        signer = WriteSigner(host, identity),
        search = ScriptedSearchRepository(),
        stagedWrites = host,
        identity = identity,
        tokens = session,
    ).apply { start(target) }

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun settle() = dispatcher.scheduler.advanceUntilIdle()

    /** A words reply walked to its seal and signed once. */
    private fun signedOnce(): ReplyWizardViewModel = viewModel().apply {
        onBodyChange("Well answered")
        onNext()
        onSign()
        settle()
    }

    /** The seal's Retry: Sign comment pressed again from the fault line. */
    private fun ReplyWizardViewModel.retry() {
        onSign()
        settle()
    }

    /** (a) The pre-commitment was taken, its answer lost: Retry approves THAT write. */
    @Test
    fun aLostSubmitAnswerRetriedAsksTheSameWritesAndPreparesNothing() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = signedOnce()
        assertThat(vm.state.value.signingFailed).isTrue()
        val first = host.submitted.toList()

        vm.retry()

        assertThat(content.calls).isEqualTo(1)
        assertThat(host.read).containsAtLeastElementsIn(first)
        assertThat(host.submitted).isEqualTo(first)
        assertThat(host.approved).isEqualTo(first)
        assertThat(vm.state.value.outcome).isEqualTo(ReplyOutcome.Signed(TEST_NODE_ID))
    }

    /** (b) The approval was taken, its answer lost: Retry closes as taken, nothing signed twice. */
    @Test
    fun aFirstAttemptAlreadyTakenClosesAsTakenOnRetry() = runTest(dispatcher) {
        host.loseApproves = 1
        val vm = signedOnce()
        val first = host.approved.toList()

        vm.retry()

        assertThat(content.calls).isEqualTo(1)
        assertThat(host.approved).isEqualTo(first)
        assertThat(host.submitted).isEqualTo(first)
        assertThat(vm.state.value.outcome).isEqualTo(ReplyOutcome.Signed(TEST_NODE_ID))
    }

    /** (c) Changed words are a new intent: the unapproved first attempt is retired, the reply prepared anew. */
    @Test
    fun aChangedReplyRetiresTheUnapprovedFirstAttemptAndPreparesAnew() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = signedOnce()
        val first = host.submitted.single()

        vm.onStanceChange(0.4, -0.2)
        vm.retry()

        assertThat(content.calls).isEqualTo(2)
        assertThat(identity.handshakes.keys).doesNotContain(first)
        assertThat(host.approved).doesNotContain(first)
        assertThat(vm.state.value.outcome).isEqualTo(ReplyOutcome.Signed(TEST_NODE_ID))
    }

    /** (c) Changed words over a first reply this device already approved: the first reply is taken. */
    @Test
    fun aChangedReplyOverAnApprovedFirstAttemptClosesAsTheFirstReply() = runTest(dispatcher) {
        host.loseApproves = 1
        val vm = signedOnce()

        vm.onStanceChange(0.4, -0.2)
        vm.retry()

        assertThat(content.calls).isEqualTo(1)
        assertThat(host.approved).hasSize(1)
        assertThat(vm.state.value.outcome).isEqualTo(ReplyOutcome.Signed(TEST_NODE_ID))
    }

    /** (d) A first reply collected unlanded falls back to a fresh prepare — asked first. */
    @Test
    fun anExpiredFirstAttemptFallsBackToAFreshPrepare() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = signedOnce()
        val first = host.submitted.single()
        host.hostSays(first, WriteState.EXPIRED)

        vm.retry()

        assertThat(host.read).contains(first)
        assertThat(content.calls).isEqualTo(2)
        assertThat(identity.handshakes.keys).doesNotContain(first)
        assertThat(vm.state.value.outcome).isEqualTo(ReplyOutcome.Signed(TEST_NODE_ID))
    }

    /** A Retry whose read does not answer decides nothing and signs nothing. */
    @Test
    fun aRetryWhoseReadDoesNotAnswerPreparesNothing() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = signedOnce()
        host.readsFail = true

        vm.retry()

        assertThat(content.calls).isEqualTo(1)
        assertThat(host.approved).isEmpty()
        assertThat(vm.state.value.transportFailed || vm.state.value.signingFailed).isTrue()
        assertThat(vm.state.value.outcome).isNull()
    }

    private fun switchTo(account: String) {
        session.tokens.value = AuthTokens("access-$account", "refresh-$account", account)
    }

    /**
     * (e) Another account active between the press and the Retry: nothing runs
     * under it, and the attempt is not erased — under its own account again,
     * the Retry asks it (auth.md "Multi-account device custody").
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
        assertThat(vm.state.value.outcome).isEqualTo(ReplyOutcome.Signed(TEST_NODE_ID))
    }
}
