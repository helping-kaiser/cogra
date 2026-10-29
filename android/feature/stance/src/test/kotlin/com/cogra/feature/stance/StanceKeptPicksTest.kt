// The stance control's kept picks, compiled from their sidecars:
// PadKeyAbsent.md (the keep and its exits), PadPending.md (the anchor while
// the key is away), PadPendingReview.md (the anchor once it is back) and
// VouchBack.md:40 / VouchBackPad.md:49 (a kept vouch-back's own pad).

package com.cogra.feature.stance

import com.cogra.crypto.ActorKey
import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.KeptFamily
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.InMemoryKeptPickStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingStanceRepository
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

private val POST = StanceTarget.Node("post-1")
private val VOUCHER = StanceTarget.Node("user-ada")

@OptIn(ExperimentalCoroutinesApi::class)
class StanceKeptPicksTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val writes = SealingWriteRepository(actor)
    private val signals = StanceSignals()
    private val kept = InMemoryKeptPickStore()

    private val stances = object : ThrowingStanceRepository() {
        val staged = mutableListOf<StancePair>()
        val reads = mutableListOf<Boolean>()

        /** What an ordered read counts; the pending-inclusive read counts [records]. */
        var orderedRecords: Int? = null
        var records = 1

        override suspend fun prepareStance(target: StanceTarget, pick: StancePair): Outcome<List<PreparedWriteView>> {
            staged += pick
            return writes.prepareStance((target as StanceTarget.Node).id, pick.pDirected, pick.pInterest)
        }

        override suspend fun standing(target: StanceTarget, includePending: Boolean): Outcome<StanceStanding> {
            reads += includePending
            val count = if (includePending) records else orderedRecords ?: records
            val net = StancePair(0.2, 0.1)
            return Outcome.Success(StanceStanding(target, net, net, count, includePending, severed = false))
        }

        override suspend fun kindOf(target: StanceTarget): StanceKind = StanceKind.POST
    }

    private val account = object : ThrowingAccountRepository() {
        override suspend fun borrowedView(): Outcome<ActorRef?> = Outcome.Success(null)
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel() = StanceViewModel(stances, WriteSigner(writes, identity), identity, signals, account, kept)

    private fun idle() = dispatcher.scheduler.advanceUntilIdle()

    private fun StanceViewModel.entry(target: StanceTarget = POST) = state.value.targets.getValue(target)

    @Test
    fun padKeyAbsent27_keepItPendingStoresThePickAndClosesThePadSigningNothing() = runTest(dispatcher) {
        identity.seed = null
        val vm = viewModel()
        vm.observe(POST)
        idle()
        vm.onOpenPad(POST)
        idle()
        vm.onPick(POST, StancePair(0.55, 0.2))

        vm.onKeepPending(POST)
        idle()

        val pick = kept.picks.value.single()
        assertThat(pick.target).isEqualTo(POST)
        assertThat(pick.pick).isEqualTo(StancePair(0.55, 0.2))
        assertThat(pick.family).isEqualTo(KeptFamily.OPINION)
        assertThat(pick.kind).isEqualTo(StanceKind.POST)
        assertThat(vm.entry().pad).isEqualTo(PadMode.CLOSED)
        assertThat(stances.staged).isEmpty()
    }

    @Test
    fun padKeyAbsent31_leavingThePadAnyOtherWayKeepsNothing() = runTest(dispatcher) {
        identity.seed = null
        val vm = viewModel()
        vm.observe(POST)
        idle()
        vm.onOpenPad(POST)
        vm.onPick(POST, StancePair(0.55, 0.2))

        vm.onDismissPad(POST)
        idle()

        assertThat(kept.picks.value).isEmpty()
    }

    @Test
    fun padKeyAbsent35_aKeptPicksFaceOpensThePadAgainHoldingIt() = runTest(dispatcher) {
        identity.seed = null
        kept.keep(POST, StancePair(-0.15, 0.15), KeptFamily.OPINION, StanceKind.POST)
        val vm = viewModel()
        vm.observe(POST)
        idle()

        vm.onOpenPad(POST)
        idle()

        assertThat(vm.entry().pad).isEqualTo(PadMode.STICKY)
        assertThat(vm.entry().pick).isEqualTo(StancePair(-0.15, 0.15))
        assertThat(vm.state.value.reviewFrom).isNull()
    }

    @Test
    fun padPending13_aHoldOnAKeptFaceWithTheKeyAwayOpensThePadAndSignsNothing() = runTest(dispatcher) {
        identity.seed = null
        kept.keep(POST, StancePair(0.3, 0.3), KeptFamily.OPINION, StanceKind.POST)
        val vm = viewModel()
        vm.observe(POST)
        idle()

        vm.onHoldDefault(POST)
        idle()

        assertThat(vm.entry().pad).isEqualTo(PadMode.STICKY)
        assertThat(stances.staged).isEmpty()
    }

    @Test
    fun padPendingReview11_withTheKeyHereTheTapAndTheHoldOpenTheReviewNeverAPad() = runTest(dispatcher) {
        kept.keep(POST, StancePair(0.3, 0.3), KeptFamily.OPINION, StanceKind.POST)
        val vm = viewModel()
        vm.observe(POST)
        idle()

        vm.onOpenPad(POST)
        assertThat(vm.state.value.reviewFrom).isEqualTo(POST)
        vm.onReviewOpened()
        vm.onHoldDefault(POST)
        idle()

        assertThat(vm.state.value.reviewFrom).isEqualTo(POST)
        assertThat(vm.entry().pad).isEqualTo(PadMode.CLOSED)
        assertThat(stances.staged).isEmpty()
    }

    @Test
    fun padPending15_aRestoreReachesTheAnchorOnTheWayBack() = runTest(dispatcher) {
        identity.seed = null
        val vm = viewModel()
        vm.observe(POST)
        idle()
        assertThat(vm.state.value.keyAbsent).isTrue()

        identity.seed = actor.seed()
        vm.onResume()
        idle()

        assertThat(vm.state.value.keyAbsent).isFalse()
    }

    @Test
    fun vouchBack40_aKeptVouchBackOpensItsPadHoldingThePickAndSignsThroughIt() = runTest(dispatcher) {
        kept.keep(VOUCHER, StancePair(0.4, 0.3), KeptFamily.VOUCH_BACK, StanceKind.PERSON)
        val vm = viewModel()
        vm.setFamily(VOUCHER, KeptFamily.VOUCH_BACK)
        vm.observe(VOUCHER)
        idle()

        vm.onOpenPad(VOUCHER)
        idle()
        assertThat(vm.entry(VOUCHER).pick).isEqualTo(StancePair(0.4, 0.3))
        assertThat(vm.state.value.reviewFrom).isNull()

        vm.onCommit(VOUCHER)
        idle()

        // Signed through its own pad, its ceremony kept: kept no longer.
        assertThat(stances.staged).containsExactly(StancePair(0.4, 0.3))
        assertThat(vm.entry(VOUCHER).taken).isTrue()
        assertThat(kept.picks.value).isEmpty()
    }

    @Test
    fun padPendingReview21_aSealedTargetSettlesUntilAnOrderedReadCountsItsRecord() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(POST)
        idle()
        stances.records = 2
        stances.orderedRecords = 1

        signals.markSettling(listOf(POST))
        idle()

        // Re-read counting the signed record, then one ordered read: not yet.
        assertThat(vm.entry().standingRecords).isEqualTo(2)
        assertThat(stances.reads.takeLast(2)).containsExactly(true, false).inOrder()
        assertThat(vm.state.value.settling).contains(POST)

        stances.orderedRecords = 2
        val again = viewModel()
        again.observe(POST)
        idle()
        assertThat(signals.settling.value).doesNotContain(POST)
    }
}
