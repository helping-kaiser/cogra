package com.cogra.feature.stance

import com.cogra.crypto.ActorKey
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceProjection
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingStanceRepository
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

        /** Holds the write open, so the pending answer is observable. */
        var gate: CompletableDeferred<Unit>? = null

        override suspend fun prepareStance(
            target: String,
            pick: StancePair,
        ): Outcome<List<PreparedWriteView>> {
            gate?.await()
            staged += pick
            return prepareOutcome ?: writes.prepareStance(target, pick.pDirected, pick.pInterest)
        }

        var standingCalls = 0
        var standingFails = false
        val standingPending = mutableListOf<Boolean>()

        override suspend fun standing(target: String, includePending: Boolean): Outcome<StanceStanding> {
            standingCalls += 1
            standingPending += includePending
            if (standingFails) return Outcome.Failed(IllegalStateException("no route to host"))
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

    @Test
    fun aBundleWithNoRecordsIsNoStandingAtAll() = runTest(dispatcher) {
        // The difference between the labelled affordance and a folded
        // pair on the target: the origin is a place, not a silence.
        stances.net = StancePair.Origin
        stances.records = 0
        val vm = viewModel()

        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).standing).isNull()
        assertThat(entry(vm).standingRead).isTrue()
    }

    @Test
    fun aBundleFoldingToTheOriginIsStillAStanding() = runTest(dispatcher) {
        stances.net = StancePair.Origin
        stances.records = 4
        val vm = viewModel()

        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).standing).isEqualTo(StancePair.Origin)
    }

    @Test
    fun theStandingIsReadPendingInclusive() = runTest(dispatcher) {
        // A stance still settling is one the author already made.
        val vm = viewModel()

        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(stances.standingPending).containsExactly(true)
    }

    @Test
    fun aFailedStandingReadIsAskedAgainWhenTheControlComesBack() = runTest(dispatcher) {
        // One transport blip must not leave that card a mystery button
        // for the rest of the session.
        stances.standingFails = true
        stances.net = StancePair(0.4, 0.2)
        stances.records = 1
        val vm = viewModel()

        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(entry(vm).standing).isNull()
        assertThat(entry(vm).standingRead).isFalse()

        stances.standingFails = false
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).standing).isEqualTo(StancePair(0.4, 0.2))
        assertThat(stances.standingCalls).isEqualTo(2)
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

    // -- A tap answers immediately (design.md §8.3) --

    @Test
    fun aTapMovesTheTargetBeforeTheRecordLands() = runTest(dispatcher) {
        // Silence reads as failure and invites the same priced act again.
        identity.stancePadTaught = true
        stances.net = StancePair(0.5, 0.5)
        stances.records = 2
        val gate = CompletableDeferred<Unit>()
        stances.gate = gate
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        // The write is still open, and the target already answers.
        assertThat(entry(vm).busy).isTrue()
        assertThat(stances.staged).isEmpty()
        assertThat(entry(vm).standing).isEqualTo(StancePair(0.1, 0.1))
        assertThat(entry(vm).standingPending).isTrue()

        gate.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()

        // The landed read is the better answer and replaces it.
        assertThat(entry(vm).standing).isEqualTo(StancePair(0.5, 0.5))
        assertThat(entry(vm).standingPending).isFalse()
    }

    @Test
    fun theAnswerIsTheFoldsOwnNeverTheClientsArithmetic() = runTest(dispatcher) {
        // The pending value comes from asking where the pick LANDS the
        // bundle; nothing here adds a pick to a standing.
        identity.stancePadTaught = true
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(stances.projected).contains(StancePair.TapDefault)
    }

    @Test
    fun aSignedStanceLeavesOneConfirmationCarryingTheNewStanding() = runTest(dispatcher) {
        identity.stancePadTaught = true
        stances.net = StancePair(0.3, 0.2)
        stances.records = 1
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).confirmation).isEqualTo(StancePair(0.3, 0.2))

        vm.onConfirmationShown(TARGET)

        assertThat(entry(vm).confirmation).isNull()
    }

    @Test
    fun aFailedWriteLeavesNoConfirmationAndNoPendingAnswer() = runTest(dispatcher) {
        identity.stancePadTaught = true
        stances.prepareOutcome = Outcome.Refused(listOf(UserError(ErrorCode.FORBIDDEN, "no")))
        stances.net = StancePair(0.4, 0.4)
        stances.records = 1
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onTapDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).confirmation).isNull()
        assertThat(entry(vm).failed).isTrue()
        assertThat(entry(vm).standingPending).isFalse()
        // The promise the pending answer made was not kept, so the fold
        // is asked again rather than left showing it.
        assertThat(entry(vm).standing).isEqualTo(StancePair(0.4, 0.4))
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

    // -- The chosen input surface (design.md §8.6) --

    @Test
    fun thePadIsTheInputUntilAnAlternateIsChosen() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.inputMode).isEqualTo(StanceInputMode.PAD)
    }

    @Test
    fun choosingAnAlternateReachesControlsAlreadyOnScreen() = runTest(dispatcher) {
        // The choice replaces the pad everywhere, not per-screen, so a
        // control composed before the change still has to follow it.
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        identity.setStanceInputMode(StanceInputMode.SLIDERS)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.inputMode).isEqualTo(StanceInputMode.SLIDERS)
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
