package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.compose.currentStateAsState
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.CommentStanceTarget
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.core.designsystem.NodeSnackbarVisuals
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.RowLine
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.LoadingState
import com.cogra.core.designsystem.v2.atom.MenuRow
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.media.LocalVideoSurfaceType
import com.cogra.core.designsystem.v2.media.ScrollStageHost
import com.cogra.core.designsystem.v2.media.ScrollStageRow
import com.cogra.core.designsystem.v2.media.SensitiveSource
import com.cogra.core.designsystem.v2.media.VideoSurfaceType
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.StateTokens
import com.cogra.domain.CommentView
import com.cogra.domain.LicenseChoice
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.isRevealed
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.removal.RemovalKind
import com.cogra.domain.removal.marked
import com.cogra.domain.saved.SavedWrites
import com.cogra.feature.content.R
import com.cogra.feature.saved.LocalSavedHost
import com.cogra.feature.saved.asHiddenPerson
import com.cogra.feature.saved.rememberHiddenSet
import com.cogra.feature.saved.rememberSavedHost
import com.cogra.feature.saved.rememberSavedWrites
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * THE COMMENTS SHEET, WIRED TO ITS OWN THREAD — the one comments surface
 * (jakob 2026-09-15).
 *
 * The same sheet the detail raises, raised over the feed by a card's
 * comment count, and full-function on both: reply, the comment ⋮, edit.
 * It is not a navigation destination — a sheet is a layer over the
 * surface that raised it, and the route below never changes — so it
 * takes its post id as an argument and binds [CommentsViewModel] to it,
 * rather than being reached by navigating.
 *
 * @param restoreTo where the reader was when the sheet gave way to a
 *   composer, and [pendingParent] which comment the new reply hangs
 *   under: the two halves of the return, both of them read from where
 *   the surface below keeps its results.
 */
