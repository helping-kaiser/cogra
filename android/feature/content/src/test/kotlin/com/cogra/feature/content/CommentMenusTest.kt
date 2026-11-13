// THE COMMENT'S MENU ON EVERY HOST (rounds 36, 41, 46), compiled from its
// sidecars: the thread's (CommentMenu, CommentMenuOwn) and the off-thread
// hosts' (HistoryCommentMenu(Own), SavedCommentMenu, ProfileCommentsMenu(Own)).
// Another's comment ends its menu with Report; the reader's own carries Edit
// between Cite and Remove, the one door to its edit; the edit opened off the
// thread returns to its host, the one card settling in place, the list untouched.
// Fakes only: no report, edit or save leaves the JVM.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.domain.ActorRef
import com.cogra.domain.CommentView
import com.cogra.domain.Landing
import com.cogra.domain.ModerationState
import com.cogra.domain.ProfileComment
import com.cogra.domain.history.HistoryCard
import com.cogra.domain.history.HistoryEntry
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.saved.SavedCard
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testModeratedField
import com.cogra.feature.saved.SavedUiState
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h4000dp")
class CommentMenusTest {

    @get:Rule
    val compose = createComposeRule()

    private val reader = "reader-id"
    private val mine: CommentView = testComment("mine", author = ActorRef(reader, "me"))
    private val theirs: CommentView = testComment("theirs", author = ActorRef("mira-id", "mira"))

    private val onPost = CommentTarget.Post(
        id = "p1",
        title = testModeratedField("The long way home"),
        content = testModeratedField("words"),
        mimeTypes = emptyList(),
        coverUrl = null,
        authorHandle = "ada",
        moderation = ModerationState.NORMAL,
        removed = false,
    )

    private val reports = mutableListOf<ReportAsk>()
    private val recordReport: ReportSheetSlot = { ask, onDismiss, _ ->
        reports += ask
        onDismiss()
    }
    private val edits = mutableListOf<Pair<String, String>>()
    private val noDoors = CardDoors(onOpenPost = {}, onOpenComment = { _, _, _ -> }, onOpenActor = {}, onOpenTopic = {})
    private val hooks = CardHooks(viewerId = reader, onEditComment = { id, title -> edits += id to title })

    /** Asserts [rows] stand in the sheet top to bottom, each under its registered node. */
    private fun assertRowsInOrder(vararg rows: String) {
        val tops = rows.map { compose.onNodeWithTag(it).fetchSemanticsNode().boundsInRoot.top }
        assertThat(tops).isInStrictOrder()
    }

    // -- The thread --

    private val threadEdits = mutableListOf<String>()

    private fun renderThread(onRequireAccount: (() -> Unit)? = null, report: ReportSheetSlot? = recordReport) {
        compose.setContent {
            Column {
                CommentsSheet(
                    state = CommentsUiState(loading = false, comments = listOf(mine, theirs), total = 2),
                    viewerId = reader,
                    signedIn = onRequireAccount == null,
                    onDismiss = {},
                    onLoadMoreComments = {},
                    onAddComment = {},
                    onReplyTo = {},
                    onEditComment = { threadEdits += it.id },
                    onCommentSignedShown = {},
                    onLoadMoreReplies = {},
                    onReveal = { _, _ -> },
                    onOpenActor = {},
                    onOpenTopic = {},
                    onReference = {},
                    onLicense = {},
                    onSignInOrJoin = {},
                    onRequireAccount = onRequireAccount,
                    reportSheet = report ?: reportDoor(onRequireAccount, "comments_report_sheet"),
                )
            }
        }
        compose.waitForIdle()
    }

    private fun threadCard(id: String) = "postDetail.threadSheet.commentCard:$id"
    private val threadMenu = "postDetail.threadSheet.commentCard.menu"

