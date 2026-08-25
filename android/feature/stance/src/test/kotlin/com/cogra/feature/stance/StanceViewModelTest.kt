package com.cogra.feature.stance

import com.cogra.crypto.ActorKey
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceProjection
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
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

private const val TARGET = "post-1"

@OptIn(ExperimentalCoroutinesApi::class)
class StanceViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val writes = SealingWriteRepository(actor)

    /** Records exactly what the control asked for; nothing is derived. */
    private val stances = object : ThrowingStanceRepository() {
        val staged = mutableListOf<StancePair>()
        val projected = mutableListOf<StancePair>()
        var net = StancePair.Origin
        var records = 0
        var prepareOutcome: Outcome<List<PreparedWriteView>>? = null
        var severanceOutcome: Outcome<List<PreparedWriteView>>? = null
        var landsOnSeverance = false
        var severanceCalls = 0

        override suspend fun prepareStance(
            target: String,
            pick: StancePair,
        ): Outcome<List<PreparedWriteView>> {
            staged += pick
            return prepareOutcome ?: writes.prepareStance(target, pick.pDirected, pick.pInterest)
        }

        var standingCalls = 0

        override suspend fun standing(target: String, includePending: Boolean): Outcome<StanceStanding> {
            standingCalls += 1
            return Outcome.Success(StanceStanding(target, net, records, includePending))
        }

        override suspend fun projection(
            target: String,
            pick: StancePair,
            includePending: Boolean,
        ): Outcome<StanceProjection> {
            projected += pick
            return Outcome.Success(
                StanceProjection(
                    pick = pick,
                    net = if (landsOnSeverance) StancePair.Origin else pick,
                    inertDirected = landsOnSeverance,
                    inertInterest = landsOnSeverance,
                    severance = landsOnSeverance,
                ),
            )
        }

        override suspend fun severanceQuote(target: String, includePending: Boolean): Outcome<SeveranceQuote> =
            Outcome.Success(SeveranceQuote(target, net, records, alreadySevered = net == StancePair.Origin))

        override suspend fun prepareSeverance(target: String): Outcome<List<PreparedWriteView>> {
            severanceCalls += 1
            return severanceOutcome ?: Outcome.Success(List(records) { writes.stage() })
        }
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel() = StanceViewModel(stances, WriteSigner(writes, identity), identity)

    private fun entry(vm: StanceViewModel) = vm.state.value.targets.getValue(TARGET)

    // -- Reading (design.md §8.1: everything about the bundle is read-side) --

    @Test
    fun observingATargetReadsTheStandingBehindIt() = runTest(dispatcher) {
        stances.net = StancePair(0.4, 0.2)
        stances.records = 3
        val vm = viewModel()

        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).standing).isEqualTo(StancePair(0.4, 0.2))
        assertThat(entry(vm).standingRecords).isEqualTo(3)
    }

    @Test
    fun aTargetIsOnlyObservedOnce() = runTest(dispatcher) {
        // A feed recomposes constantly; the standing behind a control is
        // read when it first appears and not once per frame.
        val vm = viewModel()

        vm.observe(TARGET)
        vm.observe(TARGET)
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(stances.standingCalls).isEqualTo(1)
    }

    // -- Writing: the raw-edge rule (design.md §8.1) --

    @Test
    fun aPlainTapStagesTheModestPositiveVerbatim() = runTest(dispatcher) {
        // Past the teaching tap: from here on, taps act (design.md §8.7).
        identity.stancePadTaught = true
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(stances.staged).containsExactly(StancePair(0.1, 0.1))
    }

    @Test
    fun aCommitStagesThePickedPairEvenWhenTheBundleAlreadyHoldsSomething() = runTest(dispatcher) {
        // The whole point of the raw edge: a standing of (+0.8, +0.8)
        // does NOT turn a pick of (-0.3, +0.2) into a delta. The record
        // carries what was picked.
        stances.net = StancePair(0.8, 0.8)
        stances.records = 2
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenPad(TARGET)
        vm.onPick(TARGET, StancePair(-0.3, 0.2))
        dispatcher.scheduler.advanceUntilIdle()
        vm.onCommit(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(stances.staged).containsExactly(StancePair(-0.3, 0.2))
    }

    @Test
    fun aCommittedPickClosesThePadAndRereadsTheStanding() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onOpenPad(TARGET)
        vm.onPick(TARGET, StancePair(0.5, 0.5))
        dispatcher.scheduler.advanceUntilIdle()

        stances.net = StancePair(0.5, 0.5)
        stances.records = 1
        vm.onCommit(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).pad).isEqualTo(PadMode.CLOSED)
        assertThat(entry(vm).pick).isEqualTo(StancePair.Origin)
        assertThat(entry(vm).standing).isEqualTo(StancePair(0.5, 0.5))
        assertThat(entry(vm).failed).isFalse()
    }

    @Test
    fun aRefusedPrepareIsReportedWithoutOpeningAPad() = runTest(dispatcher) {
        stances.prepareOutcome = Outcome.Refused(listOf(UserError(ErrorCode.FORBIDDEN, "no")))
        identity.stancePadTaught = true
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).failed).isTrue()
        assertThat(entry(vm).needsKey).isFalse()
        assertThat(entry(vm).pad).isEqualTo(PadMode.CLOSED)
    }

    @Test
    fun aHuskDeviceIsReportedAsNeedingItsKeyBack() = runTest(dispatcher) {
        identity.seed = null
        identity.stancePadTaught = true
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).failed).isTrue()
        assertThat(entry(vm).needsKey).isTrue()
    }

    // -- The pad's own states (design.md §8.3) --

    @Test
    fun thePadOpensAtTheOriginNotAtTheTapDefault() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenPad(TARGET)

        assertThat(entry(vm).pick).isEqualTo(StancePair.Origin)
        assertThat(entry(vm).pad).isEqualTo(PadMode.DRAGGING)
    }

    @Test
    fun onlyTheNewestPickIsAskedAbout() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onOpenPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        stances.projected.clear()

        // A drifting thumb: only where it settles costs a read.
        vm.onPick(TARGET, StancePair(0.1, 0.1))
        vm.onPick(TARGET, StancePair(0.2, 0.2))
        vm.onPick(TARGET, StancePair(0.3, 0.3))
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(stances.projected).containsExactly(StancePair(0.3, 0.3))
        assertThat(entry(vm).landing?.net).isEqualTo(StancePair(0.3, 0.3))
    }

    @Test
    fun aHoldThatNeverDriftedParksThePad() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        vm.onOpenPad(TARGET)

        vm.onHold(TARGET)

        assertThat(entry(vm).pad).isEqualTo(PadMode.STICKY)
    }

    @Test
    fun dismissingThePadForgetsThePickAndTheAlternates() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        vm.onOpenPad(TARGET)
        vm.onPick(TARGET, StancePair(0.9, 0.9))
        vm.onToggleExactValues(TARGET)

        vm.onDismissPad(TARGET)

        assertThat(entry(vm).pad).isEqualTo(PadMode.CLOSED)
        assertThat(entry(vm).pick).isEqualTo(StancePair.Origin)
        assertThat(entry(vm).exactValues).isFalse()
    }

    // -- Severance (design.md §8.2, §8.5) --

    @Test
    fun aPickThatLandsOnZeroAsksInsteadOfCommitting() = runTest(dispatcher) {
        stances.landsOnSeverance = true
        stances.records = 2
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onOpenPad(TARGET)
        vm.onPick(TARGET, StancePair(-0.8, -0.8))
        dispatcher.scheduler.advanceUntilIdle()

        vm.onCommit(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(stances.staged).isEmpty()
        val open = entry(vm).severance
        assertThat(open).isNotNull()
        assertThat(open?.fromPick).isTrue()
        assertThat(open?.quote?.records).isEqualTo(2)
    }

    @Test
    fun theRouteOpensTheSameConfirmationWithoutAPick() = runTest(dispatcher) {
        stances.net = StancePair(0.5, 0.5)
        stances.records = 4
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenSeverance(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        val open = entry(vm).severance
        assertThat(open?.fromPick).isFalse()
        assertThat(open?.quote?.standing).isEqualTo(StancePair(0.5, 0.5))
        assertThat(open?.quote?.alreadySevered).isFalse()
    }

    @Test
    fun confirmingSeveranceSignsTheWholeBatch() = runTest(dispatcher) {
        stances.net = StancePair(0.5, 0.5)
        stances.records = 3
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onOpenSeverance(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        stances.net = StancePair.Origin
        vm.onConfirmSeverance(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(stances.severanceCalls).isEqualTo(1)
        // Three counter-records, three signed acts.
        assertThat(writes.staged).hasSize(3)
        assertThat(entry(vm).severance).isNull()
        assertThat(entry(vm).standing).isEqualTo(StancePair.Origin)
    }

    @Test
    fun aRefusedSeveranceKeepsTheConfirmationOpenAndSaysSo() = runTest(dispatcher) {
        stances.net = StancePair(0.5, 0.5)
        stances.records = 2
        stances.severanceOutcome = Outcome.Refused(listOf(UserError(ErrorCode.INTERNAL, "not yet")))
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onOpenSeverance(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onConfirmSeverance(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        val open = entry(vm).severance
        assertThat(open?.failed).isTrue()
        assertThat(open?.working).isFalse()
    }

    @Test
    fun dismissingTheConfirmationLeavesTheBundleAlone() = runTest(dispatcher) {
        stances.net = StancePair(0.5, 0.5)
        stances.records = 2
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onOpenSeverance(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onDismissSeverance(TARGET)

        assertThat(entry(vm).severance).isNull()
        assertThat(stances.severanceCalls).isEqualTo(0)
    }

    // -- Teaching the held gesture (design.md §8.7) --

    @Test
    fun noControlCarriesTheMarkUntilOneIsTapped() = runTest(dispatcher) {
        // The mark belongs to the tap that opened it, not to whichever
        // card happened to render first.
        val vm = viewModel()

        vm.observe(TARGET)
        vm.observe("post-2")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.coachTarget).isNull()
    }

    @Test
    fun theFirstTapEverTeachesAndStagesNothing() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.coachTarget).isEqualTo(TARGET)
        assertThat(stances.staged).isEmpty()
        // Spent at once, so a restart cannot swallow a second tap.
        assertThat(identity.stancePadTaught).isTrue()
    }

    @Test
    fun theTapAfterTheTeachingOneActs() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(stances.staged).containsExactly(StancePair.TapDefault)
    }

    @Test
    fun aTapBeforeTheStoreHasAnsweredStillTeachesRatherThanStaging() = runTest(dispatcher) {
        // The very first tap on a freshly opened screen: the flag read is
        // still in flight, and the tap waits for it.
        val vm = viewModel()

        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.coachTarget).isEqualTo(TARGET)
        assertThat(stances.staged).isEmpty()
    }

    @Test
    fun aTapOnADeviceAlreadyTaughtActsAtOnce() = runTest(dispatcher) {
        identity.stancePadTaught = true
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.coachTarget).isNull()
        assertThat(stances.staged).containsExactly(StancePair.TapDefault)
    }

    @Test
    fun theMarkStaysUntilItIsDismissed() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        // Reading, picking, scrolling: none of it closes the lesson.
        vm.onPick(TARGET, StancePair(0.4, 0.2))
        vm.observe("post-2")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.coachTarget).isEqualTo(TARGET)

        vm.onCoachMarkDismissed()
        assertThat(vm.state.value.coachTarget).isNull()
    }

    @Test
    fun aSuccessfulHoldClosesTheMark() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenPad(TARGET)

        assertThat(vm.state.value.coachTarget).isNull()
    }
}