@Composable
fun CommentsSheetRoute(
    postId: String,
    /** The viewer's account id; gates the per-comment edit affordance. */
    viewerId: String?,
    /** Null while the auth phase resolves; the comment affordances wait. */
    signedIn: Boolean?,
    onDismiss: () -> Unit,
    /** The composer, pinned to what it answers (`ReplyEntry` 5 and 7). */
    onReply: (ReplyTargetRequest) -> Unit,
    /** `ReplyMedia` 6 — `CommentEdit`, on an own comment. */
    onEditComment: (commentId: String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    /**
     * A post opened from a sheet over the thread: a cited post from a comment's
     * tags-and-references (RefsSheet.md:15), or what a citing artifact opens from
     * its Cited by (CitedBy.md:15).
     */
    onOpenPost: (String) -> Unit,
    /** The Reference affordance (D20): compose a post citing this node. */
    onReference: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    /**
     * Called as the sheet gives way to a composer, carrying the reader's
     * place — the surface below keeps it until they come back.
     */
    onDepart: (CommentsScroll) -> Unit = {},
    /** What came back with the reader — see [CommentsReturn]. */
    commentsReturn: CommentsReturn = CommentsReturn(),
    /** Marks the return consumed, so it cannot fire twice. */
    onReturnConsumed: () -> Unit = {},
    /**
     * THE SURFACE'S OWN RE-PULL, HANDED DOWN. The thread binds once per post
     * ([CommentsViewModel.start] returns early on a second raise of the same
     * one), which is what keeps a reader's unfolded branches across a trip to
     * the composer — but it also meant a reader who pulled the surface to
     * refresh raised the sheet on the page read before the pull. A bump here
     * is the surface saying its own read is stale, so the thread re-reads too.
     */
    refreshToken: Int = 0,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit = { _, _, _ -> },
    /** A comment to land on: the thread pages and unfolds until it stands, then scrolls to it. */
    landOn: String? = null,
    /** The guest gate a signed-out reader's Save opens; null when signed in. */
    onRequireAccount: (() -> Unit)? = null,
    /**
     * The landing came from a comment card's comment glyph (FeedKinds.md,
     * Saved.md): once the landed comment stands, the reply composer opens
     * aimed at it.
     */
    aimReply: Boolean = false,
    viewModel: CommentsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(postId) { viewModel.start(postId) }
    LaunchedEffect(postId, landOn) { landOn?.let(viewModel.landing::landOn) }
    AimedReply(postId, landOn, aimReply, viewModel.state, onReply)
    // In an effect, not the composition body: a recomposition that never
    // commits would otherwise fire the refetch anyway. The landing is
    // not consumed here — the place is the other half of the same
    // return, and clearing it before the thread has been put back would
    // lose it.
    LaunchedEffect(commentsReturn.landed, commentsReturn.parentCommentId) {
        if (commentsReturn.landed) {
            viewModel.onCommentLanded(commentsReturn.parentCommentId)
        }
    }
    // Zero is the token nobody pulled with, so the first composition does not
    // read the thread a second time on top of `start`.
    LaunchedEffect(refreshToken) {
        if (refreshToken > 0) viewModel.refresh()
    }
    // The terms stand OUTSIDE the sheet's own window, as a sibling: a
    // modal sheet raised from inside another one would leave the thread
    // beneath it inert. Only a COMMENT's terms reach this mount — the
    // post's own are raised by the surface below — so it is always the
    // stacked case (`CommentLicense.jsx`, design/readme.md:2364).
    var licenseShown by remember { mutableStateOf<LicenseChoice?>(null) }
    // THE SHEET STANDS ONLY OVER A SURFACE THE READER IS ON. The open state is
    // saved with the surface, and a predictive back gesture from a page above
    // it composes that surface for the preview — Navigation Compose holds an
    // entry at STARTED while a transition into it runs, RESUMED only once it
    // lands — and a modal sheet is its own window, so raised mid-gesture it took the
    // gesture from the page — the sheet flashed and the reader stayed on the
    // profile. It rises once the surface is resumed, as it does after the
    // header's back arrow.
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val onSurface by lifecycle.currentStateAsState()
    if (!onSurface.isAtLeast(Lifecycle.State.RESUMED)) return
    CommentsSheet(
        state = state,
        viewerId = viewerId,
        signedIn = signedIn,
        restoreTo = commentsReturn.scroll,
        onRestored = onReturnConsumed,
        onDismiss = onDismiss,
        onDepart = onDepart,
        onLoadMoreComments = viewModel::loadMore,
        onAddComment = { onReply(ReplyTargetRequest(postId, null)) },
        onReplyTo = { comment -> onReply(ReplyTargetRequest(postId, comment)) },
        onEditComment = { comment -> onEditComment(comment.id) },
        onCommentSignedShown = viewModel::onCommentSignedShown,
        onLoadMoreReplies = viewModel::onLoadMoreReplies,
        onReveal = viewModel::onReveal,
        onOpenActor = onOpenActor,
        onOpenTopic = onOpenTopic,
        onOpenPost = onOpenPost,
        onReference = onReference,
        onLicense = { licenseShown = it },
        onSignInOrJoin = onSignInOrJoin,
        stanceControl = stanceControl,
        saved = rememberSavedWrites(),
        hidden = rememberHiddenSet(),
        onRequireAccount = onRequireAccount,
        onLanded = viewModel.landing::done,
    )
    licenseShown?.let { license ->
        // `CommentLicense` registers under `postDetail`, over the thread.
        LicenseSheet(
            license = license,
            onDismiss = { licenseShown = null },
            stacked = true,
            node = POST_DETAIL / "licenseSheet",
        )
    }
}

/**
 * What the sheet asks the surface below to open a composer on: the post
 * the thread belongs to, and the comment being answered — null for a
 * comment on the post itself.
 *
 * The sheet hands up the NODES rather than a built route because the
 * composer's target card is built from the thread's own words, and the
 * thread is what has them.
 */
data class ReplyTargetRequest(val postId: String, val comment: CommentView?)

/**
 * A LANDING AIMED AT A COMMENT OPENS THE COMPOSER AT IT once the comment
 * stands (FeedKinds.md, Saved.md) — the comment card's glyph and its Reply.
 * An applicant's aimed landing opens no composer: the thread stands at the
 * comment, its doors answering in place (ReplyEntry.md:25).
 */
@Composable
internal fun AimedReply(
    postId: String,
    landOn: String?,
    aimReply: Boolean,
    state: Flow<CommentsUiState>,
    onReply: (ReplyTargetRequest) -> Unit,
) {
    LaunchedEffect(postId, landOn, aimReply) {
        val at = landOn ?: return@LaunchedEffect
        if (!aimReply) return@LaunchedEffect
        val landedState = state.first { it.standing(at) != null }
        if (landedState.commentLocked) return@LaunchedEffect
        onReply(ReplyTargetRequest(postId, landedState.standing(at)))
    }
}

/** [id]'s comment where the thread holds it — a top-level comment or an unfolded reply. */
internal fun CommentsUiState.standing(id: String): CommentView? =
    comments.firstOrNull { it.id == id } ?: replyThreads.values.firstNotNullOfOrNull { thread ->
        thread.items.firstOrNull { it.id == id }
    }

/**
 * THE THREAD IS A SHEET OVER WHAT RAISED IT (`_shared.jsx:1247-1257`): the
 * title, the comments, and the entry row pinned at its foot. The surface below
 * keeps its place — the sheet is a drawer over the screen, so nothing behind it
 * scrolls when it opens or drops.
 *
 * The sheet's own height is drawn rather than content-sized
 * (`BottomSheet.jsx:29-32`: "a pinned input row at its foot needs the surface
 * itself to own the height"), so the foot does not walk up and down the screen
 * as a page of comments lands.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommentsSheet(
    state: CommentsUiState,
    viewerId: String?,
    signedIn: Boolean?,
    onDismiss: () -> Unit,
    onLoadMoreComments: () -> Unit,
    /** `ReplyEntry` 7 — the full-focus composer, this post pinned. */
    onAddComment: () -> Unit,
    /** `ReplyEntry` 5 — the composer, pre-targeted at that comment. */
    onReplyTo: (CommentView) -> Unit,
    /** `ReplyMedia` 6 — `CommentEdit`, on an own comment. */
    onEditComment: (CommentView) -> Unit,
    onCommentSignedShown: () -> Unit,
    onLoadMoreReplies: (CommentView) -> Unit,
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    /**
     * A post opened from a sheet over the thread: a cited post from a comment's
     * tags-and-references (RefsSheet.md:15), or a Cited by row's door — the citing
     * post, or the post a citing comment answers (CitedBy.md:15).
     */
    onOpenPost: (String) -> Unit,
    onReference: (String) -> Unit,
    /** Raises the terms in the sheet the menu's License row opens. */
    onLicense: (LicenseChoice) -> Unit,
    onSignInOrJoin: () -> Unit,
    /** The reader's place, handed up as the sheet gives way to a composer. */
    onDepart: (CommentsScroll) -> Unit = {},
    /** …and handed back on the way in. */
    restoreTo: CommentsScroll? = null,
    onRestored: () -> Unit = {},
    /** The stance control the post and every comment carry (design.md §6). */
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit = { _, _, _ -> },
    /** The app's one Saved overlay, which the comments' menus save through; null stands their Save rows inert. */
    saved: SavedWrites? = null,
    /**
     * The reader's one hidden set, which the comments' Hide rows hide through;
     * null stands them inert. Nothing in the thread reads it: the hidden
     * person's comments stand where they stood (CommentMenu.md:11).
     */
    hidden: HiddenSet? = null,
    /** The guest gate a signed-out reader's Save opens; null when signed in. */
    onRequireAccount: (() -> Unit)? = null,
    /** The confirm a comment's Report raises, stacked over the thread; for a guest, the join prompt. */
    reportSheet: ReportSheetSlot = reportDoor(onRequireAccount, THREAD_REPORT_SHEET, POST_DETAIL / "reportSheet"),
    /** The list scrolled to a landing ([CommentsUiState.landingAt]). */
    onLanded: () -> Unit = {},
) {
    // The sheet's own host. A ModalBottomSheet is its own window, so a
    // host on the surface behind would render the confirmation for a
    // comment that landed in THIS thread behind the thread it landed in.
    val snackbar = remember { SnackbarHostState() }
    val savedHost = rememberSavedHost(saved, snackbar, THREAD_SNACKBAR, onRequireAccount, hidden)
    AnnounceCommentSigned(state.commentSigned, snackbar, onCommentSignedShown)
    // AN APPLICANT'S TWO DOORS INTO THE COMPOSER ANSWER IN PLACE ([rememberCommentGuard]).
    val guard = rememberCommentGuard(state.commentLocked, snackbar)
    val listState = rememberLazyListState()
    ThreadPlacement(state, listState, restoreTo, onRestored, onLanded)
    // WHICH CONFIRM OR READING STANDS OVER THE THREAD ([ThreadConfirm]): the menu
    // closes and it comes up over the thread, which stays where the reader opened
    // the menu (CommentCitedByEmpty.md:3).
    var confirm by remember { mutableStateOf<ThreadConfirm?>(null) }
    // THE COMMENT WHOSE TAGS AND REFERENCES STAND OVER THE THREAD: its count
    // is a door, as on every card (TopicsLine.jsx:202-212).
    var refsFor by remember { mutableStateOf<CommentView?>(null) }
    val depart = departing(listState, onDepart)
    // THE TALLEST CLASS, ASKED FOR BY NAME (`BottomSheet.jsx`'s `tallest`,
    // readme §13 "The sheets-and-video round" 2026-09-22): pinned AT the
    // ceiling rather than held under it, because a thread is the one
    // surface with a list to read and a field to write in at once, so the
    // surface owns the height and the list scrolls inside it. The height
    // rides the drawn surface INSIDE the sheet ([CograSheetSurface]'s
    // `tallest`), never `ModalBottomSheet`'s own modifier — a height fixed
    // there collapses Material's expanded anchor and pins the sheet to the
    // top of the window, the very top of the glass included.
    ThreadSheetFrame(snackbar, onDismiss) {
        SheetTitle(
            text = stringResource(R.string.content_comments_heading),
            modifier = Modifier
                .padding(horizontal = Space.x6, vertical = Space.x1)
                .dataNode(THREAD_SHEET / "title"),
        )
        // The foot is drawn last and the list carries the weight, so a
        // foot that grows takes its room from the thread above it and the
        // sheet stays exactly at its ceiling. The keyboard pads from
        // inside the same height ([CograSheetSurface]), for the same
        // reason.
        // THE COMMENTS' MENUS SAVE THROUGH THE ONE OVERLAY, their aftermath
        // on this sheet's own snackbar — the page's is beneath the sheet.
        // A CLIP IN THE THREAD DRAWS INSIDE THE SHEET ([LocalVideoSurfaceType]):
        // a SurfaceView escapes every Compose clip, and over the sheet's
        // translucent scrim a clip scrolled past the list's top stood
        // above the sheet up to the top of the screen.
        // THE THREAD'S STANCE FACES ANSWER ON THIS SHEET'S SNACKBAR TOO: the
        // control reads [LocalSnackbarHostState], and the shell's host is
        // beneath the sheet's own window.
        CompositionLocalProvider(
            LocalSavedHost provides savedHost,
            LocalVideoSurfaceType provides VideoSurfaceType.TextureView,
            LocalSnackbarHostState provides snackbar,
            LocalReplyLocked provides state.commentLocked,
        ) {
            CommentsList(
                state = state,
                listState = listState,
                viewerId = viewerId,
                signedIn = signedIn,
                modifier = Modifier.weight(1f),
                onLoadMoreComments = onLoadMoreComments,
                onReplyTo = { c -> guard { depart { onReplyTo(c) } }() },
                onEditComment = { c -> depart { onEditComment(c) } },
                onLoadMoreReplies = onLoadMoreReplies,
                onReveal = onReveal,
                // EVERY DOOR THAT LEAVES THE SURFACE LEAVES ITS PLACE BEHIND
                // (ReplyEntry.md: back returns at the offset it was left): a
                // profile, a tag page and the composer a citation opens, as
                // the composer's own doors already do.
                onOpenActor = { handle -> depart { onOpenActor(handle) } },
                onOpenTopic = { name -> depart { onOpenTopic(name) } },
                onOpenReferences = { comment -> refsFor = comment },
                onReference = { id -> depart { onReference(id) } },
                onLicense = onLicense,
                onRemoveComment = { comment -> confirm = ThreadConfirm.Remove(comment) },
                onReportComment = { comment -> confirm = ThreadConfirm.Report(comment.id) },
                onCitedBy = { comment -> confirm = ThreadConfirm.Read(Reading.CitedBy, comment.id) },
                onOpinions = { comment -> confirm = ThreadConfirm.Read(Reading.Opinions, comment.id) },
                stanceControl = stanceControl,
            )
        }
        CommentsFoot(signedIn, state.commentLocked, guard { depart(onAddComment) }, onSignInOrJoin)
    }
    // OVER THE THREAD, the sheet beneath whole and inert (CommentRemoveConfirm.md:3):
    // the dialog is its own window, raised after the sheet's. Taken, only the
    // one comment gives way to its mark — the list is not re-read, so the
    // reader's place and every unfolded branch hold (CommentRemoved.md:19).
    // A reading's row leaves the surface, so it leaves the thread's place behind.
    val readings = threadReadings({ post -> depart { onOpenPost(post) } }, { handle -> depart { onOpenActor(handle) } })
    ThreadConfirms(confirm, reportSheet, snackbar, readings, onClose = { confirm = null })
    refsFor?.let { comment ->
        ThreadRefs(comment, depart, onOpenTopic, onOpenActor, onOpenPost) { refsFor = null }
    }
}

