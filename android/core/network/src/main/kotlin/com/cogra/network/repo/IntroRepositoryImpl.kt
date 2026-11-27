// The intro's account read and its seen-flag write over the generated
// client (OnboardingSteps.md). The documents mirror the web's by name.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome
import com.cogra.domain.flatMap
import com.cogra.domain.intro.IntroAccount
import com.cogra.domain.intro.IntroRepository
import com.cogra.domain.map
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.IntroAccountQuery
import com.cogra.network.graphql.MarkIntroSeenMutation
import com.cogra.network.graphql.fragment.IntroInviterFields
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import com.cogra.network.unauthenticatedRefusal
import javax.inject.Inject
import javax.inject.Singleton

internal fun IntroInviterFields.toDomain(): ActorRef =
    ActorRef(id, handle, displayName.value, onUser?.avatar?.mediaFields?.toDomain())

@Singleton
class IntroRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : IntroRepository {

    override suspend fun introAccount(): Outcome<IntroAccount?> = guard.run {
        client.query(IntroAccountQuery()).fetch().flatMap { data ->
            val me = data.me ?: return@flatMap unauthenticatedRefusal()
            Outcome.Success(
                IntroAccount(
                    hasSeen = me.preferences?.hasSeenOnboarding == true,
                    // A landed account names who vouched it in; before
                    // landing, the link issuer its application waits on.
                    inviter = me.invitedBy?.introInviterFields?.toDomain()
                        ?: me.application?.approver?.introInviterFields?.toDomain(),
                ),
            )
        }
    }

    override suspend fun markIntroSeen(): Outcome<Unit> = guard.run {
        client.mutation(MarkIntroSeenMutation())
            .payloadOutcome({ it.setPreferences.userErrors.map { e -> e.userErrorFields } }) { data ->
                data.setPreferences.preferences
            }.map { }
    }
}
