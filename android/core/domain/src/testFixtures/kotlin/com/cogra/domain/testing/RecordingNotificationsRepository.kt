package com.cogra.domain.testing

import com.cogra.domain.Outcome
import com.cogra.domain.notifications.NotificationPage
import com.cogra.domain.notifications.NotificationsRepository
import java.time.Instant

/**
 * The notification list, recording: every seen mark and every read mark, in
 * call order, with scriptable answers — success unless a test queues another
 * outcome — the pages the read serves, and the bell's answers.
 */
class RecordingNotificationsRepository : NotificationsRepository {
    val seen = mutableListOf<Instant>()
    val reads = mutableListOf<String>()
    var bellAsks = 0

    /** The pages the read serves, by the cursor asked after (null = the first). */
    val pages = mutableMapOf<String?, Outcome<NotificationPage?>>()

    /** The bell's answers, in order; empty means quiet. */
    val bellAnswers = ArrayDeque<Outcome<Boolean?>>()

    /** Answers for the next seen marks; empty means gone through. */
    val seenAnswers = ArrayDeque<Outcome<Boolean>>()

    /** Answers for the next read marks; empty means gone through. */
    val readAnswers = ArrayDeque<Outcome<Instant>>()

    override suspend fun page(after: String?): Outcome<NotificationPage?> =
        pages[after] ?: Outcome.Success(NotificationPage(emptyList(), endCursor = null, hasNextPage = false))

    override suspend fun hasUnread(): Outcome<Boolean?> {
        bellAsks += 1
        return bellAnswers.removeFirstOrNull() ?: Outcome.Success(false)
    }

    override suspend fun markSeen(through: Instant): Outcome<Boolean> {
        seen += through
        return seenAnswers.removeFirstOrNull() ?: Outcome.Success(false)
    }

    override suspend fun markRead(id: String): Outcome<Instant> {
        reads += id
        return readAnswers.removeFirstOrNull() ?: Outcome.Success(Instant.parse("2026-10-14T12:00:00Z"))
    }
}
