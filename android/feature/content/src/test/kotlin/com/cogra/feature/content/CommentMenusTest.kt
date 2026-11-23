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
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.domain.ActorRef
import com.cogra.domain.CommentView
import com.cogra.domain.Landing
import com.cogra.domain.ModerationState
import com.cogra.domain.Outcome
import com.cogra.domain.ProfileComment
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.history.HistoryCard
import com.cogra.domain.history.HistoryEntry
import com.cogra.domain.references.CitingArtifact
import com.cogra.domain.references.CitingKind
import com.cogra.domain.references.CitingView
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.saved.SavedCard
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.stance.HeldOpinion
import com.cogra.domain.stance.OpinionHolder
import com.cogra.domain.stance.StancePair
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

    /** What cites the comments: nothing until a test says so; the posts a row opened; the nodes read. */
    private var citing: List<CitingArtifact<CitingView>> = emptyList()
    private val opened = mutableListOf<String>()
    private val readFor = mutableListOf<String>()
    private var holding: List<HeldOpinion> = emptyList()
    private val people = mutableListOf<String>()
    private val reads = InboundReads(
        citedBy = { id ->
            readFor += id
            Outcome.Success(citing)
        },
        opinionsOn = { id ->
            readFor += id
            Outcome.Success(holding)
        },
    )
    private val noDoors = CardDoors(
        onOpenPost = { opened += it },
        onOpenComment = { _, _, _ -> },
        onOpenActor = {},
        onOpenTopic = {},
    )
    private val hooks = CardHooks(viewerId = reader, onEditComment = { id, title -> edits += id to title })

    /** Asserts [rows] stand in the sheet top to bottom, each under its registered node. */
    private fun assertRowsInOrder(vararg rows: String) {
        val tops = rows.map { compose.onNodeWithTag(it).fetchSemanticsNode().boundsInRoot.top }
        assertThat(tops).isInStrictOrder()
    }

    // -- The thread --

    private val threadEdits = mutableListOf<String>()

    private fun renderThread(
        onRequireAccount: (() -> Unit)? = null,
        report: ReportSheetSlot? = recordReport,
        comments: List<CommentView> = listOf(mine, theirs),
    ) {
        compose.setContent {
            CompositionLocalProvider(LocalInboundReads provides reads) {
                Column {
                    CommentsSheet(
                        state = CommentsUiState(loading = false, comments = comments, total = comments.size),
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
                        onOpenActor = { people += it },
                        onOpenTopic = {},
                        onOpenPost = { opened += it },
                        onReference = {},
                        onLicense = {},
                        onSignInOrJoin = {},
                        onRequireAccount = onRequireAccount,
                        reportSheet = report ?: reportDoor(onRequireAccount, "comments_report_sheet"),
                    )
                }
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

    private val removal = Removal(Instant.now(), RemovalAgent.AUTHOR)

    /**
     * CommentRemoved.md:9, CommentRemovedMenu.md:3, :5 — the reader's own removed
     * comment keeps its ⋮ in the thread: its own menu less Edit and Remove.
     */
    @Test
    fun anOwnRemovedCommentInTheThreadKeepsItsMenuLessEditAndRemove() {
        renderThread(comments = listOf(mine.copy(removal = removal), theirs))
        compose.onNodeIn(threadCard("mine"), threadMenu).performClick()
        compose.onNodeWithTag("postDetail.menuSheet").assertExists()
        assertRowsInOrder(
            "postDetail.menuSheet.save",
            "postDetail.menuSheet.cite",
            "postDetail.menuSheet.citedBy",
            "postDetail.menuSheet.opinions",
            "postDetail.menuSheet.license",
        )
        listOf("edit", "remove", "report").forEach {
            compose.onNodeWithTag("postDetail.menuSheet.$it").assertDoesNotExist()
        }
    }

    /**
     * CommentRemovedOther.md:28, :32, CommentRemovedOtherMenu.md:3, :5 — someone
     * else's removed comment keeps its ⋮ in the thread: the reader's comment
     * menu whole, Report at the tail.
     */
    @Test
    fun anothersRemovedCommentInTheThreadKeepsTheReadersMenuWhole() {
        renderThread(comments = listOf(mine, theirs.copy(removal = removal)))
        compose.onNodeIn(threadCard("theirs"), threadMenu).performClick()
        compose.onNodeWithTag("postDetail.menuSheet").assertExists()
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

    private fun consume() {
        consumed++
        returned = CommentsReturn()
    }

    private fun renderHistory(comment: CommentView) {
        compose.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides host, LocalInboundReads provides reads) {
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
                    returns = HostReturn(returned, onConsumed = ::consume, reread = reread),
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
            CompositionLocalProvider(LocalSnackbarHostState provides host, LocalInboundReads provides reads) {
                SavedScreen(
                    state = SavedUiState(
                        entries = listOf(SavedEntry(SavedCard.Comment(theirs, onPost, "p1", null), Instant.now())),
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

    private fun renderSavedComment(comment: CommentView) {
        compose.setContent {
            CompositionLocalProvider(LocalSnackbarHostState provides host, LocalInboundReads provides reads) {
                SavedScreen(
                    state = SavedUiState(
                        entries = listOf(SavedEntry(SavedCard.Comment(comment, onPost, "p1", null), Instant.now())),
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
    }

    /**
     * SavedCommentMenuOwn.md:5 — the reader's own comment: Unsave, Cite, Edit,
     * Remove, Cited by, Opinions, License under the registered `saved.menuSheet`
     * nodes, no Hide, no Report, and no per-comment legacy tag on Edit or Remove.
     */
    @Test
    fun savedsOwnCommentMenuRaisesEditAndRemoveUnderTheirRegisteredNodes() {
        renderSavedComment(mine)
        compose.onNodeWithTag("saved.commentCard.menu").performClick()
        assertRowsInOrder(
            "saved.menuSheet.save",
            "saved.menuSheet.cite",
            "saved.menuSheet.edit",
            "saved.menuSheet.remove",
            "saved.menuSheet.citedBy",
            "saved.menuSheet.opinions",
            "saved.menuSheet.license",
        )
        compose.onNodeWithTag("saved.menuSheet.hide").assertDoesNotExist()
        compose.onNodeWithTag("saved.menuSheet.report").assertDoesNotExist()
        compose.onNodeWithTag("comment_menu_edit_mine").assertDoesNotExist()
        compose.onNodeWithTag("comment_menu_remove_mine").assertDoesNotExist()
    }

    @Test
    fun savedsOthersCommentMenuCarriesNoEditOrRemove() {
        renderSavedComment(theirs)
        compose.onNodeWithTag("saved.commentCard.menu").performClick()
        compose.onNodeWithTag("saved.menuSheet.edit").assertDoesNotExist()
        compose.onNodeWithTag("saved.menuSheet.remove").assertDoesNotExist()
        compose.onNodeWithTag("comment_menu_edit_theirs").assertDoesNotExist()
        compose.onNodeWithTag("comment_menu_remove_theirs").assertDoesNotExist()
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

    // -- Cited by (CommentMenu.md:25; CommentCitedByEmpty.md; CitedBy.md:13, :15) --

    /**
     * CommentMenu.md:25, CommentCitedByEmpty.md:3, :5, :7 — the thread's Cited by row
     * raises the comment's sheet stacked over the thread, titled `Cited by`, its
     * empty line alone when nothing cites the comment; the thread stands beneath.
     */
    @Test
    fun theThreadsCitedByRowRaisesTheCommentsSheetEmpty() {
        renderThread()
        compose.onNodeIn(threadCard("theirs"), threadMenu).performClick()
        compose.onNodeWithTag("postDetail.menuSheet.citedBy").performClick()
        compose.waitForIdle()
        assertThat(readFor).containsExactly("theirs")
        compose.onNodeWithTag(THREAD_CITED_BY_SHEET).assertExists()
        compose.onNodeWithText("Nothing cites this yet").assertExists()
        compose.onNodeWithTag(threadCard("theirs")).assertExists()
    }

    /** CommentCitedByEmpty.md:11, CitedBy.md:15 — a citing post's row opens it, and the sheet goes. */
    @Test
    fun aCitingPostsRowOpensItFromTheThread() {
        citing = listOf(
            CitingArtifact("sol p7", CitingView(CitingKind.POST, "Salt maps", opensPost = "p7"), StancePair(0.4, 0.2)),
        )
        renderThread()
        compose.onNodeIn(threadCard("mine"), threadMenu).performClick()
        compose.onNodeWithTag("postDetail.menuSheet.citedBy").performClick()
        compose.waitForIdle()
        compose.onNodeWithTag("${THREAD_CITED_BY_SHEET}_row_1").performClick()
        compose.waitForIdle()
        assertThat(opened).containsExactly("p7")
        compose.onNodeWithTag(THREAD_CITED_BY_SHEET).assertDoesNotExist()
    }

    /** HistoryCommentMenu.md:11 — off the thread, what cites the comment comes up over History. */
    @Test
    fun historysCommentCitedByRowOpensOverHistory() {
        citing = listOf(
            CitingArtifact(
                "sol c9",
                CitingView(CitingKind.COMMENT, "The wax-stick ones", opensPost = "p9"),
                StancePair(0.1, 0.9),
            ),
        )
        renderHistory(theirs)
        compose.onNodeWithTag("history.commentCard.menu").performClick()
        compose.onNodeWithTag("history.menuSheet.citedBy").performClick()
        compose.waitForIdle()
        assertThat(readFor).containsExactly("theirs")
        compose.onNodeWithText("The wax-stick ones").performClick()
        compose.waitForIdle()
        assertThat(opened).containsExactly("p9")
    }

    // -- Opinions on this (CommentMenu.md:23; CommentOpinionsEmpty.md) --

    /**
     * CommentMenu.md:23, CommentOpinionsEmpty.md:3, :5, :7 — the thread's row raises
     * the comment's opinions sheet stacked over the thread, titled for the
     * comment, its empty line alone when nobody holds one.
     */
    @Test
    fun theThreadsOpinionsRowRaisesTheCommentsSheetEmpty() {
        renderThread()
        compose.onNodeIn(threadCard("theirs"), threadMenu).performClick()
        compose.onNodeWithTag("postDetail.menuSheet.opinions").performClick()
        compose.waitForIdle()
        assertThat(readFor).containsExactly("theirs")
        compose.onNodeWithTag(THREAD_OPINIONS_SHEET).assertExists()
        compose.onNodeWithText("Opinions on this comment").assertExists()
        compose.onNodeWithText("No opinions yet").assertExists()
        compose.onNodeWithTag(threadCard("theirs")).assertExists()
    }

    /** CommentOpinionsEmpty.md:11 — held, the rows draw as the post's do; a row opens its holder. */
    @Test
    fun aHoldersRowOpensTheirProfileFromTheThread() {
        holding = listOf(
            HeldOpinion(
                holderId = "a-ada",
                holder = OpinionHolder("ada-id", "ada", "Ada Okonkwo", null, redacted = false),
                pair = StancePair(0.7, 0.4),
                severed = false,
            ),
        )
        renderThread()
        compose.onNodeIn(threadCard("mine"), threadMenu).performClick()
        compose.onNodeWithTag("postDetail.menuSheet.opinions").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("Ada Okonkwo").performClick()
        compose.waitForIdle()
        assertThat(people).containsExactly("ada")
        compose.onNodeWithTag(THREAD_OPINIONS_SHEET).assertDoesNotExist()
    }

    /** HistoryCommentMenu.md:9 — off the thread, the comment's opinions come up over History. */
    @Test
    fun historysCommentOpinionsRowOpensOverHistory() {
        renderHistory(theirs)
        compose.onNodeWithTag("history.commentCard.menu").performClick()
        compose.onNodeWithTag("history.menuSheet.opinions").performClick()
        compose.waitForIdle()
        assertThat(readFor).containsExactly("theirs")
        compose.onNodeWithText("No opinions yet").assertExists()
    }
}
