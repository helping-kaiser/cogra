// The feed's cards hosted on a profile's tabs (ProfilePosts.md, ProfileComments.md):
// the post card unchanged but for its inert author chip, and the comment card in
// its line shape — the `On …` pointer leading, the door to the post it names;
// the words whole and a door, the thread's text Reply, the "View n replies"
// line under the card — those landing on the thread at the comment. web's twins are
// `profile-posts.test.tsx` and `profile-comments.test.tsx`.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertHasNoClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.DataNode
import com.cogra.domain.ActorRef
import com.cogra.domain.CommentView
import com.cogra.domain.FieldStatus
import com.cogra.domain.Landing
import com.cogra.domain.LicenseChoice
import com.cogra.domain.ModeratedField
import com.cogra.domain.ModerationState
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.ProfileComment
import com.cogra.domain.ReferenceContentKind
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.testing.testMentionTarget
import com.cogra.domain.testing.testReferenceClaim
import com.cogra.domain.testing.testTopicClaim
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h4000dp")
class HostedCardsTest {

    @get:Rule
    val compose = createComposeRule()

    private val now = Instant.now()
    private val ada = ActorRef("u1", "ada", "Ada Okonkwo")

    private fun text(value: String?) = ModeratedField(value, FieldStatus.NORMAL)

    private val opened = mutableListOf<String>()
    private val doors = CardDoors(
        onOpenPost = { opened += "post:$it" },
        onOpenComment = { postId, commentId, aim ->
            opened += "comment:$postId/$commentId" + if (aim) "+reply" else ""
        },
        onOpenActor = { opened += "actor:$it" },
        onOpenTopic = { opened += "topic:$it" },
    )

    private fun post(landing: Landing = Landing.landed(1), removal: Removal? = null) = PostView(
        id = "p1",
        title = text("The long way home"),
        description = text(null),
        content = text(if (removal == null) "Took the coast road." else null),
        author = ada,
        createdAt = now.minusSeconds(86_400),
        updatedAt = now.minusSeconds(86_400),
        landing = landing,
        license = LicenseChoice.PublicDomain,
        removal = removal,
    )

    private fun comment(
        removal: Removal? = null,
        replies: Int = 2,
        landing: Landing = Landing.landed(2),
    ) = ProfileComment(
        comment = CommentView(
            id = "c1",
            content = text(if (removal == null) "The glovebox camera earns its keep." else null),
            author = ada,
            createdAt = now.minusSeconds(86_400),
            updatedAt = now.minusSeconds(86_400),
            landing = landing,
            license = LicenseChoice.PublicDomain,
            replyCount = replies,
            removal = removal,
        ),
        target = CommentTarget.Post(
            id = "p9",
            title = text("Salt maps of the coast road"),
            content = text("words"),
            mimeTypes = emptyList(),
            coverUrl = null,
            authorHandle = "sol",
            moderation = ModerationState.NORMAL,
            removed = false,
        ),
        threadPostId = "p9",
    )

    private val posts = DataNode("profile") / "posts" / "card"
    private val cards = DataNode("profile") / "comments" / "commentCard"
    private val replies = DataNode("profile") / "comments" / "viewReplies"

    private fun host(
        signedIn: Boolean = true,
        placement: HostedPlacement = HostedPlacement.Profile,
        viewerId: String = "u2",
        tagHere: String? = null,
        body: @Composable (HostedCards) -> Unit,
    ) {
        compose.setContent {
            CompositionLocalProvider(LocalReferenceReads provides reads.reads) {
                HostedCardsScope(
                    doors = doors,
                    routes = HostedCardRoutes(
                        viewerId = viewerId,
                        signedIn = signedIn,
                        onEditPost = {},
                        onCitePost = {},
                        onReply = {},
                        onEditComment = { _, _ -> },
                        onSignInOrJoin = {},
                    ),
                    hooks = CardHooks(viewerId = viewerId),
                    revealed = emptyMap(),
                    tag = if (placement == HostedPlacement.Profile) "profile" else "tagPage",
                    notify = {},
                    placement = placement,
                    tagHere = tagHere,
                ) { hosted -> Column { body(hosted) } }
            }
        }
    }

    private val reads = ScriptedReferenceReads()

