// The content repository against a MockWebServer through the real
// generated Apollo client: fragment mapping (moderated fields, page
// info), the prepare tier split, and the edit input's present-null
// clear semantics on the wire.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.ErrorCode
import com.cogra.domain.FieldStatus
import com.cogra.domain.Landing
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.ContentRepositoryImpl
import com.google.common.truth.Truth.assertThat
import javax.inject.Provider
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test

class ContentRepositoryTest {

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

    private fun repo() = ContentRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeIdentityStore(), tokenStore), Provider { client }),
        ),
    )

    private fun landingJson(state: String, epoch: Int?) =
        """{"__typename":"Landing","state":"$state","epoch":${epoch ?: "null"}}"""

    private fun postJson(
        id: String,
        title: String?,
        redacted: Boolean = false,
        landing: String = landingJson("LANDED", 7),
    ) = """
        {"__typename":"Post","id":"$id",
         "title":{"__typename":"ModeratedText","value":${title?.let { "\"$it\"" } ?: "null"},"status":"NORMAL"},
         "description":{"__typename":"ModeratedText","value":null,"status":"NORMAL"},
         "content":{"__typename":"ModeratedText",
                    "value":${if (redacted) "null" else "\"body\""},
                    "status":"${if (redacted) "REDACTED" else "NORMAL"}"},
         "author":{"__typename":"User","id":"u1","handle":"alice","displayName":{"__typename":"ModeratedText","value":"Alice"}},
         "createdAt":"2026-08-12T10:00:00+00:00",
         "updatedAt":"2026-08-12T11:00:00+00:00",
         "landing":$landing,
         "moderationStatus":"NORMAL",
         "license":{"__typename":"License","attribution":0.5,"provenance":1.0},
         "topics":[]}
    """.trimIndent()

    @Test
    fun theListingMapsPostsAndPageInfo() = runTest {
        enqueue(
            """{"data":{"posts":{"__typename":"PostConnection",
               "edges":[{"__typename":"PostEdge","node":${postJson("p1", "Hello")}}],
               "pageInfo":{"__typename":"PageInfo","hasNextPage":true,"endCursor":"c1"}}}}""",
        )
        val page = (repo().posts(20, null) as Outcome.Success).value
        assertThat(page.items).hasSize(1)
        val post = page.items.single()
        assertThat(post.id).isEqualTo("p1")
        assertThat(post.title.value).isEqualTo("Hello")
        assertThat(post.author?.handle).isEqualTo("alice")
        assertThat(post.license).isEqualTo(LicenseChoice(attribution = 0.5, provenance = 1.0))
        assertThat(post.landing).isEqualTo(Landing.landed(7))
        assertThat(post.landing.isPending).isFalse()
        assertThat(page.hasNextPage).isTrue()
        assertThat(page.endCursor).isEqualTo("c1")
    }

    @Test
    fun theListingCarriesTheLandedOnlyOptOut() = runTest {
        val body = """{"data":{"posts":{"__typename":"PostConnection",
               "edges":[{"__typename":"PostEdge","node":${postJson("p1", "Hello")}}],
               "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}"""
        enqueue(body)
        repo().posts(20, null)
        assertThat(server.takeRequest().body.readUtf8()).contains("\"includePending\":true")

        enqueue(body)
        repo().posts(20, null, includePending = false)
        assertThat(server.takeRequest().body.readUtf8()).contains("\"includePending\":false")
    }

    @Test
    fun aPendingNodeCarriesNoEpoch() = runTest {
        enqueue(
            """{"data":{"posts":{"__typename":"PostConnection",
               "edges":[{"__typename":"PostEdge","node":${
                postJson("p1", "Hello", landing = landingJson("PENDING", null))
            }}],
               "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}""",
        )
        val post = (repo().posts(20, null) as Outcome.Success).value.items.single()
        assertThat(post.landing).isEqualTo(Landing.Pending)
        assertThat(post.landing.isPending).isTrue()
        assertThat(post.landing.epoch).isNull()
    }

    @Test
    fun aRedactedFieldKeepsItsMark() = runTest {
        enqueue(
            """{"data":{"posts":{"__typename":"PostConnection",
               "edges":[{"__typename":"PostEdge","node":${postJson("p1", null, redacted = true)}}],
               "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}""",
        )
        val post = (repo().posts(20, null) as Outcome.Success).value.items.single()
        assertThat(post.content.value).isNull()
        assertThat(post.content.status).isEqualTo(FieldStatus.REDACTED)
    }

    @Test
    fun theDetailMapsTheThreadAndAnUnknownIdIsNull() = runTest {
        enqueue(
            """{"data":{"post":{"__typename":"Post","id":"p1",
               "title":{"__typename":"ModeratedText","value":null,"status":"NORMAL"},
               "description":{"__typename":"ModeratedText","value":null,"status":"NORMAL"},
               "content":{"__typename":"ModeratedText","value":"body","status":"NORMAL"},
               "author":null,
               "createdAt":"2026-08-12T10:00:00+00:00",
               "updatedAt":"2026-08-12T10:00:00+00:00",
               "landing":${landingJson("LANDED", 3)},
               "moderationStatus":"NORMAL",
               "license":{"__typename":"License","attribution":0.0,"provenance":0.0},
               "topics":[],
               "comments":{"__typename":"CommentConnection",
                 "edges":[{"__typename":"CommentEdge","node":{"__typename":"Comment","id":"c1",
                   "content":{"__typename":"ModeratedText","value":"hi","status":"NORMAL"},
                   "author":{"__typename":"User","id":"u2","handle":"bob","displayName":{"__typename":"ModeratedText","value":"Bob"}},
                   "createdAt":"2026-08-12T10:05:00+00:00",
                   "updatedAt":"2026-08-12T10:05:00+00:00",
                   "landing":${landingJson("PENDING", null)},
                   "moderationStatus":"NORMAL",
                   "license":{"__typename":"License","attribution":1.0,"provenance":0.0},
                   "topics":[],
                   "replies":{"__typename":"CommentConnection","edges":[],
                     "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}],
                 "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":"cc"}}}}}""",
        )
        val detail = (repo().post("p1", 20, null) as Outcome.Success).value
        checkNotNull(detail)
        assertThat(detail.post.author).isNull()
        assertThat(detail.comments.items.single().content.value).isEqualTo("hi")
        assertThat(detail.comments.items.single().author?.handle).isEqualTo("bob")
        assertThat(detail.post.license).isEqualTo(LicenseChoice.PublicDomain)
        assertThat(detail.comments.items.single().license)
            .isEqualTo(LicenseChoice(attribution = 1.0, provenance = 0.0))
        // A landed post can carry a comment that has not landed yet.
        assertThat(detail.post.landing).isEqualTo(Landing.landed(3))
        assertThat(detail.comments.items.single().landing).isEqualTo(Landing.Pending)

        enqueue("""{"data":{"post":null}}""")
        assertThat((repo().post("gone", 20, null) as Outcome.Success).value).isNull()
    }

    @Test
    fun preparePostSplitsTheTiers() = runTest {
        enqueue(
            """{"data":{"preparePost":{"__typename":"PrepareContentPayload",
               "node":"node-1",
               "writes":[{"__typename":"PreparedWrite","id":"w1","family":"PUBLISH",
                          "canonicalProposal":"AAECAw==","gcAfterEpochs":8}],
               "userErrors":[]}}}""",
        )
        val license = LicenseChoice(attribution = 1.0, provenance = 0.0)
        val prepared = (repo().preparePost("T", null, "B", license) as Outcome.Success).value
        assertThat(prepared.node).isEqualTo("node-1")
        assertThat(prepared.writes.single().id).isEqualTo("w1")
        assertThat(prepared.writes.single().canonicalProposal).isEqualTo(byteArrayOf(0, 1, 2, 3))

        enqueue(
            """{"data":{"preparePost":{"__typename":"PrepareContentPayload",
               "node":null,"writes":null,
               "userErrors":[{"__typename":"UserError","message":"not a member",
                              "code":"FORBIDDEN","field":null}]}}}""",
        )
        val refused = repo().preparePost("T", null, "B", license)
        assertThat((refused as Outcome.Refused).errors.single().code).isEqualTo(ErrorCode.FORBIDDEN)
    }

    @Test
    fun anEditSendsTheCompleteFieldSet() = runTest {
        enqueue(
            """{"data":{"preparePostEdit":{"__typename":"PrepareContentPayload",
               "node":"p1",
               "writes":[{"__typename":"PreparedWrite","id":"w1","family":"PUBLISH",
                          "canonicalProposal":"AA==","gcAfterEpochs":8}],
               "userErrors":[]}}}""",
        )
        repo().preparePostEdit("p1", title = null, description = null, content = "B")
        val body = server.takeRequest().body.readUtf8()
        // The payload is the whole content state: the optional fields
        // ride as explicit nulls rather than absent keys (post.md §4).
        assertThat(body).contains("\"title\":null")
        assertThat(body).contains("\"description\":null")
        assertThat(body).contains("\"content\":\"B\"")
    }
}
