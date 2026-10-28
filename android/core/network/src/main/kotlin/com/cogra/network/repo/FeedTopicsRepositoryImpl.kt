// The feed filter's One topic chips over the real contract (api-spec.md
// `User.heldTopics`; FeedSheet.md:29-35): the reader's held topics whose
// folded association is positive. The list comes strongest first, so the read
// pages on only while the last edge it holds is still held for, and stops at
// the first that is not. A redacted name never stands as a chip.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.FieldStatus
import com.cogra.domain.Outcome
import com.cogra.domain.feed.FeedTopic
import com.cogra.domain.feed.FeedTopicsRepository
import com.cogra.domain.feed.HELD_FOR_MAX_PAGES
import com.cogra.domain.feed.HeldEdge
import com.cogra.domain.feed.heldForOf
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.HeldTopicsQuery
import com.cogra.network.toDomain
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FeedTopicsRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : FeedTopicsRepository {

    override suspend fun heldFor(): Outcome<List<FeedTopic>> {
        val topics = mutableListOf<FeedTopic>()
        var after: String? = null
        repeat(HELD_FOR_MAX_PAGES) {
            val read = guard.run {
                client.query(HeldTopicsQuery(after = Optional.presentIfNotNull(after), includePending = true)).fetch()
            }
            val held = when (read) {
                is Outcome.Success -> read.value.me?.heldTopics ?: return Outcome.Success(topics)
                is Outcome.Refused -> return read
                is Outcome.Failed -> return read
            }
            val (page, more) = heldForOf(
                held.edges.map { edge ->
                    val name = edge.node.hashtagFields.name
                    val readable = name.value?.takeUnless { name.status.toDomain() == FieldStatus.REDACTED }
                    HeldEdge(readable?.let { FeedTopic(edge.node.hashtagFields.id, it) }, edge.pDirected)
                },
            )
            topics += page
            after = held.pageInfo.endCursor
            if (!more || !held.pageInfo.hasNextPage || after == null) return Outcome.Success(topics)
        }
        return Outcome.Success(topics)
    }
}