    private fun shown(tag: String) =
        compose.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    // ProfilePosts.md:3 — the post card as the feed draws it, wearing
    // `profile.posts.card` keyed by the post's id; its words open the post.
    @Test
    fun aHostedPostIsTheFeedsCardAndOpensThePost() {
        host { it.post(post(), posts) }
        assertThat(shown("profile.posts.card:p1")).isTrue()
        compose.onNodeWithText("Took the coast road.").performClick()
        assertThat(opened).containsExactly("post:p1")
    }

    // ProfilePosts.md:25 — the author chip on the person's own card is the
    // page it stands on: a tap changes nothing.
    @Test
    fun aHostedPostsAuthorChipIsInert() {
        host { it.post(post(), posts) }
        // An inert chip is no control of its own: it merges into the card.
        compose.onNodeIn("profile.posts.card:p1", "profile.posts.card.authorChip", useUnmergedTree = true)
            .performClick()
        assertThat(opened).isEmpty()
    }

    // ProfilePosts.md:5 — a still-settling post wears `Still settling`, as the
    // feed's card does.
    @Test
    fun aStillSettlingPostWearsItsMarker() {
        host { it.post(post(landing = Landing.Pending), posts) }
        assertThat(shown("profile_post_pending_p1")).isTrue()
    }

    // ProfilePosts.md:11, ProfilePostsOwn.md:19 — a post removed before it
    // lands wears both marks: the removal mark in the content's place and
    // `Still settling`.
    @Test
    fun aPostRemovedBeforeItLandsWearsBothMarks() {
        host { it.post(post(landing = Landing.Pending, removal = Removal(now, RemovalAgent.AUTHOR)), posts) }
        assertThat(shown("profile.posts.card.removalMark")).isTrue()
        compose.onNodeWithTag("profile_post_pending_p1", useUnmergedTree = true).assertTextEquals("Still settling")
    }

    // ProfileComments.md:5, ProfileCommentsOwn.md:7 — a still-settling comment
    // wears `Still settling`, as the thread's landed reply does; a landed one
    // wears none.
    @Test
    fun aStillSettlingCommentWearsItsMarker() {
        host {
            it.comment(comment(landing = Landing.Pending), cards, replies, null)
        }
        compose.onNodeWithTag("profile_comment_c1_pending", useUnmergedTree = true).assertTextEquals("Still settling")
    }

    @Test
    fun aLandedCommentWearsNoSettlingMarker() {
        host { it.comment(comment(), cards, replies, null) }
        assertThat(shown("profile_comment_c1_pending")).isFalse()
    }

    // ProfileComments.md:7 — the card leads with its pointer to what it
    // answers; the pointer is the door to the post it names, never its comment
    // section (jakob 2026-11-23, seam 405).
    @Test
    fun theCommentsPointerLeadsAndOpensThePost() {
        host { it.comment(comment(), cards, replies, null) }
        compose.onNodeWithText("On “Salt maps of the coast road” — @sol").assertIsDisplayed()
        compose.onNodeIn("profile.comments.commentCard:c1", "profile.comments.commentCard.target").performClick()
        assertThat(opened).containsExactly("post:p9")
    }

    // A reply's pointer names the comment it answers, and opens the thread at
    // it — never at the reply itself (CommentCard.jsx:397, "to what it names").
    @Test
    fun aRepliesPointerOpensTheThreadAtTheCommentItAnswers() {
        val reply = comment().copy(target = CommentTarget.Comment("c0", text("Where was this?"), "sol"))
        host { it.comment(reply, cards, replies, null) }
        compose.onNodeWithText("On @sol's comment").assertIsDisplayed()
        compose.onNodeIn("profile.comments.commentCard:c1", "profile.comments.commentCard.target").performClick()
        assertThat(opened).containsExactly("comment:p9/c0")
    }

    // ProfileComments.md:35, :39 — Reply opens the thread aimed at the
    // comment; the author chip is inert.
    @Test
    fun replyOpensTheThreadAimedAtTheCommentAndTheAuthorChipIsInert() {
        host { it.comment(comment(), cards, replies, null) }
        compose.onNodeIn(
            "profile.comments.commentCard:c1",
            "profile.comments.commentCard.authorChip",
            useUnmergedTree = true,
        ).performClick()
        assertThat(opened).isEmpty()
        compose.onNodeIn("profile.comments.commentCard:c1", "profile.comments.commentCard.actionRow.reply")
            .performClick()
        assertThat(opened).containsExactly("comment:p9/c1+reply")
    }

