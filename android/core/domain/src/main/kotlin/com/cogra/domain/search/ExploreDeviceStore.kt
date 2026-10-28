// WHAT EXPLORE KEEPS ON THE DEVICE (Explore.md:21-33; ExploreFilter.md; the
// filter's "?": "It lasts until you change it, on this device only"). web's
// twin is `web/src/lib/search/recents.ts` and the committed-filter half of
// `search-filter.ts`.
//
// KEPT ON THE DEVICE AND NEVER AS A RECORD (Explore.md:21), PER ACCOUNT, a
// guest's under the guest key and never carried into an account (:31). The
// recents are CLEARED AT SIGN-OUT (:31) so a shared device never shows the
// next reader what the last one looked for.

package com.cogra.domain.search

import kotlinx.coroutines.flow.Flow

/** How many recent searches are kept (Explore.md:27). */
const val RECENTS_KEPT = 10

/** Explore's device-local memory: the recent searches and the committed filter, per account. */
interface ExploreDeviceStore {
    /** [account]'s recent searches, newest first; null is the guest's. */
    fun recents(account: String?): Flow<List<String>>

    /** Writes [query] into [account]'s recents ([withRecent]); a blank query changes nothing. */
    suspend fun rememberSearch(account: String?, query: String)

    /** Drops [account]'s recents — the sign-out's. */
    suspend fun forgetRecents(account: String?)

    /** The filter [account] last committed on this device, or null. */
    suspend fun committedFilter(account: String?): SearchFilter?

    suspend fun commitFilter(account: String?, filter: SearchFilter)
}

/**
 * The list with [query] written in (Explore.md:27): trimmed, at the top, any
 * earlier entry equal to it case aside dropped, ten kept. The query is kept
 * as it was last typed. A blank query changes nothing.
 */
fun withRecent(list: List<String>, query: String): List<String> {
    val asked = query.trim()
    if (asked.isEmpty()) return list
    val folded = asked.lowercase()
    return (listOf(asked) + list.filter { it.lowercase() != folded }).take(RECENTS_KEPT)
}

/**
 * The key a recent row is registered by (nodes.json `explore.recent`): the
 * query's words lowercased, each run of other characters one `-`, none
 * leading or trailing.
 */
fun recentNodeKey(query: String): String =
    query.lowercase().replace(NOT_A_WORD, "-").trim('-')

private val NOT_A_WORD = Regex("[^\\p{L}\\p{N}]+")
