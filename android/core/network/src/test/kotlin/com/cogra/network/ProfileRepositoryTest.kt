// The profile repository against a MockWebServer through the real generated
// Apollo client: the chronicle's rows read the record's own `act` (#324) and
// what the act is about — the data round 22's chronicle verbs speak.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.crypto.Family
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.RecordAbout
import com.cogra.domain.RecordAct
import com.cogra.domain.RecordLink
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.stance.OpinionDirection
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

class ProfileRepositoryTest {

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

    private fun enqueue(json: String) {
        server.enqueue(MockResponse().setBody(json).addHeader("Content-Type", "application/json"))
    }

    private fun record(
        id: String,
        family: String,
        act: String,
        target: String = "null",
        terminal: String = "null",
        pair: String = "0.4,0.3",
    ): String {
        val (d, i) = pair.split(",")
        return """{"node":{"__typename":"Record","id":"$id","family":"$family","act":"$act",
           "targetId":"t","terminalId":null,"landedAt":"2026-10-20T10:00:00Z",
           "pDirected":$d,"pInterest":$i,"severed":false,"target":$target,"terminal":$terminal}}"""
    }

    @Test
    fun aRowCarriesItsActAndWhatItIsAbout() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        val post = """{"__typename":"Post","id":"p1","title":{"value":"Salt maps"},"content":{"value":"x"}}"""
        val person = """{"__typename":"User","handle":"ada"}"""
        val rows = listOf(
            record("r1", "PUBLISH", "GENESIS", target = post),
            record("r2", "OPINION", "WALK_BACK", target = person),
            record("r3", "REFERENCE", "ORDINARY", target = post, terminal = person),
            record("r4", "TAG", "ORDINARY", target = post, pair = "0,0"),
            record("r5", "REGISTRATION", "GENESIS"),
        ).joinToString(",")
        enqueue(
            """{"data":{"records":{"__typename":"RecordConnection","edges":[$rows],
               "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}""",
        )

        val page = (repo().authorRecords("u1", 20, null) as Outcome.Success).value.items

