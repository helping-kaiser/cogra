// The seen-list write against a MockWebServer through the real generated
// Apollo client: the ids travel in seen order, and every answer but `ok`
// reads as something the tracker keeps queued.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.has
import com.cogra.domain.history.SeenEntry
import com.cogra.domain.history.SeenPage
import java.time.Instant
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.ViewHistoryRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import javax.inject.Provider

class ViewHistoryRepositoryTest {

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

    private fun repo() = ViewHistoryRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeIdentityStore(), tokenStore), Provider { client }),
        ),
    )

    @Test
    fun aBatchTravelsInTheOrderItWasSeen() = runTest {
        enqueue("""{"data":{"markSeen":{"__typename":"MarkSeenPayload","ok":true,"userErrors":[]}}}""")

        val outcome = repo().markSeen(listOf("c3", "p1", "p2"))

        assertThat(outcome).isEqualTo(Outcome.Success(Unit))
        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"nodes\":[\"c3\",\"p1\",\"p2\"]")
    }

    @Test
    fun aTrippedBudgetIsARateLimitedRefusal() = runTest {
        enqueue(
            """{"data":null,"errors":[{"message":"too many requests",
               "extensions":{"code":"RATE_LIMITED"}}]}""",
        )

        val outcome = repo().markSeen(listOf("p1"))

        assertThat(outcome).isInstanceOf(Outcome.Refused::class.java)
        assertThat((outcome as Outcome.Refused).has(ErrorCode.RATE_LIMITED)).isTrue()
    }

    @Test
    fun anOverLongBatchIsABadInputRefusal() = runTest {
        enqueue(
            """{"data":{"markSeen":{"__typename":"MarkSeenPayload","ok":null,"userErrors":[
               {"__typename":"UserError","code":"BAD_INPUT","message":"at most 100","field":["nodes"]}]}}}""",
        )

        val outcome = repo().markSeen(listOf("p1"))

        assertThat(outcome).isInstanceOf(Outcome.Refused::class.java)
        assertThat((outcome as Outcome.Refused).has(ErrorCode.BAD_INPUT)).isTrue()
    }

    // THE SEEN RECORD'S SYNC READ (PR-52): ids and first seenings of every
    // kind History serves, with whose list it is.

    @Test
    fun aSeenPageCarriesTheReaderTheIdsAndTheCursor() = runTest {
        enqueue(
            """{"data":{"me":{"__typename":"User","id":"u1","viewHistory":{"__typename":"ViewHistoryConnection",
               "edges":[
                 {"__typename":"ViewHistoryEdge","firstSeenAt":"2026-10-13T09:00:00+00:00",
                  "node":{"__typename":"Post","id":"p1"}},
                 {"__typename":"ViewHistoryEdge","firstSeenAt":"2026-10-13T08:00:00+00:00",
                  "node":{"__typename":"Hashtag","id":"t1"}}],
               "pageInfo":{"__typename":"PageInfo","hasNextPage":true,"endCursor":"c2"}}}}}""",
        )

        val page = (repo().seenPage(100, after = "c1") as Outcome.Success).value

        assertThat(page).isEqualTo(
            SeenPage(
                reader = "u1",
                entries = listOf(
                    SeenEntry("p1", Instant.parse("2026-10-13T09:00:00Z")),
                    SeenEntry("t1", Instant.parse("2026-10-13T08:00:00Z")),
                ),
                endCursor = "c2",
                hasNextPage = true,
            ),
        )
        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"first\":100")
        assertThat(body).contains("\"after\":\"c1\"")
    }

    @Test
    fun aSeenPageWithNoReaderIsNull() = runTest {
        enqueue("""{"data":{"me":null}}""")

        assertThat(repo().seenPage(100, after = null)).isEqualTo(Outcome.Success(null))
    }
}
