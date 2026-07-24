// The session-token machinery (android/CLAUDE.md "Auth / tokens"): the
// access token rides as a Bearer header; an UNAUTHENTICATED payload
// triggers a single-flight refresh-and-replay. The backend resolves an
// invalid token to "no viewer" silently, so UNAUTHENTICATED arrives as
// a userError (or a null `me`), never a transport error — the retry
// lives at the repository tier, not in an HTTP interceptor.

package com.cogra.network.auth

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.http.HttpRequest
import com.apollographql.apollo.api.http.HttpResponse
import com.apollographql.apollo.network.http.HttpInterceptor
import com.apollographql.apollo.network.http.HttpInterceptorChain
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.has
import com.cogra.domain.store.TokenStore
import com.cogra.network.graphql.RefreshSessionMutation
import com.cogra.network.graphql.type.RefreshSessionInput
import com.cogra.network.payloadOutcome
import com.cogra.domain.AuthTokens
import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Adds `Authorization: Bearer <access>` when a session exists. */
class BearerInterceptor(private val tokens: TokenStore) : HttpInterceptor {
    override suspend fun intercept(request: HttpRequest, chain: HttpInterceptorChain): HttpResponse {
        val access = tokens.current()?.accessToken ?: return chain.proceed(request)
        return chain.proceed(
            request.newBuilder().addHeader("Authorization", "Bearer $access").build(),
        )
    }
}

/**
 * The single-flight refresh: one caller rotates the pair, concurrent
 * callers wait on the lock and find fresh tokens. Reuse detection
 * (REFRESH_TOKEN_INVALID) signs the device out — every session was
 * revoked server-side (auth.md "Refresh token").
 */
@Singleton
class SessionRefresher @Inject constructor(
    private val tokens: TokenStore,
    // Provider breaks the construction cycle: the client's interceptor
    // reads the token store, and this refresher calls the client.
    private val client: Provider<ApolloClient>,
) {
    private val mutex = Mutex()

    /**
     * Refreshes unless someone already did (the stored access token no
     * longer matches [staleAccess]). Returns true when a replay is
     * worth attempting.
     */
    suspend fun refresh(staleAccess: String?): Boolean = mutex.withLock {
        val current = tokens.current() ?: return false
        if (staleAccess != null && current.accessToken != staleAccess) return true
        val outcome = client.get()
            .mutation(RefreshSessionMutation(RefreshSessionInput(current.refreshToken)))
            .payloadOutcome(
                { it.refreshSession.userErrors.map { e -> e.userErrorFields } },
                { it.refreshSession.auth },
            )
        return when (outcome) {
            is Outcome.Success -> {
                tokens.save(AuthTokens(outcome.value.authSessionFields.accessToken, outcome.value.authSessionFields.refreshToken))
                true
            }
            is Outcome.Refused -> {
                if (outcome.has(ErrorCode.REFRESH_TOKEN_INVALID)) tokens.clear()
                false
            }
            is Outcome.Failed -> false
        }
    }
}

/**
 * Wraps an authenticated call: on an UNAUTHENTICATED refusal, refresh
 * once and replay once. Anything else passes through.
 */
@Singleton
class AuthGuard @Inject constructor(
    private val tokens: TokenStore,
    private val refresher: SessionRefresher,
) {
    suspend fun <T> run(block: suspend () -> Outcome<T>): Outcome<T> {
        val before = tokens.current()?.accessToken
        val first = block()
        if (first !is Outcome.Refused || !first.has(ErrorCode.UNAUTHENTICATED)) return first
        return if (refresher.refresh(before)) block() else first
    }
}
