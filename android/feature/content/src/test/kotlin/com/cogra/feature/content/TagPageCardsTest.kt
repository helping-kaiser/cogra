// THE TAG PAGE'S CARDS (TagPage.md:15-33; round 60's registry): the feed's own
// post card and the comment card in its line shape, hosted under
// `HostedPlacement.TagPage` — every part `TagPage` and `TagPageHeldPad`
// register under `tagPage.card` and `tagPage.commentCard`, live and removed,
// and the lines the cards themselves answer: no Reply, the removed post's
// pointer by its author, the mark in the words' place, the score as every
// feed card's. The page around them is `TopicScreenTest`'s.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalShowExactValues
import com.cogra.core.designsystem.StanceControl
import com.cogra.core.designsystem.StanceControlState
import com.cogra.core.designsystem.StancePoint
import com.cogra.domain.ActorRef
import com.cogra.domain.CommentView
import com.cogra.domain.FieldStatus
import com.cogra.domain.Landing
import com.cogra.domain.LicenseChoice
import com.cogra.domain.MediaAssetView
import com.cogra.domain.ModeratedField
import com.cogra.domain.ModerationState
import com.cogra.domain.PostView
import com.cogra.domain.ProfileComment
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.score.FeedStandings
import com.cogra.domain.testing.entry
import com.cogra.domain.testing.testTopicClaim
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.Instant

/** The board's rows (`TagPageBody`): @tobias's words post, @sol's gallery post, @ada's tagged comment. */
private const val TOBIAS_POST = "dd44f5de-d68c-4931-aabc-915cefadab7f"
private const val SOL_POST = "734cd530-6c98-4f22-9027-2ff4ff46b5b5"
private const val ADA_COMMENT = "c4d2e6f8-1a3b-4d5c-8e9f-6a7b8c9d0e1f"

/** A post card's parts every post of the board wears (`r60/registered-paths.txt`). */
private val POST_CARD_PARTS = listOf(
    "", ".actionRow", ".actionRow.comments", ".actionRow.comments.count", ".actionRow.score",
    ".actionRow.score.value", ".actionRow.share", ".actionRow.stance", ".actionRow.stance.anchor",
    ".actionRow.stance.anchor.exact", ".actionRow.stance.anchor.face", ".authorChip", ".authorChip.avatar",
    ".authorChip.handle", ".authorChip.name", ".menu", ".timestamp",
)

/** `TagPage`'s live card rows: (path, key) as the registry lists them. */
private val TAG_PAGE_LIVE_CARDS =
    POST_CARD_PARTS.flatMap { part -> listOf(SOL_POST, TOBIAS_POST).map { "tagPage.card$part" to it } } +
        listOf(
            "tagPage.card.body" to TOBIAS_POST,
            "tagPage.card.description" to SOL_POST,
            "tagPage.card.media" to SOL_POST,
            "tagPage.card.media.dots" to SOL_POST,
            "tagPage.card.media.frame" to "$SOL_POST/1",
            "tagPage.card.media.frame" to "$SOL_POST/2",
            "tagPage.card.opener" to SOL_POST,
            "tagPage.card.tagsLine" to SOL_POST,
            "tagPage.card.tagsLine.tag" to "$SOL_POST/fieldnotes",
            "tagPage.card.tagsLine.tag" to "$SOL_POST/saltmaps",
            "tagPage.card.title" to SOL_POST,
        ) +
        listOf(
            "", ".actionRow", ".actionRow.stance", ".actionRow.stance.anchor", ".actionRow.stance.anchor.exact",
            ".actionRow.stance.anchor.face", ".authorChip", ".authorChip.avatar", ".authorChip.handle",
            ".authorChip.name", ".menu", ".target",
        ).map { "tagPage.commentCard$it" to ADA_COMMENT }

/** `TagPage`'s removed copies (the `post` and `comment` chips' `removed`). */
private val TAG_PAGE_REMOVED_CARDS = listOf("", ".line", ".when").flatMap { part ->
    listOf("tagPage.card.removalMark$part" to TOBIAS_POST, "tagPage.commentCard.removalMark$part" to ADA_COMMENT)
}

