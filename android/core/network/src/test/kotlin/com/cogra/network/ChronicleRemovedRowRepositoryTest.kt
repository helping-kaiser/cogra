// A REMOVED THING'S CHRONICLE ROW (Profile.md:37, :39; ProfileOther.md:33, :39;
// ProfileDeleted.md:25; `_shared.jsx` `ChronicleAct` removed): a row whose own
// thing — the node its second line quotes, the terminal for a comment or a
// citation, else the target — is a removed post or comment reads the removal
// mark where its words were, and another node's words never stand in for it.
// A row whose thing is not removed reads as it did.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.RecordLink
import com.cogra.domain.RecordRow
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.saved.REMOVED_BY_AUTHOR
import com.cogra.domain.saved.REMOVED_BY_THE_PLATFORM
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
import javax.inject.Provider

class ChronicleRemovedRowRepositoryTest {

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

    /** The rows one chronicle page of [nodes] reads, in order. */
    private suspend fun rows(vararg nodes: String): List<RecordRow> {
        val body = """{"data":{"user":{"__typename":"User","id":"u2","chronicle":{
           "__typename":"ChronicleEntryConnection","edges":[${nodes.joinToString(",") { "{\"node\":$it}" }}],
           "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}}"""
        server.enqueue(MockResponse().setBody(body).addHeader("Content-Type", "application/json"))
        return (repo().chronicle("u2", 20, null) as Outcome.Success).value.items
    }

    private fun removal(by: String?) =
        if (by == null) "null" else """{"__typename":"Removal","at":"2026-11-23T09:00:00Z","by":"$by"}"""

    /** A post as a record's leg reads it; a removed one has lost its words. */
    private fun post(id: String, removedBy: String? = null) = """
        {"__typename":"Post","id":"$id",
         "title":{"value":${if (removedBy == null) "\"Post $id\"" else "null"}},
         "content":{"value":${if (removedBy == null) "\"words of $id\"" else "null"}},
         "removal":${removal(removedBy)}}
    """.trimIndent()

    /** A comment as a record's leg reads it, its thread's post [onPost]. */
    private fun comment(id: String, onPost: String, removedBy: String? = null) = """
        {"__typename":"Comment","id":"$id",
         "content":{"value":${if (removedBy == null) "\"words of $id\"" else "null"}},
         "removal":${removal(removedBy)},
         "target":{"__typename":"Post","id":"$onPost"}}
    """.trimIndent()

    private fun record(id: String, family: String, act: String, target: String, terminal: String = "null") = """
        {"__typename":"Record","id":"$id","family":"$family","act":"$act",
         "targetId":"t","terminalId":null,"landedAt":"2026-11-20T10:00:00Z",
         "pDirected":0.4,"pInterest":0.3,"severed":false,"topic":null,
         "target":$target,"terminal":$terminal}
    """.trimIndent()

    // THE DEFECT: a Review whose comment is removed fell through to its parent
    // post's title — another node's words in the removed comment's place.
    @Test
    fun aRemovedCommentsRowReadsTheMarkAndNeverItsParentPostsWords() = runTest {
        val row = rows(
            record("r1", "REVIEW", "GENESIS", target = post("p1"), terminal = comment("c1", "p1", "AUTHOR")),
        ).single()

        assertThat(row.snippet).isEqualTo(REMOVED_BY_AUTHOR)
        assertThat(row.snippet).isNotEqualTo("Post p1")
        // The door is unchanged: the thread's post.
        assertThat(row.link).isEqualTo(RecordLink.ToPost("p1"))
    }

    // A reply whose parent comment's words stand, but whose own comment is
    // removed: the parent's words never stand in either.
    @Test
    fun aRemovedReplysRowNeverReadsItsParentCommentsWords() = runTest {
        val row = rows(
            record(
                "r1",
                "REVIEW",
                "GENESIS",
                target = comment("c0", "p1"),
                terminal = comment("c1", "p1", "AUTHOR"),
            ),
        ).single()

        assertThat(row.snippet).isEqualTo(REMOVED_BY_AUTHOR)
    }

