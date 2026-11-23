// THE COMMENT CARD'S TWO DOORS, ON EVERY HOST THAT DRAWS IT (jakob 2026-11-23,
// seam 405: "the line is the door to the post the rest of the card opens the
// thread of comments scrolled to the comment"). The pointer — the line shape's
// `On …` line, the feed shape's head row — opens what it names: a post itself,
// at its top, the thread closed; a reply's comment in its thread. The rest of
// the card opens the thread at the comment.
//
// Run once per host (Robolectric's parameterized runner), each host rendered as
// its screen renders it. [CommentCardHostCensusTest] keeps [CommentCardHost]
// whole: a new file that starts drawing the card fails it until it joins.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.domain.ActorRef
import com.cogra.domain.AuthTokens
import com.cogra.domain.CommentView
import com.cogra.domain.ModerationState
import com.cogra.domain.ProfileComment
import com.cogra.domain.feed.FeedCard
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.history.HistoryCard
import com.cogra.domain.history.HistoryEntry
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.saved.SavedCard
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingSavedRepository
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testModeratedField
import com.cogra.feature.saved.SavedUiState
import com.google.common.truth.Truth.assertWithMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.Instant

/** Every host that draws the comment card, the shape it draws, and the path its card wears. */
enum class CommentCardHost(val card: String, val testTagPrefix: String, val line: Boolean) {
    FEED("feed.commentCard", "feed_comment", line = false),
    HISTORY("history.commentCard", "history_comment", line = false),
    SAVED("saved.commentCard", "saved_comment", line = false),
    PROFILE("profile.comments.commentCard", "profile_comment", line = true),
    TAG_PAGE("tagPage.commentCard", "tagPage_comment", line = true),
}

