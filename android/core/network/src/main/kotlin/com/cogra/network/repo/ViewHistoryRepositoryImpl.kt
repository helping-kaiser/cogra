// The seen-list over the real contract (api-spec.md `markSeen`). A
// rate-limited batch arrives as a RATE_LIMITED refusal (Mapping.kt's
// transport translation), which the tracker keeps queued like any other
// outcome but success.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.history.ViewHistoryRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.graphql.MarkSeenMutation
import com.cogra.network.payloadOutcome
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ViewHistoryRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : ViewHistoryRepository {

    override suspend fun markSeen(nodeIds: List<String>): Outcome<Unit> = guard.run {
        client.mutation(MarkSeenMutation(nodeIds))
            .payloadOutcome({ it.markSeen.userErrors.map { e -> e.userErrorFields } }) {
                // `ok` is null exactly when a userError refused the batch.
                if (it.markSeen.ok == true) Unit else null
            }
    }
}
