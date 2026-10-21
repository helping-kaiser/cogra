package com.cogra.feature.stance

import com.cogra.crypto.ActorKey
import com.cogra.domain.ActorRef
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.severance
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceProjection
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.stance.localLanding
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingStanceRepository
import com.cogra.domain.testing.testGraphId
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private val TARGET = StanceTarget.Node("post-1")

@OptIn(ExperimentalCoroutinesApi::class)
class StanceViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val writes = SealingWriteRepository(actor)
    private val signals = StanceSignals()

    /** Records exactly what the control asked for; nothing is derived. */
    private val stances = object : ThrowingStanceRepository() {
        val staged = mutableListOf<StancePair>()
        val projected = mutableListOf<StancePair>()
        var net = StancePair.Origin

        /**
         * The sums behind [net], before the clip. They default to the
         * fold, which is the truth for any bundle inside `±1`; a test
         * about clipping sets them apart deliberately.
         */
        var raw: StancePair? = null
        var records = 0
        var prepareOutcome: Outcome<List<PreparedWriteView>>? = null
        var severanceOutcome: Outcome<List<PreparedWriteView>>? = null
        var severanceCalls = 0

        /** Holds the write open, so the pending answer is observable. */
        var gate: CompletableDeferred<Unit>? = null

        override suspend fun prepareStance(
            target: StanceTarget,
            pick: StancePair,
        ): Outcome<List<PreparedWriteView>> {
            gate?.await()
            staged += pick
            return prepareOutcome ?: when (target) {
                is StanceTarget.Node -> writes.prepareStance(target.id, pick.pDirected, pick.pInterest)
                is StanceTarget.Topic -> writes.prepareTopicStance(target.name, pick.pDirected, pick.pInterest)
            }
        }

        var standingCalls = 0
        var standingFails = false
        val standingPending = mutableListOf<Boolean>()

        override suspend fun standing(target: StanceTarget, includePending: Boolean): Outcome<StanceStanding> {
            standingCalls += 1
            standingPending += includePending
            if (standingFails) return Outcome.Failed(IllegalStateException("no route to host"))
            return Outcome.Success(
                StanceStanding(target, net, raw ?: net, records, includePending),
            )
        }

        /**
         * Kept only to catch a regression: the pad folds locally now, so
         * a drag that reaches this at all has put a round trip back
         * under the thumb (design.md §8.3). Tests assert [projected]
         * stays empty.
         */
        override suspend fun projection(
            target: StanceTarget,
            pick: StancePair,
            includePending: Boolean,
        ): Outcome<StanceProjection> {
            projected += pick
            return Outcome.Success(localLanding(raw ?: net, pick))
        }

        /** The sums the last quote was read at — what the server's batch walks back. */
        var quoted: StancePair? = null

        override suspend fun severanceQuote(target: StanceTarget, includePending: Boolean): Outcome<SeveranceQuote> =
            Outcome.Success(
                SeveranceQuote(
                    target = target,
                    standing = net,
                    raw = (raw ?: net).also { quoted = it },
                    records = records,
                    alreadySevered = net == StancePair.Origin,
                ),
            )

        override suspend fun prepareSeverance(target: StanceTarget): Outcome<List<PreparedWriteView>> {
            severanceCalls += 1
            // A faithful walk-back: the quoted raw sums, netted in the
            // quoted number of records, toward the node the read named.
            val node = when (target) {
                is StanceTarget.Node -> testGraphId(target.id)
                is StanceTarget.Topic -> "name:${target.name}"
            }
            val sums = quoted ?: raw ?: net
            val walkBack = severance(node, sums.pDirected, sums.pInterest, records)
            return severanceOutcome ?: Outcome.Success(writes.stageFaithful(Expectation(emptyList(), listOf(walkBack))))
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

    /** Whether the reader still borrows a view: `borrowedView`'s lender, or null. */
    private val account = object : ThrowingAccountRepository() {
        var lender: ActorRef? = null
        override suspend fun borrowedView(): Outcome<ActorRef?> = Outcome.Success(lender)
    }

    private fun viewModel() = StanceViewModel(stances, WriteSigner(writes, identity), identity, signals, account)

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

    // -- Announcing: the borrowed-view band hears every signing (VouchBack.md:21) --

    @Test
    fun aTakenSigningIsAnnouncedAndMarkedTaken() = runTest(dispatcher) {
        val heard = mutableListOf<Unit>()
        val listening = backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            signals.signed.collect {
                heard +=
                    it
            }
        }
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onHoldDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(heard).hasSize(1)
        // The one-shot a host routes on (the vouch-back's ceremony).
        assertThat(entry(vm).taken).isTrue()
        vm.onTakenShown(TARGET)
        assertThat(entry(vm).taken).isFalse()
        listening.cancel()
    }

    @Test
    fun aSigningThatDidNotGoThroughIsNeitherAnnouncedNorTaken() = runTest(dispatcher) {
        val heard = mutableListOf<Unit>()
        val listening = backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            signals.signed.collect {
                heard +=
                    it
            }
        }
        stances.prepareOutcome = Outcome.Failed(IllegalStateException("offline"))
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onHoldDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(heard).isEmpty()
        assertThat(entry(vm).taken).isFalse()
        assertThat(entry(vm).failed).isTrue()
        listening.cancel()
    }

    // -- Writing: the raw-edge rule (design.md §8.1) --

    @Test
    fun aHoldStagesTheModestPositiveVerbatim() = runTest(dispatcher) {
        // stance-control.md "The gesture": press and hold 500ms commits
        // (+0.1, +0.1), and nothing gates it.
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onHoldDefault(TARGET)
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

        vm.onHoldDefault(TARGET)
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

        vm.onHoldDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).failed).isTrue()
        assertThat(entry(vm).needsKey).isTrue()
    }

    // -- The hold answers immediately (design.md §8.3) --

    @Test
    fun aHoldMovesTheTargetOnlyOnceItsSignatureIsTaken() = runTest(dispatcher) {
        // The failure pack: signed acts are pessimistic. "The resting target
        // moves to the new opinion when the signature is taken … if it is
        // not taken, the face never moved" (StanceControl.jsx).
        identity.stancePadTaught = true
        stances.net = StancePair(0.5, 0.5)
        stances.records = 2
        val gate = CompletableDeferred<Unit>()
        stances.gate = gate
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onHoldDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        // The write is still open: the target waits, where it stood.
        assertThat(entry(vm).busy).isTrue()
        assertThat(stances.staged).isEmpty()
        assertThat(entry(vm).standing).isEqualTo(StancePair(0.5, 0.5))
        assertThat(entry(vm).standingPending).isFalse()

        stances.net = StancePair(0.6, 0.6)
        stances.records = 3
        gate.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()

        // Taken: it moves, and the landed read is the authority.
        assertThat(entry(vm).busy).isFalse()
        assertThat(entry(vm).standing).isEqualTo(StancePair(0.6, 0.6))
        assertThat(entry(vm).standingPending).isFalse()
        assertThat(entry(vm).standingRecords).isEqualTo(3)
    }

    @Test
    fun theRecordCarriesThePickWhileOnlyTheDisplayFoldsIt() = runTest(dispatcher) {
        // The fold the reader SEES is local arithmetic (design.md §8.3),
        // but the record staged behind it carries the picked pair
        // verbatim — the client never writes a delta (design.md §8.1).
        identity.stancePadTaught = true
        stances.net = StancePair(0.5, 0.5)
        stances.records = 2
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onHoldDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(stances.staged).containsExactly(StancePair.TapDefault)
    }

    @Test
    fun theLocalFoldSumsTheRawHistoryRatherThanTheClippedStanding() = runTest(dispatcher) {
        // A bundle already past the clip: its fold reads +1.00 while its
        // history sums to +6.00. Adding a pick to the CLIPPED number
        // would say a −0.5 leaves the reader at +0.5, when it actually
        // leaves them at +5.5 — still clipped to +1.00.
        stances.net = StancePair(1.0, 1.0)
        stances.raw = StancePair(6.0, 4.0)
        stances.records = 9
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenPad(TARGET)
        vm.onPick(TARGET, StancePair(-0.5, -0.5))

        assertThat(entry(vm).landing?.net).isEqualTo(StancePair(1.0, 1.0))
    }

    @Test
    fun aSignedStanceLeavesOneConfirmationCarryingTheNewStanding() = runTest(dispatcher) {
        identity.stancePadTaught = true
        stances.net = StancePair(0.3, 0.2)
        stances.records = 1
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onHoldDefault(TARGET)
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

        vm.onHoldDefault(TARGET)
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
    fun theTapParksThePadOpenAtTheDefaultAndStagesNothing() = runTest(dispatcher) {
        // stance-control.md "The gesture" (jakob 2026-10-05): the pad
        // opens at +0.10 / +0.10, so Set on a pick never moved signs
        // exactly what the hold would.
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).pick).isEqualTo(StancePair.TapDefault)
        assertThat(entry(vm).pad).isEqualTo(PadMode.STICKY)
        assertThat(stances.staged).isEmpty()
    }

    @Test
    fun setOnAnUnmovedPickSignsExactlyWhatTheHoldWould() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenPad(TARGET)
        vm.onCommit(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(stances.staged).containsExactly(StancePair.TapDefault)
    }

    @Test
    fun everyPickLandsAtOnceAndNoneOfThemCostsARead() = runTest(dispatcher) {
        // The device symptom: the landing arrived about a second behind
        // the face, because every pick was a round trip. It is now local
        // arithmetic — no read, no debounce, no frame of "working out".
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onOpenPad(TARGET)
        stances.projected.clear()

        // No scheduler advance between these: a drifting thumb is
        // answered in the same breath it moves.
        vm.onPick(TARGET, StancePair(0.1, 0.1))
        assertThat(entry(vm).landing?.net).isEqualTo(StancePair(0.1, 0.1))
        vm.onPick(TARGET, StancePair(0.2, 0.2))
        assertThat(entry(vm).landing?.net).isEqualTo(StancePair(0.2, 0.2))
        vm.onPick(TARGET, StancePair(0.3, 0.3))
        assertThat(entry(vm).landing?.net).isEqualTo(StancePair(0.3, 0.3))

        assertThat(stances.projected).isEmpty()
    }

    @Test
    fun anOpenedPadAlreadyKnowsWhereItsDefaultPickLands() = runTest(dispatcher) {
        // Nothing to wait for at the moment of blooming either: the pad
        // opens at the default and the landing for it is already known.
        stances.net = StancePair(0.4, 0.2)
        stances.records = 2
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenPad(TARGET)

        val landing = entry(vm).landing?.net
        assertThat(landing?.pDirected).isWithin(1e-9).of(0.5)
        assertThat(landing?.pInterest).isWithin(1e-9).of(0.3)
        assertThat(stances.projected).isEmpty()
    }

    @Test
    fun dismissingAShutPadLeavesItsTargetAlone() = runTest(dispatcher) {
        // Leaving a screen asks this of every control on it, and a feed
        // holds many: a dismissal that touched state would churn the
        // whole map and throw away standings that were already read.
        stances.net = StancePair(0.4, 0.2)
        stances.records = 2
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        val before = entry(vm)

        vm.onDismissPad(TARGET)

        assertThat(entry(vm)).isEqualTo(before)
    }

    @Test
    fun dismissingAnUnknownTargetCreatesNothing() = runTest(dispatcher) {
        val vm = viewModel()

        vm.onDismissPad(StanceTarget.Node("never-seen"))

        assertThat(vm.state.value.targets).doesNotContainKey(StanceTarget.Node("never-seen"))
    }

    @Test
    fun aParkedPadIsShutAndStagesNothingWhenTheScreenGoesAway() = runTest(dispatcher) {
        // What the route asks on its way out (design.md §8.3): the pad
        // is a window of its own, so one left open drew over the next
        // destination and was still standing on the way back.
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onOpenPad(TARGET)
        vm.onPick(TARGET, StancePair(0.6, 0.6))
        assertThat(entry(vm).pad).isEqualTo(PadMode.STICKY)

        vm.onDismissPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).pad).isEqualTo(PadMode.CLOSED)
        assertThat(entry(vm).pick).isEqualTo(StancePair.Origin)
        assertThat(stances.staged).isEmpty()
    }

    @Test
    fun aHoldOpensNoPad() = runTest(dispatcher) {
        // The shortcut signs without opening anything.
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onHoldDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).pad).isEqualTo(PadMode.CLOSED)
        assertThat(stances.staged).containsExactly(StancePair.TapDefault)
    }

    @Test
    fun dismissingThePadForgetsThePick() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        vm.onOpenPad(TARGET)
        vm.onPick(TARGET, StancePair(0.9, 0.9))

        vm.onDismissPad(TARGET)

        assertThat(entry(vm).pad).isEqualTo(PadMode.CLOSED)
        assertThat(entry(vm).pick).isEqualTo(StancePair.Origin)
    }

    // -- The alternates (StanceControl.jsx:601-614; stance-control.md) --

    @Test
    fun chooseYourOpinionOpensTheAlternatesAtTheDefault() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenAlternates(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).pad).isEqualTo(PadMode.ALTERNATES)
        assertThat(entry(vm).pick).isEqualTo(StancePair.TapDefault)
        assertThat(stances.staged).isEmpty()
    }

    @Test
    fun aReaderWhoChoseAnAlternateMeetsItOnTheTap() = runTest(dispatcher) {
        identity.setStanceInputMode(StanceInputMode.SLIDERS)
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).pad).isEqualTo(PadMode.ALTERNATES)
        // The coaching lines are the pad's; the alternates carry none.
        assertThat(vm.state.value.coachingTarget).isNull()
    }

    // -- The borrowed view (the master's `borrowed`, seam 240) --

    @Test
    fun anOpenAsksWhetherTheReaderStillBorrowsAView() = runTest(dispatcher) {
        account.lender = ActorRef(id = "genesis", handle = "genesismod")
        val vm = viewModel()
        vm.observe(TARGET)
        vm.onOpenPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.borrowed).isTrue()

        account.lender = null
        vm.onDismissPad(TARGET)
        vm.onOpenPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.borrowed).isFalse()
    }

    // -- Severance (design.md §8.2, §8.5) --

    @Test
    fun aPickThatLandsOnZeroAsksInsteadOfCommitting() = runTest(dispatcher) {
        stances.net = StancePair(0.8, 0.8)
        stances.records = 2
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onOpenPad(TARGET)
        // Exactly cancels the bundle: a single pick can reach severance
        // against a short history (design.md §8.2).
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
    fun confirmingAPickThatNetsToZeroSignsThePickAloneAsOneRecord() = runTest(dispatcher) {
        // The pick route signs exactly one record (jakob 2026-10-05, P5;
        // PadStanding.md:59 "its cost of 1 thing") — never the walk-back batch.
        identity.stancePadTaught = true
        stances.net = StancePair(0.8, 0.8)
        stances.records = 2
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onOpenPad(TARGET)
        vm.onPick(TARGET, StancePair(-0.8, -0.8))
        vm.onCommit(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        stances.net = StancePair.Origin
        stances.records = 3
        vm.onConfirmSeverance(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(stances.severanceCalls).isEqualTo(0)
        assertThat(stances.staged).containsExactly(StancePair(-0.8, -0.8))
        assertThat(entry(vm).severance).isNull()
        assertThat(entry(vm).pad).isEqualTo(PadMode.CLOSED)
        // Read as a walk-back, never as the table's nearest face.
        assertThat(entry(vm).confirmation).isEqualTo(StancePair.Origin)
    }

    @Test
    fun aTakenWalkBackConfirmsWithTheNumberOfThingsItSigned() = runTest(dispatcher) {
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

        assertThat(entry(vm).walkedBack).isEqualTo(3)
        vm.onConfirmationShown(TARGET)
        assertThat(entry(vm).walkedBack).isNull()
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

    // -- Teaching it: the pad is the teacher (stance-control.md) --

    @Test
    fun noControlCarriesTheCoachingUntilAPadOpens() = runTest(dispatcher) {
        // The lines belong to the open that carries them, not to
        // whichever card happened to render first.
        val vm = viewModel()

        vm.observe(TARGET)
        vm.observe(StanceTarget.Node("post-2"))
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.coachingTarget).isNull()
    }

    @Test
    fun theFirstOpenEverCarriesTheCoachingAndStagesNothing() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.coachingTarget).isEqualTo(TARGET)
        assertThat(stances.staged).isEmpty()
        // Spent at the open, so a restart cannot teach twice.
        assertThat(identity.stancePadTaught).isTrue()
    }

    @Test
    fun theOpenAfterTheTeachingOneCarriesNoCoaching() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onOpenPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDismissPad(TARGET)

        vm.onOpenPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.coachingTarget).isNull()
        assertThat(entry(vm).pad).isEqualTo(PadMode.STICKY)
    }

    @Test
    fun anOpenBeforeTheStoreHasAnsweredStillTeaches() = runTest(dispatcher) {
        // The very first tap on a freshly opened screen: the flag read is
        // still in flight. The pad opens at once; the lines join it.
        val vm = viewModel()

        vm.onOpenPad(TARGET)
        assertThat(entry(vm).pad).isEqualTo(PadMode.STICKY)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.coachingTarget).isEqualTo(TARGET)
        assertThat(stances.staged).isEmpty()
    }

    @Test
    fun aLateAnswerDoesNotTeachAPadAlreadyClosed() = runTest(dispatcher) {
        // The lines close with the pad: an answer that arrives after it
        // shut has no open to ride, and spends nothing.
        val vm = viewModel()

        vm.onOpenPad(TARGET)
        vm.onDismissPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.coachingTarget).isNull()
        assertThat(identity.stancePadTaught).isFalse()
    }

    @Test
    fun anOpenOnADeviceAlreadyTaughtCarriesNoCoaching() = runTest(dispatcher) {
        identity.stancePadTaught = true
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onOpenPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.coachingTarget).isNull()
        assertThat(stances.staged).isEmpty()
    }

    @Test
    fun theCoachingStaysForAsLongAsItsPadDoes() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onOpenPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        // Reading, picking, scrolling: none of it closes the lesson.
        vm.onPick(TARGET, StancePair(0.4, 0.2))
        vm.observe(StanceTarget.Node("post-2"))
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.coachingTarget).isEqualTo(TARGET)

        // Closing the pad does.
        vm.onDismissPad(TARGET)
        assertThat(vm.state.value.coachingTarget).isNull()
    }

    @Test
    fun aHoldNeverSpendsTheTeaching() = runTest(dispatcher) {
        // A hold opens nothing, so there is nothing for the lines to ride:
        // the account's first open is still to come.
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onHoldDefault(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(identity.stancePadTaught).isFalse()
        assertThat(stances.staged).containsExactly(StancePair.TapDefault)

        vm.onOpenPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.coachingTarget).isEqualTo(TARGET)
    }

    @Test
    fun aSetThatSignsClosesTheCoachingWithItsPad() = runTest(dispatcher) {
        val vm = viewModel()
        vm.observe(TARGET)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onOpenPad(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        vm.onCommit(TARGET)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(entry(vm).pad).isEqualTo(PadMode.CLOSED)
        assertThat(vm.state.value.coachingTarget).isNull()
    }
}