    // ProfileComments.md:43, ProfileCommentsOwn.md:15 — the card tapped outside
    // its pointer and its own controls opens the post's comment section
    // scrolled to that comment (round 3 hand test, A8: it opened nothing).
    @Test
    fun theCardsWordsOpenTheThreadAtTheComment() {
        host { it.comment(comment(), cards, replies, null) }
        compose.onNodeWithText("The glovebox camera earns its keep.").performClick()
        assertThat(opened).containsExactly("comment:p9/c1")
    }

    // ProfileComments.md:27 — the replies line under the card opens the thread
    // at the comment, wearing `profile.comments.viewReplies` keyed by its id.
    @Test
    fun theRepliesLineOpensTheThreadAtTheComment() {
        host { it.comment(comment(), cards, replies, null) }
        compose.onNodeWithText("View 2 replies").assertIsDisplayed()
        compose.onNodeWithTag("profile.comments.viewReplies:c1").performClick()
        assertThat(opened).containsExactly("comment:p9/c1")
    }

    @Test
    fun aCommentWithNoRepliesDrawsNoRepliesLine() {
        host { it.comment(comment(replies = 0), cards, replies, null) }
        assertThat(shown("profile.comments.viewReplies:c1")).isFalse()
    }

    // ProfileComments.md:29 — an applicant's Reply answers instead of the
    // thread opening.
    @Test
    fun anApplicantsReplyAnswersAndNeverOpensTheThread() {
        var answered = 0
        host { it.comment(comment(), cards, replies) { answered++ } }
        compose.onNodeIn("profile.comments.commentCard:c1", "profile.comments.commentCard.actionRow.reply")
            .performClick()
        assertThat(answered).isEqualTo(1)
        assertThat(opened).isEmpty()
    }

    // A guest's card draws no Reply, as the thread draws none for one.
    @Test
    fun aGuestsCardDrawsNoReply() {
        host(signedIn = false) { it.comment(comment(), cards, replies, null) }
        assertThat(shown("profile.comments.commentCard.actionRow.reply")).isFalse()
    }