        val published = page[0]
        val walkedBack = page[1]
        val mention = page[2]
        val untag = page[3]
        val joined = page[4]
        assertThat(published.act).isEqualTo(RecordAct.GENESIS)
        assertThat(published.genesis).isTrue()
        assertThat(published.about).isEqualTo(RecordAbout.POST)
        assertThat(published.link).isEqualTo(RecordLink.ToPost("p1"))
        assertThat(walkedBack.act).isEqualTo(RecordAct.WALK_BACK)
        assertThat(walkedBack.about).isEqualTo(RecordAbout.PERSON)
        assertThat(walkedBack.targetHandle).isEqualTo("ada")
        // A citation is about its terminal leg — the person it mentions — not
        // the citing post, whose title is not the row's words.
        assertThat(mention.family).isEqualTo(Family.REFERENCE)
        assertThat(mention.about).isEqualTo(RecordAbout.PERSON)
        assertThat(mention.targetHandle).isEqualTo("ada")
        assertThat(mention.snippet).isNull()
        assertThat(untag.untag).isTrue()
        assertThat(untag.about).isEqualTo(RecordAbout.POST)
        assertThat(joined.act).isEqualTo(RecordAct.GENESIS)
    }

    // ProfileHeader's figures (Q35, closed toward the drawn figures): three
    // record counts, each a `totalCount` read with `first: 0`.
    @Test
    fun theFiguresAreTheThreeRecordCounts() = runTest {
        enqueue(
            """{"data":{"user":{"__typename":"User","id":"u1",
               "posts":{"__typename":"RecordConnection","totalCount":5},
               "opinionsOn":{"__typename":"RecordConnection","totalCount":9},
               "opinionsBy":{"__typename":"RecordConnection","totalCount":null}}}}""",
        )
        val figures = (repo().figures("u1") as Outcome.Success).value
        assertThat(figures.posts).isEqualTo(5)
        assertThat(figures.opinionsOn).isEqualTo(9)
        // A count the server did not serve stays unknown, never a false zero.
        assertThat(figures.opinionsBy).isNull()
        val sent = server.takeRequest().body.readUtf8()
        assertThat(sent).containsMatch("genesis:\\s*true")
        assertThat(sent).containsMatch("toKind:\\s*USER")
    }

    // -- The opinions page (ProfileStances): the whole set, folded to people --

    /** A JSON string, or `null`. */
    private fun quoted(value: String?): String = if (value == null) "null" else "\"$value\""

    private fun opinion(
        id: String,
        author: String,
        target: String?,
        d: Double,
        i: Double,
        epoch: Int,
        person: String,
        severed: Boolean = false,
    ) = """{"node":{"__typename":"Record","id":"$id","authorId":"$author","targetId":${quoted(target)},
        "pDirected":$d,"pInterest":$i,"severed":$severed,"payloadMarked":false,
        "landingEpoch":$epoch,"position":0,$person}}"""

    private fun user(id: String, handle: String, name: String?, status: String = "NORMAL") =
        """{"__typename":"User","id":"$id","handle":"$handle",
           "displayName":{"__typename":"ModeratedText","value":${quoted(name)},"status":"$status"},
           "avatar":null}"""

    private fun onPage(edges: List<String>, next: String?) =
        """{"data":{"user":{"__typename":"User","id":"u2","incomingRecords":{"__typename":"RecordConnection",
           "edges":[${edges.joinToString(",")}],
           "pageInfo":{"__typename":"PageInfo","hasNextPage":${next != null},"endCursor":${quoted(next)}}}}}}"""

    @Test
    fun theOnSetIsReadWholeAcrossPagesAndFoldedToOneRowPerAuthor() = runTest {
        enqueue(
            onPage(
                listOf(
                    opinion("r1", "a-ada", "u2", 0.4, 0.2, 1, "\"author\":${user("ada", "ada", "Ada Okonkwo")}"),
                    opinion("r2", "a-kel", "u2", 0.1, 0.1, 1, "\"author\":${user("kel", "kel", null)}"),
                ),
                next = "c1",
            ),
        )
        enqueue(
            onPage(
                listOf(
                    // Ada's revision: a second record of the same bundle.
                    opinion("r3", "a-ada", "u2", 0.3, 0.1, 2, "\"author\":${user("ada", "ada", "Ada Okonkwo")}"),
                    // A deleted account keeps its row, its name gone, its handle the door.
                    opinion("r4", "a-del", "u2", 0.2, 0.2, 2, "\"author\":${user("del", "gone", null, "REDACTED")}"),
                ),
                next = null,
            ),
        )

        val rows = (repo().opinions("u2", OpinionDirection.ON) as Outcome.Success).value

        assertThat(rows.map { it.holderId }).containsExactly("a-ada", "a-del", "a-kel").inOrder()
        assertThat(rows[0].pair.pDirected).isEqualTo(0.7)
        assertThat(rows[0].holder.displayName).isEqualTo("Ada Okonkwo")
        assertThat(rows[1].holder.redacted).isTrue()
        assertThat(rows[1].holder.handle).isEqualTo("gone")
        assertThat(rows[1].holder.actorId).isEqualTo("del")
        server.takeRequest()
        assertThat(server.takeRequest().body.readUtf8()).containsMatch("\"after\"\\s*:\\s*\"c1\"")
    }

    @Test
    fun theBySetRowsAreThePeopleItIsAbout() = runTest {
        enqueue(
            """{"data":{"user":{"__typename":"User","id":"u2","outgoingRecords":{"__typename":"RecordConnection",
               "edges":[
                 ${opinion("r1", "a-u2", "a-mira", 0.4, 0.5, 1, "\"target\":${user("mira", "mira", "Mira Voss")}")},
                 ${opinion("r2", "a-u2", "a-x", -0.2, 0.1, 1, "\"target\":null")}
               ],
               "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}}""",
        )

        val rows = (repo().opinions("u2", OpinionDirection.BY) as Outcome.Success).value

        assertThat(rows.map { it.holder.handle }).containsExactly("mira", null).inOrder()
        // An address no account fronts keeps its row, named by that address.
        assertThat(rows[1].holderId).isEqualTo("a-x")
        assertThat(server.takeRequest().body.readUtf8()).containsMatch("toKind:\\s*USER")
    }

    // THE POSTS VIEW'S READ (ProfilePosts.md:3): the person's genesis Publish
    // records, a page at a time; a record whose target CoGra does not carry
    // as a post is skipped, never a blank card.
    @Test
    fun thePostsViewSkipsARecordWithNoPostAndPagesOnItsCursor() = runTest {
        enqueue(
            """{"data":{"user":{"__typename":"User","id":"u2","posts":{"__typename":"RecordConnection",
               "edges":[{"__typename":"RecordEdge","node":{"__typename":"Record","id":"r1","target":null}},
                        {"__typename":"RecordEdge","node":{"__typename":"Record","id":"r2",
                          "target":{"__typename":"User"}}}],
               "pageInfo":{"__typename":"PageInfo","hasNextPage":true,"endCursor":"c2"}}}}}""",
        )

        val page = (repo().profilePosts("u2", after = "c1") as Outcome.Success).value

        assertThat(page.items).isEmpty()
        assertThat(page.hasNextPage).isTrue()
        assertThat(page.endCursor).isEqualTo("c2")
        val sent = server.takeRequest().body.readUtf8()
        assertThat(sent).containsMatch("\"after\"\\s*:\\s*\"c1\"")
        assertThat(sent).containsMatch("family:\\s*PUBLISH,\\s*toKind:\\s*POST,\\s*genesis:\\s*true")
    }

    // THE COMMENTS VIEW'S READ (ProfileComments.md:3): each comment's own
    // genesis Review, its terminal the comment; anything else is skipped.
    @Test
    fun theCommentsViewSkipsARecordWithNoCommentAndAnUnknownPersonReadsEmpty() = runTest {
        enqueue(
            """{"data":{"user":{"__typename":"User","id":"u2","comments":{"__typename":"RecordConnection",
               "edges":[{"__typename":"RecordEdge","node":{"__typename":"Record","id":"r1",
                 "terminal":{"__typename":"Post"}}}],
               "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}}""",
        )
        enqueue("""{"data":{"user":null}}""")

        val page = (repo().profileComments("u2", after = null) as Outcome.Success).value
        val unknown = (repo().profileComments("nobody", after = null) as Outcome.Success).value

        assertThat(page.items).isEmpty()
        assertThat(server.takeRequest().body.readUtf8()).containsMatch("family:\\s*REVIEW,\\s*genesis:\\s*true")
        assertThat(unknown.items).isEmpty()
        assertThat(unknown.hasNextPage).isFalse()
    }

    @Test
    fun aFailedPageFailsTheWholeRead() = runTest {
        val ada = opinion("r1", "a-ada", "u2", 0.4, 0.2, 1, "\"author\":${user("ada", "ada", null)}")
        enqueue(onPage(listOf(ada), next = "c1"))
        server.enqueue(MockResponse().setResponseCode(500))

        assertThat(repo().opinions("u2", OpinionDirection.ON)).isInstanceOf(Outcome.Failed::class.java)
    }
}