/** `TagPageHeldPad`'s card rows: the live board's, no removed copy. */
private val HELD_PAD_CARDS = TAG_PAGE_LIVE_CARDS

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h4000dp")
class TagPageCardsTest {

    @get:Rule
    val compose = createComposeRule()

    private val now = Instant.now()
    private fun text(value: String?) = ModeratedField(value, FieldStatus.NORMAL)
    private val removal = Removal(now.minusSeconds(7_200), RemovalAgent.AUTHOR)

    private val sol = ActorRef("u-sol", "sol", "Sol Amari")
    private val tobias = ActorRef("u-tobias", "tobias", "Tobias Lindqvist")
    private val ada = ActorRef("u-ada", "ada", "Ada Okonkwo")

    private fun picture(id: String) = MediaAssetView(
        id = id,
        url = "https://example.invalid/$id.jpg",
        altText = "alt $id",
        status = FieldStatus.NORMAL,
        aspectRatio = 1.0f,
    )

    private val solPost = PostView(
        id = SOL_POST,
        title = text("Salt maps of the coast road"),
        description = text(
            "Rubbings from every slipway between the two lighthouses, taken at low tide over a month of " +
                "mornings, each one pinned to where the stone met the water and what the weather was doing. ".repeat(6),
        ),
        content = text(null),
        author = sol,
        createdAt = now.minusSeconds(86_400),
        updatedAt = now.minusSeconds(86_400),
        landing = Landing.landed(1),
        license = LicenseChoice.PublicDomain,
        topics = listOf(testTopicClaim("fieldnotes"), testTopicClaim("saltmaps")),
        attachments = listOf(picture("m1"), picture("m2")),
        commentCount = 3,
    )

    private fun tobiasPost(removed: Boolean) = PostView(
        id = TOBIAS_POST,
        title = text(null),
        description = text(null),
        content = text(if (removed) null else "Low tide at six tomorrow — anyone walking the flats?"),
        author = tobias,
        createdAt = now.minusSeconds(3_600),
        updatedAt = now.minusSeconds(3_600),
        landing = Landing.landed(1),
        license = LicenseChoice.PublicDomain,
        commentCount = 1,
        removal = if (removed) removal else null,
    )

    private fun onSolsPost(removed: Boolean) = CommentTarget.Post(
        id = SOL_POST,
        title = text("Salt maps of the coast road"),
        content = text("words"),
        mimeTypes = emptyList(),
        coverUrl = null,
        authorHandle = "sol",
        moderation = ModerationState.NORMAL,
        removed = removed,
    )

    private fun adaComment(removed: Boolean, postRemoved: Boolean = false) = ProfileComment(
        comment = CommentView(
            id = ADA_COMMENT,
            content = text(if (removed) null else "Low tide is kinder to the rubbings than noon ever was."),
            author = ada,
            createdAt = now.minusSeconds(4 * 86_400),
            updatedAt = now.minusSeconds(4 * 86_400),
            landing = Landing.landed(2),
            license = LicenseChoice.PublicDomain,
            replyCount = 2,
            removal = if (removed) removal else null,
        ),
        target = onSolsPost(postRemoved),
        threadPostId = SOL_POST,
    )

    /** The figures the reader's last feed fetch found: @sol's computed, @tobias's not reached. */
    private val standings = FeedStandings().apply {
        hold(
            reader = "reader",
            ranking = FeedRanking(asOfEpoch = 2, entries = listOf(entry(SOL_POST, newestIndex = 0, score = 0.003))),
            viewer = "reader",
        )
    }

    private val card = DataNode("tagPage") / "card"
    private val commentCard = DataNode("tagPage") / "commentCard"

