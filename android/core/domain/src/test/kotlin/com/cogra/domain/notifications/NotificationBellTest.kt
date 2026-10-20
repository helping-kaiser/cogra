package com.cogra.domain.notifications

import com.cogra.domain.Outcome
import com.cogra.domain.testing.RecordingNotificationsRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.io.IOException
import java.time.Instant

/** The bell's dot and the silent marks (FeedUnread.md; packet §6.4 K4.1); web's twin is `bell.test.tsx`. */
class NotificationBellTest {
    private val repository = RecordingNotificationsRepository()
    private val bell = NotificationBell(repository)

    @Test
    fun `a fresh root load lights the bell when something arrived`() = runTest {
        repository.bellAnswers += Outcome.Success(true)
        bell.freshRootLoad()
        assertThat(bell.lit.value).isTrue()
    }

    @Test
    fun `an arrival while on a root never lights the bell live`() = runTest {
        repository.bellAnswers += Outcome.Success(false)
        bell.freshRootLoad()
        // Something arrives on the server; nothing asks until the next fresh load.
        repository.bellAnswers += Outcome.Success(true)
        assertThat(bell.lit.value).isFalse()
        assertThat(repository.bellAsks).isEqualTo(1)
    }

    @Test
    fun `a failed ask changes nothing`() = runTest {
        repository.bellAnswers += Outcome.Success(true)
        bell.freshRootLoad()
        repository.bellAnswers += Outcome.Failed(IOException("down"))
        bell.freshRootLoad()
        assertThat(bell.lit.value).isTrue()
    }

    @Test
    fun `opening the list clears the bell`() = runTest {
        repository.bellAnswers += Outcome.Success(true)
        bell.freshRootLoad()
        bell.listOpened()
        assertThat(bell.lit.value).isFalse()
    }

    @Test
    fun `a failed mark is retried silently`() = runTest {
        val through = Instant.parse("2026-10-14T10:00:00Z")
        // Down for the seen mark and for the read mark's own flush, which
        // retries the seen mark it still owes.
        repository.seenAnswers += Outcome.Failed(IOException("down"))
        repository.seenAnswers += Outcome.Failed(IOException("down"))
        repository.readAnswers += Outcome.Failed(IOException("down"))
        bell.markSeen(through)
        bell.markRead("n1")
        assertThat(bell.owed()).isEqualTo(through to listOf("n1"))
        // The next checkpoint — the list opening again — sends what is owed.
        bell.listOpened()
        assertThat(bell.owed()).isEqualTo(null to emptyList<String>())
        assertThat(repository.reads).containsExactly("n1", "n1")
    }

    @Test
    fun `the seen pointer is only ever moved forward`() = runTest {
        val later = Instant.parse("2026-10-14T10:00:00Z")
        repository.seenAnswers += Outcome.Failed(IOException("down"))
        bell.markSeen(later)
        repository.seenAnswers += Outcome.Failed(IOException("down"))
        bell.markSeen(later.minusSeconds(60))
        assertThat(bell.owed().first).isEqualTo(later)
    }
}
