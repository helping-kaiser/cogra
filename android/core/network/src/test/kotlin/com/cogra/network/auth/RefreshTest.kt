// The refresh machinery (auth.md "Refresh token"; android/CLAUDE.md
// "Auth / tokens"): single-flight rotation, replay-once on
// UNAUTHENTICATED, and the reuse-detected sign-out.

package com.cogra.network.auth

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.network.InMemoryTokenStore
import com.cogra.network.repo.SessionRepositoryImpl
import com.google.common.truth.Truth.assertThat
import javax.inject.Provider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test

class RefreshTest {

    private lateinit var server: MockWebServer
    private lateinit var client: ApolloClient
    private val tokenStore = InMemoryTokenStore()

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        client = ApolloClient.Builder()
            .serverUrl(server.url("/graphql").toString())
            .addHttpInterceptor(BearerInterceptor(tokenStore))
            .build()
    }

    @After
    fun tearDown() {
        client.close()
        server.shutdown()
    }

    private fun enqueue(json: String) {
        server.enqueue(MockResponse().setBody(json).addHeader("Content-Type", "application/json"))
    }

    private fun refreshSuccess(access: String, refresh: String) =
        """{"data":{"refreshSession":{"__typename":"RefreshPayload",
           "auth":{"__typename":"AuthSession","accessToken":"$access","refreshToken":"$refresh"},
           "userErrors":[]}}}"""

    /**
     * The real wire shape for a guarded mutation with a bad access
     * token: a GraphQL errors-array entry with `extensions.code`, null
     * data — never a payload userError (api-spec.md "Errors are
     * tiered"; crates/api extend_with).
     */
    private fun unauthenticated() =
        """{"data":null,"errors":[{"message":"authentication required",
           "extensions":{"code":"UNAUTHENTICATED"}}]}"""

    @Test
    fun anExpiredAccessTokenRefreshesAndReplaysOnce() = runTest {
        tokenStore.save(AuthTokens("stale-access", "refresh-1"))
        val sessions = SessionRepositoryImpl(
            client,
            AuthGuard(tokenStore, SessionRefresher(tokenStore, Provider { client })),
        )
        enqueue(unauthenticated())
        enqueue(refreshSuccess("access-2", "refresh-2"))
        enqueue(
            """{"data":{"revokeOtherSessions":{"__typename":"RevokeSessionsPayload",
               "revokedCount":3,"userErrors":[]}}}""",
        )

        val outcome = sessions.revokeOtherSessions()
        assertThat((outcome as Outcome.Success).value).isEqualTo(3)
        assertThat(server.requestCount).isEqualTo(3)
        // The rotated pair replaced the stored one.
        assertThat(tokenStore.current()).isEqualTo(AuthTokens("access-2", "refresh-2"))
        // The replay carried the fresh access token.
        server.takeRequest()
        server.takeRequest()
        val replay = server.takeRequest()
        assertThat(replay.getHeader("Authorization")).isEqualTo("Bearer access-2")
    }

    @Test
    fun aStillUnauthenticatedReplayGivesUp() = runTest {
        tokenStore.save(AuthTokens("stale", "refresh-1"))
        val sessions = SessionRepositoryImpl(
            client,
            AuthGuard(tokenStore, SessionRefresher(tokenStore, Provider { client })),
        )
        enqueue(unauthenticated())
        enqueue(refreshSuccess("access-2", "refresh-2"))
        enqueue(unauthenticated())

        val outcome = sessions.revokeOtherSessions()
        assertThat(outcome).isInstanceOf(Outcome.Refused::class.java)
        assertThat((outcome as Outcome.Refused).errors.single().code)
            .isEqualTo(ErrorCode.UNAUTHENTICATED)
        // Exactly one refresh and one replay — never a loop.
        assertThat(server.requestCount).isEqualTo(3)
    }

    @Test
    fun reuseDetectionSignsTheDeviceOut() = runTest {
        tokenStore.save(AuthTokens("access", "stolen-refresh"))
        val refresher = SessionRefresher(tokenStore, Provider { client })
        enqueue(
            """{"data":{"refreshSession":{"__typename":"RefreshPayload","auth":null,
               "userErrors":[{"__typename":"UserError","message":"reuse detected",
               "code":"REFRESH_TOKEN_INVALID","field":null}]}}}""",
        )
        assertThat(refresher.refresh("access")).isFalse()
        assertThat(tokenStore.current()).isNull()
    }

    @Test
    fun concurrentCallersShareOneRefresh() = runTest {
        tokenStore.save(AuthTokens("stale", "refresh-1"))
        val refresher = SessionRefresher(tokenStore, Provider { client })
        enqueue(refreshSuccess("access-2", "refresh-2"))

        val results = listOf(
            async(Dispatchers.IO) { refresher.refresh("stale") },
            async(Dispatchers.IO) { refresher.refresh("stale") },
        ).awaitAll()

        assertThat(results).containsExactly(true, true)
        // The second caller found fresh tokens and never hit the server.
        assertThat(server.requestCount).isEqualTo(1)
        assertThat(tokenStore.current()).isEqualTo(AuthTokens("access-2", "refresh-2"))
    }

    @Test
    fun refreshingWhileSignedOutIsANoOp() = runTest {
        val refresher = SessionRefresher(tokenStore, Provider { client })
        assertThat(refresher.refresh(null)).isFalse()
        assertThat(server.requestCount).isEqualTo(0)
    }
}
