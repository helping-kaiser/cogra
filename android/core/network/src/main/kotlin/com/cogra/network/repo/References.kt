// The reference surface over the real contract (api-spec.md "Content
// authoring"; roadmap "Slice 2.4"): the finder's lookup, the
// standalone citation, and the withdrawal. References declared at
// creation ride the content write's own input instead (Content.kt) —
// exactly as tags do.
//
// The finder runs on every keystroke, so an unresolvable query is an
// empty list and never a refusal (D20).

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ReferenceCandidateView
import com.cogra.domain.map
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.PrepareReferenceMutation
import com.cogra.network.graphql.PrepareReferenceWithdrawalMutation
import com.cogra.network.graphql.ReferenceCandidatesQuery
import com.cogra.network.graphql.type.PrepareReferenceInput
import com.cogra.network.graphql.type.PrepareReferenceWithdrawalInput
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReferenceRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : ReferenceRepository {

    override suspend fun referenceCandidates(
        query: String,
        limit: Int?,
    ): Outcome<List<ReferenceCandidateView>> = guard.run {
        client.query(
            ReferenceCandidatesQuery(query = query, limit = Optional.presentIfNotNull(limit)),
        ).fetch().map { data -> data.referenceCandidates.mapNotNull { it.toDomain() } }
    }

    override suspend fun prepareReference(
        artifact: String,
        target: String,
        relevance: Double?,
        support: Double?,
    ): Outcome<List<PreparedWriteView>> = guard.run {
        client.mutation(
            PrepareReferenceMutation(
                PrepareReferenceInput(
                    artifact = artifact,
                    target = target,
                    relevance = Optional.presentIfNotNull(relevance),
                    support = Optional.presentIfNotNull(support),
                ),
            ),
        ).payloadOutcome({ it.prepareReference.userErrors.map { e -> e.userErrorFields } }) {
            it.prepareReference.writes?.map { w -> w.preparedWriteFields.toDomain() }
        }
    }

    override suspend fun prepareReferenceWithdrawal(
        artifact: String,
        target: String,
    ): Outcome<List<PreparedWriteView>> = guard.run {
        client.mutation(
            PrepareReferenceWithdrawalMutation(
                PrepareReferenceWithdrawalInput(artifact = artifact, target = target),
            ),
        ).payloadOutcome({ it.prepareReferenceWithdrawal.userErrors.map { e -> e.userErrorFields } }) {
            it.prepareReferenceWithdrawal.writes?.map { w -> w.preparedWriteFields.toDomain() }
        }
    }
}
