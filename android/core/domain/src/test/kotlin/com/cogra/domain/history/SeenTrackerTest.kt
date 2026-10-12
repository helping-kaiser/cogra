// The seen tracker's half of H1 (history packet, "Test obligations →
// Clients"): first-seeing dedupe in-session, batching and flushing at a
// checkpoint, the retry of a refused batch, the bounded failure of a batch
// refused for good (PR-46), and no tracking without a session. What counts as seen is the surface's question (`SeenCardsEffect`
// in core:designsystem) and is tested there.

package com.cogra.domain.history

import com.cogra.domain.AuthTokens
import com.cogra.domain.CograLog
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingViewHistoryRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class SeenTrackerTest {

    private val history = RecordingViewHistoryRepository()
    private val session = FakeTokenStore()

    private fun signIn(account: String = "u1", access: String = "a") {
        session.tokens.value = AuthTokens(access, "r", account)
    }

    /**
     * A tracker on the test's own clock, its session watch already running.
     * Its work runs in `backgroundScope`, which `advanceUntilIdle` leaves
     * alone; nothing in it waits on time, so `runCurrent` runs all of it.
     */
    private fun TestScope.tracker(repo: ViewHistoryRepository = history): SeenTracker =
        SeenTracker(repo, session, backgroundScope).also { runCurrent() }

    private fun ids(range: IntRange): List<String> = range.map { "n$it" }

    private val rateLimited = Outcome.Refused(listOf(UserError(ErrorCode.RATE_LIMITED, "too many attempts")))

    @Test
    fun `a seen card is queued once per session`() = runTest {
        signIn()
        val tracker = tracker()

        tracker.saw(listOf("p1", "p2"))
        tracker.saw(listOf("p2", "p3", "p1"))
        assertThat(tracker.queued()).containsExactly("p1", "p2", "p3").inOrder()

        tracker.flush()
        runCurrent()
        // Sent once, remembered after: seeing it again queues nothing.
        tracker.saw(listOf("p1", "p3"))
        assertThat(tracker.queued()).isEmpty()
        assertThat(history.calls).containsExactly(listOf("p1", "p2", "p3"))
    }

    @Test
    fun `nothing is sent before a checkpoint`() = runTest {
        signIn()
        val tracker = tracker()

        tracker.saw(listOf("p1"))
        runCurrent()

        assertThat(history.calls).isEmpty()
        assertThat(tracker.queued()).containsExactly("p1")
    }

    @Test
    fun `a batch flushes at a checkpoint in the order it was seen`() = runTest {
        signIn()
        val tracker = tracker()

        tracker.saw(listOf("c3"))
        tracker.saw(listOf("p1", "p2"))
        tracker.flush()
        runCurrent()

        assertThat(history.calls).containsExactly(listOf("c3", "p1", "p2"))
        assertThat(tracker.queued()).isEmpty()
    }

    @Test
    fun `a flush carries at most a page of ids`() = runTest {
        signIn()
        val tracker = tracker()

        tracker.saw(ids(1..250))
        tracker.flush()
        runCurrent()

        assertThat(history.calls.map { it.size }).containsExactly(100, 100, 50).inOrder()
        assertThat(history.calls.flatten()).containsExactlyElementsIn(ids(1..250)).inOrder()
        assertThat(tracker.queued()).isEmpty()
    }

    @Test
    fun `a tripped batch is retried not lost`() = runTest {
        signIn()
        val tracker = tracker()
        history.answers += rateLimited

        tracker.saw(listOf("p1", "p2"))
        tracker.flush()
        runCurrent()
        // Refused: still queued, in order, and nothing surfaced anywhere.
        assertThat(tracker.queued()).containsExactly("p1", "p2").inOrder()

        tracker.saw(listOf("p3"))
        tracker.flush()
        runCurrent()

        assertThat(history.calls).containsExactly(listOf("p1", "p2"), listOf("p1", "p2", "p3")).inOrder()
        assertThat(tracker.queued()).isEmpty()
    }

    @Test
    fun `a failed transport keeps the batch queued`() = runTest {
        signIn()
        val tracker = tracker()
        history.answers += Outcome.Failed(IOException("offline"))

        tracker.saw(listOf("p1"))
        tracker.flush()
        runCurrent()

        assertThat(tracker.queued()).containsExactly("p1")
    }

    @Test
    fun `a refusal mid flush keeps the rest queued behind it`() = runTest {
        signIn()
        val tracker = tracker()
        history.answers += Outcome.Success(Unit)
        history.answers += rateLimited

        tracker.saw(ids(1..150))
        tracker.flush()
        runCurrent()
        // The first page landed; the second was refused and nothing after
        // it was tried, so the queue is that page, still in order.
        assertThat(history.calls.map { it.size }).containsExactly(100, 50).inOrder()
        assertThat(tracker.queued()).containsExactlyElementsIn(ids(101..150)).inOrder()

        tracker.flush()
        runCurrent()
        assertThat(history.calls.last()).containsExactlyElementsIn(ids(101..150)).inOrder()
        assertThat(tracker.queued()).isEmpty()
    }

    // A BATCH REFUSED FOR GOOD (PR-46: "we cant have a stalling session"): the
    // queue halves it down to the id at fault and drops that one alone.

    private val badInput = Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "no such node")))

    /** Refuses any batch holding a poison id, takes the rest; scripted answers go first. */
    private class PoisonedHistory(
        private vararg val poison: String,
        val first: ArrayDeque<Outcome<Unit>> = ArrayDeque(),
    ) : ViewHistoryRepository {
        val calls = mutableListOf<List<String>>()

        override suspend fun markSeen(nodeIds: List<String>): Outcome<Unit> {
            calls += nodeIds
            first.removeFirstOrNull()?.let { return it }
            return if (nodeIds.any { it in poison }) {
                Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "no such node")))
            } else {
                Outcome.Success(Unit)
            }
        }
    }

    private val log = mutableListOf<String>()

    @After
    fun silenceLog() = CograLog.uninstall()

    @Test
    fun `a batch refused for good is halved down to the one bad id, which alone is dropped`() = runTest {
        signIn()
        CograLog.install { _, message, _ -> log += message }
        val repo = PoisonedHistory("n37")
        val tracker = tracker(repo)

        tracker.saw(ids(0..99))
        tracker.flush()
        runCurrent()

        assertThat(tracker.queued()).isEmpty()
        assertThat(tracker.dropped()).containsExactly("n37")
        assertThat(repo.calls[0]).hasSize(100)
        assertThat(repo.calls[1]).hasSize(50)
        // Every other id landed, in order within what was delivered.
        val delivered = repo.calls.filter { "n37" !in it }.flatten()
        assertThat(delivered).containsExactlyElementsIn(ids(0..99) - "n37")
        // Bounded: about twice the depth of the halving, not a call per id.
        assertThat(repo.calls.size).isAtMost(16)
        // The writer is told which id went.
        assertThat(log).hasSize(1)
        assertThat(log.single()).contains("n37")
    }

    @Test
    fun `an id refused alone is dropped at once`() = runTest {
        signIn()
        val repo = PoisonedHistory("solo")
        val tracker = tracker(repo)

        tracker.saw(listOf("solo"))
        tracker.flush()
        runCurrent()

        assertThat(repo.calls).containsExactly(listOf("solo"))
        assertThat(tracker.queued()).isEmpty()
        assertThat(tracker.dropped()).containsExactly("solo")
    }

    @Test
    fun `a dropped id is never queued or sent again this session`() = runTest {
        signIn()
        val repo = PoisonedHistory("bad")
        val tracker = tracker(repo)
        tracker.saw(listOf("a", "bad", "b"))
        tracker.flush()
        runCurrent()
        val before = repo.calls.size

        tracker.saw(listOf("bad"))
        tracker.sawEdges("bad", top = true, bottom = true)
        tracker.flush()
        runCurrent()

        assertThat(tracker.queued()).isEmpty()
        assertThat(repo.calls).hasSize(before)
    }

    @Test
    fun `a transient answer never drops an id however often it comes`() = runTest {
        signIn()
        val tracker = tracker()
        tracker.saw(listOf("p1", "p2"))

        repeat(5) {
            history.answers += rateLimited
            history.answers += Outcome.Failed(IOException("offline"))
            history.answers += Outcome.Refused(listOf(UserError(ErrorCode.INTERNAL, "fault")))
            history.answers += Outcome.Refused(listOf(UserError(ErrorCode.UNKNOWN, "newer server")))
            repeat(4) {
                tracker.flush()
                runCurrent()
            }
        }

        assertThat(tracker.queued()).containsExactly("p1", "p2").inOrder()
        assertThat(tracker.dropped()).isEmpty()
    }

    @Test
    fun `a transient answer mid halving keeps the rest queued and the halving carries on`() = runTest {
        signIn()
        val repo = PoisonedHistory("bad")
        val tracker = tracker(repo)
        // The page is refused for good and halved; the half is then rate limited.
        repo.first += badInput
        repo.first += rateLimited

        tracker.saw(listOf("a", "b", "bad", "c"))
        tracker.flush()
        runCurrent()

        assertThat(repo.calls).containsExactly(listOf("a", "b", "bad", "c"), listOf("a", "b")).inOrder()
        assertThat(tracker.queued()).containsExactly("a", "b", "bad", "c").inOrder()
        assertThat(tracker.dropped()).isEmpty()

        tracker.flush()
        runCurrent()

        // It resumes at the half, not at the whole page.
        assertThat(repo.calls[2]).containsExactly("a", "b").inOrder()
        assertThat(tracker.queued()).isEmpty()
        assertThat(tracker.dropped()).containsExactly("bad")
    }

    @Test
    fun `another account starts with a whole page and nothing dropped`() = runTest {
        signIn("u1")
        val repo = PoisonedHistory("bad")
        val tracker = tracker(repo)
        repo.first += badInput
        repo.first += rateLimited
        tracker.saw(listOf("a", "bad"))
        tracker.flush()
        runCurrent()

        signIn("u2")
        runCurrent()
        tracker.saw(listOf("x", "y"))
        tracker.flush()
        runCurrent()

        assertThat(tracker.dropped()).isEmpty()
        assertThat(repo.calls.last()).containsExactly("x", "y").inOrder()
    }

    @Test
    fun `only BAD_INPUT is final`() {
        assertThat(FINAL_REFUSALS).containsExactly(ErrorCode.BAD_INPUT)
    }

    @Test
    fun `nothing is tracked without a session`() = runTest {
        val tracker = tracker()

        tracker.saw(listOf("p1"))
        tracker.flush()
        runCurrent()
        assertThat(tracker.queued()).isEmpty()
        assertThat(history.calls).isEmpty()

        // What was seen signed out does not wait for a session either.
        signIn()
        runCurrent()
        tracker.flush()
        runCurrent()
        assertThat(history.calls).isEmpty()
    }

    @Test
    fun `signing out drops what the session queued`() = runTest {
        signIn()
        val tracker = tracker()
        tracker.saw(listOf("p1"))

        session.tokens.value = null
        runCurrent()
        tracker.flush()
        runCurrent()

        assertThat(tracker.queued()).isEmpty()
        assertThat(history.calls).isEmpty()
    }

    @Test
    fun `another account starts with nothing queued and nothing remembered`() = runTest {
        signIn("u1")
        val tracker = tracker()
        tracker.saw(listOf("p1", "p2"))
        tracker.flush()
        runCurrent()

        signIn("u2")
        runCurrent()
        // u1 saw these; u2 has not, so they are u2's first seeing.
        tracker.saw(listOf("p1"))
        assertThat(tracker.queued()).containsExactly("p1")
    }

    @Test
    fun `a token refresh keeps the session's memory`() = runTest {
        signIn("u1", access = "a1")
        val tracker = tracker()
        tracker.saw(listOf("p1"))
        tracker.flush()
        runCurrent()

        signIn("u1", access = "a2")
        runCurrent()
        tracker.saw(listOf("p1", "p2"))

        assertThat(tracker.queued()).containsExactly("p2")
    }

    @Test
    fun `a batch out when the account changes is never settled against the next one`() = runTest {
        signIn("u1")
        val answer = CompletableDeferred<Outcome<Unit>>()
        val calls = mutableListOf<List<String>>()
        val slow = object : ViewHistoryRepository {
            override suspend fun markSeen(nodeIds: List<String>): Outcome<Unit> {
                calls += nodeIds
                return if (calls.size == 1) answer.await() else Outcome.Success(Unit)
            }
        }
        val tracker = tracker(slow)
        tracker.saw(listOf("p1"))
        tracker.flush()
        runCurrent()

        signIn("u2")
        runCurrent()
        tracker.saw(listOf("p2"))
        answer.complete(Outcome.Success(Unit))
        runCurrent()

        // u1's landed batch took nothing off u2's queue; u2's own went next.
        assertThat(calls).containsExactly(listOf("p1"), listOf("p2")).inOrder()
        assertThat(tracker.queued()).isEmpty()
    }

    // THE TALL-CARD RULE (History.md:13): a card taller than the viewport is
    // seen once both its top and its bottom edge have been on screen, not
    // necessarily at once. The surface reports edges frame by frame; the
    // book remembers the first for the session.

    @Test
    fun `a tall card is queued once its top and its bottom were reported in separate frames`() = runTest {
        signIn()
        val tracker = tracker()

        tracker.sawEdges("tall", top = true, bottom = false)
        assertThat(tracker.queued()).isEmpty()
        tracker.sawEdges("tall", top = false, bottom = true)

        assertThat(tracker.queued()).containsExactly("tall")
        tracker.flush()
        runCurrent()
        assertThat(history.calls).containsExactly(listOf("tall"))
    }

    @Test
    fun `a tall card reached from below joins bottom edge first`() = runTest {
        signIn()
        val tracker = tracker()

        tracker.sawEdges("tall", top = false, bottom = true)
        tracker.sawEdges("tall", top = false, bottom = true)
        tracker.sawEdges("tall", top = true, bottom = false)

        assertThat(tracker.queued()).containsExactly("tall")
    }

    @Test
    fun `a tall card that only ever showed one edge is never queued`() = runTest {
        signIn()
        val tracker = tracker()

        repeat(3) { tracker.sawEdges("tall", top = true, bottom = false) }
        tracker.sawEdges("tall", top = false, bottom = false)
        tracker.flush()
        runCurrent()

        assertThat(tracker.queued()).isEmpty()
        assertThat(history.calls).isEmpty()
    }

    @Test
    fun `a tall card already seen is not queued again by its edges`() = runTest {
        signIn()
        val tracker = tracker()
        tracker.sawEdges("tall", top = true, bottom = false)
        tracker.sawEdges("tall", top = false, bottom = true)
        tracker.flush()
        runCurrent()

        tracker.sawEdges("tall", top = true, bottom = false)
        tracker.sawEdges("tall", top = false, bottom = true)

        assertThat(tracker.queued()).isEmpty()
        assertThat(history.calls).containsExactly(listOf("tall"))
    }

    @Test
    fun `the session boundary forgets a tall card's remembered edge`() = runTest {
        signIn("u1")
        val tracker = tracker()
        tracker.sawEdges("tall", top = true, bottom = false)

        // Another account: u1's top edge is not u2's.
        signIn("u2")
        runCurrent()
        tracker.sawEdges("tall", top = false, bottom = true)
        assertThat(tracker.queued()).isEmpty()

        // Signed out and back in: the session that saw the bottom is gone.
        session.tokens.value = null
        runCurrent()
        signIn("u2")
        runCurrent()
        tracker.sawEdges("tall", top = true, bottom = false)
        assertThat(tracker.queued()).isEmpty()
    }

    @Test
    fun `no session records no edge`() = runTest {
        val tracker = tracker()
        tracker.sawEdges("tall", top = true, bottom = false)

        signIn()
        runCurrent()
        tracker.sawEdges("tall", top = false, bottom = true)

        assertThat(tracker.queued()).isEmpty()
    }
}
