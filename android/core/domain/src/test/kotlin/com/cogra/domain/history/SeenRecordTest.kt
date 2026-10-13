// The device's seen record (ranked-feed-api §4.3, §14.3; PR-51 persist,
// PR-52 sync, OS-22 cadence): durable per account, a cache of the server's
// seen-list kept fresh by the lazy delta sync past its watermark. The
// packet's underscore names render here in this module's backtick-sentence
// idiom.

package com.cogra.domain.history

import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.testing.FakeSeenRecordStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingViewHistoryRepository
import com.cogra.domain.testing.ScriptedSeenHistory
import com.google.common.truth.Truth.assertThat
import java.io.IOException
import java.time.Instant
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SeenRecordTest {

    private val session = FakeTokenStore()
    private val store = FakeSeenRecordStore()
    private val server = ScriptedSeenHistory()

    private val base: Instant = Instant.parse("2026-10-13T08:00:00Z")

    /** The session is [account]'s, and the server reads as them. */
    private fun signIn(account: String) {
        server.reader = account
        session.tokens.value = AuthTokens("a-$account", "r", account)
    }

    private fun signOut() {
        server.reader = null
        session.tokens.value = null
    }

    /** One process's record — a new one over the same [store] is a restart. Its session watch has run. */
    private fun TestScope.open(): SeenRecord = SeenRecord(store, server, session, backgroundScope).also { runCurrent() }

    /** [count] things [account] saw on the server, newest first: h(count-1) … h0. */
    private fun seededList(account: String, count: Int) {
        server.lists[account] = (count - 1 downTo 0)
            .map { SeenEntry("h$it", base.plusSeconds(it.toLong())) }
            .toMutableList()
    }

    @Test
    fun `a restart keeps the devices seen record`() = runTest {
        signIn("u1")
        val before = open()
        before.add("u1", listOf("p1", "p2"))
        runCurrent()

        // The process dies; the next one reads the same store. The server
        // has nothing (no markSeen went out), so only the device can know.
        val after = open()

        assertThat(after.seenIds()).containsExactly("p1", "p2")
    }

    @Test
    fun `a fresh sign in seeds the seen record from view history once`() = runTest {
        seededList("u1", count = 150)
        open()
        signIn("u1")
        runCurrent()

        // The seed is the whole list, newest page first: two pages of 100.
        assertThat(server.calls).containsExactly("u1" to null, "u1" to "100").inOrder()
        assertThat(store.records.getValue("u1").ids).hasSize(150)
        assertThat(store.records.getValue("u1").watermark).isEqualTo(SeenWatermark("h149", base.plusSeconds(149)))

        // The next open finds the watermark at the list's head: one page,
        // nothing new — never the burst again.
        server.calls.clear()
        val reopened = open()
        assertThat(server.calls).containsExactly("u1" to null)
        assertThat(reopened.seenIds()).hasSize(150)
    }

    @Test
    fun `the sync pulls only the delta past the watermark`() = runTest {
        seededList("u1", count = 250)
        signIn("u1")
        open()
        server.calls.clear()

        server.seenElsewhere("u1", "x1", base.plusSeconds(1_000))
        server.seenElsewhere("u1", "x2", base.plusSeconds(1_001))
        val reopened = open()

        assertThat(server.calls).containsExactly("u1" to null)
        assertThat(reopened.seenIds()).containsAtLeast("x1", "x2", "h249")
        assertThat(store.records.getValue("u1").watermark).isEqualTo(SeenWatermark("x2", base.plusSeconds(1_001)))
    }

    @Test
    fun `a thing seen on one device is cut on the other after its next open`() = runTest {
        signIn("u1")
        val phone = open()
        assertThat(phone.seenIds()).isEmpty()

        // Seen on the PC; the phone learns at its next open, not before.
        server.seenElsewhere("u1", "pc-post", base)
        assertThat(phone.seenIds()).doesNotContain("pc-post")

        assertThat(open().seenIds()).contains("pc-post")
    }

    @Test
    fun `an account switch keeps each accounts record apart`() = runTest {
        signIn("u1")
        val record = open()
        record.add("u1", listOf("p1"))
        runCurrent()

        signIn("u2")
        runCurrent()
        assertThat(record.seenIds()).isEmpty()
        record.add("u2", listOf("q1"))
        // A late report for the account that left is not the new one's.
        record.add("u1", listOf("p9"))
        runCurrent()
        assertThat(record.seenIds()).containsExactly("q1")

        signIn("u1")
        runCurrent()
        assertThat(record.seenIds()).containsExactly("p1")
        assertThat(store.records.getValue("u1").ids).containsExactly("p1")
        assertThat(store.records.getValue("u2").ids).containsExactly("q1")
    }

    @Test
    fun `a session less reader has no record and cuts nothing`() = runTest {
        signOut()
        val record = open()
        record.add("u1", listOf("p1"))
        runCurrent()

        assertThat(record.seenIds()).isEmpty()
        assertThat(store.records).isEmpty()
        assertThat(server.calls).isEmpty()
    }

    @Test
    fun `the own profile never enters the record`() = runTest {
        server.lists["u1"] = mutableListOf(SeenEntry("u1", base.plusSeconds(2)), SeenEntry("p0", base))
        signIn("u1")
        val record = open()
        record.add("u1", listOf("u1", "p1"))
        runCurrent()

        assertThat(record.seenIds()).containsExactly("p0", "p1")
    }

    /**
     * A sync cut short keeps the pages it pulled — the newest seeing is
     * already cut — and leaves the watermark, so the next open re-reads
     * down to the old one and misses nothing.
     */
    @Test
    fun `a sync cut short keeps what it pulled and leaves the watermark`() = runTest {
        seededList("u1", count = 150)
        server.faults.addLast(Outcome.Success(null))
        signIn("u1")
        val first = open()
        assertThat(first.seenIds()).isEmpty()

        // The second page faults: the first stays, the watermark does not move.
        server.calls.clear()
        val second = SeenRecord(store, FaultOnSecondPage(server), session, backgroundScope).also { runCurrent() }
        assertThat(second.seenIds()).hasSize(100)
        assertThat(store.records.getValue("u1").watermark).isNull()

        val third = open()
        assertThat(third.seenIds()).hasSize(150)
        assertThat(store.records.getValue("u1").watermark).isNotNull()
    }

    /** A page read under another session never lands in this account's record. */
    @Test
    fun `a page read as another reader is never written`() = runTest {
        seededList("u2", count = 3)
        signIn("u1")
        server.reader = "u2"
        val record = open()

        assertThat(record.seenIds()).isEmpty()
    }

    @Test
    fun `the trackers first seeing is written through to the accounts record`() = runTest {
        signIn("u1")
        val record = open()
        val tracker = SeenTracker(RecordingViewHistoryRepository(), session, backgroundScope, record)
        runCurrent()

        tracker.saw(listOf("p1", "p2"))
        tracker.sawEdges("tall", top = true, bottom = false)
        runCurrent()
        assertThat(record.seenIds()).containsExactly("p1", "p2")
        assertThat(store.records.getValue("u1").ids).containsExactly("p1", "p2")

        tracker.sawEdges("tall", top = false, bottom = true)
        runCurrent()
        assertThat(store.records.getValue("u1").ids).containsExactly("p1", "p2", "tall")
    }

    private class FaultOnSecondPage(private val inner: SeenHistorySource) : SeenHistorySource {
        private var served = 0

        override suspend fun seenPage(first: Int, after: String?): Outcome<SeenPage?> =
            if (served++ == 1) Outcome.Failed(IOException("offline")) else inner.seenPage(first, after)
    }
}