/** The comment's reading sheets over the thread: the design registers no node for them (CommentCitedByEmpty). */
internal const val THREAD_READINGS = "comment"

/** The comment's Cited by sheet over the thread, by its tag. */
internal const val THREAD_CITED_BY_SHEET = "${THREAD_READINGS}_cited_by_sheet"

/** How the thread wears a comment's readings: stacked over it, its own clips its own. */
private fun threadReadings(onOpenPost: (String) -> Unit, onOpenPerson: (String) -> Unit) =
    ReadingHost(onOpenPost, onOpenPerson, OpinionsOn.Comment, THREAD_READINGS, stacked = true, suspendsVideo = false)

/** The thread's own snackbar says a just-signed comment once ([CommentsUiState.commentSigned]). */
@Composable
private fun AnnounceCommentSigned(signed: Boolean, snackbar: SnackbarHostState, onShown: () -> Unit) {
    val signedCopy = stringResource(R.string.content_post_saved)
    LaunchedEffect(signed) {
        if (signed) {
            snackbar.say(signedCopy)
            onShown()
        }
    }
}

/** The comment's opinions sheet over the thread: unregistered, as its Cited by (CommentOpinionsEmpty). */
internal const val THREAD_OPINIONS_SHEET = "${THREAD_READINGS}_opinions_sheet"

/**
 * The reader's place, handed up as a door leaves the surface: every door out of
 * the thread leaves it behind (ReplyEntry.md: back returns at the offset it was left).
 */
private fun departing(listState: LazyListState, onDepart: (CommentsScroll) -> Unit): (() -> Unit) -> Unit = { go ->
    onDepart(CommentsScroll(listState.firstVisibleItemIndex, listState.firstVisibleItemScrollOffset))
    go()
}

/**
 * A comment's tags and references, stacked over the thread; a row that leaves
 * the surface leaves the thread's place behind, as every door out of it does.
 */
