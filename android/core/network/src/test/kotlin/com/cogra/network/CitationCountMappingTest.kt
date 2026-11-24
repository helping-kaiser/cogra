// A card carries the count; the detail and the edit carry the list
// (api-spec.md "Query budgets"; jakob 2026-11-23): the two reads that keep
// `references` beside the fragments, against a MockWebServer through the real
// generated Apollo client.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.ContentRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import javax.inject.Provider

class CitationCountMappingTest {

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
            SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { client }),
        ),
    )

    private val landing = """{"__typename":"Landing","state":"LANDED","epoch":4}"""

    private fun claimJson(handle: String) =
        """{"__typename":"ReferenceClaim",
            "target":{"__typename":"User","id":"user-$handle","handle":"$handle",
            "displayName":{"__typename":"ModeratedText","value":null}},
            "targetId":"l1-$handle","relevance":0.1,"support":0.2,"withdrawalCost":1,
            "rawRelevance":0.1,"rawSupport":0.2,"pending":false}"""

    /** The detail's post as `PostFields` plus its own list serves it, [rest] keys appended. */
    private fun postJson(references: String, referenceCount: Int, rest: String) = """
        {"__typename":"Post","id":"p1",
         "title":{"__typename":"ModeratedText","value":"Hello","status":"NORMAL"},
         "description":{"__typename":"ModeratedText","value":null,"status":"NORMAL"},
         "content":{"__typename":"ModeratedText","value":"body","status":"NORMAL"},
         "attachments":[],"attachmentsStatus":"NORMAL","author":null,
         "createdAt":"2026-08-12T10:00:00+00:00","updatedAt":"2026-08-12T10:00:00+00:00",
         "landing":$landing,"moderationStatus":"NORMAL",
         "removal":null,"genesisRecordId":"rec:p1",
         "license":{"__typename":"License","attribution":0.0,"provenance":0.0},
         "topics":[],"references":$references,"referenceCount":$referenceCount$rest}
    """.trimIndent()

    /** One comment as `CommentFields` serves it, [rest] keys appended. */
    private fun commentJson(referenceCount: Int, rest: String) = """
        {"__typename":"Comment","id":"c1",
         "content":{"__typename":"ModeratedText","value":"hi","status":"NORMAL"},
         "attachments":[],"attachmentsStatus":"NORMAL","author":null,
         "createdAt":"2026-08-12T10:05:00+00:00","updatedAt":"2026-08-12T10:05:00+00:00",
         "landing":$landing,"moderationStatus":"NORMAL",
         "removal":null,"genesisRecordId":"rec:c1",
         "sensitiveSelfMark":false,"sensitiveReason":null,
         "license":{"__typename":"License","attribution":1.0,"provenance":0.0},
         "topics":[],"referenceCount":$referenceCount$rest}
    """.trimIndent()

    @Test
    fun theDetailKeepsItsOwnPostsListAndItsCommentsCarryTheCount() = runTest {
        val replies = """,
            "replies":{"__typename":"CommentConnection","totalCount":0}"""
        val comment = commentJson(referenceCount = 3, rest = replies)
        val thread = """,
            "comments":{"__typename":"CommentConnection","totalCount":1,
              "edges":[{"__typename":"CommentEdge","node":$comment}],
              "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}"""
        val post = postJson("[${claimJson("ada")},${claimJson("mira")}]", referenceCount = 2, rest = thread)
        enqueue("""{"data":{"post":$post}}""")

        val detail = checkNotNull((repo().post("p1", 20, null) as Outcome.Success).value)
        assertThat(detail.post.references?.map { it.targetId }).containsExactly("l1-ada", "l1-mira").inOrder()
        assertThat(detail.post.citationCount).isEqualTo(2)
        val read = detail.comments.items.single()
        // A comment card's read: the count, never the list.
        assertThat(read.references).isNull()
        assertThat(read.referenceCount).isEqualTo(3)
        assertThat(read.citationCount).isEqualTo(3)
    }

    @Test
    fun theCommentEditsReadCarriesEveryCitation() = runTest {
        val cited = """,
            "references":[${claimJson("ada")},${claimJson("mira")},${claimJson("sol")}]"""
        enqueue("""{"data":{"comment":${commentJson(referenceCount = 3, rest = cited)}}}""")

        val loaded = checkNotNull((repo().commentForEdit("c1") as Outcome.Success).value)
        assertThat(loaded.comment.references?.map { it.targetId })
            .containsExactly("l1-ada", "l1-mira", "l1-sol").inOrder()
        assertThat(loaded.comment.referenceCount).isEqualTo(3)
    }
}
