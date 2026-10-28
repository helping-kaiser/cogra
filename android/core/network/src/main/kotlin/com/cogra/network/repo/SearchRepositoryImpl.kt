// The global search over the real contract (api-spec.md "Search",
// `Query.search`). A public read: the guard sends it anonymous for a guest
// and with the session's token for a reader, so `includeSeen` and `RANKED`
// have someone to read. web's twin is `web/src/lib/api/search-api.ts`.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.Outcome
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.map
import com.cogra.domain.search.SEARCH_KINDS
import com.cogra.domain.search.SearchAsk
import com.cogra.domain.search.SearchHit
import com.cogra.domain.search.SearchNode
import com.cogra.domain.search.SearchOrder
import com.cogra.domain.search.SearchPage
import com.cogra.domain.search.SearchRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.SearchQuery
import com.cogra.network.graphql.type.NodeKind
import com.cogra.network.graphql.type.ReadOrder
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SearchRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : SearchRepository {

    override suspend fun searchPage(ask: SearchAsk, after: String?): Outcome<SearchPage> = guard.run {
        val ranked = ask.order == SearchOrder.RANKED
        client.query(
            SearchQuery(
                query = ask.query,
                // In the list's own order, so one filter is always one request;
                // none on narrows nothing (null, every served kind).
                kinds = Optional.presentIfNotNull(
                    SEARCH_KINDS.filter { it in ask.kinds }.map { it.toWire() }.takeIf { it.isNotEmpty() },
                ),
                includeSeen = Optional.present(ask.includeSeen),
                order = Optional.present(if (ranked) ReadOrder.RANKED else ReadOrder.NEWEST),
                viewer = Optional.presentIfNotNull(ask.viewer.takeIf { ranked }),
                after = Optional.presentIfNotNull(after),
            ),
        ).fetch().map { data ->
            val page = data.search
            SearchPage(
                hits = page.edges.mapNotNull { edge -> edge.node.toDomain()?.let { SearchHit(it, edge.score) } },
                endCursor = page.pageInfo.endCursor,
                hasNextPage = page.pageInfo.hasNextPage,
                hasMorePeople = page.hasMorePeople,
            )
        }
    }
}

private const val NORMAL = "NORMAL"

private fun FeedKind.toWire(): NodeKind = when (this) {
    FeedKind.POST -> NodeKind.POST
    FeedKind.COMMENT -> NodeKind.COMMENT
    FeedKind.PROFILE -> NodeKind.USER
    FeedKind.TAG -> NodeKind.HASHTAG
}

/** A member of the union this build serves; null for one it cannot draw. */
private fun SearchQuery.Node.toDomain(): SearchNode? {
    onPost?.let { post ->
        return SearchNode.Post(
            id = post.id,
            title = post.title.value?.takeIf { post.title.status.rawValue != "REDACTED" },
            createdAt = post.createdAt,
            coverUrl = post.cover(),
        )
    }
    onComment?.let { comment ->
        return SearchNode.Comment(
            id = comment.id,
            content = comment.content.value,
            createdAt = comment.createdAt,
            threadPostId = comment.post?.id,
            threadPostTitle = comment.post?.title?.value,
        )
    }
    onUser?.let { user ->
        return SearchNode.Person(
            id = user.id,
            handle = user.handle,
            displayName = user.displayName.value,
            avatarUrl = user.avatar?.takeIf { it.status.rawValue == NORMAL }?.url,
        )
    }
    onHashtag?.let { tag -> return SearchNode.Tag(id = tag.id, name = tag.name.value) }
    return null
}

/**
 * A post's cover, unless its media is classified: then the text tile
 * (ExploreSearch.md: "a sensitive result stands … as the text T tile and
 * never its cover"). A clip shows its still; a picture itself.
 */
private fun SearchQuery.OnPost.cover(): String? {
    if (attachmentsStatus.rawValue != NORMAL) return null
    val first = attachments.firstOrNull() ?: return null
    if (first.status.rawValue != NORMAL) return null
    first.coverMedia?.let { cover -> return cover.url.takeIf { cover.status.rawValue == NORMAL } }
    return first.url.takeIf { first.mimeType.startsWith("image/") }
}
