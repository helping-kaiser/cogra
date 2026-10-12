// The seen-list's client side (api-spec.md `markSeen`, `User.viewHistory`):
// the reader's private record of what has been fully on their screen.
// L2 viewer state, never a graph record and never a signed act.

package com.cogra.domain.history

import com.cogra.domain.Outcome

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
