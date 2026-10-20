package com.cogra.domain.testing

import com.cogra.domain.Outcome
import com.cogra.domain.saved.SavedPage
import com.cogra.domain.saved.SavedRepository
import java.time.Instant

/** One read of the Saved list: the search it narrowed by (null = none) and the cursor it asked after. */
data class SavedRead(val query: String?, val after: String?)

/**
 * The Saved list, recording: every keep (with the restore time an Undo
 * passed) and every drop, in call order, with scriptable answers — success
 * unless a test queues another outcome — and the pages the reads serve.
 */
class RecordingSavedRepository : SavedRepository {
    val sets = mutableListOf<Pair<String, Instant?>>()
    val removes = mutableListOf<String>()

    /** Answers for the next keeps, in order; empty means kept at [keptAt]. */
    val setAnswers = ArrayDeque<Outcome<Instant>>()

    /** Answers for the next drops, in order; empty means dropped. */
    val removeAnswers = ArrayDeque<Outcome<Unit>>()

    /** The pages the reads serve, by the search and the cursor asked after; unscripted reads serve an empty end. */
    val pages = mutableMapOf<SavedRead, Outcome<SavedPage?>>()

    /** Every read asked, in call order. */
    val reads = mutableListOf<SavedRead>()

    var keptAt: Instant = Instant.parse("2026-10-13T12:00:00Z")

    override suspend fun setBookmark(node: String, at: Instant?): Outcome<Instant> {
        sets += node to at
        return setAnswers.removeFirstOrNull() ?: Outcome.Success(at ?: keptAt)
    }

    override suspend fun removeBookmark(node: String): Outcome<Unit> {
        removes += node
        return removeAnswers.removeFirstOrNull() ?: Outcome.Success(Unit)
    }

    override suspend fun savedPage(query: String?, after: String?): Outcome<SavedPage?> {
        val read = SavedRead(query, after)
        reads += read
        return pages[read] ?: Outcome.Success(SavedPage(emptyList(), endCursor = null, hasNextPage = false))
    }
}
