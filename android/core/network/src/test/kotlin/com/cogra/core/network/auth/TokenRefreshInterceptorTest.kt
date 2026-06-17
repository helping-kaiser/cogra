package com.cogra.core.network.auth

import com.apollographql.apollo.ApolloClient
import com.cogra.core.domain.model.AuthTokens
import com.cogra.core.domain.repository.TokenStore
import com.cogra.core.network.testutil.InMemoryTokenStore
import com.cogra.network.graphql.MeQuery
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test

private const val ME_SUCCESS = """
  {"data":{"me":{
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
}
