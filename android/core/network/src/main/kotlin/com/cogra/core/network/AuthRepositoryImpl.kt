package com.cogra.core.network

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.core.domain.model.AuthTokens
import com.cogra.core.domain.model.ProfileEdits
import com.cogra.core.domain.model.User
import com.cogra.core.domain.model.UserError
import com.cogra.core.domain.repository.AuthOutcome
import com.cogra.core.domain.repository.AuthRepository
import com.cogra.core.domain.repository.EditProfileOutcome
import com.cogra.core.network.mapper.errorCodeFromRaw
import com.cogra.core.network.mapper.toDomain
import com.cogra.network.graphql.EditProfileMutation
import com.cogra.network.graphql.LogInMutation
import com.cogra.network.graphql.MeQuery
import com.cogra.network.graphql.type.EditProfileInput
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

    override suspend fun editProfile(edits: ProfileEdits): EditProfileOutcome {
        // A null field stays Absent (omitted, untouched server-side); a present
        // field — including an empty string that clears an optional value —
        // rides as Present.
        val input = EditProfileInput(
            handle = Optional.presentIfNotNull(edits.handle),
            displayName = Optional.presentIfNotNull(edits.displayName),
            bio = Optional.presentIfNotNull(edits.bio),
            websiteUrl = Optional.presentIfNotNull(edits.websiteUrl),
        )
        val payload =
            apolloClient.mutation(EditProfileMutation(input)).execute().dataOrThrow().editProfile
        val user = payload.user
        return if (user != null) {
            EditProfileOutcome.Updated(user.userFields.toDomain())
        } else {
            EditProfileOutcome.Rejected(
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
}
