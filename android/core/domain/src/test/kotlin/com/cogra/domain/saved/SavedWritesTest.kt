// The Saved overlay's ordering law (saved-surface packet, "Optimistic write
// queue"): one write in flight per node, the newest intent wins, a failure
// reverts to what the server last confirmed, and the overlay belongs to one
// account. web's twin is `saved-writes.test.ts`, test for test.

package com.cogra.domain.saved

import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.testing.FakeTokenStore
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.io.IOException
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class SavedWritesTest {

    private val now = Instant.parse("2026-10-13T12:00:00Z")
    private val earlier = Instant.parse("2026-10-01T00:00:00Z")
    private val session = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") }

    /** A repository whose answers the test releases one by one. */
    private class Scripted : SavedRepository {
        val sent = mutableListOf<String>()
        val answers = ArrayDeque<CompletableDeferred<Boolean>>()

        private suspend fun next(): Boolean = CompletableDeferred<Boolean>().also { answers.addLast(it) }.await()

        override suspend fun setBookmark(node: String, at: Instant?): Outcome<Instant> {
            sent += "keep $node ${at ?: "now"}"
            return if (next()) Outcome.Success(at ?: Instant.parse("2026-10-13T12:00:00Z")) else Outcome.Failed(IOException("down"))
        }

        override suspend fun removeBookmark(node: String): Outcome<Unit> {
            sent += "drop $node"
            return if (next()) Outcome.Success(Unit) else Outcome.Failed(IOException("down"))
        }

        override suspend fun savedPage(after: String?) = Outcome.Success<SavedPage?>(null)

        fun answer(ok: Boolean) {
            answers.removeFirst().complete(ok)
        }
    }

    private fun TestScope.writes(repo: Scripted): SavedWrites =
        SavedWrites(repo, session, backgroundScope).also {
            it.now = { now }
            runCurrent()
        }

    @Test
    fun `answers at the tap before the server does`() = runTest {
        val repo = Scripted()
        val writes = writes(repo)
        writes.keep("p1", server = null)
        assertThat(writes.overlay.value.kept("p1", null)).isEqualTo(now)
        writes.drop("p2", server = earlier)
        assertThat(writes.overlay.value.kept("p2", earlier)).isNull()
    }

    @Test
    fun `unsave then undo sends in order`() = runTest {
        val repo = Scripted()
        val writes = writes(repo)
        writes.drop("p1", server = earlier)
        writes.keep("p1", server = null, at = earlier, kind = ComfortKind.RESTORE)
        runCurrent()
        // The Undo waits behind the unsave: never two writes on one node at once.
        assertThat(repo.sent).containsExactly("drop p1")
        repo.answer(true)
        runCurrent()
        assertThat(repo.sent).containsExactly("drop p1", "keep p1 $earlier").inOrder()
        repo.answer(true)
        runCurrent()
        assertThat(writes.overlay.value.kept("p1", null)).isEqualTo(earlier)
    }

    @Test
    fun `a newer intent supersedes a queued one`() = runTest {
        val repo = Scripted()
        val writes = writes(repo)
        writes.keep("p1", server = null)
        writes.drop("p1", server = null)
        writes.keep("p1", server = null)
        writes.drop("p1", server = null)
        runCurrent()
        repo.answer(true)
        runCurrent()
        // The two in the middle were never sent.
        assertThat(repo.sent).containsExactly("keep p1 now", "drop p1").inOrder()
        repo.answer(true)
        runCurrent()
        assertThat(writes.overlay.value.kept("p1", null)).isNull()
    }

    @Test
    fun `a failed unsave reverts the row`() = runTest {
        val repo = Scripted()
        val writes = writes(repo)
        val reverted = mutableListOf<Pair<String, ComfortKind>>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            writes.reverts.collect { reverted += it }
        }
        writes.drop("p1", server = earlier)
        runCurrent()
        repo.answer(false)
        runCurrent()
        assertThat(writes.overlay.value.kept("p1", earlier)).isEqualTo(earlier)
        assertThat(writes.overlay.value.failure("p1")).isEqualTo(ComfortKind.UNSAVE)
        assertThat(reverted).containsExactly("p1" to ComfortKind.UNSAVE)
    }

    @Test
    fun `retry asks the same comfort again`() = runTest {
        val repo = Scripted()
        val writes = writes(repo)
        writes.keep("p1", server = null)
        runCurrent()
        repo.answer(false)
        runCurrent()
        assertThat(writes.overlay.value.kept("p1", null)).isNull()
        writes.retry("p1")
        // The line goes the moment the comfort is asked again.
        assertThat(writes.overlay.value.failure("p1")).isNull()
        assertThat(writes.overlay.value.kept("p1", null)).isEqualTo(now)
        runCurrent()
        assertThat(repo.sent).containsExactly("keep p1 now", "keep p1 now").inOrder()
        repo.answer(true)
        runCurrent()
        assertThat(writes.overlay.value.kept("p1", null)).isEqualTo(now)
    }

    @Test
    fun `a failed undo records a restore failure`() = runTest {
        val repo = Scripted()
        val writes = writes(repo)
        writes.drop("p1", server = earlier)
        runCurrent()
        repo.answer(true)
        runCurrent()
        writes.keep("p1", server = null, at = earlier, kind = ComfortKind.RESTORE)
        runCurrent()
        repo.answer(false)
        runCurrent()
        assertThat(writes.overlay.value.kept("p1", earlier)).isNull()
        assertThat(writes.overlay.value.failure("p1")).isEqualTo(ComfortKind.RESTORE)
    }

    @Test
    fun `a fresh load clears the lines and steps aside`() = runTest {
        val repo = Scripted()
        val writes = writes(repo)
        writes.keep("p1", server = null)
        runCurrent()
        repo.answer(false)
        runCurrent()
        writes.settle()
        assertThat(writes.overlay.value.failure("p1")).isNull()
        assertThat(writes.overlay.value.kept("p1", earlier)).isEqualTo(earlier)
    }

    @Test
    fun `the overlay belongs to the signed in account`() = runTest {
        val repo = Scripted()
        val writes = writes(repo)
        writes.drop("p1", server = earlier)
        session.tokens.value = AuthTokens("a2", "r2", "u2")
        runCurrent()
        assertThat(writes.overlay.value.kept("p1", earlier)).isEqualTo(earlier)
    }
}
