package com.cogra.feature.stance

import com.cogra.crypto.ActorKey
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ReaderStanding
import com.cogra.domain.WriteState
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.severance
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StanceAttempts
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.testing.AnswerLosingWriteRepository
import com.cogra.domain.testing.FakeBorrowedStanceRepository
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.InMemoryKeptPickStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingStanceRepository
import com.cogra.domain.testing.signedInSession
import com.cogra.domain.testing.testGraphId
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

private val TARGET = StanceTarget.Node("post-1")

/**
 * A stance's Retry asks THE SAME signing again (PadFailed.md:51, RowSigning.md:23
 * "the same pick is signed again"; SigningAfterClose.md:27 "the same signing is
 * asked again … AND NEVER anything else is signed"; SeveranceConfirm.md:33-35).
 * A stance is a sum of records and every prepare stages a record of its own, so a
 * Retry that prepares afresh beside a first attempt whose answer was lost sums the
 * pick twice. web's twins: `stance-attempts.ts`, `apollo-stance-data.ts` (#676,
 * #681, #700, #702).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class StanceRetrySameSigningTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)
    private val host = AnswerLosingWriteRepository(sealer)
    private val session = signedInSession()

    /** Every attempt the device keeps, shared by every holder as the app's singleton is. */
    private val attempts = StanceAttempts()

    /** A faithful stance repository that counts its prepares: every call stages NEW records. */
    private val stances = object : ThrowingStanceRepository() {
        val staged = mutableListOf<StancePair>()
        var severanceCalls = 0
        var net = StancePair.Origin
        var records = 0

        /** For each prepare, the handshakes this device still held when it ran. */
        val heldAtPrepare = mutableListOf<Set<String>>()

        /** Holds the next prepare open until completed, then lets every later one through. */
        var gate: CompletableDeferred<Unit>? = null

        override suspend fun prepareStance(target: StanceTarget, pick: StancePair): Outcome<List<PreparedWriteView>> {
            gate?.let {
                gate = null
                it.await()
            }
            staged += pick
            heldAtPrepare += identity.handshakes.keys.toSet()
            return sealer.prepareStance((target as StanceTarget.Node).id, pick.pDirected, pick.pInterest)
        }

        override suspend fun standing(target: StanceTarget, includePending: Boolean): Outcome<StanceStanding> =
            Outcome.Success(StanceStanding(target, net, net, records, includePending, false))

        override suspend fun severanceQuote(target: StanceTarget, includePending: Boolean): Outcome<SeveranceQuote> =
            Outcome.Success(
                SeveranceQuote(
                    target = target,
                    standing = net,
                    raw = net,
                    records = records,
                    alreadySevered = records == 0,
                    bundleRecords = records,
                ),
            )

        override suspend fun prepareSeverance(target: StanceTarget): Outcome<List<PreparedWriteView>> {
            severanceCalls += 1
            heldAtPrepare += identity.handshakes.keys.toSet()
            val node = testGraphId((target as StanceTarget.Node).id)
            val walkBack = severance(node, net.pDirected, net.pInterest, records)
            return Outcome.Success(sealer.stageFaithful(Expectation(emptyList(), listOf(walkBack))))
        }
    }

    private val account = object : ThrowingAccountRepository() {
        override suspend fun borrowedView() = Outcome.Success(null)
    }

    private fun viewModel() = StanceViewModel(
        stances = stances,
        signer = WriteSigner(host, identity),
        identity = identity,
        signals = StanceSignals(),
        account = account,
        keptPicks = InMemoryKeptPickStore(),
        standing = ReaderStanding(),
        borrowed = FakeBorrowedStanceRepository(),
        tokens = session,
        stagedWrites = host,
        attempts = attempts,
    )

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun settle() = dispatcher.scheduler.advanceUntilIdle()

    private fun StanceViewModel.entry() = state.value.targets.getValue(TARGET)

    /** A control read and its pad opened at [pick]. */
    private fun opened(pick: StancePair = PICK): StanceViewModel = viewModel().apply {
        observe(TARGET)
        settle()
        onOpenPad(TARGET)
        settle()
        onPick(TARGET, pick)
    }

    /** Set pressed on the pad: the first signing. */
    private fun StanceViewModel.set() {
        onCommit(TARGET)
        settle()
    }

    private fun switchTo(account: String) {
        session.tokens.value = AuthTokens("access-$account", "refresh-$account", account)
    }

    // (a) The pad's Retry after a lost answer asks the same signing: no second record.

    @Test
    fun aLostSubmitAnswerThenThePadsRetryAsksTheSameRecordAndPreparesNothing() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = opened()
        vm.set()
        assertThat(vm.entry().failed).isTrue()

        // PadFailed.md:3 — Retry takes Set's slot; pressing it is the same Set.
        vm.set()

        assertThat(stances.staged).containsExactly(PICK)
        assertThat(host.read).containsExactly("w1")
        assertThat(host.approved).containsExactly("w1")
        assertThat(vm.entry().failed).isFalse()
        assertThat(vm.entry().confirmation).isNotNull()
    }

    @Test
    fun aLostApprovalAnswerThenTheRowsRetryFindsItTakenAndSignsNothingTwice() = runTest(dispatcher) {
        host.loseApproves = 1
        val vm = viewModel().apply {
            observe(TARGET)
            settle()
        }
        // RowSigning.md:15 — the hold's signing did not go through.
        vm.onHoldDefault(TARGET)
        settle()
        assertThat(vm.entry().failed).isTrue()

        // RowSigning.md:23 — the same hold is signed again.
        vm.onRetrySigning(TARGET)
        settle()

        assertThat(stances.staged).containsExactly(StancePair.TapDefault)
        assertThat(host.approved).containsExactly("w1")
        assertThat(vm.entry().failed).isFalse()
        assertThat(vm.entry().confirmation).isNotNull()
    }

    // (b) A changed pick over a first attempt already approved closes as taken.

    @Test
    fun aChangedPickOverAnApprovedFirstAttemptClosesAsTakenAndSignsNothingNew() = runTest(dispatcher) {
        host.loseApproves = 1
        val vm = opened()
        vm.set()
        assertThat(vm.entry().failed).isTrue()

        // PadFailed.md:15 — the pick moves while the fault stands.
        vm.onPick(TARGET, OTHER)
        vm.set()

        assertThat(stances.staged).containsExactly(PICK)
        assertThat(host.approved).containsExactly("w1")
        assertThat(vm.entry().pad).isEqualTo(PadMode.CLOSED)
        assertThat(vm.entry().failed).isFalse()
    }

    // (c) A changed pick over an unapproved first attempt retires it before preparing.

    @Test
    fun aChangedPickRetiresTheFirstAttemptBeforeTheNewOneIsPrepared() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = opened()
        vm.set()
        assertThat(identity.handshakes.keys).contains("w1")

        vm.onPick(TARGET, OTHER)
        vm.set()

        assertThat(stances.staged).containsExactly(PICK, OTHER).inOrder()
        // The first attempt's material was gone when the second was prepared.
        assertThat(stances.heldAtPrepare[1]).doesNotContain("w1")
        assertThat(host.approved).doesNotContain("w1")
        assertThat(vm.entry().confirmation).isNotNull()
    }

    // (d) An expired first attempt is asked, then a fresh one is prepared.

    @Test
    fun anExpiredFirstAttemptIsAskedFirstAndThenPreparedAfresh() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = opened()
        vm.set()
        host.hostSays("w1", WriteState.EXPIRED)

        vm.set()

        assertThat(host.read).contains("w1")
        assertThat(stances.staged).containsExactly(PICK, PICK)
        assertThat(vm.entry().confirmation).isNotNull()
    }

    // (e) A Retry under another account runs nothing; under its own it asks again.

    @Test
    fun aRetryUnderAnotherAccountRunsNothingAndTheAttemptStandsAgainUnderItsOwn() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = opened()
        vm.set()
        assertThat(vm.entry().failed).isTrue()

        // The fault's Retry is acct-a's: under acct-b it reads, retires,
        // prepares and signs nothing, and the fault stands as it was.
        switchTo("acct-b")
        vm.set()
        assertThat(host.read).isEmpty()
        assertThat(identity.handshakes.keys).contains("w1")
        assertThat(stances.staged).containsExactly(PICK)
        assertThat(vm.entry().failed).isTrue()
        assertThat(vm.entry().busy).isFalse()

        // Back under acct-a, the Retry asks acct-a's first attempt again.
        switchTo("acct-a")
        vm.set()

        assertThat(stances.staged).containsExactly(PICK)
        assertThat(host.read).containsExactly("w1")
        assertThat(host.approved).containsExactly("w1")
        assertThat(vm.entry().confirmation).isNotNull()
    }

    @Test
    fun anotherAccountsOwnGestureNeverAsksOrRetiresTheAttempt() = runTest(dispatcher) {
        host.loseSubmits = 1
        val first = opened()
        first.set()

        // acct-b's own pick on a fresh control is acct-b's act: it reads and
        // retires nothing of acct-a's attempt.
        switchTo("acct-b")
        val other = opened()
        other.set()
        assertThat(host.read).isEmpty()
        assertThat(identity.handshakes.keys).contains("w1")
        assertThat(stances.staged).containsExactly(PICK, PICK)

        switchTo("acct-a")
        first.set()
        assertThat(stances.staged).containsExactly(PICK, PICK)
        assertThat(host.read).containsExactly("w1")
    }

    @Test
    fun aPressWhoseAccountChangesBeforeItsSigningSignsNothingUnderTheOther() = runTest(dispatcher) {
        val gate = CompletableDeferred<Unit>()
        stances.gate = gate
        val vm = opened()
        // The press is taken as acct-a; the account changes while it prepares.
        vm.onCommit(TARGET)
        settle()
        switchTo("acct-b")
        gate.complete(Unit)
        settle()

        assertThat(host.submitted).isEmpty()
        assertThat(vm.entry().confirmation).isNull()
        assertThat(vm.entry().busy).isFalse()
    }

    // (f) A pick's attempt and a walk-back's attempt never ask each other.

    @Test
    fun aWalkBackNeverAsksAPicksAttemptAndAPickNeverAsksAWalkBacks() = runTest(dispatcher) {
        stances.net = StancePair(0.4, 0.2)
        stances.records = 2
        // The pick's signing loses its answer.
        host.loseSubmits = 1
        val vm = opened()
        vm.set()
        assertThat(vm.entry().failed).isTrue()

        // The walk-back is its own gesture: it prepares its own batch and reads
        // nothing of the pick's.
        host.loseSubmits = 1
        vm.onOpenSeverance(TARGET)
        settle()
        vm.onConfirmSeverance(TARGET)
        settle()
        assertThat(stances.severanceCalls).isEqualTo(1)
        assertThat(host.read).isEmpty()
        assertThat(vm.entry().severance?.failed).isTrue()

        // SeveranceConfirm.md:33 — Walk it back reads Retry: the same batch.
        val walkBackIds = listOf("w2", "w3")
        vm.onConfirmSeverance(TARGET)
        settle()
        assertThat(stances.severanceCalls).isEqualTo(1)
        assertThat(host.read).containsExactlyElementsIn(walkBackIds)
        assertThat(vm.entry().walkedBack).isEqualTo(2)

        // The pick's Retry asks the pick's own record, never the walk-back's.
        vm.onRetrySigning(TARGET)
        settle()
        assertThat(stances.staged).containsExactly(PICK)
        assertThat(host.read).containsExactlyElementsIn(walkBackIds + "w1")
    }

    @Test
    fun theWalkBacksRetryAfterALostAnswerPreparesNoSecondBatch() = runTest(dispatcher) {
        stances.net = StancePair(0.4, 0.2)
        stances.records = 2
        host.loseApproves = 1
        val vm = viewModel().apply {
            observe(TARGET)
            settle()
        }
        vm.onOpenSeverance(TARGET)
        settle()
        vm.onConfirmSeverance(TARGET)
        settle()
        assertThat(vm.entry().severance?.failed).isTrue()

        vm.onConfirmSeverance(TARGET)
        settle()

        assertThat(stances.severanceCalls).isEqualTo(1)
        assertThat(host.approved).containsExactly("w1", "w2")
        assertThat(vm.entry().walkedBack).isEqualTo(2)
    }

    // The empty sign's Retry is a pick's (EmptySignConfirm.md:35).

    @Test
    fun theEmptySignsRetryAsksTheSameRecord() = runTest(dispatcher) {
        host.loseSubmits = 1
        val vm = opened(StancePair.Origin)
        vm.set()
        assertThat(vm.entry().emptySign).isNotNull()
        vm.onConfirmEmptySign(TARGET)
        settle()
        assertThat(vm.entry().emptySign?.failed).isTrue()

        vm.onConfirmEmptySign(TARGET)
        settle()

        assertThat(stances.staged).containsExactly(StancePair.Origin)
        assertThat(vm.entry().emptySign).isNull()
    }

    // An attempt in flight is not a failed attempt: another holder's commit is its own act.

    @Test
    fun aCommitWhileTheTargetsFirstIsStillSigningIsAnActOfItsOwn() = runTest(dispatcher) {
        val first = opened()
        val second = opened()
        val gate = CompletableDeferred<Unit>()
        stances.gate = gate
        // The first holds the target's slot while its prepare is open.
        first.onCommit(TARGET)
        settle()
        second.onCommit(TARGET)
        settle()
        gate.complete(Unit)
        settle()

        assertThat(stances.staged).containsExactly(PICK, PICK)
        assertThat(first.entry().confirmation).isNotNull()
        assertThat(second.entry().confirmation).isNotNull()
    }

    private companion object {
        val PICK = StancePair(0.3, 0.2)
        val OTHER = StancePair(0.6, -0.1)
    }
}
