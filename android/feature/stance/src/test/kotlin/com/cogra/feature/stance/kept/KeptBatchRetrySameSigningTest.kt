package com.cogra.feature.stance.kept

import com.cogra.crypto.ActorKey
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.WriteState
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.KeptFamily
import com.cogra.domain.stance.StanceAttempts
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.testing.AnswerLosingWriteRepository
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.InMemoryKeptPickStore
import com.cogra.domain.testing.ScriptedKeptPreviewRepository
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingStanceRepository
import com.cogra.domain.testing.signedInSession
import com.google.common.truth.Truth.assertThat
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

private val POST = StanceTarget.Node("post-1")
private val PERSON = StanceTarget.Node("user-mira")
private val TOPIC = StanceTarget.Topic("saltmaps")

/**
 * The kept picks' seal: its Retry asks THE SAME batch again (KeptPicksSeal.md:33
 * "the fault line and Retry take the commit's place", :63 "the whole batch is
 * asked to sign again"; SigningAfterClose.md:27 "AND NEVER anything else is
 * signed"). Each pick is a record of its own in a bundle that sums, so a batch
 * prepared afresh beside one the server took sums every pick twice. web's twin:
 * `commitBatch` in `apollo-stance-data.ts` (#693, #700).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class KeptBatchRetrySameSigningTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)
    private val host = AnswerLosingWriteRepository(sealer)
    private val session = signedInSession()
    private val kept = InMemoryKeptPickStore()

    /** A faithful prepare that counts itself: every call stages a NEW record. */
    private val stances = object : ThrowingStanceRepository() {
        val staged = mutableListOf<StanceTarget>()

        /** For each prepare, the handshakes this device still held when it ran. */
        val heldAtPrepare = mutableListOf<Set<String>>()

        /** Holds the next prepare open until completed. */
        var gate: CompletableDeferred<Unit>? = null

        override suspend fun prepareStance(target: StanceTarget, pick: StancePair): Outcome<List<PreparedWriteView>> {
            gate?.let {
                gate = null
                it.await()
            }
            staged += target
            heldAtPrepare += identity.handshakes.keys.toSet()
            return when (target) {
                is StanceTarget.Node -> sealer.prepareStance(target.id, pick.pDirected, pick.pInterest)
                is StanceTarget.Topic -> sealer.prepareTopicStance(target.name, pick.pDirected, pick.pInterest)
            }
        }

        override suspend fun standing(target: StanceTarget, includePending: Boolean): Outcome<StanceStanding> =
            Outcome.Success(StanceStanding(target, StancePair.Origin, StancePair.Origin, 0, includePending, false))
    }

    private fun viewModel() = KeptPicksViewModel(
        kept = kept,
        previews = ScriptedKeptPreviewRepository(),
        stances = stances,
        signer = WriteSigner(host, identity),
        identity = identity,
        signals = StanceSignals(),
        tokens = session,
        stagedWrites = host,
        attempts = StanceAttempts(),
    )

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun settle() = dispatcher.scheduler.advanceUntilIdle()

    /** Three picks kept, the review read and the seal opened. */
    private suspend fun sealed(): KeptPicksViewModel {
        kept.keep(POST, StancePair(0.1, 0.1), KeptFamily.OPINION, StanceKind.POST)
        kept.keep(PERSON, StancePair(0.55, 0.2), KeptFamily.OPINION, StanceKind.PERSON)
        kept.keep(TOPIC, StancePair(0.6, 0.35), KeptFamily.OPINION, StanceKind.TOPIC)
        return viewModel().apply {
            settle()
            onSignThem()
        }
    }

    /** `Sign the picks`, or the Retry in its place. */
    private fun KeptPicksViewModel.sign() {
        onSign()
        settle()
    }

    private fun switchTo(account: String) {
        session.tokens.value = AuthTokens("access-$account", "refresh-$account", account)
    }

    /** The batch's first signing: the three records staged once, as w1, w2, w3. */
    private val firstBatch = listOf("w1", "w2", "w3")

    // (a) A lost answer and Retry: the same batch, nothing prepared again.

    @Test
    fun aLostSubmitAnswerThenRetryAsksTheSameBatchAndPreparesNothing() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = sealed()
        vm.sign()
        assertThat(vm.state.value.fault).isEqualTo(KeptSealFault.OFFLINE)

        vm.sign()

        assertThat(stances.staged).containsExactly(POST, PERSON, TOPIC).inOrder()
        assertThat(host.read).containsExactlyElementsIn(firstBatch)
        assertThat(vm.state.value.exit).isEqualTo(KeptExit.Left(KeptSnack.Signed(3)))
    }

    @Test
    fun aLostApprovalAnswerThenRetryFindsItTakenAndApprovesNothingTwice() = runTest(dispatcher) {
        host.loseApproves = 1
        val vm = sealed()
        vm.sign()
        assertThat(vm.state.value.fault).isEqualTo(KeptSealFault.OFFLINE)

        vm.sign()

        assertThat(stances.staged).hasSize(3)
        assertThat(host.approved).containsExactlyElementsIn(firstBatch)
        assertThat(vm.state.value.exit).isEqualTo(KeptExit.Left(KeptSnack.Signed(3)))
    }

    // (b) A changed batch over a first attempt already approved closes as taken.

    @Test
    fun aChangedBatchOverAnApprovedFirstAttemptClosesAsTakenAndSignsNothingNew() = runTest(dispatcher) {
        host.loseApproves = 1
        val vm = sealed()
        vm.sign()

        // KeptPicksSeal.md:31 — back to the review, where a × drops a pick.
        vm.onBackToReview()
        vm.onRemove(2)
        settle()
        vm.onSignThem()
        vm.sign()

        assertThat(stances.staged).hasSize(3)
        assertThat(host.approved).containsExactlyElementsIn(firstBatch)
        assertThat(vm.state.value.exit).isInstanceOf(KeptExit.Left::class.java)
    }

    // (c) A changed batch over an unapproved first attempt retires it before preparing.

    @Test
    fun aChangedBatchRetiresTheFirstAttemptBeforeTheNewOneIsPrepared() = runTest(dispatcher) {
        host.loseSubmits = 3
        val vm = sealed()
        vm.sign()
        assertThat(identity.handshakes.keys).containsAtLeastElementsIn(firstBatch)

        vm.onBackToReview()
        vm.onRemove(2)
        settle()
        vm.onSignThem()
        vm.sign()

        assertThat(stances.staged).containsExactly(POST, PERSON, TOPIC, POST, PERSON).inOrder()
        assertThat(stances.heldAtPrepare[3]).containsNoneIn(firstBatch)
        assertThat(host.approved).containsNoneIn(firstBatch)
        assertThat(vm.state.value.exit).isEqualTo(KeptExit.Left(KeptSnack.Signed(2)))
    }

    // (d) An expired first batch is asked, then a fresh one is prepared.

    @Test
    fun anExpiredFirstBatchIsAskedFirstAndThenPreparedAfresh() = runTest(dispatcher) {
        host.loseSubmits = 3
        val vm = sealed()
        vm.sign()
        firstBatch.forEach { host.hostSays(it, WriteState.EXPIRED) }

        vm.sign()

        assertThat(host.read).containsAtLeastElementsIn(firstBatch)
        assertThat(stances.staged).hasSize(6)
        assertThat(vm.state.value.exit).isEqualTo(KeptExit.Left(KeptSnack.Signed(3)))
    }

    // (e) Another account never asks the batch; its own asks it again once back.

    @Test
    fun aRetryUnderAnotherAccountRunsNothingAndTheBatchStandsAgainUnderItsOwn() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = sealed()
        vm.sign()

        switchTo("acct-b")
        vm.sign()
        assertThat(stances.staged).hasSize(3)
        assertThat(host.read).isEmpty()
        assertThat(identity.handshakes.keys).contains("w1")
        assertThat(vm.state.value.signing).isFalse()
        assertThat(vm.state.value.exit).isNull()

        switchTo("acct-a")
        vm.sign()

        assertThat(stances.staged).hasSize(3)
        assertThat(host.read).containsExactlyElementsIn(firstBatch)
        assertThat(vm.state.value.exit).isEqualTo(KeptExit.Left(KeptSnack.Signed(3)))
    }

    @Test
    fun aPressWhoseAccountChangesWhileTheBatchPreparesSignsNothing() = runTest(dispatcher) {
        val vm = sealed()
        val gate = CompletableDeferred<Unit>()
        stances.gate = gate
        vm.onSign()
        settle()
        switchTo("acct-b")
        gate.complete(Unit)
        settle()

        assertThat(stances.staged).containsExactly(POST)
        assertThat(host.submitted).isEmpty()
        assertThat(vm.state.value.signing).isFalse()
        assertThat(vm.state.value.exit).isNull()
    }
}
