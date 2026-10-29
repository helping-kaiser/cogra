// History's own read over the real contract (api-spec.md `User.viewHistory`):
// every seen thing as its kind's own feed card reads it. Authenticated-only
// and never member-gated: an applicant's History reads like a member's.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.Outcome
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.history.HISTORY_KINDS
import com.cogra.domain.history.HistoryCard
import com.cogra.domain.history.HistoryEntry
import com.cogra.domain.history.HistoryPage
import com.cogra.domain.history.HistoryRepository
import com.cogra.domain.map
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.HistoryPageQuery
import com.cogra.network.toDomain
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HistoryRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : HistoryRepository {

    override suspend fun historyPage(query: String?, kinds: Set<FeedKind>, after: String?): Outcome<HistoryPage?> =
        guard.run {
            // No chip on is every kind History serves (HistoryFilter.md:9): sent as null.
            val narrowed = HISTORY_KINDS.filter { it in kinds }.map { it.toWire() }.ifEmpty { null }
            client.query(
                HistoryPageQuery(
                    query = Optional.presentIfNotNull(query),
                    kinds = Optional.presentIfNotNull(narrowed),
                    after = Optional.presentIfNotNull(after),
                ),
            )
                .fetch()
                .map { data ->
                    val history = data.me?.viewHistory ?: return@map null
                    HistoryPage(
                        entries = history.edges.mapNotNull { edge ->
                            edge.node.toCard()?.let { HistoryEntry(it, edge.firstSeenAt) }
                        },
                        endCursor = history.pageInfo.endCursor,
                        hasNextPage = history.pageInfo.hasNextPage,
                        hasMorePeople = history.hasMorePeople,
                        hasMoreTags = history.hasMoreTags,
                    )
                }
        }
}

/** Each seen thing as its kind's own feed card reads it (History.md:19-21); a kind a later slice adds waits. */
private fun HistoryPageQuery.Node.toCard(): HistoryCard? {
    onPost?.let { post ->
        return HistoryCard.Post(post.postFields.toDomain().copy(commentCount = post.commentCount.totalCount))
    }
    onComment?.let { comment ->
        return HistoryCard.Comment(
            comment = comment.commentFields.toDomain(),
            target = comment.target?.commentHeadFields?.toTarget(),
            threadPostId = comment.post?.id,
        )
    }
    onUser?.let { user -> return HistoryCard.Person(user.profileFields.toDomain()) }
    onHashtag?.let { tag -> return HistoryCard.Tag(tag.tagCardFields.toTopic()) }
    return null
}
