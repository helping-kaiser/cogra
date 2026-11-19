// THE HIDE ROW OF SOMEONE ELSE'S COMMENT, ON EVERY HOST (CommentMenu.md:7-21),
// compiled from its sidecars: the thread's (CommentMenu, CommentRemovedOtherMenu)
// and the off-thread hosts' (FeedCommentMenu, HistoryCommentMenu,
// SavedCommentMenu, ProfileCommentsMenu, ProfileCommentsRemovedMenu). `Hide @ada`
// after Cite, `Unhide @ada` while hidden, no confirm, the host's snackbar with
// Undo, a failure on the comment's own row with Retry, a guest's tap the gate;
// the own comment has none. Fakes only: no hide leaves the JVM.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.domain.ActorRef
import com.cogra.domain.AuthTokens
import com.cogra.domain.CommentView
import com.cogra.domain.ModerationState
import com.cogra.domain.Outcome
import com.cogra.domain.ProfileComment
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.feed.FeedCard
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.hidden.HiddenEntry
import com.cogra.domain.hidden.HiddenPerson
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.history.HistoryCard
import com.cogra.domain.history.HistoryEntry
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.saved.SavedCard
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingHiddenRepository
import com.cogra.domain.testing.RecordingSavedRepository
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testModeratedField
import com.cogra.feature.saved.LocalSavedHost
import com.cogra.feature.saved.SavedUiState
import com.cogra.feature.saved.rememberSavedHost
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.IOException
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h4000dp")
class CommentMenuHideTest {

    @get:Rule
    val compose = createComposeRule()

    private val reader = "reader-id"
    private val ada = ActorRef("ada-id", "ada")
    private val adaHiddenAt: Instant = Instant.parse("2026-11-01T09:00:00Z")
    private val byAda: CommentView = testComment("c1", author = ada)
    private val mine: CommentView = testComment("mine", author = ActorRef(reader, "me"))

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

    private val hiddenRepository = RecordingHiddenRepository()
    private val tokens = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", reader) }
    private val host = SnackbarHostState()

    private fun hiddenSet(adaHidden: Boolean): HiddenSet {
        if (adaHidden) {
            val person = HiddenPerson(ada.id, ada.handle, null, null, redacted = false)
            hiddenRepository.served = Outcome.Success(listOf(HiddenEntry(person, adaHiddenAt)))
        }
        return HiddenSet(hiddenRepository, tokens, CoroutineScope(Dispatchers.Unconfined)).also {
            runBlocking { it.refetch() }
        }
    }

    private fun writes() = SavedWrites(RecordingSavedRepository(), tokens, CoroutineScope(Dispatchers.Unconfined))

    private val noDoors = CardDoors(onOpenPost = {}, onOpenComment = { _, _, _ -> }, onOpenActor = {}, onOpenTopic = {})

    private fun snackbarMessage(): String? = host.currentSnackbarData?.visuals?.message

    private fun assertRowsInOrder(vararg rows: String) {
        val tops = rows.map { compose.onNodeWithTag(it).fetchSemanticsNode().boundsInRoot.top }
        assertThat(tops).isInStrictOrder()
    }

    // -- The thread --

    private fun renderThread(
        comments: List<CommentView> = listOf(byAda, mine),
        adaHidden: Boolean = false,
        onRequireAccount: (() -> Unit)? = null,
    ) {
        val store = hiddenSet(adaHidden)
        compose.setContent {
            CommentsSheet(
                state = CommentsUiState(loading = false, comments = comments, total = comments.size),
                viewerId = reader,
                signedIn = onRequireAccount == null,
                onDismiss = {},
                onLoadMoreComments = {},
                onAddComment = {},
                onReplyTo = {},
                onEditComment = {},
                onCommentSignedShown = {},
                onLoadMoreReplies = {},
                onReveal = { _, _ -> },
                onOpenActor = {},
                onOpenTopic = {},
                onOpenPost = {},
                onReference = {},
                onLicense = {},
                onSignInOrJoin = {},
                saved = writes(),
                hidden = store,
                onRequireAccount = onRequireAccount,
            )
        }
        compose.waitForIdle()
    }

