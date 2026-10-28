package com.cogra.domain.testing

import com.cogra.domain.Outcome
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.history.HistoryPage
import com.cogra.domain.history.HistoryRepository
import kotlinx.coroutines.CompletableDeferred

/** One read of History: the search it narrowed by (null = none), the kinds, and the cursor it asked after. */
data class HistoryRead(val query: String?, val kinds: Set<FeedKind>, val after: String?)

/**
 * History's read, scripted: the pages each read serves, by its search, its
 * kinds and its cursor, and every read asked in call order. A read can be
 * HELD on a [CompletableDeferred] so a test lands answers out of order — the
 * stale-answer guard's case.
 */
class ScriptedHistoryRepository : HistoryRepository {
    /** The pages the reads serve; unscripted reads serve an empty end. */
    val pages = mutableMapOf<HistoryRead, Outcome<HistoryPage?>>()

    /** Reads that wait until the test completes their answer. */
    val held = mutableMapOf<HistoryRead, CompletableDeferred<Outcome<HistoryPage?>>>()

    /** Every read asked, in call order. */
    val reads = mutableListOf<HistoryRead>()

    override suspend fun historyPage(query: String?, kinds: Set<FeedKind>, after: String?): Outcome<HistoryPage?> {
        val read = HistoryRead(query, kinds, after)
        reads += read
        held[read]?.let { return it.await() }
        return pages[read] ?: Outcome.Success(HistoryPage(emptyList(), endCursor = null, hasNextPage = false))
    }
}
