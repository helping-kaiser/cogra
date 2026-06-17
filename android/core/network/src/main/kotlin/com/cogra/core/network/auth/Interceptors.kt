package com.cogra.core.network.auth

import com.apollographql.apollo.api.ApolloRequest
import com.apollographql.apollo.api.ApolloResponse
import com.apollographql.apollo.api.Operation
import com.apollographql.apollo.interceptor.ApolloInterceptor
import com.apollographql.apollo.interceptor.ApolloInterceptorChain
import com.cogra.core.domain.repository.TokenStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Transport-fault code the backend sets on `extensions.code` for an
 *  expired/absent access token (schema `ErrorCode.UNAUTHENTICATED`). */
private const val UNAUTHENTICATED = "UNAUTHENTICATED"

/** Attaches the stored access token as a Bearer header on every request. Read
 *  per-attempt, so a retry after refresh picks up the rotated token. */
class AuthorizationInterceptor(
    private val tokenStore: TokenStore,
) : ApolloInterceptor {

    override fun <D : Operation.Data> intercept(
        request: ApolloRequest<D>,
        chain: ApolloInterceptorChain,
    ): Flow<ApolloResponse<D>> = flow {
        val accessToken = tokenStore.current()?.accessToken
        val authorized = if (accessToken != null) {
            request.newBuilder().addHttpHeader("Authorization", "Bearer $accessToken").build()
        } else {
            request
        }
        emitAll(chain.proceed(authorized))
    }
}

/**
 * On an UNAUTHENTICATED response, refreshes once and replays the request. A
 * [Mutex] collapses concurrent 401s into a single refresh; a request that
 * raced in after another already refreshed skips straight to the replay. This
 * interceptor must sit *before* [AuthorizationInterceptor] so the replay
 * re-reads the rotated token.
 */
class TokenRefreshInterceptor(
    private val tokenStore: TokenStore,
    private val refresher: TokenRefresher,
) : ApolloInterceptor {

    private val refreshMutex = Mutex()

    override fun <D : Operation.Data> intercept(
        request: ApolloRequest<D>,
        chain: ApolloInterceptorChain,
    ): Flow<ApolloResponse<D>> = flow {
        val response = chain.proceed(request).first()
        if (!response.isUnauthenticated()) {
            emit(response)
            return@flow
        }

        val tokenBeforeRefresh = tokenStore.current()?.accessToken
        val refreshed = refreshMutex.withLock {
            val tokenNow = tokenStore.current()?.accessToken
            // A concurrent call may have already rotated the token while we
            // waited for the lock; if so, don't refresh again.
            if (tokenNow != null && tokenNow != tokenBeforeRefresh) true else refresher.refresh()
        }

        if (refreshed) {
            emitAll(chain.proceed(request.newBuilder().build()))
        } else {
            emit(response)
        }
    }
}

private fun ApolloResponse<*>.isUnauthenticated(): Boolean =
    errors?.any { (it.extensions?.get("code") as? String) == UNAUTHENTICATED } == true