    private fun render(posts: List<PostView>, comments: List<ProfileComment>) {
        compose.setContent {
            CompositionLocalProvider(
                LocalShowExactValues provides true,
                LocalScoreDoor provides ScoreDoor(standings.state.value, "reader") {},
            ) {
                HostedCardsScope(
                    doors = CardDoors(
                        onOpenPost = {},
                        onOpenComment = { _, _, _ -> },
                        onOpenActor = {},
                        onOpenTopic = {},
                    ),
                    routes = HostedCardRoutes(
                        viewerId = "reader",
                        signedIn = true,
                        onEditPost = {},
                        onCitePost = {},
                        onReply = {},
                        onEditComment = { _, _ -> },
                        onSignInOrJoin = {},
                    ),
                    hooks = CardHooks(
                        viewerId = "reader",
                        stanceControl = { _, prefix, node ->
                            StanceControl(
                                state = StanceControlState(standing = StancePoint(0.1, 0.1)),
                                onHoldDefault = {},
                                onOpenPad = {},
                                onPick = {},
                                onCommit = {},
                                onDismissPad = {},
                                onOpenAlternates = {},
                                onOpenSeverance = {},
                                onConfirmSeverance = {},
                                onDismissSeverance = {},
                                onConfirmationShown = {},
                                testTagPrefix = prefix,
                                node = node,
                            )
                        },
                    ),
                    revealed = emptyMap(),
                    tag = "tagPage",
                    notify = {},
                    placement = HostedPlacement.TagPage,
                ) { hosted ->
                    Column {
                        posts.forEach { hosted.post(it, card) }
                        comments.forEach { hosted.comment(it, commentCard, commentCard, null) }
                    }
                }
            }
        }
        compose.waitForIdle()
    }

    private fun shown(tag: String) =
        compose.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    /**
     * A registered (path, key) pair as the harness pairs it: an instance root
     * wears `path:key`; a part its bare path inside the instance its key
     * names; a nested key `outer/inner` the inner instance inside `…:outer`.
     */
    private fun registered(path: String, key: String): SemanticsMatcher {
        fun tagged(predicate: (String) -> Boolean) = SemanticsMatcher("tag") { node ->
            node.config.getOrNull(SemanticsProperties.TestTag)?.let(predicate) == true
        }
        val parts = key.split("/")
        val last = parts.last()
        val outer = parts.dropLast(1).lastOrNull()
        val root = tagged { it == "$path:$last" }
        val asRoot = if (outer == null) root else (root and hasAnyAncestor(tagged { it.endsWith(":$outer") }))
        val asPart = tagged { it == path } and hasAnyAncestor(tagged { it.endsWith(":$last") })
        return asRoot or asPart
    }

    private fun missing(rows: List<Pair<String, String>>) = rows.filter { (path, key) ->
        compose.onAllNodes(registered(path, key), useUnmergedTree = true).fetchSemanticsNodes().isEmpty()
    }

    // -- The census --

    // TagPage (round 60): every card and comment card part the board registers stands, live.
    @Test
    fun theTagPageBoardsLiveCardsWearEveryRegisteredPart() {
        render(listOf(tobiasPost(removed = false), solPost), listOf(adaComment(removed = false)))
        assertThat(missing(TAG_PAGE_LIVE_CARDS)).isEmpty()
    }

    // TagPage's `post` and `comment` chips at `removed`: each mark in its card under its path.
    @Test
    fun theTagPageBoardsRemovedCopiesWearTheirMarks() {
        render(listOf(tobiasPost(removed = true)), listOf(adaComment(removed = true)))
        assertThat(missing(TAG_PAGE_REMOVED_CARDS)).isEmpty()
    }

    // TagPageHeldPad (round 60): the same card rows stand under the parked pad's page.
    @Test
    fun theHeldPadBoardsCardsWearEveryRegisteredPart() {
        render(listOf(tobiasPost(removed = false), solPost), listOf(adaComment(removed = false)))
        assertThat(missing(HELD_PAD_CARDS)).isEmpty()
    }

    // -- TagPage.md --

