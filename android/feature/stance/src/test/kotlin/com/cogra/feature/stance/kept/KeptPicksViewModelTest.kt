// The kept picks' review and seal, compiled from their sidecars:
// KeptPicksReview.md and KeptPicksSeal.md, line by line where the holder
// decides it (the drawing's own lines are KeptPicksScreenTest's).

package com.cogra.feature.stance.kept

import com.cogra.crypto.ActorKey
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.KeptFamily
import com.cogra.domain.stance.KeptPreview
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.InMemoryKeptPickStore
import com.cogra.domain.testing.ScriptedKeptPreviewRepository
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

private val POST = StanceTarget.Node("post-1")
private val PERSON = StanceTarget.Node("user-mira")
private val TOPIC = StanceTarget.Topic("saltmaps")

@OptIn(ExperimentalCoroutinesApi::class)
class KeptPicksViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val writes = SealingWriteRepository(actor)
    private val signals = StanceSignals()
    private val kept = InMemoryKeptPickStore()
    private val previews = ScriptedKeptPreviewRepository().apply {
        previews[POST] = KeptPreview(StanceKind.POST, "The long way home — @ada", src = "post-photo.jpg")
        previews[PERSON] = KeptPreview(StanceKind.PERSON, "Mira Voss")
    }

    private val stances = object : ThrowingStanceRepository() {
        val staged = mutableListOf<StanceTarget>()

        /** A refusal or a lost answer at the prepare of one target. */
        val refusals = mutableMapOf<StanceTarget, Outcome<List<PreparedWriteView>>>()

        /** The standing behind each target: records and raw sums. */
        val standings = mutableMapOf<StanceTarget, Pair<Int, StancePair>>()

        override suspend fun prepareStance(target: StanceTarget, pick: StancePair): Outcome<List<PreparedWriteView>> {
            refusals[target]?.let { return it }
            staged += target
            return when (target) {
                is StanceTarget.Node -> writes.prepareStance(target.id, pick.pDirected, pick.pInterest)
                is StanceTarget.Topic -> writes.prepareTopicStance(target.name, pick.pDirected, pick.pInterest)
            }
        }

        override suspend fun standing(target: StanceTarget, includePending: Boolean): Outcome<StanceStanding> {
            val (records, raw) = standings[target] ?: (0 to StancePair.Origin)
            return Outcome.Success(StanceStanding(target, raw, raw, records, includePending, severed = false))
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

    private fun viewModel() =
        KeptPicksViewModel(kept, previews, stances, WriteSigner(writes, identity), identity, signals)

    private fun idle() = dispatcher.scheduler.advanceUntilIdle()

    private suspend fun keepThree() {
        kept.keep(POST, StancePair(0.1, 0.1), KeptFamily.OPINION, StanceKind.POST)
        kept.keep(PERSON, StancePair(0.55, 0.2), KeptFamily.OPINION, StanceKind.PERSON)
        kept.keep(TOPIC, StancePair(0.6, 0.35), KeptFamily.OPINION, StanceKind.TOPIC)
    }

    @Test
    fun review5_9_theReviewListsPlainPicksOnlyInTheOrderTheyWereKept() = runTest(dispatcher) {
        keepThree()
        kept.keep(PERSON, StancePair(0.3, 0.2), KeptFamily.VOUCH_BACK, StanceKind.PERSON)
        val vm = viewModel()
        idle()

        assertThat(vm.state.value.rows.map { it.pick.target }).containsExactly(POST, PERSON, TOPIC).inOrder()
        assertThat(vm.state.value.rows.map { it.preview.name })
            .containsExactly("The long way home — @ada", "Mira Voss", "saltmaps").inOrder()
        assertThat(vm.state.value.approvalKept).isFalse()
    }

    @Test
    fun review45_47_aKeptApprovalIsNamedButNeverJoins() = runTest(dispatcher) {
        keepThree()
        kept.keep(StanceTarget.Node("app-noor"), StancePair(0.3, 0.2), KeptFamily.APPROVAL, StanceKind.PERSON)
        val vm = viewModel()
        idle()

        assertThat(vm.state.value.approvalKept).isTrue()
        assertThat(vm.state.value.rows).hasSize(3)
    }

    @Test
    fun review15_aTargetWhoseReadGetsNoAnswerKeepsItsRowNamedByItsKind() = runTest(dispatcher) {
        val comment = StanceTarget.Node("comment-1")
        kept.keep(comment, StancePair(0.1, 0.1), KeptFamily.OPINION, StanceKind.COMMENT)
        val vm = viewModel()
        idle()

        val row = vm.state.value.rows.single()
        assertThat(row.preview.name).isEqualTo("A comment")
        assertThat(row.preview.kind).isEqualTo(StanceKind.COMMENT)
    }

    @Test
    fun review19_aPickThatNetsItsBundleToNothingSaysSoOnItsRow() = runTest(dispatcher) {
        stances.standings[PERSON] = 2 to StancePair(-0.55, -0.2)
        keepThree()
        val vm = viewModel()
        idle()

        assertThat(vm.state.value.rows.map { it.severs }).containsExactly(false, true, false).inOrder()
    }

    @Test
    fun review21_theCrossDropsAtOnceSaysItAndMovesFocusToTheNextRow() = runTest(dispatcher) {
        keepThree()
        val vm = viewModel()
        idle()

        vm.onRemove(1)
        idle()

        assertThat(kept.picks.value.map { it.target }).containsExactly(POST, TOPIC).inOrder()
        assertThat(vm.state.value.removedLeft).isEqualTo(2)
        assertThat(keptRemoved(2)).isEqualTo("Removed — 2 picks left.")
        assertThat(vm.state.value.focusIndex).isEqualTo(1)
        assertThat(vm.state.value.exit).isNull()
    }

    @Test
    fun review23_theLastDropLeavesWithNothingLeftToSign() = runTest(dispatcher) {
        kept.keep(POST, StancePair(0.1, 0.1), KeptFamily.OPINION, StanceKind.POST)
        val vm = viewModel()
        idle()

        vm.onRemove(0)
        idle()

        assertThat(vm.state.value.exit).isEqualTo(KeptExit.Left(KeptSnack.NothingLeft))
        assertThat(kept.picks.value).isEmpty()
    }

    @Test
    fun review27_signThemOpensTheSealAndSignsNothing() = runTest(dispatcher) {
        keepThree()
        val vm = viewModel()
        idle()

        vm.onSignThem()

        assertThat(vm.state.value.stage).isEqualTo(KeptStage.SEAL)
        assertThat(stances.staged).isEmpty()
    }

    @Test
    fun seal27_theSealSignsTheKeptPicksTogetherAndLeavesThemSettling() = runTest(dispatcher) {
        keepThree()
        val vm = viewModel()
        idle()
        vm.onSignThem()

        vm.onSign()
        idle()

        assertThat(stances.staged).containsExactly(POST, PERSON, TOPIC).inOrder()
        assertThat(kept.picks.value).isEmpty()
        assertThat(vm.state.value.exit).isEqualTo(KeptExit.Left(KeptSnack.Signed(3)))
        assertThat(keptSigned(3)).isEqualTo("Signed 3 things, still settling.")
        assertThat(signals.settling.value).containsExactly(POST, PERSON, TOPIC)
    }

    @Test
    fun seal21_aSecondPressWaitsForTheFirstsAnswer() = runTest(dispatcher) {
        keepThree()
        val vm = viewModel()
        idle()
        vm.onSignThem()

        vm.onSign()
        vm.onSign()
        idle()

        assertThat(stances.staged).hasSize(3)
    }

    @Test
    fun seal33_theWriteRuleRefusesTheBatchAndNoPickIsDropped() = runTest(dispatcher) {
        keepThree()
        stances.refusals[PERSON] = Outcome.Refused(listOf(UserError(ErrorCode.WRITE_RULE_FAILED, "spent", null)))
        val vm = viewModel()
        idle()
        vm.onSignThem()

        vm.onSign()
        idle()

        assertThat(vm.state.value.fault).isEqualTo(KeptSealFault.WRITE_RULE)
        assertThat(kept.picks.value).hasSize(3)
        // `Not now`: the review stands again with every pick still in it (:35).
        vm.onBackToReview()
        assertThat(vm.state.value.stage).isEqualTo(KeptStage.REVIEW)
        assertThat(vm.state.value.rows).hasSize(3)
    }

    @Test
    fun seal29_noAnswerPutsTheFaultLineInTheCommitsPlaceAndKeepsEveryPick() = runTest(dispatcher) {
        keepThree()
        stances.refusals[TOPIC] = Outcome.Failed(IllegalStateException("no route to host"))
        val vm = viewModel()
        idle()
        vm.onSignThem()

        vm.onSign()
        idle()

        assertThat(vm.state.value.fault).isEqualTo(KeptSealFault.OFFLINE)
        assertThat(vm.state.value.signing).isFalse()
        assertThat(kept.picks.value).hasSize(3)
    }

    @Test
    fun seal37_anyOtherRefusalIsTheBugNotice() = runTest(dispatcher) {
        keepThree()
        stances.refusals[POST] = Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "no", null)))
        val vm = viewModel()
        idle()
        vm.onSignThem()

        vm.onSign()
        idle()

        assertThat(vm.state.value.fault).isEqualTo(KeptSealFault.BUG)
        assertThat(kept.picks.value).hasSize(3)
    }

    @Test
    fun seal49_theXLeavesTheFlowAndKeepsEveryPick() = runTest(dispatcher) {
        keepThree()
        val vm = viewModel()
        idle()
        vm.onSignThem()

        vm.onLeave()

        assertThat(vm.state.value.exit).isEqualTo(KeptExit.Left())
        assertThat(kept.picks.value).hasSize(3)
    }

    @Test
    fun review39_withTheKeyGoneTheReviewLeaves() = runTest(dispatcher) {
        identity.seed = null
        keepThree()
        val vm = viewModel()
        idle()

        assertThat(vm.state.value.exit).isEqualTo(KeptExit.Left())
    }
}