@RunWith(ParameterizedRobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h4000dp")
class CommentPointerDoorTest(private val host: CommentCardHost) {

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0}")
        fun hosts(): List<Array<Any>> = CommentCardHost.entries.map { arrayOf(it) }
    }

    @get:Rule
    val compose = createComposeRule()

    private val comment: CommentView =
        testComment("c1", body = "The glovebox camera earns its keep.", author = ActorRef("u-ada", "ada"))

    /** The comment answers the post p1 itself. */
    private val onPost = CommentTarget.Post(
        id = "p1",
        title = testModeratedField("The long way home"),
        content = testModeratedField("words"),
        mimeTypes = emptyList(),
        coverUrl = null,
        authorHandle = "bo",
        moderation = ModerationState.NORMAL,
        removed = false,
    )

    /** The comment is a reply: it answers @sol's comment c0 in p1's thread. */
    private val onComment =
        CommentTarget.Comment(id = "c0", content = testModeratedField("Where was this?"), authorHandle = "sol")

    /** A post its author removed: the pointer still names it. */
    private val onRemovedPost =
        onPost.copy(title = testModeratedField(null), content = testModeratedField(null), removed = true)

    private val opened = mutableListOf<String>()
    private val doors = CardDoors(
        onOpenPost = { opened += "post:$it" },
        onOpenComment = { postId, commentId, aim ->
            opened += "comment:$postId/$commentId" + if (aim) "+reply" else ""
        },
        onOpenActor = { opened += "actor:$it" },
        onOpenTopic = { opened += "topic:$it" },
    )

    private val tokens = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u-reader") }

    private fun writes() = SavedWrites(RecordingSavedRepository(), tokens, CoroutineScope(Dispatchers.Unconfined))

    private fun render(target: CommentTarget) {
        compose.setContent {
            when (host) {
                CommentCardHost.FEED -> FeedScreen(
                    state = FeedUiState(
                        loading = false,
                        filter = FeedFilter.DEFAULT.copy(kinds = FeedKind.entries.toSet()),
                        cards = listOf(FeedCard.Comment(comment, target = target, threadPostId = "p1")),
                    ),
                    onRefresh = {},
                    onLoadMore = {},
                    onOpenPost = doors.onOpenPost,
                    onOpenActor = doors.onOpenActor,
                    onOpenTopic = doors.onOpenTopic,
                    kinds = FeedKindHooks(onOpenComment = doors.onOpenComment),
                )
                CommentCardHost.HISTORY -> HistoryScreen(
                    state = HistoryUiState(
                        entries = listOf(HistoryEntry(HistoryCard.Comment(comment, target, "p1"), Instant.now())),
                        loading = false,
                        answered = HistoryAsk(null, emptySet()),
                    ),
                    writes = writes(),
                    callbacks = HistoryCallbacks(),
                    doors = HistoryDoors(cards = doors, onComposeWithTag = {}),
                )
                CommentCardHost.SAVED -> SavedScreen(
                    state = SavedUiState(
                        entries = listOf(SavedEntry(SavedCard.Comment(comment, target, "p1", null), Instant.now())),
                        loading = false,
                    ),
                    writes = writes(),
                    onRefresh = {},
                    onLoadMore = {},
                    onRetryMore = {},
                    onSearch = {},
                    onBack = {},
                    doors = doors,
                )
                CommentCardHost.PROFILE, CommentCardHost.TAG_PAGE -> {
                    val profile = host == CommentCardHost.PROFILE
                    HostedCardsScope(
                        doors = doors,
                        routes = HostedCardRoutes(
                            viewerId = "u-reader",
                            signedIn = true,
                            onEditPost = {},
                            onCitePost = {},
                            onReply = {},
                            onEditComment = { _, _ -> },
                            onSignInOrJoin = {},
                        ),
                        hooks = CardHooks(viewerId = "u-reader"),
                        revealed = emptyMap(),
                        tag = if (profile) "profile" else "tagPage",
                        notify = {},
                        placement = if (profile) HostedPlacement.Profile else HostedPlacement.TagPage,
                    ) { hosted ->
                        val card = if (profile) {
                            DataNode("profile") / "comments" / "commentCard"
                        } else {
                            DataNode("tagPage") / "commentCard"
                        }
                        val replies = if (profile) DataNode("profile") / "comments" / "viewReplies" else card
                        Column { hosted.comment(ProfileComment(comment, target, "p1"), card, replies, null) }
                    }
                }
            }
        }
        compose.waitForIdle()
    }

    /** The pointer: the line shape's registered `.target`, the feed shape's head row. */
    private fun pointer(): SemanticsNodeInteraction = if (host.line) {
        compose.onNodeIn("${host.card}:c1", "${host.card}.target")
    } else {
        compose.onNodeWithTag("${host.testTagPrefix}_c1_head")
    }

    private fun assertOpened(vararg doors: String) =
        assertWithMessage(host.name).that(opened).containsExactlyElementsIn(doors.toList()).inOrder()

    // (1) The pointer is the door to the post it names: the post itself, at its
    // top — never its comment section.
    @Test
    fun thePointerOpensThePostItNames() {
        render(onPost)
        pointer().performClick()
        assertOpened("post:p1")
    }

    // A reply's pointer, `On @sol's comment`, names a comment, and the pointer is
    // "its own door, to what it names" (CommentCard.jsx:397): the thread opens
    // at that comment — c0, never the reply itself (the orchestrator's reading,
    // flagged to jakob).
    @Test
    fun aRepliesPointerOpensTheThreadAtTheCommentItNames() {
        render(onComment)
        pointer().performClick()
        assertOpened("comment:p1/c0")
    }

    // (4) No pointer is ruled inert: a removed post's pointer still opens it, as
    // the feed's head row always did (History.md:51, Saved.md:29) — the detail
    // then stands its removal mark.
    @Test
    fun aRemovedPostsPointerStillOpensThePost() {
        render(onRemovedPost)
        pointer().performClick()
        assertOpened("post:p1")
    }

    // (2) The rest of the card opens the thread scrolled to the comment
    // (FeedKinds.md:27, History.md:53, Saved.md:31, ProfileComments.md:51).
    @Test
    fun theRestOfTheCardOpensTheThreadAtTheComment() {
        render(onPost)
        compose.onNodeWithText("The glovebox camera earns its keep.").performClick()
        assertOpened("comment:p1/c1")
    }

    // (3) The pointer is its own door for TalkBack: a button with its own click
    // action, spoken by the words naming the post it opens.
    @Test
    fun thePointerIsANamedButtonOfItsOwn() {
        render(onPost)
        val config = pointer().fetchSemanticsNode().config
        assertWithMessage(host.name).that(config.getOrNull(SemanticsProperties.Role)).isEqualTo(Role.Button)
        assertWithMessage(host.name).that(config.contains(SemanticsActions.OnClick)).isTrue()
        val spoken = config.getOrNull(SemanticsProperties.ContentDescription).orEmpty() +
            config.getOrNull(SemanticsProperties.Text).orEmpty().map { it.text }
        assertWithMessage(host.name).that(spoken).containsExactly("On “The long way home” — @bo")
    }

    // (5) The line answers at 48dp the way the app's other inline doors do
    // (`cg-hit`, `hitTarget`): a tap 20dp above its ink's centre still opens the
    // post. The feed shape's head row is not a line and is not grown.
    @Test
    fun theLinePointerAnswersAt48dp() {
        if (!host.line) return
        render(onPost)
        val ink = compose.onNodeWithText("On “The long way home” — @bo", useUnmergedTree = true)
            .fetchSemanticsNode().boundsInRoot
        val above = with(compose.density) { 20.dp.toPx() }
        compose.onRoot().performTouchInput { click(Offset(ink.left + 4f, ink.center.y - above)) }
        assertOpened("post:p1")
    }
}