    // TopicsLine.jsx:202-212, graph.json FeedKinds 27 — a comment's count is
    // a door: the tags-and-references sheet over the host, its rows leaving
    // through the host's doors (RefsSheet.md:9-15).
    @Test
    fun aCommentsCountOpensItsTagsAndReferences() {
        val listed = comment().let {
            it.copy(
                comment = it.comment.copy(
                    topics = listOf(testTopicClaim("saltmaps")),
                    references = listOf(testReferenceClaim(testMentionTarget("mira"))),
                ),
            )
        }
        host { it.comment(listed, cards, replies, null) }
        compose.onNodeWithTag("profile_comment_c1_refs_sheet").assertDoesNotExist()
        compose.onNodeWithTag("profile_comment_c1_topics_counts", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("profile_comment_c1_refs_sheet").assertExists()
        compose.onNodeWithTag("profile_comment_c1_refs_reference_l1-user-mira").performClick()
        compose.onNodeWithTag("profile_comment_c1_refs_sheet").assertDoesNotExist()
        assertThat(opened).containsExactly("actor:mira")
    }

    // api-spec.md "Query budgets" (jakob 2026-11-23): a hosted comment card
    // carries the count its read served, and its sheet reads the rows by id.
    @Test
    fun aHostedCommentCardCountsAndItsSheetReadsTheRowsById() {
        reads.answer = Outcome.Success(
            listOf(testReferenceClaim(testMentionTarget("mira")), testReferenceClaim(testMentionTarget("ada"))),
        )
        val listed = comment().let {
            it.copy(comment = it.comment.copy(topics = listOf(testTopicClaim("saltmaps")), referenceCount = 2))
        }
        host { it.comment(listed, cards, replies, null) }
        compose.onNodeWithTag("profile_comment_c1_topics_counts", useUnmergedTree = true)
            .assertTextEquals("· 2 references")
        assertThat(reads.asked).isEmpty()
        compose.onNodeWithTag("profile_comment_c1_topics_counts", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("profile_comment_c1_refs_reference_l1-user-mira").assertExists()
        compose.onNodeWithTag("profile_comment_c1_refs_reference_l1-user-ada").assertExists()
        assertThat(reads.asked).containsExactly(ReferenceContentKind.COMMENT to "c1")
    }

    // The post card hosted on a profile reads its own post's rows.
    @Test
    fun aHostedPostCardsSheetReadsThePostsRowsById() {
        reads.answer = Outcome.Success(listOf(testReferenceClaim(testMentionTarget("mira"))))
        host { it.post(post().copy(topics = listOf(testTopicClaim("saltmaps")), referenceCount = 1), posts) }
        compose.onNodeIn("profile.posts.card:p1", "profile.posts.card.tagsLine.counts", useUnmergedTree = true)
            .assertTextEquals("· 1 reference")
            .performClick()
        compose.onNodeWithTag("profile_post_p1_refs_reference_l1-user-mira").assertExists()
        assertThat(reads.asked).containsExactly(ReferenceContentKind.POST to "p1")
    }

    // jakob 2026-11-23 — on a tag's own page its chip opens nothing, as the
    // person's own name opens nothing on their profile: no second page of the
    // tag, and the tap never falls through to the card's door. Every other tag
    // still opens.
    @Test
    fun onATagsOwnPageItsChipIsInertAndAnotherStillOpens() {
        val tagged = post().copy(topics = listOf(testTopicClaim("rust"), testTopicClaim("fieldnotes")))
        host(placement = HostedPlacement.TagPage, tagHere = "rust") {
            it.post(tagged, DataNode("tagPage") / "card")
        }
        // An inert chip is no control of its own: it merges into the card.
        compose.onNodeWithTag("tagPage.card.tagsLine.tag:rust", useUnmergedTree = true)
            .assertHasNoClickAction()
            .performClick()
        assertThat(opened).isEmpty()
        compose.onNodeWithTag("tagPage.card.tagsLine.tag:fieldnotes").assertHasClickAction().performClick()
        assertThat(opened).containsExactly("topic:fieldnotes")
    }

    // The same rule inside a sheet raised over the page: the tags-and-references
    // sheet's row for the page's own tag is a plain row; another row still leaves.
    @Test
    fun overATagsOwnPageItsRowInTheTagsSheetOpensNothing() {
        val listed = comment().let {
            it.copy(
                comment = it.comment.copy(
                    topics = listOf(testTopicClaim("rust")),
                    references = listOf(testReferenceClaim(testMentionTarget("mira"))),
                ),
            )
        }
        host(placement = HostedPlacement.TagPage, tagHere = "rust") {
            it.comment(listed, DataNode("tagPage") / "commentCard", replies, null)
        }
        compose.onNodeWithTag("tagPage_comment_c1_topics_counts", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("tagPage_comment_c1_refs_topic_rust", useUnmergedTree = true)
            .assertHasNoClickAction()
            .performClick()
        compose.onNodeWithTag("tagPage_comment_c1_refs_sheet").assertExists()
        assertThat(opened).isEmpty()
        compose.onNodeWithTag("tagPage_comment_c1_refs_reference_l1-user-mira").performClick()
        assertThat(opened).containsExactly("actor:mira")
    }

    // Off a tag page the same chip is a door, as it is everywhere.
    @Test
    fun offATagPageTheChipStillOpensItsTag() {
        val tagged = post().copy(topics = listOf(testTopicClaim("rust")))
        host { it.post(tagged, posts) }
        compose.onNodeWithTag("profile.posts.card.tagsLine.tag:rust").performClick()
        assertThat(opened).containsExactly("topic:rust")
    }

    // `CommentCard`'s line shape carries no score and no share.
    @Test
    fun theLineShapeCarriesNoScoreAndNoShare() {
        host { it.comment(comment(), cards, replies, null) }
        assertThat(shown("profile.comments.commentCard.actionRow.score")).isFalse()
        assertThat(shown("profile.comments.commentCard.actionRow.share")).isFalse()
    }

    // ProfileComments.md:7, :9 — a removed comment keeps its place, its mark
    // where its words were, its author chip, time and pointer, and its ⋮.
    @Test
    fun aRemovedCommentKeepsItsPlaceItsPointerAndItsMenu() {
        host { it.comment(comment(removal = Removal(now, RemovalAgent.AUTHOR)), cards, replies, null) }
        compose.onNodeWithTag("profile.comments.commentCard.removalMark.line", useUnmergedTree = true)
            .assertTextEquals("Removed by its author")
        compose.onNodeWithTag("profile.comments.commentCard.removalMark.detail", useUnmergedTree = true)
            .assertTextEquals("The comment's place in the thread, and every response, remain.")
        assertThat(shown("profile.comments.commentCard.authorChip")).isTrue()
        assertThat(shown("profile.comments.commentCard.target")).isTrue()
        assertThat(shown("profile.comments.commentCard.menu")).isTrue()
        assertThat(shown("profile.comments.commentCard.actionRow.reply")).isTrue()
    }

    // -- A removed card keeps its ⋮ (round 57; the *RemovedMenu* boards) --

    private val removed = Removal(now, RemovalAgent.AUTHOR)

    /** Opens [trigger] and asserts [rows] stand top to bottom under [sheet] and [absent] do not. */
    private fun assertMenu(trigger: String, sheet: String, rows: List<String>, absent: List<String>) {
        compose.onNodeWithTag(trigger, useUnmergedTree = true).performClick()
        compose.onNodeWithTag(sheet).assertExists()
        val tops = rows.map { compose.onNodeWithTag("$sheet.$it").fetchSemanticsNode().boundsInRoot.top }
        assertThat(tops).isInStrictOrder()
        absent.forEach { assertThat(shown("$sheet.$it")).isFalse() }
    }

    private val readerPostRows = listOf("save", "cite", "hide", "citedBy", "opinions", "license", "report")
    private val ownRemovedPostRows = listOf("save", "cite", "citedBy", "opinions", "license")
    private val ownOnlyPostRows = listOf("edit", "markSensitive", "remove")

    // ProfilePosts.md:11, ProfilePostsRemovedMenu.md:3, :5 — another's removed
    // post keeps its ⋮, the reader's post menu whole, Report at the tail.
    @Test
    fun anothersRemovedPostOnAProfileKeepsTheReadersMenuWhole() {
        host { it.post(post(removal = removed), posts) }
        assertThat(shown("profile.posts.card.removalMark")).isTrue()
        assertMenu("profile.posts.card.menu", "profile.menuSheet", readerPostRows, ownOnlyPostRows)
    }

    // ProfilePostsOwn.md:13, ProfilePostsRemovedMenuOwn.md:3, :5 — the reader's
    // own removed post: the own menu less Edit, Mark as sensitive and Remove.
    @Test
    fun anOwnRemovedPostOnTheOwnProfileLosesEditSensitiveAndRemove() {
        host(viewerId = "u1") { it.post(post(removal = removed), posts) }
        assertMenu(
            "profile.posts.card.menu",
            "profile.menuSheet",
            ownRemovedPostRows,
            ownOnlyPostRows + listOf("hide", "report"),
        )
    }

    // ProfileComments.md:9, ProfileCommentsRemovedMenu.md:3, :5 — another's
    // removed comment: the reader's comment menu whole, Hide with its author's
    // handle after Cite.
    @Test
    fun anothersRemovedCommentKeepsTheReadersCommentMenu() {
        host { it.comment(comment(removal = removed), cards, replies, null) }
        assertMenu(
            "profile.comments.commentCard.menu",
            "profile.menuSheet",
            listOf("save", "cite", "hide", "citedBy", "opinions", "license", "report"),
            listOf("edit", "remove"),
        )
    }

    // ProfileCommentsOwn.md:11, ProfileCommentsRemovedMenuOwn.md:3, :5 — the
    // reader's own removed comment: the own comment menu less Edit and Remove.
    @Test
    fun anOwnRemovedCommentLosesEditAndRemove() {
        host(viewerId = "u1") { it.comment(comment(removal = removed), cards, replies, null) }
        assertMenu(
            "profile.comments.commentCard.menu",
            "profile.menuSheet",
            listOf("save", "cite", "citedBy", "opinions", "license"),
            listOf("edit", "remove", "hide", "report"),
        )
    }

    // TagPageRemovedMenu.md:3, :5 — another's removed tagged post: the reader's
    // post menu whole under `tagPage.menuSheet`, every row registered.
    @Test
    fun anothersRemovedTaggedPostKeepsTheReadersMenuWhole() {
        host(placement = HostedPlacement.TagPage) { it.post(post(removal = removed), tagCard) }
        assertMenu("tagPage.card.menu", "tagPage.menuSheet", readerPostRows, ownOnlyPostRows)
    }

    // TagPageRemovedMenuOwn.md:3, :5 — the reader's own removed tagged post.
    @Test
    fun anOwnRemovedTaggedPostLosesEditSensitiveAndRemove() {
        host(placement = HostedPlacement.TagPage, viewerId = "u1") { it.post(post(removal = removed), tagCard) }
        assertMenu(
            "tagPage.card.menu",
            "tagPage.menuSheet",
            ownRemovedPostRows,
            ownOnlyPostRows + listOf("hide", "report"),
        )
    }

    // TagPageMenuOwn (nodes.json) — a live own tagged post keeps its whole own
    // menu, Edit, Mark as sensitive and Remove wearing the registered rows.
    @Test
    fun anOwnLiveTaggedPostKeepsItsWholeOwnMenu() {
        host(placement = HostedPlacement.TagPage, viewerId = "u1") { it.post(post(), tagCard) }
        assertMenu(
            "tagPage.card.menu",
            "tagPage.menuSheet",
            listOf("save", "cite", "edit", "markSensitive", "remove", "citedBy", "opinions", "license"),
            listOf("hide", "report"),
        )
    }

    // -- A tag's page (TagPage.md, TagPageMenu.md) --

    private val tagCard = DataNode("tagPage") / "card"
    private val tagComment = DataNode("tagPage") / "commentCard"

    // TagPage.md:15 — the feed's post card, wearing `tagPage.card` keyed by
    // the post's id; the author is not the page here, so the chip is a door.
    @Test
    fun aTagPagesPostIsTheFeedsCardAndItsAuthorIsADoor() {
        host(placement = HostedPlacement.TagPage) { it.post(post(), tagCard) }
        assertThat(shown("tagPage.card:p1")).isTrue()
        compose.onNodeIn("tagPage.card:p1", "tagPage.card.authorChip", useUnmergedTree = true).performClick()
        assertThat(opened).containsExactly("actor:ada")
        compose.onNodeWithText("Took the coast road.").performClick()
        assertThat(opened).containsExactly("actor:ada", "post:p1").inOrder()
    }

    // TagPageMenu.md:3, :5 — a tagged post's ⋮ raises `tagPage.menuSheet`, the
    // reader's rows under it, Report at the tail.
    @Test
    fun aTagPagesPostMenuRaisesTheTagPagesSheet() {
        host(placement = HostedPlacement.TagPage) { it.post(post(), tagCard) }
        compose.onNodeWithTag("tagPage.card.menu").performClick()
        compose.onNodeWithTag("tagPage.menuSheet").assertExists()
        val tops = listOf(
            "tagPage.menuSheet.save",
            "tagPage.menuSheet.cite",
            "tagPage.menuSheet.hide",
            "tagPage.menuSheet.license",
            "tagPage.menuSheet.report",
        ).map { compose.onNodeWithTag(it).fetchSemanticsNode().boundsInRoot.top }
        assertThat(tops).isInStrictOrder()
    }

    // TagPage.md:15, :17 — a tagged comment stands as the comment card leading
    // with the thread it answers, and offers no Reply and no view-replies line.
    @Test
    fun aTaggedCommentLeadsWithItsThreadAndOffersNoReplyAndNoRepliesLine() {
        host(placement = HostedPlacement.TagPage) { it.comment(comment(replies = 2), tagComment, tagComment, null) }
        compose.onNodeWithText("On “Salt maps of the coast road” — @sol").assertIsDisplayed()
        assertThat(shown("tagPage.commentCard.actionRow.reply")).isFalse()
        assertThat(shown("tagPage.commentCard:c1")).isTrue()
        compose.onNodeWithText("View 2 replies").assertDoesNotExist()
        compose.onNodeIn("tagPage.commentCard:c1", "tagPage.commentCard.target").performClick()
        assertThat(opened).containsExactly("post:p9")
    }

    // A tagged comment's author is a door too: the page is the tag's, not theirs.
    @Test
    fun aTaggedCommentsAuthorIsADoor() {
        host(placement = HostedPlacement.TagPage) { it.comment(comment(), tagComment, tagComment, null) }
        compose.onNodeIn("tagPage.commentCard:c1", "tagPage.commentCard.authorChip", useUnmergedTree = true)
            .performClick()
        assertThat(opened).containsExactly("actor:ada")
    }
}
