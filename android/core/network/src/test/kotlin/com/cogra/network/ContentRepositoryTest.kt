// The content repository against a MockWebServer through the real
// generated Apollo client: fragment mapping (moderated fields, page
// info), the prepare tier split, and the edit input's present-null
// clear semantics on the wire.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.ErrorCode
import com.cogra.domain.FieldStatus
import com.cogra.domain.Landing
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.topics.TagClaim
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
        attachments: String = "[]",
    ) = """
        {"__typename":"Post","id":"$id",
         "title":{"__typename":"ModeratedText","value":${title?.let { "\"$it\"" } ?: "null"},"status":"NORMAL"},
         "description":{"__typename":"ModeratedText","value":null,"status":"NORMAL"},
         "content":{"__typename":"ModeratedText",
                    "value":${if (redacted) "null" else "\"body\""},
                    "status":"${if (redacted) "REDACTED" else "NORMAL"}"},
         "attachments":$attachments,
         "attachmentsStatus":"NORMAL",
         "author":{"__typename":"User","id":"u1","handle":"alice","displayName":{"__typename":"ModeratedText","value":"Alice"},"avatar":null},
         "createdAt":"2026-08-12T10:00:00+00:00",
         "updatedAt":"2026-08-12T11:00:00+00:00",
         "landing":$landing,
         "moderationStatus":"NORMAL",
         "license":{"__typename":"License","attribution":0.5,"provenance":1.0},
         "topics":[],
         "references":[]}
    """.trimIndent()

    /** One attachment as the contract serves it. */
    private fun mediaJson(
        id: String = "m1",
        altText: String? = "A salt crust",
        status: String = "NORMAL",
        aspectRatio: String? = "0.8",
    ) = """
        {"__typename":"MediaAttachment","id":"$id","url":"https://media/$id",
         "altText":${altText?.let { "\"$it\"" } ?: "null"},
         "status":"$status",
         "options":{"__typename":"MediaOptions","aspectRatio":${aspectRatio?.let { "\"$it\"" } ?: "null"}}}
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
               "attachments":[],
               "attachmentsStatus":"NORMAL",
               "author":null,
               "createdAt":"2026-08-12T10:00:00+00:00",
               "updatedAt":"2026-08-12T10:00:00+00:00",
               "landing":${landingJson("LANDED", 3)},
               "moderationStatus":"NORMAL",
               "license":{"__typename":"License","attribution":0.0,"provenance":0.0},
               "topics":[],
               "references":[],
               "comments":{"__typename":"CommentConnection",
                 "edges":[{"__typename":"CommentEdge","node":{"__typename":"Comment","id":"c1",
                   "content":{"__typename":"ModeratedText","value":"hi","status":"NORMAL"},
                   "attachments":[${mediaJson("cm1")}],
                   "attachmentsStatus":"NORMAL",
                   "author":{"__typename":"User","id":"u2","handle":"bob","displayName":{"__typename":"ModeratedText","value":"Bob"}},
                   "createdAt":"2026-08-12T10:05:00+00:00",
                   "updatedAt":"2026-08-12T10:05:00+00:00",
                   "landing":${landingJson("PENDING", null)},
                   "moderationStatus":"NORMAL",
                   "license":{"__typename":"License","attribution":1.0,"provenance":0.0},
                   "topics":[],
                   "references":[],
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
        // A comment is text plus optional media (D16), and its gallery
        // maps like a post's.
        val commentMedia = detail.comments.items.single().attachments.single()
        assertThat(commentMedia.id).isEqualTo("cm1")
        assertThat(commentMedia.altText).isEqualTo("A salt crust")
        assertThat(commentMedia.aspectRatio).isEqualTo(0.8f)

        enqueue("""{"data":{"post":null}}""")
        assertThat((repo().post("gone", 20, null) as Outcome.Success).value).isNull()
    }

    @Test
    fun aGalleryMapsInOrderWithItsStateAndReservedShape() = runTest {
        enqueue(
            """{"data":{"posts":{"__typename":"PostConnection",
               "edges":[{"__typename":"PostEdge","node":${
                postJson(
                    "p1",
                    "Salt maps",
                    attachments = "[${mediaJson("m1")},${mediaJson("m2", altText = null, aspectRatio = "1.91")}]",
                )
            }}],
               "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}""",
        )
        val post = (repo().posts(20, null) as Outcome.Success).value.items.single()
        assertThat(post.attachments.map { it.id }).containsExactly("m1", "m2").inOrder()
        assertThat(post.attachmentsStatus).isEqualTo(FieldStatus.NORMAL)
        assertThat(post.isMediaPost).isTrue()
        // A described asset keeps its words; an undescribed one stays
        // null rather than acquiring a fabricated description (D20).
        assertThat(post.attachments[0].altText).isEqualTo("A salt crust")
        assertThat(post.attachments[1].altText).isNull()
        assertThat(post.attachments[1].aspectRatio).isEqualTo(1.91f)
    }

    @Test
    fun anUnparsableRatioReservesASquareRatherThanCollapsing() = runTest {
        enqueue(
            """{"data":{"posts":{"__typename":"PostConnection",
               "edges":[{"__typename":"PostEdge","node":${
                postJson("p1", null, attachments = "[${mediaJson(aspectRatio = null)}]")
            }}],
               "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}""",
        )
        val post = (repo().posts(20, null) as Outcome.Success).value.items.single()
        // The field exists to hold the tile open before the load; a
        // zero would collapse exactly what it is there to reserve.
        assertThat(post.attachments.single().aspectRatio).isEqualTo(1f)
    }

    @Test
    fun aRedactedAssetKeepsItsMark() = runTest {
        enqueue(
            """{"data":{"posts":{"__typename":"PostConnection",
               "edges":[{"__typename":"PostEdge","node":${
                postJson(
                    "p1",
                    null,
                    attachments = "[${mediaJson(altText = null, status = "REDACTED")}]",
                )
            }}],
               "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}""",
        )
        val post = (repo().posts(20, null) as Outcome.Success).value.items.single()
        assertThat(post.attachments.single().status).isEqualTo(FieldStatus.REDACTED)
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

    /**
     * The mark is part of that complete state: an edit prepared without
     * it unmarks the post, so it rides every edit — the switch always,
     * its reason only under the switch (api-spec.md "The author's own
     * sensitive mark").
     */
    @Test
    fun anEditReStatesTheAuthorsOwnSensitiveMark() = runTest {
        enqueue(
            """{"data":{"preparePostEdit":{"__typename":"PrepareContentPayload",
               "node":"p1",
               "writes":[{"__typename":"PreparedWrite","id":"w1","family":"PUBLISH",
                          "canonicalProposal":"AA==","gcAfterEpochs":8}],
               "userErrors":[]}}}""",
        )
        repo().preparePostEdit(
            "p1",
            title = null,
            description = null,
            content = "B",
            sensitive = true,
            sensitiveReason = "graphic injury",
        )
        val marked = server.takeRequest().body.readUtf8()
        assertThat(marked).contains("\"sensitive\":true")
        assertThat(marked).contains("\"sensitiveReason\":\"graphic injury\"")

        enqueue(
            """{"data":{"preparePostEdit":{"__typename":"PrepareContentPayload",
               "node":"p1",
               "writes":[{"__typename":"PreparedWrite","id":"w1","family":"PUBLISH",
                          "canonicalProposal":"AA==","gcAfterEpochs":8}],
               "userErrors":[]}}}""",
        )
        // A reason without the switch is a field-level refusal, so an
        // unmarked edit sends the switch alone.
        repo().preparePostEdit(
            "p1",
            title = null,
            description = null,
            content = "B",
            sensitive = false,
            sensitiveReason = "left over from a cleared switch",
        )
        val unmarked = server.takeRequest().body.readUtf8()
        assertThat(unmarked).contains("\"sensitive\":false")
        assertThat(unmarked).contains("\"sensitiveReason\":null")
    }

    /** The edit form's own read: the author's mark, alone. */
    @Test
    fun theSelfMarkReadServesTheAuthorsMarkAlone() = runTest {
        enqueue(
            """{"data":{"post":{"__typename":"Post","id":"p1",
               "sensitiveSelfMark":true,"sensitiveReason":"graphic injury"}}}""",
        )
        val mark = (repo().postSelfMark("p1") as Outcome.Success).value
        assertThat(mark?.sensitive).isTrue()
        assertThat(mark?.reason).isEqualTo("graphic injury")

        enqueue("""{"data":{"post":null}}""")
        assertThat((repo().postSelfMark("gone") as Outcome.Success).value).isNull()
    }

    /**
     * A comment declares its topics on the creation input, the way a
     * post does (F9), and both parameters ride explicitly so an
     * untouched slider says what omitting it would.
     */
    @Test
    fun aCommentCarriesItsDeclaredTopicsOnTheWire() = runTest {
        enqueue(
            """{"data":{"prepareComment":{"__typename":"PrepareContentPayload",
               "node":"c1",
               "writes":[{"__typename":"PreparedWrite","id":"w1","family":"REVIEW",
                          "canonicalProposal":"AA==","gcAfterEpochs":8},
                         {"__typename":"PreparedWrite","id":"w2","family":"TAG",
                          "canonicalProposal":"AQ==","gcAfterEpochs":8}],
               "userErrors":[]}}}""",
        )
        val prepared = repo().prepareComment(
            target = "p1",
            content = "Nice",
            license = LicenseChoice.PublicDomain,
            tags = listOf(TagClaim("rust", relevance = 0.4, confidence = 0.9)),
        )
        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"name\":\"rust\"")
        assertThat(body).contains("\"pDirected\":0.4")
        assertThat(body).contains("\"pInterest\":0.9")
        // The minting Review and its Tag record both come back to sign.
        assertThat((prepared as Outcome.Success).value.writes.map { it.id })
            .containsExactly("w1", "w2").inOrder()
    }

    /** No topics declared means no `tags` key at all, not an empty list. */
    @Test
    fun aCommentWithoutTopicsSendsNoTagsKey() = runTest {
        enqueue(
            """{"data":{"prepareComment":{"__typename":"PrepareContentPayload",
               "node":"c1",
               "writes":[{"__typename":"PreparedWrite","id":"w1","family":"REVIEW",
                          "canonicalProposal":"AA==","gcAfterEpochs":8}],
               "userErrors":[]}}}""",
        )
        repo().prepareComment("p1", "Nice", LicenseChoice.PublicDomain)
        assertThat(server.takeRequest().body.readUtf8()).doesNotContain("\"tags\"")
    }

    /** The server names the offending chip by path, and it survives the mapping (F2). */
    @Test
    fun aRefusedTopicNamesItsChipByPath() = runTest {
        enqueue(
            """{"data":{"prepareComment":{"__typename":"PrepareContentPayload",
               "node":null,"writes":null,
               "userErrors":[{"__typename":"UserError",
                              "message":"`x y` is not a legal topic name",
                              "code":"BAD_INPUT","field":["tags","0","name"]}]}}}""",
        )
        val refused = repo().prepareComment(
            target = "p1",
            content = "Nice",
            license = LicenseChoice.PublicDomain,
            tags = listOf(TagClaim("x y")),
        )
        val error = (refused as Outcome.Refused).errors.single()
        assertThat(error.code).isEqualTo(ErrorCode.BAD_INPUT)
        assertThat(error.field).containsExactly("tags", "0", "name").inOrder()
    }

    // -- A comment's gallery (2026-08-31: comment media) --

    /**
     * Order is the list's own, and there is **no cover**: a comment's
     * set leads nothing, so marking a first picture would state a fact
     * about the gallery that is not true of it.
     */
    @Test
    fun aCommentsGalleryRidesInOrderAndNamesNoCover() = runTest {
        enqueue(
            """{"data":{"prepareComment":{"__typename":"PrepareContentPayload",
               "node":"c1",
               "writes":[{"__typename":"PreparedWrite","id":"w1","family":"REVIEW",
                          "canonicalProposal":"AA==","gcAfterEpochs":8}],
               "userErrors":[]}}}""",
        )
        repo().prepareComment(
            target = "p1",
            content = "Two from the sea wall",
            license = LicenseChoice.PublicDomain,
            attachments = listOf(AttachmentClaim("m1"), AttachmentClaim("m2")),
        )

        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"mediaId\":\"m1\"")
        assertThat(body).contains("\"mediaId\":\"m2\"")
        assertThat(body).contains("\"displayOrder\":0")
        assertThat(body).contains("\"displayOrder\":1")
        assertThat(body).doesNotContain("isCover")
    }

    /**
     * An edit's gallery is the complete state, so an empty one rides as
     * an explicit `[]` — an absent field would leave the old pictures
     * standing and make removing the last one unsayable.
     */
    @Test
    fun aCommentEditClearingItsGallerySaysSoExplicitly() = runTest {
        enqueue(
            """{"data":{"prepareCommentEdit":{"__typename":"PrepareContentPayload",
               "node":"c1",
               "writes":[{"__typename":"PreparedWrite","id":"w1","family":"REVIEW",
                          "canonicalProposal":"AA==","gcAfterEpochs":8}],
               "userErrors":[]}}}""",
        )
        repo().prepareCommentEdit(id = "c1", content = "Words only now")

        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"attachments\":[]")
    }
}
