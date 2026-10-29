// One trace open per level entry (score-readout CD-SR2, CD-SR3; FeedEntryMoved.md:9):
// level one fetches once, a deeper level reads the held answer and asks
// nothing, a thing still settling makes no fetch, and Retry is the one way
// a failed read asks again.

package com.cogra.feature.content

import com.cogra.domain.AuthTokens
import com.cogra.domain.feed.FeedViewer
import com.cogra.domain.score.FeedStandings
import com.cogra.domain.score.OpenTrace
import com.cogra.domain.score.TraceFetch
import com.cogra.domain.score.TraceOrigin
import com.cogra.domain.score.TraceSession
import com.cogra.domain.score.TraceThingKind
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.FakeTraceRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.TraceCast
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

class TraceViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val traces = FakeTraceRepository()
    private val standings = FeedStandings()
    private val session = TraceSession()
    private val tokens = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", TraceCast.SOL.id) }
    private val viewer = FeedViewer(ThrowingAccountRepository(), tokens)

    private fun viewModel() = TraceViewModel(OpenTrace(traces, standings, session, viewer), session, viewer)

    private fun args(
        level: TraceLevel = TraceLevel.Entry,
        settling: Boolean = false,
        origin: TraceOrigin = TraceOrigin.Feed,
    ) = TraceArgs(TraceCast.POST_ID, TraceThingKind.POST, origin, settling, TraceCast.SOL.id, null, level)

    private fun settle() = dispatcher.scheduler.advanceUntilIdle()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun levelOneMakesTheOpensOneLiveFetch() = runTest(dispatcher) {
        traces.answers += TraceFetch.Answered(TraceCast.ownAnswer())
        val vm = viewModel()
        vm.start(args())
        vm.start(args())
        settle()

        assertThat(traces.traced).containsExactly(TraceCast.SOL.id to TraceCast.POST_ID)
        val view = vm.state.value.view as TraceView.Answered
        assertThat(view.held.answer.score).isEqualTo(15.2)
        assertThat(view.context.borrowed).isFalse()
    }

    @Test
    fun aDeeperLevelReadsTheHeldAnswerAndAsksNothing() = runTest(dispatcher) {
        traces.answers += TraceFetch.Answered(TraceCast.ownAnswer())
        viewModel().start(args())
        settle()

        val deeper = viewModel()
        deeper.start(args(level = TraceLevel.Step(1, 1)))
        settle()

        assertThat(traces.traced).hasSize(1)
        assertThat(deeper.state.value.view).isInstanceOf(TraceView.Answered::class.java)
    }

    @Test
    fun aDeeperLevelReachedColdMakesItsOwnOneFetch() = runTest(dispatcher) {
        traces.answers += TraceFetch.Answered(TraceCast.ownAnswer())
        viewModel().start(args(level = TraceLevel.Path(1)))
        settle()

        assertThat(traces.traced).hasSize(1)
    }

    @Test
    fun theTraceMakesNoFetchGivenTheThingIsStillSettling() = runTest(dispatcher) {
        val vm = viewModel()
        vm.start(args(settling = true))
        settle()

        assertThat(traces.traced).isEmpty()
        assertThat(vm.state.value.view).isEqualTo(TraceView.Settling)
    }

    @Test
    fun aWalkFromAnotherViewIsTheBorrowedOne() = runTest(dispatcher) {
        traces.answers += TraceFetch.Answered(TraceCast.borrowedAnswer())
        val vm = viewModel()
        vm.start(args().copy(viewer = TraceCast.MIRA.id))
        settle()

        assertThat((vm.state.value.view as TraceView.Answered).context.borrowed).isTrue()
    }

    @Test
    fun aFailedReadSaysHowAndRetryAsksAgain() = runTest(dispatcher) {
        traces.answers += TraceFetch.Offline
        traces.answers += TraceFetch.Answered(TraceCast.ownAnswer())
        val vm = viewModel()
        vm.start(args())
        settle()
        assertThat(vm.state.value.view).isEqualTo(TraceView.Offline)

        vm.retry()
        settle()
        assertThat(traces.traced).hasSize(2)
        assertThat(vm.state.value.view).isInstanceOf(TraceView.Answered::class.java)
    }

    @Test
    fun theQuietRowUnfoldsInPlace() = runTest(dispatcher) {
        val vm = viewModel()
        vm.unfold()
        assertThat(vm.state.value.unfolded).isTrue()
    }
}