@Composable
private fun ThreadRefs(
    comment: CommentView,
    depart: (() -> Unit) -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    RefsSheet(
        topics = comment.topics,
        references = comment.references,
        onDismiss = onDismiss,
        onOpenTopic = { name -> depart { onOpenTopic(name) } },
        onOpenActor = { handle -> depart { onOpenActor(handle) } },
        onOpenPost = { id -> depart { onOpenPost(id) } },
        testTagPrefix = "comment_${comment.id}",
        stacked = true,
    )
}

/**
 * The confirm over the thread: the think-twice dialog for the reader's own
 * comment (CommentMenuOwn.md:19), or another's report (CommentMenu.md:29).
 */
private sealed interface ThreadConfirm {
    data class Remove(val comment: CommentView) : ThreadConfirm

    data class Report(val commentId: String) : ThreadConfirm

    /** A reading of the comment, stacked over the thread (CommentCitedByEmpty.md:3). */
    data class Read(val reading: Reading, val commentId: String) : ThreadConfirm
}

@Composable
private fun ThreadConfirms(
    confirm: ThreadConfirm?,
    reportSheet: ReportSheetSlot,
    snackbar: SnackbarHostState,
    readings: ReadingHost,
    onClose: () -> Unit,
) {
    when (confirm) {
        is ThreadConfirm.Remove -> CommentRemoveConfirm(confirm.comment, onClose = onClose)
        is ThreadConfirm.Report -> ThreadReport(confirm.commentId, reportSheet, snackbar, onClose)
        is ThreadConfirm.Read -> ReadingSheet(confirm.reading, confirm.commentId, readings, onClose)
        null -> Unit
    }
}

/**
 * WHICH COMMENT'S REPORT CONFIRM IS UP (CommentMenu.md:29): a sheet over the
 * thread's sheet, as the menu that raised it — a guest's tap raises the join
 * prompt in its place (ReportConfirm.md:21) — its aftermath on the thread's own
 * snackbar.
 */
@Composable
private fun ThreadReport(
    commentId: String,
    reportSheet: ReportSheetSlot,
    snackbar: SnackbarHostState,
    onClose: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val notify: (String) -> Unit = { text -> scope.launch { snackbar.say(text) } }
    reportSheet(ReportAsk(commentId, ReportKind.Comment), onClose, notify)
}

/** The thread sheet's own snackbar IS the page's registered `postDetail.snackbar` (CommentMenu.md:11), every line of it. */
internal val THREAD_SNACKBAR = POST_DETAIL / "snackbar"

private suspend fun SnackbarHostState.say(text: String) = showSnackbar(NodeSnackbarVisuals(text, THREAD_SNACKBAR))

/** The comment report confirm's fallback tag; the registered node is `postDetail.reportSheet`. */
private const val THREAD_REPORT_SHEET = "comments_report_sheet"

/** The thread's comment menus: `postDetail.menuSheet`, every row registered (CommentMenu, CommentMenuOwn). */
private val THREAD_MENU = CommentMenuPlacement(POST_DETAIL / "menuSheet", CommentMenuPlacement.ALL)

/**
 * The snackbar's lift off the screen's foot over a sheet (`Snackbar.jsx`
 * `offset={16}` on a surface with no bar), less the 12dp the house snackbar
 * already insets itself by (`CograSnackbar`).
 */
private val SNACKBAR_FOOT = 4.dp

/**
 * The thread's sheet, its drawn surface, and the snackbar laid OVER it.
 *
 * THE SNACKBAR RIDES ABOVE THE SHEET, NEVER IN IT (`SettingsUnhidden.jsx`,
 * "The line rides above the sheet"; `Snackbar.jsx`'s fixed, centred
 * placement, 16 off the foot of a surface with no bar): a host laid in the
 * sheet's column took the foot's room — pushing the comment field up — and
 * stood at the column's start edge.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ThreadSheetFrame(
    snackbar: SnackbarHostState,
    onDismiss: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    CograSheetHost(onDismissRequest = onDismiss) {
        Box {
            // THE THREAD SHEET IS ONE NAMED SHEET (`postDetail.threadSheet`), over
            // the detail or over a list alike — as the detail's one menu sheet is.
            CograSheetSurface(
                tallest = true,
                testTag = THREAD_SHEET.tag,
                handleTestTag = (THREAD_SHEET / "dragHandle").tag,
                content = content,
            )
            CograSnackbarHost(
                snackbar,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.ime))
                    .padding(bottom = SNACKBAR_FOOT),
            )
        }
    }
}

/** The comment's think-twice dialog (CommentRemoveConfirm): the post's anatomy, the comment's nouns. */
@Composable
private fun CommentRemoveConfirm(comment: CommentView, onClose: () -> Unit) {
    RemoveConfirm(
        kind = RemovalKind.Comment,
        nodeId = comment.id,
        record = comment.genesisRecordId,
        onClose = onClose,
        testTag = "comment_remove_confirm",
        node = POST_DETAIL / "dialog",
        answerKeyed = true,
    )
}

/** Where the thread's list stands when it opens: the reader's old place, or a landing. */
@Composable
private fun ThreadPlacement(
    state: CommentsUiState,
    listState: LazyListState,
    restoreTo: CommentsScroll?,
    onRestored: () -> Unit,
    onLanded: () -> Unit,
) {
    // THE READER COMES BACK WHERE THEY LEFT (jakob 2026-09-15). The
    // restore waits for the refetched page: scrolling an empty list puts
    // the reader at the top and the arriving comments do not move them.
    // It consumes either way once the read is done, so a thread that
    // came back empty does not leave a place behind to jump to later.
    LaunchedEffect(restoreTo, state.loading, state.comments.isEmpty()) {
        val place = restoreTo ?: return@LaunchedEffect
        if (state.loading) return@LaunchedEffect
        if (state.comments.isNotEmpty()) listState.scrollToItem(place.index, place.offset)
        onRestored()
    }
    // LANDED ON A COMMENT (Saved.md "tap a comment's row"): the branch is
    // already unfolded down to it, so the thread scrolls to the top-level
    // comment it hangs under and the comment stands within that row.
    LaunchedEffect(state.landingAt) {
        val top = state.landingAt ?: return@LaunchedEffect
        val index = state.comments.indexOfFirst { it.id == top }
        if (index >= 0) listState.scrollToItem(index)
        onLanded()
    }
}

/**
 * The thread's rows, and the three things it says when it has none:
 * reading, unreachable, or empty.
 *
 * The sheet says all three ITSELF, unlike the version that projected the
 * detail's state: it is raised over the feed too, where there is no
 * screen underneath holding a thread to degrade in its place.
 */
