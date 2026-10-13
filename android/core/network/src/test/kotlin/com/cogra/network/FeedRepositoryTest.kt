// The ranked feed against a MockWebServer through the real generated
// Apollo client: the request carries exactly the two pod-side axes, the
// answer maps field for field, and a window hydrates posts in the order
// handed.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedRankArgs
import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.feed.PeopleMark
import com.cogra.domain.feed.RankedEntry
import com.cogra.domain.feed.SettlingRow
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.FeedRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import javax.inject.Provider

class FeedRepositoryTest {

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

    private fun repo() = FeedRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeIdentityStore(), tokenStore), Provider { client }),
        ),
    )

    @Test
    fun theRankingMapsEveryRowAndBothOrders() = runTest {
        enqueue(
            """{"data":{"feedRanking":{"__typename":"FeedRanking","asOfEpoch":12,
               "entries":[
                 {"__typename":"FeedEntry","targetId":"p1","kind":"POST","score":2.5,"mark":"FOR","newestIndex":1},
                 {"__typename":"FeedEntry","targetId":"t1","kind":"HASHTAG","score":1.0,"mark":null,"newestIndex":0}],
               "settling":[
                 {"__typename":"SettlingEntry","targetId":"s1","kind":"COMMENT","mark":"SIGNLESS",
                  "rankedPosition":1,"newestPosition":0}]}}}""",
        )

        val answer = repo().ranking("viewer-1", FeedRankArgs(setOf(FeedKind.POST), topic = null))

        assertThat(answer).isEqualTo(
            Outcome.Success(
                FeedRanking(
                    asOfEpoch = 12,
                    entries = listOf(
                        RankedEntry("p1", FeedKind.POST, 2.5, PeopleMark.FOR, 1),
                        RankedEntry("t1", FeedKind.TAG, 1.0, null, 0),
                    ),
                    settling = listOf(SettlingRow("s1", FeedKind.COMMENT, PeopleMark.SIGNLESS, 1, 0)),
                ),
            ),
        )
    }

    /** Only the ranker's two arguments ride: kinds — explicitly, in a stable order — and the topic. */
    @Test
    fun theRequestCarriesTheViewerKindsAndTopicOnly() = runTest {
        enqueue("""{"data":{"feedRanking":null}}""")

        repo().ranking("viewer-1", FeedRankArgs(setOf(FeedKind.TAG, FeedKind.POST), topic = "h1"))

        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"viewer\":\"viewer-1\"")
        assertThat(body).contains("\"kinds\":[\"POST\",\"HASHTAG\"]")
        assertThat(body).contains("\"topic\":\"h1\"")
        assertThat(body).doesNotContain("includeSeen")
        assertThat(body).doesNotContain("order")
    }

    @Test
    fun aViewerWithNoRankableActorReadsNull() = runTest {
        enqueue("""{"data":{"feedRanking":null}}""")

        assertThat(repo().ranking("nobody", FeedRankArgs(setOf(FeedKind.POST), null)))
            .isEqualTo(Outcome.Success(null))
    }

    @Test
    fun aRowOfAKindThisBuildCannotRenderIsDropped() = runTest {
        enqueue(
            """{"data":{"feedRanking":{"__typename":"FeedRanking","asOfEpoch":3,
               "entries":[
                 {"__typename":"FeedEntry","targetId":"x","kind":"OFFER","score":2.0,"mark":null,"newestIndex":1},
                 {"__typename":"FeedEntry","targetId":"p1","kind":"POST","score":1.0,"mark":null,"newestIndex":0}],
               "settling":[]}}}""",
        )

        val answer = (repo().ranking("v", FeedRankArgs(setOf(FeedKind.POST), null)) as Outcome.Success).value

        assertThat(answer?.entries?.map { it.targetId }).containsExactly("p1")
    }

    @Test
    fun aWindowHydratesPostsInTheOrderHandedAndSkipsOtherKinds() = runTest {
        enqueue(
            """{"data":{"feed":{"__typename":"FeedConnection","edges":[
               {"__typename":"FeedEdge","node":${postJson("p2")}},
               {"__typename":"FeedEdge","node":{"__typename":"Hashtag"}},
               {"__typename":"FeedEdge","node":${postJson("p1", commentCount = 4)}}]}}}""",
        )

        val window = (repo().window(listOf("p2", "t1", "p1")) as Outcome.Success).value

        assertThat(window.map { it.id }).containsExactly("p2", "p1").inOrder()
        assertThat(window.last().commentCount).isEqualTo(4)
        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"ids\":[\"p2\",\"t1\",\"p1\"]")
        assertThat(body).contains("\"first\":3")
    }

    @Test
    fun anEmptyWindowMakesNoCall() = runTest {
        assertThat(repo().window(emptyList())).isEqualTo(Outcome.Success(emptyList<Any>()))
        assertThat(server.requestCount).isEqualTo(0)
    }

    private fun postJson(id: String, commentCount: Int = 0) = """
        {"__typename":"Post","id":"$id",
         "title":{"__typename":"ModeratedText","value":"Title $id","status":"NORMAL"},
         "description":{"__typename":"ModeratedText","value":null,"status":"NORMAL"},
         "content":{"__typename":"ModeratedText","value":"body","status":"NORMAL"},
         "attachments":[],
         "attachmentsStatus":"NORMAL",
         "author":{"__typename":"User","id":"u1","handle":"alice","displayName":{"__typename":"ModeratedText","value":"Alice"},"avatar":null},
         "createdAt":"2026-08-12T10:00:00+00:00",
         "updatedAt":"2026-08-12T11:00:00+00:00",
         "landing":{"__typename":"Landing","state":"LANDED","epoch":7},
         "moderationStatus":"NORMAL",
         "license":{"__typename":"License","attribution":0.5,"provenance":1.0},
         "topics":[],
         "references":[],
         "commentCount":{"__typename":"CommentConnection","totalCount":$commentCount}}
    """.trimIndent()
}
