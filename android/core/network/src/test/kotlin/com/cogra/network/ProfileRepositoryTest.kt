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
        topic: String = "null",
    ): String {
        val (d, i) = pair.split(",")
        return """{"node":{"__typename":"Record","id":"$id","family":"$family","act":"$act",
           "targetId":"t","terminalId":null,"landedAt":"2026-10-20T10:00:00Z",
           "pDirected":$d,"pInterest":$i,"severed":false,"target":$target,"terminal":$terminal,
           "topic":$topic}}"""
    }

    /** One page of `User.chronicle` around the given edges. */
    private fun chronicle(edges: String) =
        """{"data":{"user":{"__typename":"User","id":"u1","chronicle":{"__typename":"ChronicleEntryConnection",
           "edges":[$edges],
           "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}}"""

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
        enqueue(chronicle(rows))

        val page = (repo().chronicle("u1", 20, null) as Outcome.Success).value.items

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

    // copy-voice, the chronicle's verbs: a tag's aside is its topic, served as
    // `Record.topic` since a Type is no Node; a withdrawn citation's act reads
    // through, and an act this build does not know reads ordinary.
    @Test
    fun aRowCarriesItsTopicAndAWithdrawal() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        val post = """{"__typename":"Post","id":"p1","title":{"value":"Salt maps"},"content":{"value":"x"}}"""
        val saltmaps = """{"__typename":"Hashtag","name":{"__typename":"ModeratedText","value":"saltmaps"}}"""
        val rows = listOf(
            record("r1", "TAG", "ORDINARY", target = post, topic = saltmaps, pair = "1,0.5"),
            record("r2", "REFERENCE", "WITHDRAWAL", target = post, terminal = post, pair = "-0.5,-0.5"),
            record("r3", "OPINION", "SOMETHING_NEWER", target = post),
        ).joinToString(",")
        enqueue(chronicle(rows))

        val page = (repo().chronicle("u1", 20, null) as Outcome.Success).value.items

        assertThat(page[0].topic).isEqualTo("saltmaps")
        assertThat(page[1].act).isEqualTo(RecordAct.WITHDRAWAL)
        assertThat(page[1].topic).isNull()
        assertThat(page[2].act).isEqualTo(RecordAct.ORDINARY)
    }

    // ProfileHeader's figures (Q35, ruled 2026-11-10): the opinion figures
    // `bundleCount`s over unmarked records, each `first: 0`. Posts is the
    // count of the Posts view's own listing — `User.posts`, settling and
    // removed posts counted, never an edit — so the figure and the list agree
    // (ProfilePosts.md:15, ProfilePostsOwn.md:11), never the mirror's
    // landed-only count of Publish records.
    @Test
    fun theFiguresCountThePostsListingAndTheBundlesOfOpinions() = runTest {
        enqueue(
            """{"data":{"user":{"__typename":"User","id":"u1",
               "posts":{"__typename":"PostConnection","totalCount":5},
               "opinionsOn":{"__typename":"RecordConnection","bundleCount":9},
               "opinionsBy":{"__typename":"RecordConnection","bundleCount":null}}}}""",
        )
        val figures = (repo().figures("u1") as Outcome.Success).value
        assertThat(figures.posts).isEqualTo(5)
        assertThat(figures.opinionsOn).isEqualTo(9)
        // A count the server did not serve stays unknown, never a false zero.
        assertThat(figures.opinionsBy).isNull()
        val sent = server.takeRequest().body.readUtf8()
        assertThat(sent).containsMatch("posts\\(first:\\s*0\\)")
        assertThat(sent).doesNotContain("family: PUBLISH")
        assertThat(sent).containsMatch("toKind:\\s*USER")
        assertThat(sent).containsMatch("payloadMarked:\\s*false")
        assertThat(sent).contains("bundleCount")
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

    // -- The Posts and Comments views (ProfilePosts.md, ProfileComments.md) --

    private val removedJson = """{"__typename":"Removal","at":"2026-11-20T09:00:00Z","by":"AUTHOR"}"""

    private fun landingJson(state: String, epoch: Int?) =
        """{"__typename":"Landing","state":"$state","epoch":${epoch ?: "null"}}"""

    /** A post as `PostFields` reads it, with the card's comment count. */
    private fun postJson(id: String, state: String = "LANDED", epoch: Int? = 7, removed: Boolean = false) = """
        {"__typename":"Post","id":"$id",
         "title":{"__typename":"ModeratedText","value":"Post $id","status":"NORMAL"},
         "description":{"__typename":"ModeratedText","value":null,"status":"NORMAL"},
         "content":{"__typename":"ModeratedText","value":${if (removed) "null" else "\"body\""},"status":"NORMAL"},
         "attachments":[],
         "attachmentsStatus":"NORMAL",
         "author":{"__typename":"User","id":"u2","handle":"ada",
           "displayName":{"__typename":"ModeratedText","value":"Ada"},"avatar":null},
         "createdAt":"2026-11-12T10:00:00+00:00",
         "updatedAt":"2026-11-12T10:00:00+00:00",
         "landing":${landingJson(state, epoch)},
         "moderationStatus":"NORMAL",
         "removal":${if (removed) removedJson else "null"},"genesisRecordId":"rec:$id",
         "license":{"__typename":"License","attribution":0.5,"provenance":1.0},
         "topics":[],
         "references":[],"referenceCount":0,
         "commentCount":{"__typename":"CommentConnection","totalCount":3}}
    """.trimIndent()

    /** A comment as the comment card reads it: its fields, its pointer, its post, its replies' count. */
    private fun commentJson(id: String, state: String = "LANDED", epoch: Int? = 7, removed: Boolean = false) = """
        {"__typename":"Comment","id":"$id",
         "content":{"__typename":"ModeratedText","value":${if (removed) "null" else "\"a reply\""},"status":"NORMAL"},
         "attachments":[],
         "attachmentsStatus":"NORMAL",
         "author":{"__typename":"User","id":"u2","handle":"ada",
           "displayName":{"__typename":"ModeratedText","value":"Ada"},"avatar":null},
         "createdAt":"2026-11-12T10:05:00+00:00",
         "updatedAt":"2026-11-12T10:05:00+00:00",
         "landing":${landingJson(state, epoch)},
         "moderationStatus":"NORMAL",
         "removal":${if (removed) removedJson else "null"},"genesisRecordId":"rec:$id",
         "sensitiveSelfMark":false,"sensitiveReason":null,
         "license":{"__typename":"License","attribution":1.0,"provenance":0.0},
         "topics":[],
         "references":[],"referenceCount":0,
         "target":{"__typename":"Post","id":"p9",
           "title":{"__typename":"ModeratedText","value":"Salt maps","status":"NORMAL"},
           "content":{"__typename":"ModeratedText","value":"words","status":"NORMAL"},
           "attachments":[],
           "author":{"__typename":"User","id":"u3","handle":"sol"},
           "moderationStatus":"NORMAL",
           "removal":null},
         "post":{"__typename":"Post","id":"p9"},
         "replies":{"__typename":"CommentConnection","totalCount":2}}
    """.trimIndent()

    private fun listing(field: String, connection: String, nodes: List<String>, next: String?): String {
        val edge = connection.removeSuffix("Connection") + "Edge"
        val edges = nodes.joinToString(",") { "{\"__typename\":\"$edge\",\"node\":$it}" }
        return """{"data":{"user":{"__typename":"User","id":"u2","$field":{"__typename":"$connection",
           "edges":[$edges],
           "pageInfo":{"__typename":"PageInfo","hasNextPage":${next != null},"endCursor":${quoted(next)}}}}}}"""
    }

    // THE POSTS VIEW'S READ (ProfilePosts.md:3, :7, :9; ProfilePostsOwn.md:9):
    // `User.posts`, whose edge node IS the post — a still-settling post at the
    // head wearing its PENDING landing, a removed one in its place — in the
    // listing's own order, a page at a time on its cursor.
    @Test
    fun thePostsViewReadsTheListingSettlingFirstARemovedPostKeptAndPagesOnItsCursor() = runTest {
        enqueue(
            listing(
                "posts",
                "PostConnection",
                listOf(
                    postJson("p3", state = "PENDING", epoch = null),
                    postJson("p2", removed = true),
                    postJson("p1"),
                ),
                next = "c2",
            ),
        )

        val page = (repo().profilePosts("u2", after = "c1") as Outcome.Success).value

        assertThat(page.items.map { it.id }).containsExactly("p3", "p2", "p1").inOrder()
        assertThat(page.items[0].landing.isPending).isTrue()
        assertThat(page.items[1].landing.isPending).isFalse()
        assertThat(page.items[1].removal).isNotNull()
        assertThat(page.items[2].commentCount).isEqualTo(3)
        assertThat(page.hasNextPage).isTrue()
        assertThat(page.endCursor).isEqualTo("c2")
        val sent = server.takeRequest().body.readUtf8()
        assertThat(sent).containsMatch("\"after\"\\s*:\\s*\"c1\"")
        assertThat(sent).containsMatch("posts\\(first:\\s*20,\\s*after:\\s*\\\$after\\)")
        assertThat(sent).doesNotContain("outgoingRecords")
    }

    // THE COMMENTS VIEW'S READ (ProfileComments.md:3, :5; ProfileCommentsOwn.md:7):
    // `User.comments`, whose edge node IS the comment — a still-settling one at
    // the head, its pointer, thread post and replies' count read — and a
    // person the server does not know reads empty.
    @Test
    fun theCommentsViewReadsTheListingSettlingFirstAndAnUnknownPersonReadsEmpty() = runTest {
        enqueue(
            listing(
                "comments",
                "CommentConnection",
                listOf(commentJson("c2", state = "PENDING", epoch = null), commentJson("c1", removed = true)),
                next = null,
            ),
        )
        enqueue("""{"data":{"user":null}}""")

        val page = (repo().profileComments("u2", after = null) as Outcome.Success).value
        val unknown = (repo().profileComments("nobody", after = null) as Outcome.Success).value

        assertThat(page.items.map { it.comment.id }).containsExactly("c2", "c1").inOrder()
        assertThat(page.items[0].comment.landing.isPending).isTrue()
        assertThat(page.items[0].comment.replyCount).isEqualTo(2)
        assertThat(page.items[0].threadPostId).isEqualTo("p9")
        assertThat(page.items[0].target).isNotNull()
        assertThat(page.items[1].comment.removal).isNotNull()
        assertThat(page.hasNextPage).isFalse()
        val sent = server.takeRequest().body.readUtf8()
        assertThat(sent).containsMatch("comments\\(first:\\s*20,\\s*after:\\s*\\\$after\\)")
        assertThat(sent).doesNotContain("outgoingRecords")
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
