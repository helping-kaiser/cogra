package com.cogra.core.network

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.core.domain.model.AuthTokens
import com.cogra.core.domain.model.User
import com.cogra.core.domain.model.UserError
import com.cogra.core.domain.repository.AuthOutcome
import com.cogra.core.domain.repository.AuthRepository
import com.cogra.core.network.mapper.errorCodeFromRaw
import com.cogra.core.network.mapper.toDomain
import com.cogra.network.graphql.LogInMutation
import com.cogra.network.graphql.MeQuery
import com.cogra.network.graphql.type.LogInInput

/**
 * Maps the generated Apollo operations onto the domain [AuthRepository]
 * contract. Transport faults propagate as the exceptions Apollo throws from
 * `dataOrThrow()`; the use-case layer turns those into failures. A login that
 * the backend rejects arrives as data (auth null, userErrors populated), not
 * as an exception, so it maps cleanly to [AuthOutcome.Rejected].
 */
class AuthRepositoryImpl(
    private val apolloClient: ApolloClient,
) : AuthRepository {

    override suspend fun logIn(email: String, password: String, deviceLabel: String?): AuthOutcome {
        val input = LogInInput(
            email = email,
            password = password,
            deviceLabel = Optional.presentIfNotNull(deviceLabel),
        )
        val payload = apolloClient.mutation(LogInMutation(input)).execute().dataOrThrow().logIn
        val auth = payload.auth
        return if (auth != null) {
            AuthOutcome.Authenticated(
                tokens = AuthTokens(auth.accessToken, auth.refreshToken),
                user = auth.user.userFields.toDomain(),
            )
        } else {
            AuthOutcome.Rejected(
                payload.userErrors.map { error ->
                    UserError(
                        message = error.message,
                        code = errorCodeFromRaw(error.code.rawValue),
                        field = error.field ?: emptyList(),
                    )
                },
            )
        }
    }

    override suspend fun me(): User? =
        apolloClient.query(MeQuery()).execute().dataOrThrow().me?.userFields?.toDomain()
}