@Composable
private fun CommentsList(
    state: CommentsUiState,
    listState: LazyListState,
    viewerId: String?,
    signedIn: Boolean?,
    onLoadMoreComments: () -> Unit,
    onReplyTo: (CommentView) -> Unit,
    onEditComment: (CommentView) -> Unit,
    onLoadMoreReplies: (CommentView) -> Unit,
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenReferences: (CommentView) -> Unit,
    onReference: (String) -> Unit,
    onLicense: (LicenseChoice) -> Unit,
    /** An own comment's Remove row: the think-twice dialog over the thread. */
    onRemoveComment: (CommentView) -> Unit,
    onReportComment: (CommentView) -> Unit,
    onCitedBy: (CommentView) -> Unit,
    onOpinions: (CommentView) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
    modifier: Modifier = Modifier,
) {
    // ONE STAGE FOR THE THREAD (the stage law, design/readme.md "The
    // feed-video rulings"): every clip in it, replies included, competes
    // for one — the playing clip keeps it while past 70%, and the topmost
    // qualifying clip takes it the moment it drops. The sheet is a scroll
    // surface of its own, so it does not share the stage of the list below —
    // it suspends it: the surface that raised the sheet stops its own clip
    // while the sheet stands (jakob 2026-09-24). Settling at the thread's own
    // hard top hands its stage to the topmost qualifying clip (jakob
    // 2026-09-30): else a top clip that once lost focus never plays again.
    ScrollStageHost(listState, hardTopReelects = true) {
        LazyColumn(
            state = listState,
            modifier = modifier.testTag("comments_list"),
            contentPadding = PaddingValues(horizontal = Space.x4, vertical = Space.x2),
            verticalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            if (state.comments.isEmpty()) {
                item {
                    when {
                        state.loading -> LoadingState(testTag = "comments_loading")
                        state.transportFault != null -> ErrorLine(
                            R.string.content_error_transport,
                            "comments_transport_error",
                        )
                        else -> Text(
                            stringResource(R.string.content_comments_empty),
                            modifier = Modifier.testTag("detail_no_comments"),
                        )
                    }
                }
            }
            items(state.comments, key = { it.id }) { comment ->
                // The row's key again, so the stage can ask the list whether
                // this thread — replies and all — is still placed.
                ScrollStageRow(comment.id) {
                    CommentThread(
                        comment = comment,
                        depth = 0,
                        state = state,
                        viewerId = viewerId,
                        signedIn = signedIn,
                        onLoadMoreReplies = onLoadMoreReplies,
                        onReplyTo = onReplyTo,
                        onEditComment = onEditComment,
                        onReveal = onReveal,
                        onOpenActor = onOpenActor,
                        onOpenTopic = onOpenTopic,
                        onOpenReferences = onOpenReferences,
                        onReference = onReference,
                        onLicense = onLicense,
                        onRemoveComment = onRemoveComment,
                        onReportComment = onReportComment,
                        onCitedBy = onCitedBy,
                        onOpinions = onOpinions,
                        stanceControl = stanceControl,
                    )
                }
            }
            if (state.hasMore) {
                item { MoreComments(state, onLoadMoreComments) }
            }
        }
    }
}

/**
 * A failed comments page surfaces where the failed fetch was asked for — the
 * load-more slot, inside the thread (android.md "Degrade, never crash").
 */
@Composable
private fun MoreComments(state: CommentsUiState, onLoadMoreComments: () -> Unit) {
    when {
        state.loadingMore -> CircularProgressIndicator(modifier = Modifier.padding(8.dp))
        state.transportFault == TransportFault.APPEND -> Column {
            ErrorLine(R.string.content_thread_stale, "detail_more_comments_error")
            TextButton(
                onClick = onLoadMoreComments,
                modifier = Modifier.testTag("detail_more_comments_retry"),
            ) {
                Text(stringResource(R.string.content_retry))
            }
        }
        else -> TextButton(
            onClick = onLoadMoreComments,
            modifier = Modifier.testTag("detail_more_comments"),
        ) {
            Text(stringResource(R.string.content_feed_load_more))
        }
    }
}

/**
 * `ReplyEntry` 7: the sheet's foot is the way *into* the composer, not the
 * composer itself. The full-focus wizard is where a comment is written, so
 * this row only opens it.
 *
 * The write affordance swaps, never merely disables: a member gets the
 * composer's door, an anonymous reader gets the join entry (android.md
 * "Screens"); while the phase resolves, neither.
 */
@Composable
private fun CommentsFoot(
    signedIn: Boolean?,
    /** An applicant's foot: the disabled opacity, still tappable (ReplyEntry.md:27). */
    locked: Boolean,
    onAddComment: () -> Unit,
    onSignInOrJoin: () -> Unit,
) {
    if (signedIn == null) return
    HorizontalDivider()
    if (signedIn) {
        // It looks like the field the board draws and behaves like the button
        // it is: a real text field would take focus and raise a keyboard for
        // words that are typed on the next screen.
        Surface(
            onClick = onAddComment,
            shape = MaterialTheme.shapes.extraLarge,
            color = MaterialTheme.colorScheme.surfaceContainerHighest,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Space.x4, vertical = Space.x3)
                .alpha(if (locked) StateTokens.DISABLED else 1f)
                .testTag("detail_add_comment"),
        ) {
            Text(
                text = stringResource(R.string.content_comment_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            )
        }
    } else {
        TextButton(
            onClick = onSignInOrJoin,
            modifier = Modifier
                .padding(horizontal = Space.x2)
                .testTag("detail_comment_signin"),
        ) {
            Text(stringResource(R.string.content_comment_signin))
        }
    }
}

