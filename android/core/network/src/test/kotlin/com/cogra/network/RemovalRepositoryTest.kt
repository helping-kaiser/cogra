// The author's Remove (`removeContent`) and the node re-read against a
// MockWebServer through the real generated Apollo client — its own file
// because the content repository's suite is already at detekt's size ceiling.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.removal.RemovalKind
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.RemovalRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.time.Instant
import javax.inject.Provider

class RemovalRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var client: ApolloClient
    private val tokenStore = FakeTokenStore()

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        client = ApolloClient.Builder().serverUrl(server.url("/graphql").toString()).build()
    }

    @After
    fun tearDown() {
        client.close()
        server.shutdown()
    }

    private fun enqueue(json: String) {
        server.enqueue(MockResponse().setBody(json).addHeader("Content-Type", "application/json"))
    }

    private fun repo() = RemovalRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { client }),
        ),
    )

    private fun removed(records: String, errors: String = "[]") =
        """{"data":{"removeContent":{"__typename":"RemoveContentPayload","records":$records,"userErrors":$errors}}}"""

    /** The client names the genesis record and asks for the whole chain (erasure.md §1). */
    @Test
    fun aRemovalNamesTheRecordWithItsWholeChainAndAnswersItsMoment() = runTest {
        enqueue(
            removed(
                """[{"__typename":"Record","id":"rec:p1","payloadState":"REDUCED",
                    "redactedAt":"2026-10-28T09:00:00+00:00"}]""",
            ),
        )
        val outcome = repo().removeContent("rec:p1")

        assertThat(outcome).isEqualTo(Outcome.Success(Instant.parse("2026-10-28T09:00:00Z")))
        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"record\":\"rec:p1\"")
        assertThat(body).contains("includeRevisions: true")
    }

    /** `records: []` — a still-settling node — is a success with no moment, never a contract break. */
    @Test
    fun aStillSettlingNodesEmptyAnswerIsASuccess() = runTest {
        enqueue(removed("[]"))
        assertThat(repo().removeContent("rec:p1")).isEqualTo(Outcome.Success(null))
    }

    @Test
    fun aRefusalIsRefused() = runTest {
        enqueue(
            removed(
                "[]",
                """[{"__typename":"UserError","message":"not yours","code":"FORBIDDEN","field":null}]""",
            ),
        )
        val outcome = repo().removeContent("rec:p1")

        assertThat((outcome as Outcome.Refused).errors.single().code).isEqualTo(ErrorCode.FORBIDDEN)
    }

    @Test
    fun theReReadAnswersTheNodesOwnMark() = runTest {
        enqueue(
            """{"data":{"post":{"__typename":"Post","id":"p1",
               "removal":{"__typename":"Removal","at":"2026-10-28T09:00:00+00:00","by":"ACCOUNT"}}}}""",
        )
        enqueue("""{"data":{"comment":{"__typename":"Comment","id":"c1","removal":null}}}""")

        assertThat(repo().removal(RemovalKind.Post, "p1")).isEqualTo(
            Outcome.Success(Removal(Instant.parse("2026-10-28T09:00:00Z"), RemovalAgent.ACCOUNT)),
        )
        assertThat(repo().removal(RemovalKind.Comment, "c1")).isEqualTo(Outcome.Success(null))
    }

    /** An agent this build cannot name is never read as a verdict. */
    @Test
    fun anUnknownAgentReadsUnknown() = runTest {
        enqueue(
            """{"data":{"post":{"__typename":"Post","id":"p1",
               "removal":{"__typename":"Removal","at":"2026-10-28T09:00:00+00:00","by":"SOMETHING_NEW"}}}}""",
        )
        val read = repo().removal(RemovalKind.Post, "p1") as Outcome.Success
        assertThat(read.value?.by).isEqualTo(RemovalAgent.UNKNOWN)
    }
}
