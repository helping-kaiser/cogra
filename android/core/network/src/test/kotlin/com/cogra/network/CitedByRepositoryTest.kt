// The Cited by read against a MockWebServer through the real generated Apollo
// client (CitedBy.md:7, :9, :13, :15): the terminal-anchored set read whole
// across pages and folded, each row named from its citing artifact — a post by
// its title and cover, a comment by its words and the post it answers, a
// removed one by its mark.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.references.CitingKind
import com.cogra.domain.references.CitingView
import com.cogra.domain.saved.REMOVED_BY_AUTHOR
import com.cogra.domain.stance.StancePair
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.CitedByRepositoryImpl
import com.google.common.truth.Truth.assertThat
import javax.inject.Provider
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test

class CitedByRepositoryTest {

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

    private fun repo() = CitedByRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { client }),
        ),
    )

    private fun quoted(value: String?): String = if (value == null) "null" else "\"$value\""

    private fun record(id: String, author: String, artifact: String, d: Double, i: Double, epoch: Int, target: String) =
        """{"node":{"__typename":"Record","id":"$id","authorId":"$author","targetId":"$artifact",
           "pDirected":$d,"pInterest":$i,"payloadMarked":false,"landingEpoch":$epoch,"position":0,
           "target":$target}}"""

    private fun post(id: String, title: String?, removedBy: String? = null) =
        """{"__typename":"Post","id":"$id",
           "title":{"__typename":"ModeratedText","value":${quoted(title)},"status":"NORMAL"},
           "content":{"__typename":"ModeratedText","value":"Body","status":"NORMAL"},
           "attachments":[{"__typename":"MediaAttachment","id":"m1","url":"https://m/1.jpg",
             "mimeType":"image/jpeg","status":"NORMAL","coverMedia":null}],
           "author":{"__typename":"User","id":"u1","handle":"ada"},
           "removal":${removedBy?.let { """{"__typename":"Removal","by":"$it"}""" } ?: "null"}}"""

    private fun comment(id: String, words: String, onPost: String?) =
        """{"__typename":"Comment","id":"$id",
           "content":{"__typename":"ModeratedText","value":"$words","status":"NORMAL"},
           "removal":null,
           "target":${onPost?.let { """{"__typename":"Post","id":"$it"}""" } ?: "null"}}"""

    private fun page(edges: List<String>, next: String?) =
        """{"data":{"records":{"__typename":"RecordConnection","edges":[${edges.joinToString(",")}],
           "pageInfo":{"__typename":"PageInfo","hasNextPage":${next != null},"endCursor":${quoted(next)}}}}}"""

    @Test
    fun theSetIsReadWholeAcrossPagesAndFoldedNewestFirst() = runTest {
        enqueue(
            page(
                listOf(
                    record("r1", "sol", "p1", 0.4, 0.2, 1, post("p1", "Salt maps")),
                    record("r2", "ada", "c1", 0.1, 0.9, 2, comment("c1", "The wax-stick ones", "p9")),
                ),
                next = "k1",
            ),
        )
        // The revision lands on the second page: one row, at the bundle's net,
        // and the newest act moves it to the top.
        enqueue(page(listOf(record("r3", "sol", "p1", 0.3, 0.3, 3, post("p1", "Salt maps"))), next = null))

        val rows = (repo().citedBy("n1") as Outcome.Success).value

        assertThat(rows.map { it.target.name }).containsExactly("Salt maps", "The wax-stick ones").inOrder()
        assertThat(rows[0].pair).isEqualTo(StancePair(0.7, 0.5))
        assertThat(rows[0].target).isEqualTo(
            CitingView(CitingKind.POST, "Salt maps", cover = "https://m/1.jpg", opensPost = "p1"),
        )
        // A citing comment opens the thread on the post it answers (CitedBy.md:15).
        assertThat(rows[1].target).isEqualTo(CitingView(CitingKind.COMMENT, "The wax-stick ones", opensPost = "p9"))
        val first = server.takeRequest().body.readUtf8()
        assertThat(first).containsMatch("terminal:\\s*\\\$id")
        assertThat(first).containsMatch("family:\\s*REFERENCE")
        assertThat(server.takeRequest().body.readUtf8()).containsMatch("\"after\"\\s*:\\s*\"k1\"")
    }

    @Test
    fun aRemovedCitingPostKeepsItsRowUnderItsMark() = runTest {
        val removed = post("p1", "Salt maps", removedBy = "AUTHOR")
        enqueue(page(listOf(record("r1", "sol", "p1", 0.4, 0.2, 1, removed)), null))

        val row = (repo().citedBy("n1") as Outcome.Success).value.single()

        assertThat(row.target).isEqualTo(
            CitingView(CitingKind.POST, REMOVED_BY_AUTHOR, cover = null, redacted = true, opensPost = "p1"),
        )
    }

    @Test
    fun aCommentNestedDeeperKeepsItsRowWithNoDestination() = runTest {
        enqueue(page(listOf(record("r1", "sol", "c2", 0.4, 0.2, 1, comment("c2", "Deeper", null))), null))

        val row = (repo().citedBy("n1") as Outcome.Success).value.single()

        assertThat(row.target.opensPost).isNull()
    }

    @Test
    fun nothingCitingIsAnEmptyList() = runTest {
        enqueue(page(emptyList(), null))
        assertThat((repo().citedBy("n1") as Outcome.Success).value).isEmpty()
    }
}