    // :17 — a tagged comment's card offers no Reply and no view-replies line, though it has replies.
    @Test
    fun aTaggedCommentsCardOffersNoReplyAndNoViewRepliesLine() {
        render(emptyList(), listOf(adaComment(removed = false)))
        assertThat(shown("tagPage.commentCard.actionRow.reply")).isFalse()
        assertThat(shown("tagPage_comment_${ADA_COMMENT}_reply")).isFalse()
        assertThat(
            compose.onAllNodes(SemanticsMatcher("a replies line") { node ->
                node.config.getOrNull(SemanticsProperties.TestTag)?.contains("viewReplies") == true
            }, useUnmergedTree = true).fetchSemanticsNodes(),
        ).isEmpty()
    }

    // :21 — a tagged comment's pointer names a removed post it answers by its author's handle, never its title.
    @Test
    fun aRemovedPostsPointerNamesItsAuthorNeverItsTitle() {
        render(emptyList(), listOf(adaComment(removed = false, postRemoved = true)))
        val words = compose.onAllNodes(registered("tagPage.commentCard.target", ADA_COMMENT), useUnmergedTree = true)
            .fetchSemanticsNodes()
            .flatMap { node ->
                fun all(n: androidx.compose.ui.semantics.SemanticsNode): List<String> =
                    n.config.getOrNull(SemanticsProperties.Text).orEmpty().map { it.text } + n.children.flatMap(::all)
                all(node)
            }
            .joinToString(" ")
        assertThat(words).contains("@sol's removed post")
        assertThat(words).doesNotContain("Salt maps of the coast road")
    }

    // :23 — with Removed on, the removed post stands as the feed's removed card
    // and the removed comment as `tagPage.commentCard` with its mark in the
    // words' place, each `Removed by its author` with the removal's date.
    @Test
    fun aRemovedTaggedPostAndCommentStandAsTheirMarks() {
        render(listOf(tobiasPost(removed = true)), listOf(adaComment(removed = true)))
        compose.onNode(registered("tagPage.card.removalMark.line", TOBIAS_POST), useUnmergedTree = true)
            .assertExists()
        compose.onNode(registered("tagPage.commentCard.removalMark.line", ADA_COMMENT), useUnmergedTree = true)
            .assertExists()
        assertThat(shown("tagPage.card.body")).isFalse()
        val lines = listOf("tagPage.card.removalMark.line", "tagPage.commentCard.removalMark.line").map { tag ->
            compose.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes().single()
                .config.getOrNull(SemanticsProperties.Text).orEmpty().joinToString { it.text }
        }
        lines.forEach { assertThat(it).isEqualTo("Removed by its author") }
        assertThat(shown("tagPage.card.removalMark.when")).isTrue()
        assertThat(shown("tagPage.commentCard.removalMark.when")).isTrue()
    }

    // :31 — a card's score is what the reader's last feed fetch found, a dash where it found none.
    @Test
    fun aCardsScoreIsTheLatestFetchsFigureADashWhereItFoundNone() {
        render(listOf(tobiasPost(removed = false), solPost), emptyList())
        compose.onNode(registered("tagPage.card.actionRow.score", TOBIAS_POST), useUnmergedTree = true)
            .assertContentDescriptionEquals("Feed score —")
    }

    // :33 — it prints as every feed card's: a computed figure under 0.005 reads 0.01, never 0.00.
    @Test
    fun aCardsScorePrintsAsEveryFeedCardsDoes() {
        render(listOf(solPost), emptyList())
        compose.onNode(registered("tagPage.card.actionRow.score", SOL_POST), useUnmergedTree = true)
            .assertContentDescriptionEquals("Feed score 0.01")
    }

    // The census's own guard: the hosted cards wear the tag page's paths, never the feed's.
    @Test
    fun theHostedCardsNeverWearTheFeedsPaths() {
        render(listOf(solPost), listOf(adaComment(removed = false)))
        compose.onNodeWithTag("tagPage.card:$SOL_POST").assertExists()
        assertThat(shown("feed.card:$SOL_POST")).isFalse()
    }
}
