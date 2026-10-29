// The score's trace against a MockWebServer through the real generated Apollo
// client: the answer maps field for field, a failed read says how it failed,
// and the names batch reads posts and comments.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.score.TraceAnswer
import com.cogra.domain.score.TraceFamily
import com.cogra.domain.score.TraceFetch
import com.cogra.domain.score.TraceHop
import com.cogra.domain.score.TraceLeg
import com.cogra.domain.score.TraceLegRole
import com.cogra.domain.score.TraceNamed
import com.cogra.domain.score.TraceNode
import com.cogra.domain.score.TraceNodeKind
import com.cogra.domain.score.TracePath
import com.cogra.domain.score.TracePerson
import com.cogra.domain.score.TraceRecord
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.TraceRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.time.Instant
import javax.inject.Provider

class TraceRepositoryTest {

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

    private fun repo() = TraceRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { client }),
        ),
    )

    @Test
    fun theTraceMapsEveryPathHopAndRecord() = runTest {
        enqueue(
            """{"data":{"feedTrace":{"__typename":"FeedTrace","score":6.8,"paths":[{"__typename":"RankPath",
               "nodes":[
                 {"__typename":"SliceNode","graphId":"prof:u-sol","id":"u-sol","kind":"USER"},
                 {"__typename":"SliceNode","graphId":"mint:p","id":"p1","kind":"POST"}],
               "sign":1,"contribution":6.8,
               "hops":[{"__typename":"RankHop","pDirected":0.55,"pInterest":0.2,"records":[
                 {"__typename":"Record","id":"act:1","family":"OPINION",
                  "author":{"__typename":"User","id":"u-sol","handle":"sol","displayName":{"__typename":"ModeratedText","value":"Sol"},
                            "avatar":{"__typename":"MediaAttachment","url":"https://m/sol.jpg"}},
                  "landedAt":"2026-10-20T10:00:00Z",
                  "legs":[{"__typename":"RecordLeg","role":"BINARY","sourceId":"addr:u-sol","targetId":"mint:p",
                           "pDirected":0.55,"pInterest":0.2}]}]}]}]}}}""",
        )

        val answer = repo().trace("u-sol", "p1")

        assertThat(answer).isEqualTo(
            TraceFetch.Answered(
                TraceAnswer(
                    score = 6.8,
                    paths = listOf(
                        TracePath(
                            nodes = listOf(
                                TraceNode("prof:u-sol", "u-sol", TraceNodeKind.USER),
                                TraceNode("mint:p", "p1", TraceNodeKind.POST),
                            ),
                            sign = 1,
                            contribution = 6.8,
                            hops = listOf(
                                TraceHop(
                                    0.55,
                                    0.2,
                                    listOf(
                                        TraceRecord(
                                            id = "act:1",
                                            family = TraceFamily.OPINION,
                                            author = TracePerson("u-sol", "sol", "Sol", "https://m/sol.jpg"),
                                            landedAt = Instant.parse("2026-10-20T10:00:00Z"),
                                            legs = listOf(TraceLeg(TraceLegRole.BINARY, "addr:u-sol", "mint:p", 0.55, 0.2)),
                                        ),
                                    ),
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        )
        val sent = server.takeRequest().body.readUtf8()
        assertThat(sent).contains("\"viewer\":\"u-sol\"")
        assertThat(sent).contains("\"target\":\"p1\"")
        // Spot-check fields are never asked for: no step carries a number.
        assertThat(sent).doesNotContain("magnitude")
        assertThat(sent).doesNotContain("weight")
    }

    @Test
    fun aTargetNoPathReachesAnswersTheMovedOnState() = runTest {
        enqueue("""{"data":{"feedTrace":{"__typename":"FeedTrace","score":null,"paths":[]}}}""")
        assertThat(repo().trace("u-sol", "p1")).isEqualTo(TraceFetch.Answered(TraceAnswer(null, emptyList())))
    }

    @Test
    fun anErrorAnswerIsTheFaultAndNoAnswerIsOffline() = runTest {
        enqueue("""{"data":null,"errors":[{"message":"ranker unavailable","extensions":{"code":"INTERNAL"}}]}""")
        assertThat(repo().trace("u-sol", "p1")).isEqualTo(TraceFetch.Fault)
        // Nothing listens on port 1: the read never reaches a server.
        val nowhere = ApolloClient.Builder().serverUrl("http://127.0.0.1:1/graphql").build()
        val offline = TraceRepositoryImpl(
            nowhere,
            AuthGuard(
                tokenStore,
                SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { nowhere }),
            ),
        )
        assertThat(offline.trace("u-sol", "p1")).isEqualTo(TraceFetch.Offline)
        nowhere.close()
    }

    @Test
    fun theNamesBatchReadsPostsAndComments() = runTest {
        enqueue(
            """{"data":{"nodes":[
                 {"__typename":"Post","id":"p2","title":{"__typename":"ModeratedText","value":"The long way home"},
                  "author":{"__typename":"User","handle":"ada"}},
                 {"__typename":"Comment","id":"c1","author":null},
                 null]}}""",
        )
        assertThat(repo().names(listOf("p2", "c1", "gone"))).containsExactly(
            "p2",
            TraceNamed.Post("p2", "The long way home", "ada"),
            "c1",
            TraceNamed.Comment("c1", null),
        )
    }
}
