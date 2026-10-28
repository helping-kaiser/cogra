// The author's Remove over the real contract (api-spec.md `removeContent`)
// and the node re-read that brings its mark back (`PostRemoval`,
// `CommentRemoval`). Every refusal is a userError on the payload; a lost
// answer is a transport failure — the confirm reads both as one state.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.Removal
import com.cogra.domain.flatMap
import com.cogra.domain.map
import com.cogra.domain.removal.RemovalKind
import com.cogra.domain.removal.RemovalRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.CommentRemovalQuery
import com.cogra.network.graphql.PostRemovalQuery
import com.cogra.network.graphql.RemoveContentMutation
import com.cogra.network.payload
import com.cogra.network.removalOf
import com.cogra.network.toDomain
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RemovalRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : RemovalRepository {

    override suspend fun removeContent(record: String): Outcome<Instant?> = guard.run {
        client.mutation(RemoveContentMutation(record)).fetch().flatMap { data ->
            val answer = data.removeContent
            // `records: []` is a success, not the contract break a null value
            // would read as (`payload`): the stamp rides wrapped.
            payload(answer.userErrors.map { it.userErrorFields }.toDomain()) {
                Stamped(answer.records.firstNotNullOfOrNull { it.redactedAt })
            }.map { it.at }
        }
    }

    override suspend fun removal(kind: RemovalKind, id: String): Outcome<Removal?> = guard.run {
        when (kind) {
            RemovalKind.Post -> client.query(PostRemovalQuery(id)).fetch().map { data ->
                data.post?.removal?.let { removalOf(it.at, it.by) }
            }
            RemovalKind.Comment -> client.query(CommentRemovalQuery(id)).fetch().map { data ->
                data.comment?.removal?.let { removalOf(it.at, it.by) }
            }
        }
    }

    /** The removal's own moment, wrapped so a still-settling node's null is a value. */
    private data class Stamped(val at: Instant?)
}
