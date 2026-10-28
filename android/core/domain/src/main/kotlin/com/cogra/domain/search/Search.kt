// The global search's client side (api-spec.md "Search", `Query.search`;
// slice 2.7). A public read: a guest searches too, and a signed-in reader's
// session rides along so `includeSeen` and `RANKED` have someone to read.
// web's twin is `web/src/lib/api/search-api.ts`.

package com.cogra.domain.search

import com.cogra.domain.Outcome
import com.cogra.domain.feed.FeedKind
import java.time.Instant

/** The search over the contract. */
interface SearchRepository {
    /**
     * A page of [ask]'s results after [after]. A page continues the ask its
     * first page answered, so [after] must come from a page read with the
     * same [ask].
     */
    suspend fun searchPage(ask: SearchAsk, after: String?): Outcome<SearchPage>
}

/** The filter's two orders (`OrderSection.jsx` `FILTER_ORDER`). */
enum class SearchOrder { RANKED, NEWEST }

/** One search, as the wire asks it. */
data class SearchAsk(
    val query: String,
    /** The kinds on; empty narrows nothing (every served kind). */
    val kinds: Set<FeedKind>,
    val includeSeen: Boolean,
    val order: SearchOrder,
    /** The reader, for RANKED; null under NEWEST and for a guest. */
    val viewer: String?,
)

/** One page of results, in the order served — sectioned people, topics, content. */
data class SearchPage(
    val hits: List<SearchHit>,
    val endCursor: String?,
    val hasNextPage: Boolean,
    /** More people match than the people section serves: the `See all profiles` door. */
    val hasMorePeople: Boolean,
)

/** One result and the viewer's score of it — null past a seam and under NEWEST. */
data class SearchHit(val node: SearchNode, val score: Double?)

/** One result, as the `SearchResult` union serves it. */
sealed interface SearchNode {
    val id: String

    data class Post(
        override val id: String,
        /** Null when the title is redacted or the post is untitled. */
        val title: String?,
        val createdAt: Instant,
        /** The row's mark: the cover, or null when there is none or it is classified. */
        val coverUrl: String?,
    ) : SearchNode

    data class Comment(
        override val id: String,
        val content: String?,
        val createdAt: Instant,
        /** The thread's root post the comment is found through; null when none resolves. */
        val threadPostId: String?,
        val threadPostTitle: String?,
    ) : SearchNode

    data class Person(
        override val id: String,
        val handle: String,
        val displayName: String?,
        /** Null when there is none or it is classified: the monogram stands. */
        val avatarUrl: String?,
    ) : SearchNode

    data class Tag(override val id: String, val name: String?) : SearchNode
}