/**
 * THE COMMENT'S ROWS (CommentMenu.md:7, CommentMenuOwn.md:3) — another's:
 * Save · Cite in a new post · Hide @ada · Cited by · Opinions on this · License
 * terms · Report; the reader's own: Save · Cite in a new post · Edit · Remove ·
 * Cited by · Opinions on this · License terms, and no Hide and no Report (the
 * own menus' rule).
 *
 * EDIT IS A MENU ROW, NEVER A BUTTON ON THE CARD (jakob on #423, seam 304):
 * the menu's Edit is the one door to the comment's edit on every host
 * (CommentMenuOwn.md:11), between Cite and Remove; the acts lead, the two
 * readings and the license close the menu.
 *
 * REPORT SITS AT THE TAIL of another's comment's menu, below the license, as on
 * every other-person menu (ruling 75).
 *
 * HIDE STANDS IN THE POST MENU'S SLOT, after Cite, on someone else's comment
 * only — a removed one included, its author still someone to hide
 * (CommentMenu.md:7, :9; CommentRemovedOtherMenu.md:5).
 *
 * `Cited by` and `Opinions on this` STAND WHATEVER THE COUNT IS, which is
 * the difference between a menu row and a count line: a row that came and
 * went with a number would make the menu a different menu every time.
 *
 * @param onCitedBy the `Cited by` row's door — what cites the comment, over the
 *   surface the menu was opened on (CommentMenu.md:25).
 * @param onOpinions the `Opinions on this` row's door — the comment's opinions
 *   sheet, over the surface the menu was opened on (CommentMenu.md:23).
 * @param own the reader wrote the comment: the own rows, Edit and Remove, and
 *   no Report.
 * @param onEdit the own menu's Edit — the comment's edit over the surface the
 *   menu was opened on (CommentMenuOwn.md:13).
 * @param onRemove the own menu's Remove — the think-twice dialog.
 * @param onReport another's menu's Report — the confirm over the surface the
 *   menu was opened on, or the join prompt for a guest; null stands it inert.
 * @param placement the registered sheet and the rows its host's boards register
 *   (`postDetail.menuSheet` on the thread); null keeps the per-comment tags.
 */
@Composable
internal fun commentMenuRows(
    comment: CommentView,
    own: Boolean,
    onCite: () -> Unit,
    onLicense: () -> Unit,
    onCitedBy: () -> Unit,
    onOpinions: () -> Unit,
    onEdit: () -> Unit = {},
    onRemove: () -> Unit = {},
    onReport: (() -> Unit)? = null,
    placement: CommentMenuPlacement? = null,
): List<MenuRow> = buildList {
    fun tag(row: CommentMenuRow, legacy: String): String =
        placement?.takeIf { row in it.rows }?.let { (it.sheet / row.nodeName).tag }
            ?: "comment_menu_${legacy}_${comment.id}"
    // SAVE IS THE ONE BEHAVIOUR EVERY MENU SHARES (`saveMenuRow`); the comment
    // menus gain the `Saved.` snackbar too (design digest item 54).
    val save = stringResource(R.string.content_menu_save)
    val saveTag = tag(CommentMenuRow.Save, "save")
    add(LocalSavedHost.current?.menuRow(comment.id, comment.viewerBookmarkedAt, saveTag) ?: MenuRow(save, saveTag) {})
    add(MenuRow(stringResource(R.string.content_menu_cite), tag(CommentMenuRow.Cite, "cite"), onCite))
    // A REMOVED COMMENT KEEPS ITS ⋮, its own menu less Edit and Remove
    // (ProfileCommentsRemovedMenuOwn.md:5); the reader's stays whole (ProfileComments.md:9).
    if (own && !comment.removed) {
        add(MenuRow(stringResource(R.string.content_edit), tag(CommentMenuRow.Edit, "edit"), onEdit))
        add(MenuRow(stringResource(R.string.content_menu_remove), tag(CommentMenuRow.Remove, "remove"), onRemove))
    }
    if (!own) add(commentHideRow(comment, tag(CommentMenuRow.Hide, "hide")))
    // The two readings stand whatever their counts and open for a guest
    // (CommentMenu.md:27, :35).
    add(MenuRow(stringResource(R.string.content_menu_cited_by), tag(CommentMenuRow.CitedBy, "cited_by"), onCitedBy))
    add(MenuRow(stringResource(R.string.content_menu_opinions), tag(CommentMenuRow.Opinions, "opinions"), onOpinions))
    add(MenuRow(stringResource(R.string.content_menu_license), tag(CommentMenuRow.License, "license"), onLicense))
    if (!own) {
        add(MenuRow(stringResource(R.string.content_menu_report), tag(CommentMenuRow.Report, "report"), onReport ?: {}))
    }
}

/**
 * THE HIDE ROW OF SOMEONE ELSE'S COMMENT, the post menu's twin
 * (CommentMenu.md:11-21): `Hide @ada`, or `Unhide @ada` while the author is
 * hidden, one node whatever it reads; no confirm; the host's snackbar with
 * Undo; a failure on this comment's own row line, the gesture's origin being
 * the comment; a guest's tap raises the gate (`SavedHost.hideRow`). Outside a
 * host with a hidden set, or for an author the read did not carry, the row
 * stands inert, as the post menu's does.
 */
@Composable
private fun commentHideRow(comment: CommentView, tag: String): MenuRow {
    val live = comment.author?.let { LocalSavedHost.current?.hideRow(it.asHiddenPerson(), comment.id, tag) }
    val label = comment.author?.handle?.let { stringResource(R.string.content_menu_hide_actor, "@$it") }
        ?: stringResource(R.string.content_menu_hide_account)
    return live ?: MenuRow(label, tag) {}
}

/**
 * The thread is **two levels deep on screen**: a comment, and its
 * replies indented once (design/readme.md §13, 2026-08-28, and the
 * canonical `CommentCard`, which sets exactly this).
 *
 * Anything deeper flattens into that one reply level and opens with the
 * @handle it answers — the mention is the structure, so the column never
 * narrows to a word. design.md §6 still says three levels; it predates
 * the ruling (design/backlog.md item 26 tracks that lag).
 */
private const val MAX_INDENT_DEPTH = 1

/**
 * One comment with its replies (design.md §6 "Comment"): author chip,
 * body, the soft "Edited" marker (design.md §9), the creator's edit
 * affordance, the reply affordance, and the branch behind its count.
 */
