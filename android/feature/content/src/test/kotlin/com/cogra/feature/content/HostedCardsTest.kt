// The feed's cards hosted on a profile's tabs (ProfilePosts.md, ProfileComments.md):
// the post card unchanged but for its inert author chip, and the comment card in
// its line shape — the `On …` pointer leading, the words whole and no door, the
// thread's text Reply, the "View n replies" line under the card — every door
// landing on the thread the comment lives in. web's twins are
// `profile-posts.test.tsx` and `profile-comments.test.tsx`.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
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
import com.cogra.domain.PostView
import com.cogra.domain.ProfileComment
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.saved.CommentTarget
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

    private fun post(landing: Landing = Landing.landed(1)) = PostView(
        id = "p1",
        title = text("The long way home"),
        description = text(null),
        content = text("Took the coast road."),
        author = ada,
        createdAt = now.minusSeconds(86_400),
        updatedAt = now.minusSeconds(86_400),
        landing = landing,
        license = LicenseChoice.PublicDomain,
    )

    private fun comment(removal: Removal? = null, replies: Int = 2) = ProfileComment(
        comment = CommentView(
            id = "c1",
            content = text(if (removal == null) "The glovebox camera earns its keep." else null),
            author = ada,
            createdAt = now.minusSeconds(86_400),
            updatedAt = now.minusSeconds(86_400),
            landing = Landing.landed(2),
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

    private fun host(signedIn: Boolean = true, body: @Composable (HostedCards) -> Unit) {
        compose.setContent {
            HostedCardsScope(
                doors = doors,
                routes = HostedCardRoutes(
                    viewerId = "u2",
                    signedIn = signedIn,
                    onEditPost = {},
                    onCitePost = {},
                    onReply = {},
                    onEditComment = { _, _ -> },
                    onSignInOrJoin = {},
                ),
                hooks = CardHooks(viewerId = "u2"),
                revealed = emptyMap(),
                tag = "profile",
                notify = {},
            ) { hosted -> Column { body(hosted) } }
        }
    }

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

    // ProfileComments.md:5, :23 — the card leads with its pointer to what it
    // answers, and the pointer opens the thread the comment lives in,
    // scrolled to that comment.
    @Test
    fun theCommentsPointerLeadsAndOpensItsThread() {
        host { it.comment(comment(), cards, replies, null) }
        compose.onNodeWithText("On “Salt maps of the coast road” — @sol").assertIsDisplayed()
        compose.onNodeIn("profile.comments.commentCard:c1", "profile.comments.commentCard.target").performClick()
        assertThat(opened).containsExactly("comment:p9/c1")
    }

    // ProfileComments.md:21, :25 — Reply opens the thread aimed at the
    // comment; the words are no door and the author chip is inert.
    @Test
    fun replyOpensTheThreadAimedAtTheCommentAndTheWordsAreNoDoor() {
        host { it.comment(comment(), cards, replies, null) }
        compose.onNodeWithText("The glovebox camera earns its keep.").performClick()
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

    // `CommentCard`'s line shape carries no score and no share.
    @Test
    fun theLineShapeCarriesNoScoreAndNoShare() {
        host { it.comment(comment(), cards, replies, null) }
        assertThat(shown("profile.comments.commentCard.actionRow.score")).isFalse()
        assertThat(shown("profile.comments.commentCard.actionRow.share")).isFalse()
    }

    // ProfileComments.md:7, :9 — a removed comment keeps its place, its mark
    // where its words were, its author chip, time and pointer, and no menu.
    @Test
    fun aRemovedCommentKeepsItsPlaceItsPointerAndNoMenu() {
        host { it.comment(comment(removal = Removal(now, RemovalAgent.AUTHOR)), cards, replies, null) }
        compose.onNodeWithTag("profile.comments.commentCard.removalMark.line", useUnmergedTree = true)
            .assertTextEquals("Removed by its author")
        compose.onNodeWithTag("profile.comments.commentCard.removalMark.detail", useUnmergedTree = true)
            .assertTextEquals("The comment's place in the thread, and every response, remain.")
        assertThat(shown("profile.comments.commentCard.authorChip")).isTrue()
        assertThat(shown("profile.comments.commentCard.target")).isTrue()
        assertThat(shown("profile.comments.commentCard.menu")).isFalse()
        assertThat(shown("profile.comments.commentCard.actionRow.reply")).isTrue()
    }
}
