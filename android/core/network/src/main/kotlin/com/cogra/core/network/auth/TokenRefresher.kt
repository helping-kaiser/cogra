package com.cogra.core.network.auth

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.exception.ApolloException
import com.cogra.core.domain.model.AuthTokens
import com.cogra.core.domain.repository.TokenStore
import com.cogra.network.graphql.RefreshSessionMutation
import com.cogra.network.graphql.type.RefreshSessionInput

/** Exchanges the stored refresh token for a fresh token pair. */
interface TokenRefresher {
    /** Returns true and persists the rotated pair on success; false when there
     *  is nothing to refresh, the server rejects it, or the call fails. */
    suspend fun refresh(): Boolean
}

/**
 * Refreshes via a dedicated [refreshClient] that carries neither the
 * authorization nor the refresh interceptor, so a refresh never attaches a
 * stale access token and never recurses back into itself. On success the
 * rotated refresh token replaces the stored one, honoring the server's
 * rotate-on-every-use rule (auth.md §Tokens).
 */
class ApolloTokenRefresher(
    private val refreshClient: ApolloClient,
    private val tokenStore: TokenStore,
) : TokenRefresher {

    override suspend fun refresh(): Boolean {
        val refreshToken = tokenStore.current()?.refreshToken ?: return false
        val auth = try {
            refreshClient
                .mutation(RefreshSessionMutation(RefreshSessionInput(refreshToken)))
                .execute()
                .data
                ?.refreshSession
                ?.auth
        } catch (e: ApolloException) {
            return false
        } ?: return false

        tokenStore.save(AuthTokens(auth.accessToken, auth.refreshToken))
        return true
    }
}
