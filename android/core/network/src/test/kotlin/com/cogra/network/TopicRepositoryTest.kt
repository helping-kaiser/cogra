// The topic repository against a MockWebServer through the real
// generated Apollo client: the hashtag read (found and not-found), the
// polymorphic taggedContent mapping (Post and Comment), and the Tag
// gesture with its two parameters.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.TaggedContentKind
import com.cogra.domain.TaggedNode
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.testing.FakeLockCustodyStore
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
            SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { client }),
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

    private fun hashtagJson(vararg rows: String) =
        """{"data":{"hashtag":{"__typename":"Hashtag","id":"h1",
           "name":{"__typename":"ModeratedText","value":"rust","status":"NORMAL"},
           "taggedContent":[${rows.joinToString(",")}]}}}"""

    private fun row(node: String, relevance: Double, confidence: Double, pending: Boolean) =
        """{"__typename":"TaggedContent","node":$node,
           "relevance":$relevance,"confidence":$confidence,"pending":$pending}"""

    private val namedComment = """{"__typename":"Comment","id":"c1"}"""

    private fun commentCardsJson() = """{"data":{"nodes":[${taggedCommentJson()}]}}"""

    @Test
    fun taggedContentMapsBothPostsAndComments() = runTest {
        enqueue(hashtagJson(row(taggedPostJson(), 0.1, 1.0, false), row(namedComment, 0.4, 0.9, true)))
        enqueue(commentCardsJson())
        val entries = (repo().taggedContent("rust") as Outcome.Success).value
        assertThat(entries).hasSize(2)
        val post = entries.first { it.kind == TaggedContentKind.POST }
        assertThat(post.id).isEqualTo("p1")
        assertThat(post.title).isEqualTo("A post")
        assertThat(post.authorHandle).isEqualTo("alice")
        val comment = entries.first { it.kind == TaggedContentKind.COMMENT }
        assertThat(comment.id).isEqualTo("c1")
        assertThat(comment.title).isNull()
        assertThat(comment.authorHandle).isEqualTo("bob")
        assertThat(comment.pending).isTrue()
        assertThat(comment.relevance).isEqualTo(0.4)
        assertThat(comment.confidence).isEqualTo(0.9)
    }

    /**
     * THE TAG PAGE DRAWS THE FEED'S OWN CARDS (TagPage.md:15), so each entry
     * carries the whole node: the post as the feed card reads it, its comment
     * count included, from the `Hashtag` read; the comment with what it
     * answers and its thread's post, from the `TaggedComments` read over the
     * comment ids the first read named.
     */
    @Test
    fun taggedContentCarriesEachNodeAsItsCardReadsIt() = runTest {
        enqueue(hashtagJson(row(taggedPostJson(), 0.1, 1.0, false), row(namedComment, 0.4, 0.9, true)))
        enqueue(commentCardsJson())
        val entries = (repo().taggedContent("rust") as Outcome.Success).value
        val post = (entries[0].node as TaggedNode.Post).post
        assertThat(post.id).isEqualTo("p1")
        assertThat(post.content.value).isEqualTo("body")
        assertThat(post.commentCount).isEqualTo(3)
        assertThat(post.author?.displayName).isEqualTo("Alice")
        val listed = (entries[1].node as TaggedNode.Comment).listed
        assertThat(listed.comment.id).isEqualTo("c1")
        assertThat(listed.comment.content.value).isEqualTo("a reply")
        assertThat(listed.threadPostId).isEqualTo("p9")
        val target = listed.target as CommentTarget.Post
        assertThat(target.id).isEqualTo("p9")
        assertThat(target.title.value).isEqualTo("Salt maps")
        assertThat(target.authorHandle).isEqualTo("sol")
        // The second read asks for exactly the comment rows the first named.
        server.takeRequest()
        val second = server.takeRequest().body.readUtf8()
        assertThat(second).contains("TaggedComments")
        assertThat(second).contains("\"ids\":[\"c1\"]")
    }

    // A page that tags no comment sends one read: the posts' cards ride it.
    @Test
    fun aPageWithOnlyPostsSendsNoCommentRead() = runTest {
        enqueue(hashtagJson(row(taggedPostJson(), 0.1, 1.0, false)))
        val entries = (repo().taggedContent("rust") as Outcome.Success).value
        assertThat((entries.single().node as TaggedNode.Post).post.id).isEqualTo("p1")
        assertThat(server.requestCount).isEqualTo(1)
    }

    // A page of comments alone takes every card from the second read.
    @Test
    fun aPageWithOnlyCommentsFillsEveryCardFromTheSecondRead() = runTest {
        enqueue(hashtagJson(row(namedComment, 0.4, 0.9, false)))
        enqueue(commentCardsJson())
        val entries = (repo().taggedContent("rust") as Outcome.Success).value
        assertThat((entries.single().node as TaggedNode.Comment).listed.comment.id).isEqualTo("c1")
        assertThat(server.requestCount).isEqualTo(2)
    }

    // Either read failing fails the page, as the one read did (TagPage's
    // states): no page of posts with its comment rows silently missing.
    @Test
    fun aFailedCommentReadFailsThePage() = runTest {
        enqueue(hashtagJson(row(taggedPostJson(), 0.1, 1.0, false), row(namedComment, 0.4, 0.9, false)))
        server.enqueue(MockResponse().setResponseCode(500))
        assertThat(repo().taggedContent("rust")).isInstanceOf(Outcome.Failed::class.java)
    }

    // A comment slot that resolves to nothing leaves its row without a card.
    @Test
    fun aCommentThatNoLongerResolvesStandsWithoutACard() = runTest {
        enqueue(hashtagJson(row(namedComment, 0.4, 0.9, false)))
        enqueue("""{"data":{"nodes":[null]}}""")
        val entries = (repo().taggedContent("rust") as Outcome.Success).value
        assertThat(entries.single().node).isNull()
    }

    private fun taggedPostJson() = """
        {"__typename":"Post","id":"p1",
         "title":{"__typename":"ModeratedText","value":"A post","status":"NORMAL"},
         "description":{"__typename":"ModeratedText","value":null,"status":"NORMAL"},
         "content":{"__typename":"ModeratedText","value":"body","status":"NORMAL"},
         "attachments":[],
         "attachmentsStatus":"NORMAL",
         "author":{"__typename":"User","id":"u1","handle":"alice","displayName":{"__typename":"ModeratedText","value":"Alice"},"avatar":null},
         "createdAt":"2026-08-12T10:00:00+00:00",
         "updatedAt":"2026-08-12T11:00:00+00:00",
         "landing":{"__typename":"Landing","state":"LANDED","epoch":7},
         "moderationStatus":"NORMAL",
         "removal":null,"genesisRecordId":"rec:p1",
         "license":{"__typename":"License","attribution":0.5,"provenance":1.0},
         "topics":[],
         "references":[],
         "commentCount":{"__typename":"CommentConnection","totalCount":3}}
    """.trimIndent()

    private fun taggedCommentJson() = """
        {"__typename":"Comment","id":"c1",
         "content":{"__typename":"ModeratedText","value":"a reply","status":"NORMAL"},
         "attachments":[],
         "attachmentsStatus":"NORMAL",
         "author":{"__typename":"User","id":"u2","handle":"bob","displayName":{"__typename":"ModeratedText","value":"Bob"},"avatar":null},
         "createdAt":"2026-08-12T10:05:00+00:00",
         "updatedAt":"2026-08-12T10:05:00+00:00",
         "landing":{"__typename":"Landing","state":"PENDING","epoch":null},
         "moderationStatus":"NORMAL",
         "removal":null,"genesisRecordId":"rec:c1",
         "sensitiveSelfMark":false,"sensitiveReason":null,
         "license":{"__typename":"License","attribution":1.0,"provenance":0.0},
         "topics":[],
         "references":[],
         "target":{"__typename":"Post","id":"p9",
           "title":{"__typename":"ModeratedText","value":"Salt maps","status":"NORMAL"},
           "content":{"__typename":"ModeratedText","value":"words","status":"NORMAL"},
           "attachments":[],
           "author":{"__typename":"User","id":"u3","handle":"sol"},
           "moderationStatus":"NORMAL",
           "removal":null},
         "post":{"__typename":"Post","id":"p9"}}
    """.trimIndent()

    @Test
    fun prepareTagSendsTheTargetAndNameOnTheWire() = runTest {
        enqueue(
            """{"data":{"prepareTag":{"__typename":"PreparePayload",
               "writes":[{"__typename":"PreparedWrite","id":"w1","family":"TAG",
                          "canonicalProposal":"AA==","gcAfterEpochs":8}],
               "userErrors":[]}}}""",
        )
        // An un-tag: (0,0), both parameters riding explicitly (hashtag.md §4)
        // — the wire requires them and fills nothing in.
        val outcome = repo().prepareTag("post-1", "rust", pDirected = 0.0, pInterest = 0.0)
        assertThat(outcome).isInstanceOf(Outcome.Success::class.java)
        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"target\":\"post-1\"")
        assertThat(body).contains("\"name\":\"rust\"")
        assertThat(body).contains("\"pDirected\":0.0")
        assertThat(body).contains("\"pInterest\":0.0")
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
