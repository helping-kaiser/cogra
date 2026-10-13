// The seen-list over the real contract (api-spec.md `markSeen`,
// `User.viewHistory`). A rate-limited batch arrives as a RATE_LIMITED
// refusal (Mapping.kt's transport translation), which the tracker keeps
// queued like any other outcome but success. The read is the seen record's
// sync: ids and first seenings only.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.Outcome
import com.cogra.domain.history.SeenEntry
import com.cogra.domain.history.SeenHistorySource
import com.cogra.domain.history.SeenPage
import com.cogra.domain.history.ViewHistoryRepository
import com.cogra.domain.map
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.MarkSeenMutation
import com.cogra.network.graphql.SeenHistoryQuery
import com.cogra.network.payloadOutcome
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ViewHistoryRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : ViewHistoryRepository, SeenHistorySource {

    override suspend fun markSeen(nodeIds: List<String>): Outcome<Unit> = guard.run {
        client.mutation(MarkSeenMutation(nodeIds))
            .payloadOutcome({ it.markSeen.userErrors.map { e -> e.userErrorFields } }) {
                // `ok` is null exactly when a userError refused the batch.
                if (it.markSeen.ok == true) Unit else null
            }
    }

    override suspend fun seenPage(first: Int, after: String?): Outcome<SeenPage?> = guard.run {
        client.query(SeenHistoryQuery(first = first, after = Optional.presentIfNotNull(after)))
            .fetch()
            .map { data ->
                val me = data.me ?: return@map null
                val history = me.viewHistory ?: return@map null
                SeenPage(
                    reader = me.id,
                    entries = history.edges.mapNotNull { edge ->
                        val node = edge.node
                        val id = node.onPost?.id ?: node.onComment?.id ?: node.onUser?.id ?: node.onHashtag?.id
                        id?.let { SeenEntry(it, edge.firstSeenAt) }
                    },
                    endCursor = history.pageInfo.endCursor,
                    hasNextPage = history.pageInfo.hasNextPage,
                )
            }
    }
}
