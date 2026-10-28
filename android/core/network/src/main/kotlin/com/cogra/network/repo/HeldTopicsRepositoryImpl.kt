// The topics the reader holds over the real contract (api-spec.md
// `User.heldTopics`): the count Explore's Your-topics door reads and the list
// the door opens. Viewer-only — no session, no list. The pending half rides
// along (`includePending: true`, the field's default), so the door counts
// exactly the rows the list shows.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.Outcome
import com.cogra.domain.map
import com.cogra.domain.topics.HeldTopic
import com.cogra.domain.topics.HeldTopicsPage
import com.cogra.domain.topics.HeldTopicsRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.HeldTopicsCountQuery
import com.cogra.network.graphql.HeldTopicsQuery
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HeldTopicsRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : HeldTopicsRepository {

    override suspend fun heldCount(): Outcome<Int?> = guard.run {
        client.query(HeldTopicsCountQuery(includePending = true)).fetch()
            .map { data -> data.me?.heldTopics?.totalCount }
    }

    override suspend fun heldPage(after: String?): Outcome<HeldTopicsPage?> = guard.run {
        client.query(HeldTopicsQuery(after = Optional.presentIfNotNull(after), includePending = true)).fetch()
            .map { data ->
                val held = data.me?.heldTopics ?: return@map null
                HeldTopicsPage(
                    topics = held.edges.mapNotNull { edge ->
                        edge.node.hashtagFields.name.value?.let { name ->
                            HeldTopic(name, edge.pDirected, edge.pInterest, edge.pending)
                        }
                    },
                    endCursor = held.pageInfo.endCursor,
                    hasNextPage = held.pageInfo.hasNextPage,
                )
            }
    }
}
