package com.cogra.domain.testing

import com.cogra.domain.Outcome
import com.cogra.domain.history.ViewHistoryRepository

/**
 * The seen-list, recording: every `markSeen` call's ids in call order, and
 * a scriptable answer — success unless a test queues another outcome.
 */
class RecordingViewHistoryRepository : ViewHistoryRepository {
    val calls = mutableListOf<List<String>>()

    /** Answers for the next calls, in order; empty means success. */
    val answers = ArrayDeque<Outcome<Unit>>()

    override suspend fun markSeen(nodeIds: List<String>): Outcome<Unit> {
        calls += nodeIds
        return answers.removeFirstOrNull() ?: Outcome.Success(Unit)
    }
}
