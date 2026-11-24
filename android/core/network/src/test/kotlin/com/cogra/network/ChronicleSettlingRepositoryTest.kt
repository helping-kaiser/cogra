// THE EVERYTHING TAB'S READ (`User.chronicle`; Profile.md:31, :33) against a
// MockWebServer through the real generated Apollo client: a still-settling
// post or comment reads as the row its genesis record will draw, keyed by that
// record's id, aged by its signing and marked pending; a landed record reads
// the row it always did; the server's order stands.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.crypto.Family
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.RecordAbout
import com.cogra.domain.RecordAct
import com.cogra.domain.RecordLink
import com.cogra.domain.RecordRow
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.ProfileRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.time.Instant
import javax.inject.Provider

class ChronicleSettlingRepositoryTest {

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

    private fun repo(): ProfileRepositoryImpl {
        val guard = AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { client }),
        )
        return ProfileRepositoryImpl(client, guard)
    }

    private fun page(edges: List<String>, next: String? = null) {
        val body = """{"data":{"user":{"__typename":"User","id":"u2","chronicle":{
           "__typename":"ChronicleEntryConnection","edges":[${edges.joinToString(",") { "{\"node\":$it}" }}],
           "pageInfo":{"__typename":"PageInfo","hasNextPage":${next != null},
             "endCursor":${if (next == null) "null" else "\"$next\""}}}}}}"""
        server.enqueue(MockResponse().setBody(body).addHeader("Content-Type", "application/json"))
    }

    private fun landing(state: String) = """{"__typename":"Landing","state":"$state"}"""

    private fun settlingPost(id: String, title: String?, words: String?, state: String = "PENDING") = """
        {"__typename":"Post","postId":"$id","genesisRecordId":"rec:$id",
         "createdAt":"2026-11-24T10:00:00Z","landing":${landing(state)},
         "title":{"__typename":"ModeratedText","value":${title?.let { "\"$it\"" } ?: "null"}},
         "content":{"__typename":"ModeratedText","value":${words?.let { "\"$it\"" } ?: "null"}}}
    """.trimIndent()

    private fun settlingComment(id: String, post: String?) = """
        {"__typename":"Comment","commentId":"$id","genesisRecordId":"rec:$id",
         "createdAt":"2026-11-24T10:01:00Z","landing":${landing("PENDING")},
         "content":{"__typename":"ModeratedText","value":"A fine reply"},
         "post":${post?.let { "{\"__typename\":\"Post\",\"id\":\"$it\"}" } ?: "null"}}
    """.trimIndent()

    private val landedPublish = """
        {"__typename":"Record","id":"rec:p0","family":"PUBLISH","act":"GENESIS",
         "targetId":"mint:rec:p0","terminalId":null,"landedAt":"2026-11-20T10:00:00Z",
         "pDirected":0.0,"pInterest":0.0,"severed":false,"topic":null,"terminal":null,
         "target":{"__typename":"Post","id":"p0","title":{"value":"Older"},"content":{"value":"x"},"removal":null}}
    """.trimIndent()

    @Test
    fun aSettlingPostAndCommentReadAsTheirActsRowsInTheServersOrder() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        page(listOf(settlingPost("p1", "Salt maps", "body"), settlingComment("c1", post = "p9"), landedPublish))

        val rows = (repo().chronicle("u2", 20, null) as Outcome.Success).value.items

        assertThat(rows.map { it.id }).containsExactly("rec:p1", "rec:c1", "rec:p0").inOrder()

        val post = rows[0]
        assertThat(post.family).isEqualTo(Family.PUBLISH)
        assertThat(post.genesis).isTrue()
        assertThat(post.act).isEqualTo(RecordAct.GENESIS)
        assertThat(post.snippet).isEqualTo("Salt maps")
        assertThat(post.link).isEqualTo(RecordLink.ToPost("p1"))
        assertThat(post.pending).isTrue()
        assertThat(post.signedAt).isEqualTo(Instant.parse("2026-11-24T10:00:00Z"))
        assertThat(post.landedAt).isNull()

        val comment = rows[1]
        assertThat(comment.family).isEqualTo(Family.REVIEW)
        assertThat(comment.genesis).isTrue()
        assertThat(comment.snippet).isEqualTo("A fine reply")
        // Its door is its thread's post, as the Comments tab's card opens.
        assertThat(comment.link).isEqualTo(RecordLink.ToPost("p9"))
        assertThat(comment.pending).isTrue()
    }

    // The landed record's row is the one the tab always drew: no marker, its
    // age its landing.
    @Test
    fun aLandedRecordReadsItsRowUnchanged() = runTest {
        page(listOf(landedPublish))

        val row = (repo().chronicle("u2", 20, null) as Outcome.Success).value.items.single()

        assertThat(row).isEqualTo(
            RecordRow(
                id = "rec:p0",
                family = Family.PUBLISH,
                genesis = true,
                snippet = "Older",
                link = RecordLink.ToPost("p0"),
                landedAt = Instant.parse("2026-11-20T10:00:00Z"),
                act = RecordAct.GENESIS,
                about = RecordAbout.POST,
            ),
        )
    }

    // A post with no title reads its words; one served LANDED in the instant
    // its record is mirrored keeps its row, unmarked, until the next read
    // serves the record.
    @Test
    fun anUntitledPostReadsItsWordsAndALandedEntryIsUnmarked() = runTest {
        page(listOf(settlingPost("p2", title = null, words = "Just words", state = "LANDED")))

        val row = (repo().chronicle("u2", 20, null) as Outcome.Success).value.items.single()

        assertThat(row.snippet).isEqualTo("Just words")
        assertThat(row.pending).isFalse()
        assertThat(row.id).isEqualTo("rec:p2")
    }

    // The read is the person's chronicle by id, at the page asked for, from the
    // cursor given; the ids of the settling kinds ride their aliases.
    @Test
    fun theReadAsksTheChronicleAtThePageFromTheCursor() = runTest {
        page(emptyList(), next = "c2")

        val read = (repo().chronicle("u2", 20, "c1") as Outcome.Success).value

        assertThat(read.hasNextPage).isTrue()
        assertThat(read.endCursor).isEqualTo("c2")
        val sent = server.takeRequest().body.readUtf8()
        assertThat(sent).containsMatch("chronicle\\(first:\\s*\\\$first,\\s*after:\\s*\\\$after\\)")
        assertThat(sent).containsMatch("\"after\"\\s*:\\s*\"c1\"")
        assertThat(sent).containsMatch("postId:\\s*id")
        assertThat(sent).containsMatch("commentId:\\s*id")
        assertThat(sent).doesNotContain("records(")
    }

    @Test
    fun aPersonTheServerDoesNotKnowReadsEmpty() = runTest {
        server.enqueue(
            MockResponse().setBody("""{"data":{"user":null}}""").addHeader("Content-Type", "application/json"),
        )

        val read = (repo().chronicle("nobody", 20, null) as Outcome.Success).value

        assertThat(read.items).isEmpty()
        assertThat(read.hasNextPage).isFalse()
    }
}
