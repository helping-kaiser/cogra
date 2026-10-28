package com.cogra.domain.testing

import com.cogra.domain.Outcome
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.removal.RemovalKind
import com.cogra.domain.removal.RemovalRepository
import kotlinx.coroutines.CompletableDeferred
import java.time.Instant

/**
 * The removal, scripted: every record asked and every node re-read, in call
 * order. A removal is taken unless a test queues another answer — or holds
 * the next one open with [hold], to stand the in-flight state up — and the
 * re-read answers the AUTHOR mark at [removedAt] unless one is queued.
 */
class ScriptedRemovalRepository : RemovalRepository {
    val records = mutableListOf<String>()
    val reads = mutableListOf<Pair<RemovalKind, String>>()

    /** Answers for the next removals, in order; empty means taken at [removedAt]. */
    val answers = ArrayDeque<Outcome<Instant?>>()

    /** Answers for the next re-reads, in order; empty means the AUTHOR mark at [removedAt]. */
    val readAnswers = ArrayDeque<Outcome<Removal?>>()

    /** Non-null: the next removal waits on this before it answers. */
    var hold: CompletableDeferred<Unit>? = null

    var removedAt: Instant = Instant.parse("2026-10-28T12:00:00Z")

    override suspend fun removeContent(record: String): Outcome<Instant?> {
        records += record
        hold?.await()
        return answers.removeFirstOrNull() ?: Outcome.Success(removedAt)
    }

    override suspend fun removal(kind: RemovalKind, id: String): Outcome<Removal?> {
        reads += kind to id
        return readAnswers.removeFirstOrNull() ?: Outcome.Success(Removal(removedAt, RemovalAgent.AUTHOR))
    }
}