    /** CommentMenu.md:7 — another's comment: Save, Cite, Cited by, Opinions, License terms, Report at the tail. */
    @Test
    fun anothersCommentMenuEndsWithReport() {
        renderThread()
        compose.onNodeIn(threadCard("theirs"), threadMenu).performClick()
        assertRowsInOrder(
            "postDetail.menuSheet.save",
            "postDetail.menuSheet.cite",
            "postDetail.menuSheet.citedBy",
            "postDetail.menuSheet.opinions",
            "postDetail.menuSheet.license",
            "postDetail.menuSheet.report",
        )
        compose.onNodeWithTag("postDetail.menuSheet.edit").assertDoesNotExist()
        compose.onNodeWithTag("postDetail.menuSheet.remove").assertDoesNotExist()
    }

    /** CommentMenuOwn.md:3, :5 — the own menu: Save, Cite, Edit, Remove, Cited by, Opinions, License; no Report. */
    @Test
    fun theOwnCommentMenuCarriesEditBetweenCiteAndRemoveAndNoReport() {
        renderThread()
        compose.onNodeIn(threadCard("mine"), threadMenu).performClick()
        assertRowsInOrder(
            "postDetail.menuSheet.save",
            "postDetail.menuSheet.cite",
            "postDetail.menuSheet.edit",
            "postDetail.menuSheet.remove",
            "postDetail.menuSheet.citedBy",
            "postDetail.menuSheet.opinions",
            "postDetail.menuSheet.license",
        )
        compose.onNodeWithTag("postDetail.menuSheet.report").assertDoesNotExist()
    }

    /** CommentMenuOwn.md:11, :13 — no card carries Edit; the menu's Edit closes it and opens the edit. */
    @Test
    fun theMenusEditIsTheOneDoorToTheEdit() {
        renderThread()
        compose.onNodeIn(threadCard("mine"), "postDetail.threadSheet.commentCard.actionRow.edit").assertDoesNotExist()
        compose.onNodeIn(threadCard("mine"), threadMenu).performClick()
        compose.onNodeWithTag("postDetail.menuSheet.edit").performClick()
        compose.waitForIdle()
        assertThat(threadEdits).containsExactly("mine")
        compose.onNodeWithTag("postDetail.menuSheet").assertDoesNotExist()
    }

    /** CommentMenu.md:29 — Report closes the menu and raises the confirm for THIS comment; nothing is sent. */
    @Test
    fun reportRaisesTheConfirmForTheComment() {
        renderThread()
        compose.onNodeIn(threadCard("theirs"), threadMenu).performClick()
        compose.onNodeWithTag("postDetail.menuSheet.report").performClick()
        compose.waitForIdle()
        assertThat(reports).containsExactly(ReportAsk("theirs", ReportKind.Comment))
        compose.onNodeWithTag("postDetail.menuSheet").assertDoesNotExist()
    }

    /** CommentMenu.md:33 — a guest's Report raises the join prompt; the readings and License never ask. */
    @Test
    fun aGuestsReportAsksToJoinAndTheReadingsStayOpen() {
        var asked = 0
        renderThread(onRequireAccount = { asked++ }, report = null)
        compose.onNodeIn(threadCard("theirs"), threadMenu).performClick()
        compose.onNodeWithTag("postDetail.menuSheet.citedBy").performClick()
        compose.waitForIdle()
        assertThat(asked).isEqualTo(0)
        compose.onNodeIn(threadCard("theirs"), threadMenu).performClick()
        compose.onNodeWithTag("postDetail.menuSheet.report").performClick()
        compose.waitForIdle()
        assertThat(asked).isEqualTo(1)
    }

    /** CommentMenu.md:29 — the confirm's title names the thing: `Report this comment?`. */
    @Test
    fun theCommentsConfirmReadsReportThisComment() {
        val node = DataNode("postDetail") / "reportSheet"
        compose.setContent {
            ReportConfirmSheet(
                kind = ReportKind.Comment,
                sending = false,
                onReport = {},
                onDismiss = {},
                testTag = "t",
                node = node,
            )
        }
        compose.onNodeWithTag("postDetail.reportSheet.title").assertTextEquals("Report this comment?")
    }

    // -- Off the thread --

