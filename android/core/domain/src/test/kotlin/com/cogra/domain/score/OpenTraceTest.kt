// One trace open (score-readout CD-SR1, CD-SR2; FeedKinds.md:11; §5.6): one
// live fetch in the view the figure came from, adopted on every surface that
// draws the thing, held for the deeper levels; a failed read never adopts.

package com.cogra.domain.score

import com.cogra.domain.ActorRef
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.feed.FeedViewer
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.FakeTraceRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.TraceCast
import com.cogra.domain.testing.rankingOf
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test

class OpenTraceTest {

    private val traces = FakeTraceRepository()
    private val standings = FeedStandings()
    private val session = TraceSession()
    private val tokens = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u-sol") }
    private val account = object : ThrowingAccountRepository() {
        var lender: Outcome<ActorRef?> = Outcome.Success(null)

        override suspend fun borrowedView(): Outcome<ActorRef?> = lender
    }
    private val open = OpenTrace(traces, standings, session, FeedViewer(account, tokens))

    @Test
    fun `the open fetches once in the view the tap handed, and adopts what it found`() = runTest {
        standings.hold("u-sol", rankingOf(TraceCast.POST_ID), viewer = "u-sol")
        traces.answers += TraceFetch.Answered(TraceCast.ownAnswer(score = 14.7))
        val read = open(TraceCast.POST_ID, viewer = "u-lender")
        assertThat(traces.traced).containsExactly("u-lender" to TraceCast.POST_ID)
        assertThat(read).isInstanceOf(TraceRead.Answered::class.java)
        assertThat(standings.state.value.of("u-sol", TraceCast.POST_ID, pending = false)).isEqualTo(Standing.Figure(14.7))
        assertThat(session.heldFor(TraceCast.POST_ID)?.answer?.score).isEqualTo(14.7)
    }

    @Test
    fun `with no view handed, the held ranking's view is the one walked`() = runTest {
        standings.hold("u-sol", rankingOf("x"), viewer = "u-mira")
        traces.answers += TraceFetch.Answered(TraceCast.ownAnswer())
        open(TraceCast.POST_ID, viewer = null)
        assertThat(traces.traced.single().first).isEqualTo("u-mira")
    }

    @Test
    fun `with nothing held, the reader's view is read afresh`() = runTest {
        account.lender = Outcome.Success(ActorRef("u-mira", "mira"))
        traces.answers += TraceFetch.Answered(TraceCast.ownAnswer())
        open(TraceCast.POST_ID, viewer = null)
        assertThat(traces.traced.single().first).isEqualTo("u-mira")
    }

    @Test
    fun `a trace that finds no paths is adopted as the dash`() = runTest {
        standings.hold("u-sol", rankingOf(TraceCast.POST_ID), viewer = "u-sol")
        traces.answers += TraceFetch.Answered(TraceAnswer(null, emptyList()))
        open(TraceCast.POST_ID, viewer = "u-sol")
        assertThat(standings.state.value.of("u-sol", TraceCast.POST_ID, pending = false)).isEqualTo(Standing.Dash)
    }

    @Test
    fun `a failed read adopts nothing and says how it failed`() = runTest {
        standings.hold("u-sol", rankingOf(TraceCast.POST_ID), viewer = "u-sol")
        traces.answers += TraceFetch.Offline
        assertThat(open(TraceCast.POST_ID, "u-sol")).isEqualTo(TraceRead.Offline)
        traces.answers += TraceFetch.Fault
        assertThat(open(TraceCast.POST_ID, "u-sol")).isEqualTo(TraceRead.Fault)
        assertThat(standings.state.value.of("u-sol", TraceCast.POST_ID, pending = false)).isEqualTo(Standing.Figure(1.0))
    }

    @Test
    fun `the steps' posts and comments are named in one batch, people never`() = runTest {
        traces.answers += TraceFetch.Answered(TraceAnswer(1.0, listOf(TraceCast.reviewPath())))
        open("p2", viewer = "u-sol")
        assertThat(traces.namesAsked).containsExactly(listOf("c1"))
    }

    @Test
    fun `the open makes no names read when nothing needs naming`() = runTest {
        traces.answers += TraceFetch.Answered(TraceCast.ownAnswer())
        open(TraceCast.POST_ID, viewer = "u-sol")
        assertThat(traces.namesAsked).isEmpty()
    }
}
