// The topic repository against a MockWebServer through the real
// generated Apollo client: the hashtag read (found and not-found), the
// polymorphic taggedContent mapping (Post and Comment), and the Tag
// gesture with its two parameters.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.TaggedContentKind
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.TopicRepositoryImpl
import com.google.common.truth.Truth.assertThat
import javax.inject.Provider
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test

class TopicRepositoryTest {

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

    private fun repo() = TopicRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeIdentityStore(), tokenStore), Provider { client }),
        ),
    )

    @Test
    fun hashtagResolvesTheCanonicalName() = runTest {
        enqueue(
            """{"data":{"hashtag":{"__typename":"Hashtag","id":"h1",
               "name":{"__typename":"ModeratedText","value":"rust","status":"NORMAL"},
               "taggedContent":[]}}}""",
        )
        val outcome = repo().hashtag("rust")
        assertThat(outcome).isInstanceOf(Outcome.Success::class.java)
        val hashtag = (outcome as Outcome.Success).value
        checkNotNull(hashtag)
        assertThat(hashtag.id).isEqualTo("h1")
        assertThat(hashtag.name.value).isEqualTo("rust")
    }

    @Test
    fun aNameTheSubstrateCannotCarryResolvesNull() = runTest {
        enqueue("""{"data":{"hashtag":null}}""")
        val outcome = repo().hashtag("münchen")
        assertThat((outcome as Outcome.Success).value).isNull()
    }

    @Test
    fun taggedContentMapsBothPostsAndComments() = runTest {
        enqueue(
            """{"data":{"hashtag":{"__typename":"Hashtag","id":"h1",
               "name":{"__typename":"ModeratedText","value":"rust","status":"NORMAL"},
               "taggedContent":[
                 {"__typename":"TaggedContent",
                  "node":{"__typename":"Post","id":"p1",
                    "title":{"__typename":"ModeratedText","value":"A post","status":"NORMAL"},
                    "content":{"__typename":"ModeratedText","value":"body","status":"NORMAL"},
                    "author":{"__typename":"User","id":"u1","handle":"alice","displayName":{"__typename":"ModeratedText","value":"Alice"}}},
                  "relevance":0.1,"confidence":1.0,"pending":false},
                 {"__typename":"TaggedContent",
                  "node":{"__typename":"Comment","id":"c1",
                    "content":{"__typename":"ModeratedText","value":"a reply","status":"NORMAL"},
                    "author":{"__typename":"User","id":"u2","handle":"bob","displayName":{"__typename":"ModeratedText","value":"Bob"}}},
                  "relevance":0.1,"confidence":1.0,"pending":true}
               ]}}}""",
        )
        val entries = (repo().taggedContent("rust") as Outcome.Success).value
        assertThat(entries).hasSize(2)
        val post = entries.first { it.kind == TaggedContentKind.POST }
        assertThat(post.id).isEqualTo("p1")
        assertThat(post.title).isEqualTo("A post")
        assertThat(post.authorHandle).isEqualTo("alice")
        val comment = entries.first { it.kind == TaggedContentKind.COMMENT }
        assertThat(comment.id).isEqualTo("c1")
        assertThat(comment.title).isNull()
        assertThat(comment.pending).isTrue()
    }

    @Test
    fun prepareTagSendsTheTargetAndNameOnTheWire() = runTest {
        enqueue(
            """{"data":{"prepareTag":{"__typename":"PreparePayload",
               "writes":[{"__typename":"PreparedWrite","id":"w1","family":"TAG",
                          "canonicalProposal":"AA==","gcAfterEpochs":8}],
               "userErrors":[]}}}""",
        )
        val outcome = repo().prepareTag("post-1", "rust", pDirected = 0.0)
        assertThat(outcome).isInstanceOf(Outcome.Success::class.java)
        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"target\":\"post-1\"")
        assertThat(body).contains("\"name\":\"rust\"")
        assertThat(body).contains("\"pDirected\":0.0")
    }

    @Test
    fun prepareTagCarriesBothParametersWhenTheSlidersWereUsed() = runTest {
        enqueue(
            """{"data":{"prepareTag":{"__typename":"PreparePayload",
               "writes":[{"__typename":"PreparedWrite","id":"w1","family":"TAG",
                          "canonicalProposal":"AA==","gcAfterEpochs":8}],
               "userErrors":[]}}}""",
        )
        repo().prepareTag("post-1", "rust", pDirected = 0.4, pInterest = 0.75)
        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"pDirected\":0.4")
        assertThat(body).contains("\"pInterest\":0.75")
    }
}
