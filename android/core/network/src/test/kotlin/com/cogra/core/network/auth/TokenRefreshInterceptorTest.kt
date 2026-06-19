package com.cogra.core.network.auth

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.ApolloRequest
import com.apollographql.apollo.api.ApolloResponse
import com.apollographql.apollo.api.Operation
import com.apollographql.apollo.interceptor.ApolloInterceptorChain
import com.cogra.core.domain.model.AuthTokens
import com.cogra.core.domain.repository.TokenStore
import com.cogra.core.network.testutil.InMemoryTokenStore
import com.cogra.network.graphql.MeQuery
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test

private const val ME_SUCCESS = """
  {"data":{"me":{
    "__typename":"User",
    "id":"u1",
    "handle":{"value":"alice","status":"NORMAL"},
    "displayName":{"value":"Alice","status":"NORMAL"},
    "bio":{"value":"hi","status":"NORMAL"},
    "websiteUrl":{"value":null,"status":"NORMAL"},
    "networkRole":"MEMBER",
    "moderationStatus":"NORMAL",
    "createdAt":"2026-06-17T00:00:00Z",
    "updatedAt":"2026-06-17T00:00:00Z"
  }}}
"""

private const val ME_UNAUTHENTICATED =
    """{"data":{"me":null},"errors":[{"message":"expired","extensions":{"code":"UNAUTHENTICATED"}}]}"""

/** Records refresh calls and rotates the stored token, standing in for the
 *  real Apollo-backed refresher. */
private class FakeTokenRefresher(private val tokenStore: TokenStore) : TokenRefresher {
    var calls = 0
        private set

    override suspend fun refresh(): Boolean {
        calls++
        tokenStore.save(AuthTokens(accessToken = "new-access", refreshToken = "new-refresh"))
        return true
    }
}

/**
 * Returns [before] for the first [rotateAfter] reads, then [after]. Simulates a
 * concurrent refresh that rotated the token while this call waited for the
 * single-flight lock: the pre-lock reads (authorization header + the dedupe
 * snapshot) see the old token, the in-lock read sees the rotated one. No real
 * threads — the rotation is deterministic on read count.
 */
private class RotateAfterReadsTokenStore(
    private val before: AuthTokens,
    private val after: AuthTokens,
    private val rotateAfter: Int,
) : TokenStore {
    private var reads = 0
    private val state = MutableStateFlow<AuthTokens?>(before)

    override val tokens: Flow<AuthTokens?> = state.asStateFlow()

    override suspend fun current(): AuthTokens {
        reads++
        return if (reads > rotateAfter) after else before
    }

    override suspend fun save(tokens: AuthTokens) {
        state.value = tokens
    }

    override suspend fun clear() {
        state.value = null
    }
}

/** Replays a fixed list of responses for every [proceed], ignoring the request. */
private class FixedChain(private val responses: List<ApolloResponse<*>>) : ApolloInterceptorChain {
    override fun <D : Operation.Data> proceed(request: ApolloRequest<D>): Flow<ApolloResponse<D>> {
        @Suppress("UNCHECKED_CAST")
        return responses.asFlow() as Flow<ApolloResponse<D>>
    }
}

class TokenRefreshInterceptorTest {

    private lateinit var server: MockWebServer
    private lateinit var apolloClient: ApolloClient
    private lateinit var tokenStore: InMemoryTokenStore
    private lateinit var refresher: FakeTokenRefresher

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        tokenStore = InMemoryTokenStore(AuthTokens("old-access", "old-refresh"))
        refresher = FakeTokenRefresher(tokenStore)
        apolloClient = ApolloClient.Builder()
            .serverUrl(server.url("/").toString())
            .addInterceptor(TokenRefreshInterceptor(tokenStore, refresher))
            .addInterceptor(AuthorizationInterceptor(tokenStore))
            .build()
    }

    @After
    fun tearDown() {
        apolloClient.close()
        server.shutdown()
    }

    @Test
    fun `unauthenticated response triggers one refresh and replays with the new token`() = runTest {
        server.enqueue(MockResponse().setBody(ME_UNAUTHENTICATED).addHeader("Content-Type", "application/json"))
        server.enqueue(MockResponse().setBody(ME_SUCCESS).addHeader("Content-Type", "application/json"))

        val response = apolloClient.query(MeQuery()).execute()

        assertThat(response.data?.me?.userFields?.id).isEqualTo("u1")
        assertThat(refresher.calls).isEqualTo(1)

        val first = server.takeRequest()
        val second = server.takeRequest()
        assertThat(first.getHeader("Authorization")).isEqualTo("Bearer old-access")
        assertThat(second.getHeader("Authorization")).isEqualTo("Bearer new-access")
    }

    @Test
    fun `successful response does not refresh`() = runTest {
        server.enqueue(MockResponse().setBody(ME_SUCCESS).addHeader("Content-Type", "application/json"))

        val response = apolloClient.query(MeQuery()).execute()

        assertThat(response.data?.me?.userFields?.id).isEqualTo("u1")
        assertThat(refresher.calls).isEqualTo(0)
        assertThat(server.requestCount).isEqualTo(1)
    }

    @Test
    fun `a token rotated by a concurrent refresh skips the redundant refresh`() = runTest {
        // Pre-lock reads (authorization header on the first attempt + the dedupe
        // snapshot) see the old token; the in-lock read sees a rotated one, as if
        // a racing call had already refreshed. The branch must replay without
        // calling the refresher.
        val rotatingStore = RotateAfterReadsTokenStore(
            before = AuthTokens("old-access", "old-refresh"),
            after = AuthTokens("new-access", "new-refresh"),
            rotateAfter = 2,
        )
        val rotatingRefresher = FakeTokenRefresher(rotatingStore)
        val client = ApolloClient.Builder()
            .serverUrl(server.url("/").toString())
            .addInterceptor(TokenRefreshInterceptor(rotatingStore, rotatingRefresher))
            .addInterceptor(AuthorizationInterceptor(rotatingStore))
            .build()

        server.enqueue(MockResponse().setBody(ME_UNAUTHENTICATED).addHeader("Content-Type", "application/json"))
        server.enqueue(MockResponse().setBody(ME_SUCCESS).addHeader("Content-Type", "application/json"))

        val response = client.query(MeQuery()).execute()

        assertThat(response.data?.me?.userFields?.id).isEqualTo("u1")
        assertThat(rotatingRefresher.calls).isEqualTo(0)
        val first = server.takeRequest()
        val second = server.takeRequest()
        assertThat(first.getHeader("Authorization")).isEqualTo("Bearer old-access")
        assertThat(second.getHeader("Authorization")).isEqualTo("Bearer new-access")

        client.close()
    }

    @Test
    fun `forwards every emission of a multi-emission response`() = runTest {
        val request = ApolloRequest.Builder(MeQuery()).build()
        val responses = listOf(
            ApolloResponse.Builder(MeQuery(), request.requestUuid).extensions(mapOf("n" to 1)).build(),
            ApolloResponse.Builder(MeQuery(), request.requestUuid).extensions(mapOf("n" to 2)).build(),
        )
        val interceptor = TokenRefreshInterceptor(tokenStore, refresher)

        val emitted = interceptor.intercept(request, FixedChain(responses)).toList()

        assertThat(emitted.map { it.extensions["n"] }).containsExactly(1, 2).inOrder()
        assertThat(refresher.calls).isEqualTo(0)
    }
}
