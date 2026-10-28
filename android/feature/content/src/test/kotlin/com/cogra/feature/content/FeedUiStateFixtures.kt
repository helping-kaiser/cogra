// A feed state stood up from posts alone — the shape every feed screen test
// that predates the four kinds scripts. The state holds cards of every kind
// (FeedKinds.md); a list of posts is that list's post cards, in order.

package com.cogra.feature.content

import com.cogra.domain.PostView
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.feed.FeedCard
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.feed.FeedRow

/** [FeedUiState] whose cards are [posts], each as its post card. */
@Suppress("FunctionNaming", "LongParameterList")
internal fun FeedUiState(
    posts: List<PostView>,
    loading: Boolean = true,
    hasNextPage: Boolean = false,
    loadingMore: Boolean = false,
    transportFault: TransportFault? = null,
    reveals: Map<String, SensitiveMark> = emptyMap(),
    filter: FeedFilter = FeedFilter.DEFAULT,
    ranking: FeedRanking? = null,
    rows: List<FeedRow> = emptyList(),
    seenTail: Set<String> = emptySet(),
): FeedUiState = FeedUiState(
    loading = loading,
    cards = posts.map(FeedCard::Post),
    hasNextPage = hasNextPage,
    loadingMore = loadingMore,
    transportFault = transportFault,
    reveals = reveals,
    filter = filter,
    ranking = ranking,
    rows = rows,
    seenTail = seenTail,
)