@Composable
private fun CommentThread(
    comment: CommentView,
    depth: Int,
    modifier: Modifier = Modifier,
    state: CommentsUiState,
    viewerId: String?,
    signedIn: Boolean?,
    onLoadMoreReplies: (CommentView) -> Unit,
    onReplyTo: (CommentView) -> Unit,
    onEditComment: (CommentView) -> Unit,
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenReferences: (CommentView) -> Unit,
    onReference: (String) -> Unit,
    /** Raises the terms in the sheet the menu's License row opens. */
    onLicense: (LicenseChoice) -> Unit,
    onRemoveComment: (CommentView) -> Unit,
    onReportComment: (CommentView) -> Unit,
    onCitedBy: (CommentView) -> Unit,
    onOpinions: (CommentView) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
) {
    val indent = (minOf(depth, MAX_INDENT_DEPTH) * 12).dp
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(start = indent),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        CommentCard(
            // ONLY THE ONE NODE GIVES WAY (CommentRemoveConfirm.md:11): a
            // comment removed since the thread was read wears its mark in its
            // own place, and its branch below is untouched.
            comment = comment.marked(rememberRemovedMarks()),
            state = state,
            viewerId = viewerId,
            signedIn = signedIn,
            onReplyTo = onReplyTo,
            onEditComment = onEditComment,
            onReveal = onReveal,
            onOpenActor = onOpenActor,
            onOpenTopic = onOpenTopic,
            onOpenReferences = onOpenReferences,
            onReference = onReference,
            onLicense = onLicense,
            onRemoveComment = onRemoveComment,
            onReportComment = onReportComment,
            onCitedBy = onCitedBy,
            onOpinions = onOpinions,
            stanceControl = stanceControl,
        )
        CommentBranch(
            comment = comment,
            depth = depth,
            state = state,
            viewerId = viewerId,
            signedIn = signedIn,
            onLoadMoreReplies = onLoadMoreReplies,
            onReplyTo = onReplyTo,
            onEditComment = onEditComment,
            onReveal = onReveal,
            onOpenActor = onOpenActor,
            onOpenTopic = onOpenTopic,
            onOpenReferences = onOpenReferences,
            onReference = onReference,
            onLicense = onLicense,
            onRemoveComment = onRemoveComment,
            onReportComment = onReportComment,
            onCitedBy = onCitedBy,
            onOpinions = onOpinions,
            stanceControl = stanceControl,
        )
    }
}

/**
 * The card itself (`CommentCard.jsx`) — the author's line, what they
 * wrote, and the one affordance row under it.
 */
@Composable
private fun CommentCard(
    comment: CommentView,
    state: CommentsUiState,
    viewerId: String?,
    signedIn: Boolean?,
    onReplyTo: (CommentView) -> Unit,
    onEditComment: (CommentView) -> Unit,
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenReferences: (CommentView) -> Unit,
    onReference: (String) -> Unit,
    onLicense: (LicenseChoice) -> Unit,
    onRemoveComment: (CommentView) -> Unit,
    onReportComment: (CommentView) -> Unit,
    onCitedBy: (CommentView) -> Unit,
    onOpinions: (CommentView) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
) {
    // Keyed by the comment's id, as a feed card by its post's: the board keys
    // its samples by handle, which one person's two comments would share.
    val card = (THREAD_SHEET / "commentCard").keyed(comment.id)
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .dataNode(card),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                // `Card.jsx`: `--card-padding` 16 and `--card-gap` 12, as the feed's cards.
                .padding(Space.x4),
            verticalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            // The picture the boards draw on a comment card (Q49),
            // and the age beside it. Null is the monogram — the
            // designed fallback for an author who has set none, not
            // a gap waiting for a photo.
            ContentCardHeader(
                author = comment.author,
                at = comment.createdAt,
                onOpenActor = onOpenActor,
                testTagPrefix = "comment_${comment.id}",
                // A REMOVED COMMENT KEEPS ITS ⋮ (CommentRemoved.md:9,
                // CommentRemovedOther.md:28): the reader's comment menu whole,
                // the own one less Edit and Remove — `commentMenuRows` drops them.
                menu = commentMenuRows(
                    comment = comment,
                    own = isOwn(comment, viewerId),
                    onCite = { onReference(comment.id) },
                    onLicense = { onLicense(comment.license) },
                    onCitedBy = { onCitedBy(comment) },
                    onOpinions = { onOpinions(comment) },
                    onEdit = { onEditComment(comment) },
                    onRemove = { onRemoveComment(comment) },
                    onReport = { onReportComment(comment) },
                    // CommentMenu and CommentMenuOwn register the thread's
                    // menu under the detail's prefix, whichever surface
                    // raised the thread (`postDetail.menuSheet.*`).
                    placement = THREAD_MENU,
                ),
                menuSheetNode = POST_DETAIL / "menuSheet",
                menuContentDescription = stringResource(R.string.content_menu_comment),
                // IT IS DRAWN STACKED ON PURPOSE (`CommentMenu.jsx:18-23`):
                // the thread already lives in a sheet, so this menu is a
                // sheet on a sheet (design/readme.md:2364).
                stacked = true,
                node = card,
            )
            CommentCardBody(
                comment = comment,
                state = state,
                node = card,
                onReveal = onReveal,
                onOpenTopic = onOpenTopic,
                onOpenReferences = onOpenReferences,
            )
            CommentAffordances(
                comment = comment,
                node = card / "actionRow",
                signedIn = signedIn,
                onReplyTo = onReplyTo,
                stanceControl = stanceControl,
            )
            // THE ROW LINE under the face (RowSigning.md): a save or unsave
            // of this comment that did not go through.
            LocalSavedHost.current?.comfortLine(comment.id)?.let { RowLine(it, "comment_${comment.id}_row_line") }
        }
    }
}

/**
 * What the author wrote, and the quiet marks the card carries under it.
 */
@Composable
private fun CommentCardBody(
    comment: CommentView,
    state: CommentsUiState,
    node: DataNode,
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenReferences: (CommentView) -> Unit,
) {
    // A comment is text **plus** optional media (D16),
    // so its body is never the exclusive-or a post's
    // is — but it veils and redacts as one region all
    // the same.
    PostBody(
        content = comment.content,
        description = null,
        attachments = comment.attachments,
        attachmentsStatus = comment.attachmentsStatus,
        moderation = comment.moderation,
        removal = comment.removal,
        testTagPrefix = "comment_${comment.id}",
        surface = BodySurface.Comment,
        node = node,
        revealed = state.reveals.isRevealed(comment.id, comment.sensitiveMark()),
        onReveal = { onReveal(comment.id, comment.sensitiveMark()) },
        // The statuses are the veil — the OR of the author's
        // own mark and a moderator's verdict — so the
        // author's half is what names the source.
        sensitiveSource = if (comment.sensitiveSelfMark) {
            SensitiveSource.Author
        } else {
            SensitiveSource.Platform
        },
        sensitiveReason = comment.sensitiveReason,
    )
    // The soft marker, friendly not forensic (design.md §9).
    if (comment.updatedAt.isAfter(comment.createdAt)) {
        Text(
            text = stringResource(R.string.content_comment_edited),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.testTag("comment_edited_${comment.id}"),
        )
    }
    if (comment.landing.isPending) {
        PendingMarker(testTag = "comment_pending_${comment.id}")
    }
    // The same one line a post wears (`CommentCard.jsx`).
    TopicsLine(
        topics = comment.topics,
        references = comment.references,
        onOpenTopic = onOpenTopic,
        // THE COUNT IS A DOOR on every comment too (TopicsLine.jsx:202-212):
        // the tags-and-references sheet, stacked over the thread.
        onOpenReferences = { onOpenReferences(comment) },
        testTagPrefix = "comment_${comment.id}",
    )
}