    private fun openThreadMenu(id: String) =
        compose.onNodeIn("postDetail.threadSheet.commentCard:$id", "postDetail.threadSheet.commentCard.menu")
            .performClick()

    /** CommentMenu.md:7, :9 — someone else's comment: Hide @ada after Cite, before Cited by. */
    @Test
    fun anothersCommentInTheThreadCarriesHideAfterCite() {
        renderThread()
        openThreadMenu("c1")
        assertRowsInOrder(
            "postDetail.menuSheet.save",
            "postDetail.menuSheet.cite",
            "postDetail.menuSheet.hide",
            "postDetail.menuSheet.citedBy",
            "postDetail.menuSheet.opinions",
            "postDetail.menuSheet.license",
            "postDetail.menuSheet.report",
        )
        compose.onNodeWithTag("postDetail.menuSheet.hide").assertTextEquals("Hide @ada")
    }

    /** CommentMenu.md:9 — never on the reader's own comment. */
    @Test
    fun theOwnCommentCarriesNoHide() {
        renderThread()
        openThreadMenu("mine")
        compose.onNodeWithTag("postDetail.menuSheet.cite").assertExists()
        compose.onNodeWithTag("postDetail.menuSheet.hide").assertDoesNotExist()
    }

    /**
     * CommentMenu.md:11 — the menu closes, the thread stands as it was, the
     * hidden person's comments where they stood, and the snackbar names them
     * with Undo; no confirm.
     */
    @Test
    fun hidingFromTheThreadKeepsTheirCommentsAndSaysSoWithUndo() {
        renderThread()
        openThreadMenu("c1")
        compose.onNodeWithTag("postDetail.menuSheet.hide").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.hides).containsExactly(ada.id to null)
        compose.onNodeWithTag("postDetail.menuSheet").assertDoesNotExist()
        compose.onNodeWithTag("postDetail.threadSheet.commentCard:c1").assertExists()
        compose.onNodeWithText("@ada is hidden.").assertExists()
        compose.onNodeWithText("Undo").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.unhides).containsExactly(ada.id)
    }

    /** CommentMenu.md:17, :19 — hidden, the row reads Unhide @ada and its tap unhides. */
    @Test
    fun theThreadsRowReadsUnhideWhileTheAuthorIsHidden() {
        renderThread(adaHidden = true)
        openThreadMenu("c1")
        compose.onNodeWithTag("postDetail.menuSheet.hide").assertTextEquals("Unhide @ada").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.unhides).containsExactly(ada.id)
        compose.onNodeWithText("@ada is unhidden.").assertExists()
    }

    /** CommentMenu.md:15 — a hide that does not go through reverts, and the comment's row says so with Retry. */
    @Test
    fun aFailedHideInTheThreadSaysRetryOnTheCommentsRow() {
        hiddenRepository.hideAnswers.addLast(Outcome.Failed(IOException("down")))
        renderThread()
        openThreadMenu("c1")
        compose.onNodeWithTag("postDetail.menuSheet.hide").performClick()
        compose.waitForIdle()
        compose.onNodeWithTag("comment_c1_row_line", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("Retry", useUnmergedTree = true).performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.hides).hasSize(2)
    }

    /** CommentMenu.md:47, GuestGate.md:7 — a guest's Hide raises the gate and sends nothing. */
    @Test
    fun aGuestsHideInTheThreadRaisesTheGate() {
        var asked = 0
        renderThread(onRequireAccount = { asked++ })
        openThreadMenu("c1")
        compose.onNodeWithTag("postDetail.menuSheet.hide").performClick()
        compose.waitForIdle()
        assertThat(asked).isEqualTo(1)
        assertThat(hiddenRepository.hides).isEmpty()
    }

    // -- The feed's comment card --

    private fun renderFeed() {
        val store = hiddenSet(adaHidden = false)
        compose.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides host) {
                FeedScreen(
                    state = FeedUiState(
                        loading = false,
                        filter = FeedFilter.DEFAULT.copy(kinds = FeedKind.entries.toSet()),
                        cards = listOf(
                            FeedCard.Comment(byAda, target = null, threadPostId = "p1"),
                            FeedCard.Comment(testComment("c2", author = ActorRef("bo-id", "bo")), null, "p1"),
                        ),
                    ),
                    onRefresh = {},
                    onLoadMore = {},
                    onOpenPost = {},
                    onOpenActor = {},
                    onOpenTopic = {},
                    viewerId = reader,
                    saved = writes(),
                    hidden = store,
                )
            }
        }
        compose.waitForIdle()
    }

    /**
     * FeedCommentMenu.md:5, :7 — `feed.menuSheet` carries Hide after Cite; the
     * tap takes the person's comment cards out of the feed, the one it was made
     * from among them, and the feed's snackbar names them with Undo.
     */
    @Test
    fun hidingFromAFeedCommentCardTakesTheirCardsOut() {
        renderFeed()
        compose.onNodeIn("feed.commentCard:c1", "feed.commentCard.menu").performClick()
        assertRowsInOrder("feed.menuSheet.cite", "feed.menuSheet.hide", "feed.menuSheet.citedBy")
        compose.onNodeWithTag("feed.menuSheet.hide").assertTextEquals("Hide @ada").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.hides).containsExactly(ada.id to null)
        compose.onNodeWithTag("feed.commentCard:c1").assertDoesNotExist()
        compose.onNodeWithTag("feed.commentCard:c2").assertExists()
        assertThat(snackbarMessage()).isEqualTo("@ada is hidden.")
        assertThat(host.currentSnackbarData?.visuals?.actionLabel).isEqualTo("Undo")
    }

    // -- History --

    private fun renderHistory(adaHidden: Boolean) {
        val store = hiddenSet(adaHidden)
        compose.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides host) {
                HistoryScreen(
                    state = HistoryUiState(
                        entries = listOf(HistoryEntry(HistoryCard.Comment(byAda, onPost, "p1"), Instant.now())),
                        loading = false,
                        answered = HistoryAsk(null, emptySet()),
                    ),
                    writes = writes(),
                    callbacks = HistoryCallbacks(),
                    doors = HistoryDoors(cards = noDoors, onComposeWithTag = {}),
                    hidden = store,
                    hooks = CardHooks(viewerId = reader),
                )
            }
        }
        compose.waitForIdle()
    }

    /** HistoryCommentMenu.md:5, :7 — Hide after Cite; History stands as it stood, the snackbar names them. */
    @Test
    fun hidingFromHistorysCommentMenuKeepsTheCard() {
        renderHistory(adaHidden = false)
        compose.onNodeWithTag("history.commentCard.menu").performClick()
        assertRowsInOrder("history.menuSheet.cite", "history.menuSheet.hide", "history.menuSheet.citedBy")
        compose.onNodeWithTag("history.menuSheet.hide").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.hides).containsExactly(ada.id to null)
        compose.onNodeWithTag("history.commentCard:c1").assertExists()
        assertThat(snackbarMessage()).isEqualTo("@ada is hidden.")
    }

    /** HistoryCommentMenu.md:9, :11 — hidden, the row reads Unhide @ada and its tap unhides. */
    @Test
    fun historysCommentRowReadsUnhideWhileTheAuthorIsHidden() {
        renderHistory(adaHidden = true)
        compose.onNodeWithTag("history.commentCard.menu").performClick()
        compose.onNodeWithTag("history.menuSheet.hide").assertTextEquals("Unhide @ada").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.unhides).containsExactly(ada.id)
        assertThat(snackbarMessage()).isEqualTo("@ada is unhidden.")
    }

    // -- Saved --

    /** SavedCommentMenu.md:5, :7 — `saved.menuSheet.hide` after Cite; every card stays where it is. */
    @Test
    fun hidingFromSavedsCommentMenuKeepsEveryCard() {
        val store = hiddenSet(adaHidden = false)
        compose.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides host) {
                Column {
                    SavedScreen(
                        state = SavedUiState(
                            entries = listOf(SavedEntry(SavedCard.Comment(byAda, onPost, "p1", null), Instant.now())),
                            loading = false,
                        ),
                        writes = writes(),
                        onRefresh = {},
                        onLoadMore = {},
                        onRetryMore = {},
                        onSearch = {},
                        onBack = {},
                        doors = noDoors,
                        hidden = store,
                        hooks = CardHooks(viewerId = reader),
                    )
                    CograSnackbarHost(host)
                }
            }
        }
        compose.onNodeWithTag("saved.commentCard.menu").performClick()
        assertRowsInOrder("saved.menuSheet.cite", "saved.menuSheet.hide", "saved.menuSheet.citedBy")
        compose.onNodeWithTag("saved.menuSheet.hide").assertTextEquals("Hide @ada").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.hides).containsExactly(ada.id to null)
        compose.onNodeWithTag("saved.commentCard:c1").assertExists()
        compose.onNodeWithText("@ada is hidden.").assertExists()
    }

    // -- A profile's Comments tab --

    private fun renderProfileComment(comment: CommentView) {
        val store = hiddenSet(adaHidden = false)
        val writes = writes()
        compose.setContent {
            val saved = rememberSavedHost(writes, host, DataNode("profile") / "snackbar", null, store)
            CompositionLocalProvider(LocalSnackbarHostState provides host, LocalSavedHost provides saved) {
                HostedCardsScope(
                    doors = noDoors,
                    routes = HostedCardRoutes(
                        viewerId = reader,
                        signedIn = true,
                        onEditPost = {},
                        onCitePost = {},
                        onReply = {},
                        onEditComment = { _, _ -> },
                        onSignInOrJoin = {},
                    ),
                    hooks = CardHooks(viewerId = reader),
                    revealed = emptyMap(),
                    tag = "profile",
                    notify = {},
                ) { hosted ->
                    Column {
                        hosted.comment(
                            ProfileComment(comment = comment, target = onPost, threadPostId = "p1"),
                            DataNode("profile") / "comments" / "commentCard",
                            DataNode("profile") / "comments" / "viewReplies",
                            null,
                        )
                    }
                }
            }
        }
        compose.waitForIdle()
    }

    /** ProfileCommentsMenu.md:5, :9 — Hide after Cite; the reader stays on the profile, every card in place. */
    @Test
    fun hidingFromAProfilesCommentMenuKeepsTheCard() {
        renderProfileComment(byAda)
        compose.onNodeWithTag("profile.comments.commentCard.menu").performClick()
        assertRowsInOrder("profile.menuSheet.cite", "profile.menuSheet.hide", "profile.menuSheet.citedBy")
        compose.onNodeWithTag("profile.menuSheet.hide").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.hides).containsExactly(ada.id to null)
        compose.onNodeWithTag("profile.comments.commentCard:c1").assertExists()
        assertThat(snackbarMessage()).isEqualTo("@ada is hidden.")
    }

    /**
     * ProfileCommentsRemovedMenu.md:5, :7 — a removed comment's menu keeps
     * Hide with its author's handle; the tap hides, the mark in its place.
     */
    @Test
    fun aRemovedCommentsMenuKeepsHide() {
        renderProfileComment(byAda.copy(removal = Removal(Instant.now(), RemovalAgent.AUTHOR)))
        compose.onNodeWithTag("profile.comments.commentCard.menu").performClick()
        compose.onNodeWithTag("profile.menuSheet.hide").assertTextEquals("Hide @ada").performClick()
        compose.waitForIdle()
        assertThat(hiddenRepository.hides).containsExactly(ada.id to null)
        compose.onNodeWithTag("profile.comments.commentCard:c1").assertExists()
    }
}
