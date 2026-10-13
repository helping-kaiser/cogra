// The account deletion over the generated client (auth.md "Self-service
// deletion"; api-spec.md `requestAccountDeletion` and its siblings). The
// operation documents are account.graphql's, shared by name and selection
// with the web's.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.Outcome
import com.cogra.domain.deletion.AccountDeletion
import com.cogra.domain.deletion.AccountDeletionRepository
import com.cogra.domain.deletion.DeletionStanding
import com.cogra.domain.flatMap
import com.cogra.domain.map
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.AccountDeletionQuery
import com.cogra.network.graphql.CancelAccountDeletionMutation
import com.cogra.network.graphql.ConfirmAccountDeletionMutation
import com.cogra.network.graphql.DeleteApplicantAccountMutation
import com.cogra.network.graphql.RequestAccountDeletionMutation
import com.cogra.network.graphql.fragment.AccountDeletionFields
import com.cogra.network.graphql.type.ConfirmAccountDeletionInput
import com.cogra.network.graphql.type.RequestAccountDeletionInput
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import com.cogra.network.unauthenticatedRefusal
import javax.inject.Inject
import javax.inject.Singleton

internal fun AccountDeletionFields.toDomain(): AccountDeletion = AccountDeletion(scheduledFor, includesContent)

@Singleton
class AccountDeletionRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : AccountDeletionRepository {

    // A path this build cannot name reads as UNKNOWN, which every surface
    // treats as locked — the weaker claim (Models.kt `AccountDeletionPath`).
    // The field is viewer-only, so on the viewer's own read it is present;
    // an absent one is no viewer at all.
    override suspend fun standing(): Outcome<DeletionStanding?> = guard.run {
        client.query(AccountDeletionQuery()).fetch().flatMap { data ->
            val me = data.me ?: return@flatMap unauthenticatedRefusal()
            val path = me.deletionPath ?: return@flatMap unauthenticatedRefusal()
            Outcome.Success(
                DeletionStanding(
                    path = path.toDomain(),
                    deletion = me.accountDeletion?.accountDeletionFields?.toDomain(),
                ),
            )
        }
    }

    override suspend fun request(includeContent: Boolean): Outcome<AccountDeletion?> = guard.run {
        client.mutation(
            RequestAccountDeletionMutation(RequestAccountDeletionInput(includeContent = Optional.present(includeContent))),
        ).payloadOutcome({ it.requestAccountDeletion.userErrors.map { e -> e.userErrorFields } }) {
            // Null is the ordinary answer — nothing is confirmed until the
            // link is opened — so it rides in a box, never as a fault.
            Standing(it.requestAccountDeletion.accountDeletion?.accountDeletionFields?.toDomain())
        }.map { it.deletion }
    }

    // Session-free and never guarded: the link is the capability, and a
    // signed-out device opening it is exactly who asks (api-spec.md
    // `confirmAccountDeletion`). False stays absent rather than sent: the
    // election is opt-in only, and an absent choice leaves it as it stands.
    override suspend fun confirm(token: String, includeContent: Boolean): Outcome<AccountDeletion?> =
        client.mutation(
            ConfirmAccountDeletionMutation(
                ConfirmAccountDeletionInput(
                    deletionToken = token,
                    includeContent = if (includeContent) Optional.present(true) else Optional.absent(),
                ),
            ),
        ).payloadOutcome({ it.confirmAccountDeletion.userErrors.map { e -> e.userErrorFields } }) {
            Standing(it.confirmAccountDeletion.accountDeletion?.accountDeletionFields?.toDomain())
        }.map { it.deletion }

    override suspend fun cancel(): Outcome<Unit> = guard.run {
        client.mutation(CancelAccountDeletionMutation())
            .payloadOutcome({ it.cancelAccountDeletion.userErrors.map { e -> e.userErrorFields } }) {
                Standing(it.cancelAccountDeletion.accountDeletion?.accountDeletionFields?.toDomain())
            }.map { }
    }

    override suspend fun deleteApplicantAccount(): Outcome<Unit> = guard.run {
        client.mutation(DeleteApplicantAccountMutation())
            .payloadOutcome({ it.deleteApplicantAccount.userErrors.map { e -> e.userErrorFields } }) {
                it.deleteApplicantAccount.ok?.takeIf { ok -> ok }
            }.map { }
    }

    /** A non-null box, so the null deletion an act lawfully answers is not read as a fault. */
    private data class Standing(val deletion: AccountDeletion?)
}