    private val host = SnackbarHostState()
    private var refreshed = 0
    private var consumed = 0
    private val rereads = mutableListOf<String>()

    /** What the edit destination hands back; a test flips it to `landed` to stage the return. */
    private var returned by mutableStateOf(CommentsReturn())

    /** The one-comment re-read: the edited comment, now pending — what the read serves right after a signing. */
    private val reread: suspend (String) -> CommentView? = { id ->
        rereads += id
        mine.copy(landing = Landing.Pending)
    }

    private fun renderHistory(comment: CommentView) {
        compose.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides host) {
                HistoryScreen(
                    state = HistoryUiState(
                        entries = listOf(HistoryEntry(HistoryCard.Comment(comment, onPost, "p1"), Instant.now())),
                        loading = false,
                        answered = HistoryAsk(null, emptySet()),
                    ),
                    writes = null,
                    callbacks = HistoryCallbacks(onRefresh = { refreshed++ }),
                    doors = HistoryDoors(cards = noDoors, onComposeWithTag = {}),
                    hooks = hooks,
                    reportSheet = recordReport,
                    commentsReturn = returned,
                    onCommentsReturnConsumed = {
                        consumed++
                        returned = CommentsReturn()
                    },
                    rereadComment = reread,
                )
            }
        }
        compose.waitForIdle()
    }

    /** HistoryCommentMenu.md:3, :5, :13 — `history.menuSheet` unstacked, Report at the tail raising its confirm. */
    @Test
    fun historysCommentMenuEndsWithReportAndRaisesItsConfirm() {
        renderHistory(theirs)
        compose.onNodeWithTag("history.commentCard.menu").performClick()
        compose.onNodeWithTag("history.menuSheet").assertExists()
        assertRowsInOrder(
            "history.menuSheet.save",
            "history.menuSheet.cite",
            "history.menuSheet.citedBy",
            "history.menuSheet.opinions",
            "history.menuSheet.license",
            "history.menuSheet.report",
        )
        compose.onNodeWithTag("history.menuSheet.report").performClick()
        compose.waitForIdle()
        assertThat(reports).containsExactly(ReportAsk("theirs", ReportKind.Comment))
    }

    /**
     * HistoryCommentMenuOwn.md:5, :7 — the own rows under `history.menuSheet`;
     * Edit closes the menu and opens the comment's edit, its caption the post.
     */
    @Test
    fun historysOwnCommentMenuEditOpensTheEdit() {
        renderHistory(mine)
        compose.onNodeWithTag("history.commentCard.menu").performClick()
        assertRowsInOrder(
            "history.menuSheet.save",
            "history.menuSheet.cite",
            "history.menuSheet.edit",
            "history.menuSheet.remove",
            "history.menuSheet.citedBy",
            "history.menuSheet.opinions",
            "history.menuSheet.license",
        )
        compose.onNodeWithTag("history.menuSheet.report").assertDoesNotExist()
        compose.onNodeWithTag("history.menuSheet.edit").performClick()
        compose.waitForIdle()
        assertThat(edits).containsExactly("mine" to "The long way home")
        compose.onNodeWithTag("history.menuSheet").assertDoesNotExist()
    }

    /**
     * HistoryCommentMenuOwn.md:17, CommentEdit.md:89 — signed off the thread,
     * History comes back as it was left: the list is NOT read again, the one
     * edited comment is, and its card settles in place wearing Still settling;
     * the thread never opens.
     */
    @Test
    fun anEditSignedOffTheThreadSettlesItsCardInPlaceWithoutReloadingHistory() {
        renderHistory(mine)
        compose.onNodeWithTag("history_comment_mine_pending", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("history.commentCard.menu").performClick()
        compose.onNodeWithTag("history.menuSheet.edit").performClick()
        compose.waitForIdle()
        returned = CommentsReturn(landed = true)
        compose.waitForIdle()
        assertThat(refreshed).isEqualTo(0)
        assertThat(rereads).containsExactly("mine")
        assertThat(consumed).isEqualTo(1)
        compose.onNodeWithTag("history.commentCard:mine").assertExists()
        compose.onNodeWithTag("history_comment_mine_pending", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("postDetail.threadSheet").assertDoesNotExist()
    }

    /**
     * A signed result no edit of this host's opened and no thread takes is
     * consumed all the same, so the next thread raised here cannot announce
     * it; nothing is re-read and the list is not reloaded.
     */
    @Test
    fun aReturnNoEditOpenedIsConsumedAndReadsNothing() {
        renderHistory(mine)
        returned = CommentsReturn(landed = true)
        compose.waitForIdle()
        assertThat(consumed).isEqualTo(1)
        assertThat(rereads).isEmpty()
        assertThat(refreshed).isEqualTo(0)
        compose.onNodeWithTag("history_comment_mine_pending", useUnmergedTree = true).assertDoesNotExist()
    }

    /** SavedCommentMenu.md:3, :5 — `saved.menuSheet`: Unsave first, Report at the tail. */
    @Test
    fun savedsCommentMenuEndsWithReport() {
        compose.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides host) {
                SavedScreen(
                    state = SavedUiState(
                        entries = listOf(SavedEntry(SavedCard.Comment(theirs, onPost, "p1"), Instant.now())),
                        loading = false,
                    ),
                    writes = null,
                    onRefresh = {},
                    onLoadMore = {},
                    onRetryMore = {},
                    onSearch = {},
                    onBack = {},
                    doors = noDoors,
                    hooks = hooks,
                    reportSheet = recordReport,
                )
            }
        }
        compose.onNodeWithTag("saved.commentCard.menu").performClick()
        assertRowsInOrder(
            "saved.menuSheet.save",
            "saved.menuSheet.cite",
            "saved.menuSheet.citedBy",
            "saved.menuSheet.opinions",
            "saved.menuSheet.license",
            "saved.menuSheet.report",
        )
        compose.onNodeWithTag("saved.menuSheet.report").performClick()
        compose.waitForIdle()
        assertThat(reports).containsExactly(ReportAsk("theirs", ReportKind.Comment))
    }

    /**
     * ProfileCommentsMenuOwn.md:5, :7, :17 — the own comment's menu on the own
     * profile is `profile.menuSheet` with Edit; signed, the profile comes back
     * as it was left and the card settles in place wearing Still settling.
     */
    @Test
    fun theOwnProfilesCommentMenuEditsAndTheCardSettlesInPlace() {
        var profileEdits = 0
        compose.setContent {
            HostedCardsScope(
                doors = noDoors,
                routes = HostedCardRoutes(
                    viewerId = reader,
                    signedIn = true,
                    onEditPost = {},
                    onCitePost = {},
                    onReply = {},
                    onEditComment = { _, _ -> profileEdits++ },
                    onSignInOrJoin = {},
                    commentsReturn = returned,
                    onCommentsReturnConsumed = {
                        consumed++
                        returned = CommentsReturn()
                    },
                ),
                hooks = hooks.copy(onEditComment = { _, _ -> profileEdits++ }),
                revealed = emptyMap(),
                tag = "profile",
                notify = {},
                rereadComment = reread,
            ) { hosted ->
                Column {
                    hosted.comment(
                        ProfileComment(comment = mine, target = onPost, threadPostId = "p1"),
                        DataNode("profile") / "comments" / "commentCard",
                        DataNode("profile") / "comments" / "viewReplies",
                        null,
                    )
                }
            }
        }
        compose.waitForIdle()
        compose.onNodeWithTag("profile.comments.commentCard.menu").performClick()
        compose.onNodeWithTag("profile.menuSheet").assertExists()
        compose.onNodeWithTag("profile.menuSheet.edit").performClick()
        compose.waitForIdle()
        assertThat(profileEdits).isEqualTo(1)
        returned = CommentsReturn(landed = true)
        compose.waitForIdle()
        assertThat(rereads).containsExactly("mine")
        assertThat(consumed).isEqualTo(1)
        compose.onNodeWithTag("profile_comment_mine_pending", useUnmergedTree = true).assertExists()
    }
}
