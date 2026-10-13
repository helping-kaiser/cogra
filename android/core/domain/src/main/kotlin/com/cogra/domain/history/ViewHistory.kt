// The seen-list's client side (api-spec.md `markSeen`, `User.viewHistory`):
// the reader's private record of what has been fully on their screen.
// L2 viewer state, never a graph record and never a signed act.

package com.cogra.domain.history

import com.cogra.domain.Outcome
import java.time.Instant

/**
 * The most ids one `markSeen` call carries: a page (`client-constants.json`
 * `paging.maxPageSize`). The server refuses a longer list as BAD_INPUT, so a
 * longer queue goes out as several calls.
 */
const val MAX_SEEN_BATCH = 100

/** The seen-list over the contract. */
interface ViewHistoryRepository {
    /**
     * Records that the viewer has seen [nodeIds], in the order given —
     * at most [MAX_SEEN_BATCH] of them. Success means the batch was
     * written; a node already on the list, or an id naming nothing
     * seeable, is skipped by the server and is still a success.
     */
    suspend fun markSeen(nodeIds: List<String>): Outcome<Unit>
}

/** One thing on the seen-list: its id and when the reader first saw it. */
data class SeenEntry(val nodeId: String, val firstSeenAt: Instant)

/** One page of the seen-list, newest first by first seeing. */
data class SeenPage(
    /**
     * Whose list it is — the account the session read it as. A sync checks
     * it against the record it writes into, so a page read across an
     * account switch never lands in the wrong account's record.
     */
    val reader: String,
    val entries: List<SeenEntry>,
    val endCursor: String?,
    val hasNextPage: Boolean,
)

/**
 * The seen-list read the device's seen record syncs from (`User.viewHistory`,
 * ids only — history packet F5's cheap form, revived by PR-52/OS-22).
 */
interface SeenHistorySource {
    /**
     * The page of the reader's own seen-list after [after], newest first,
     * at most [first] things of every kind History serves. Success(null)
     * when there is no signed-in reader to read for.
     */
    suspend fun seenPage(first: Int, after: String?): Outcome<SeenPage?>
}