    @Test
    fun aRemovedPostsPublishAndTagRowsReadTheMark() = runTest {
        val read = rows(
            record("r1", "PUBLISH", "GENESIS", target = post("p1", "AUTHOR")),
            record("r2", "TAG", "ORDINARY", target = post("p1", "ACCOUNT")),
            record("r3", "OPINION", "ORDINARY", target = comment("c1", "p1", "AUTHOR")),
        )

        assertThat(read.map { it.snippet }).containsExactly(REMOVED_BY_AUTHOR, REMOVED_BY_AUTHOR, REMOVED_BY_AUTHOR)
        // Doors unchanged: the removed thing's detail, its mark there.
        assertThat(read[0].link).isEqualTo(RecordLink.ToPost("p1"))
        assertThat(read[2].link).isEqualTo(RecordLink.ToPost("p1"))
    }

    // A citation's own thing is its terminal, the cited thing: removed, it
    // reads the mark, never the citing post's words.
    @Test
    fun aCitationOfARemovedThingReadsTheMark() = runTest {
        val read = rows(
            record("r1", "REFERENCE", "ORDINARY", target = post("p0"), terminal = post("p1", "AUTHOR")),
            record("r2", "REFERENCE", "ORDINARY", target = post("p0"), terminal = comment("c1", "p2", "AUTHOR")),
        )

        assertThat(read.map { it.snippet }).containsExactly(REMOVED_BY_AUTHOR, REMOVED_BY_AUTHOR).inOrder()
        assertThat(read[1].link).isEqualTo(RecordLink.ToPost("p2"))
    }

    // A moderation removal reads the platform's mark, the second one the app
    // already draws on cards and the cited-by sheet.
    @Test
    fun aModerationRemovalReadsThePlatformsMark() = runTest {
        val row = rows(record("r1", "TAG", "ORDINARY", target = post("p1", "MODERATION"))).single()

        assertThat(row.snippet).isEqualTo(REMOVED_BY_THE_PLATFORM)
    }

    // A row whose own thing stands reads its words as it always did — even
    // when the OTHER leg is removed.
    @Test
    fun aRowWhoseThingIsNotRemovedIsUnchanged() = runTest {
        val read = rows(
            record("r1", "REVIEW", "GENESIS", target = post("p1", "AUTHOR"), terminal = comment("c1", "p1")),
            record("r2", "REFERENCE", "ORDINARY", target = post("p0", "AUTHOR"), terminal = post("p1")),
            record("r3", "PUBLISH", "GENESIS", target = post("p2")),
        )

        assertThat(read.map { it.snippet }).containsExactly("words of c1", "Post p1", "Post p2").inOrder()
    }

    private fun settlingPost(removedBy: String?) = """
        {"__typename":"Post","postId":"p5","genesisRecordId":"rec:p5",
         "createdAt":"2026-11-24T10:00:00Z","landing":{"__typename":"Landing","state":"PENDING"},
         "title":{"value":null},"content":{"value":${if (removedBy == null) "\"body\"" else "null"}},
         "removal":${removal(removedBy)}}
    """.trimIndent()

    private fun settlingComment(removedBy: String?) = """
        {"__typename":"Comment","commentId":"c5","genesisRecordId":"rec:c5",
         "createdAt":"2026-11-24T10:00:00Z","landing":{"__typename":"Landing","state":"PENDING"},
         "content":{"value":${if (removedBy == null) "\"reply\"" else "null"}},
         "removal":${removal(removedBy)},
         "post":{"__typename":"Post","id":"p9"}}
    """.trimIndent()

    @Test
    fun aRemovedSettlingPostOrCommentReadsTheMarkAndKeepsItsDoor() = runTest {
        val read = rows(settlingPost("AUTHOR"), settlingComment("AUTHOR"), settlingPost(null))

        assertThat(read.map { it.snippet }).containsExactly(REMOVED_BY_AUTHOR, REMOVED_BY_AUTHOR, "body").inOrder()
        assertThat(read[0].link).isEqualTo(RecordLink.ToPost("p5"))
        assertThat(read[1].link).isEqualTo(RecordLink.ToPost("p9"))
        assertThat(read.all { it.pending }).isTrue()
    }
}