/**
 * ONE AFFORDANCE ROW, AS ON PostCard, SPREAD ACROSS THE CARD
 * (`CommentCard.jsx`: `width: "100%"`, `justifyContent: "space-between"`,
 * `flexWrap: "wrap"`, `columnGap: --space-2`, `rowGap: --space-1`). A fixed
 * gap huddled the controls at the leading edge; wrapping is what keeps every
 * one of them on its 48dp target when a comment grows one more.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CommentAffordances(
    comment: CommentView,
    /** The card's registered `actionRow`: its stance and reply wear its parts. */
    node: DataNode,
    signedIn: Boolean?,
    onReplyTo: (CommentView) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
) {
    // NO EDIT ON THE CARD (jakob on #423, seam 304; CommentMenuOwn.md:11): the
    // own comment's Edit is a row of its ⋮ menu, the one door to its edit.
    FlowRow(
        modifier = Modifier.fillMaxWidth().dataNode(node),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalArrangement = Arrangement.spacedBy(Space.x1),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        // A comment carries the control too (design.md §6), naming its
        // target `this comment` (`CommentCard.jsx`).
        CommentStanceTarget { stanceControl(comment.id, "comment_${comment.id}", node / "stance") }
        if (signedIn == true) {
            // `ReplyEntry` 5 — the composer, pre-targeted.
            // `Button variant="text" size="sm"` (`CommentCard.jsx`).
            CograButton(
                text = stringResource(R.string.content_comment_reply),
                onClick = { onReplyTo(comment) },
                kind = ButtonKind.Text,
                size = ButtonSize.Compact,
                // An applicant's Reply: the disabled opacity, still tappable (ReplyEntry.md:29).
                modifier = Modifier
                    .alpha(if (LocalReplyLocked.current) StateTokens.DISABLED else 1f)
                    .dataNode(node / "reply"),
            )
        }
    }
}

/** Whether the reader wrote [comment] — what gives it Edit and the own menu's Remove. */
private fun isOwn(comment: CommentView, viewerId: String?): Boolean =
    viewerId != null && comment.author?.id == viewerId

/**
 * The branch under a card: the replies a reader has opened, and the one line
 * that stands in for them until they ask.
 *
 * Replies are counted, not carried (Q49): nothing is on screen until a reader
 * opens the branch, and `replyCount` is what the collapsed line reads.
 */
@Composable
private fun CommentBranch(
    comment: CommentView,
    depth: Int,
    state: CommentsUiState,
    viewerId: String?,
    signedIn: Boolean?,
    onLoadMoreReplies: (CommentView) -> Unit,
    onReplyTo: (CommentView) -> Unit,
    onEditComment: (CommentView) -> Unit,
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenReferences: (CommentView) -> Unit,
    onReference: (String) -> Unit,
    onLicense: (LicenseChoice) -> Unit,
    onRemoveComment: (CommentView) -> Unit,
    onReportComment: (CommentView) -> Unit,
    onCitedBy: (CommentView) -> Unit,
    onOpinions: (CommentView) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
) {
    val thread = state.replyThreads[comment.id]
    val replies = thread?.items.orEmpty()
    val hasMore = thread?.hasMore ?: false
    replies.forEach { reply ->
        CommentThread(
            comment = reply,
            depth = depth + 1,
            state = state,
            viewerId = viewerId,
            signedIn = signedIn,
            onLoadMoreReplies = onLoadMoreReplies,
            onReplyTo = onReplyTo,
            onEditComment = onEditComment,
            onReveal = onReveal,
            onOpenActor = onOpenActor,
            onOpenTopic = onOpenTopic,
            onOpenReferences = onOpenReferences,
            onReference = onReference,
            onLicense = onLicense,
            onRemoveComment = onRemoveComment,
            onReportComment = onReportComment,
            onCitedBy = onCitedBy,
            onOpinions = onOpinions,
            stanceControl = stanceControl,
        )
    }
    when {
        thread?.loading == true -> CircularProgressIndicator(
            modifier = Modifier.padding(start = 12.dp).testTag("replies_loading_${comment.id}"),
        )
        thread?.failed == true -> TextButton(
            onClick = { onLoadMoreReplies(comment) },
            modifier = Modifier.testTag("replies_retry_${comment.id}"),
        ) {
            Text(stringResource(R.string.content_retry))
        }
        // The collapsed branch, as `CommentCard` draws it: the count
        // stands in for the replies until a reader asks for them.
        replies.isEmpty() && comment.replyCount > 0 -> TextButton(
            onClick = { onLoadMoreReplies(comment) },
            modifier = Modifier.testTag("replies_more_${comment.id}"),
        ) {
            Text(
                pluralStringResource(
                    R.plurals.content_comment_view_replies,
                    comment.replyCount,
                    comment.replyCount,
                ),
            )
        }
        hasMore -> TextButton(
            onClick = { onLoadMoreReplies(comment) },
            modifier = Modifier.testTag("replies_more_${comment.id}"),
        ) {
            Text(stringResource(R.string.content_comment_more_replies))
        }
    }
}

/** The thread's one sheet (`postDetail.threadSheet`), whichever surface raised it. */
internal val THREAD_SHEET = POST_DETAIL / "threadSheet"

/**
 * The thread's Reply wears the applicant's locked look. A local scoped to this
 * sheet rather than a parameter: the Reply sits five layers down the thread's
 * list, under the replies' own nesting, and the taps already ride
 * `onReplyTo`; only the look needs to reach it.
 */
private val LocalReplyLocked = staticCompositionLocalOf { false }

/**
 * AN APPLICANT'S TWO DOORS INTO THE COMPOSER ANSWER IN PLACE (ReplyEntry.md:25-29;
 * copy-voice *The applicant-foot family*; PR-103): `Add a comment` and every
 * comment's Reply say `You can comment once you're in.` on the sheet's own
 * snackbar — the composer never opens and nothing stages. The guard wraps a
 * door: while [locked] it answers, otherwise the door opens as it always did.
 */
@Composable
private fun rememberCommentGuard(locked: Boolean, snackbar: SnackbarHostState): (() -> Unit) -> () -> Unit {
    val scope = rememberCoroutineScope()
    val line = stringResource(R.string.content_comment_locked)
    val answer: () -> Unit = { scope.launch { snackbar.say(line) } }
    return { door -> if (locked) answer else door }
}
