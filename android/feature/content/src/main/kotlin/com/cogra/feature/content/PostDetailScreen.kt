package com.cogra.feature.content

import android.content.res.Configuration
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.pullToRefresh
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.ActorChip
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.NodeSnackbarVisuals
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.core.designsystem.v2.atom.CograOverflowMenu
import com.cogra.core.designsystem.v2.atom.LoadingState
import com.cogra.core.designsystem.v2.media.CoverKind
import com.cogra.core.designsystem.v2.media.CoveringLayersHost
import com.cogra.core.designsystem.v2.media.CoversSurface
import com.cogra.core.designsystem.v2.media.DetailClip
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.MediaViewer
import com.cogra.core.designsystem.v2.media.SensitiveVeil
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.CommentView
import com.cogra.domain.LicenseChoice
import com.cogra.domain.PostView
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.isRevealed
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.stance.StanceTarget
import com.cogra.feature.content.R
import com.cogra.feature.content.reply.ReplyTarget
import com.cogra.feature.content.reply.ReplyTargetKind
import com.cogra.feature.saved.ComfortRowLine
import com.cogra.feature.saved.SavedHost
import com.cogra.feature.saved.asHiddenPerson
import com.cogra.feature.saved.rememberHiddenSet
import com.cogra.feature.saved.rememberSavedHost
import com.cogra.feature.saved.rememberSavedWrites
import com.cogra.feature.stance.StanceControlRoute
import kotlinx.coroutines.launch

@Composable
fun PostDetailRoute(
    postId: String,
    /** The viewer's account id; gates the edit affordance to the creator. */
    viewerId: String?,
    /** Null while the auth phase resolves; the comment/join affordances wait. */
    signedIn: Boolean?,
    onEdit: (String) -> Unit,
    /**
     * The reply wizard, pinned to what it answers — the post for
     * `ReplyEntry` 7, the comment for `ReplyEntry` 5. The target is
     * built here rather than by the caller because this is where the
     * thread's own words are.
     */
    onReply: (ReplyTarget) -> Unit,
    /** `ReplyMedia` 6 — `CommentEdit`, on an own comment. */
    onEditComment: (commentId: String, parentTitle: String) -> Unit,
    onOpenActor: (String) -> Unit,
    /** A post cited from the tags-and-references sheet. */
    onOpenPost: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    /** The Reference affordance (D20): compose a post citing this node. */
    onReference: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    onBack: () -> Unit,
    refreshSignal: Boolean = false,
    onRefreshSignalConsumed: () -> Unit = {},
    /**
     * THE SHEET'S OWN RETURN, not the detail's (jakob 2026-09-15). The
     * thread is the same sheet the feed raises, so a comment coming back
     * signed is answered by the sheet on either surface and this screen
     * only passes the two values through: where the reader was, and
     * which comment the new reply hangs under.
     */
    commentsReturn: CommentsReturn = CommentsReturn(),
    onCommentsReturnConsumed: () -> Unit = {},
    /** The reader's place, on the way out to a composer. */
    onCommentsDepart: (CommentsScroll) -> Unit = {},
    /** The deletion band, while the account's confirmed deletion is in its grace (`FeedDeleting.md:3`). */
    deletionBand: @Composable () -> Unit = {},
    /**
     * The guest gate: non-null means the reader is signed out, and the menu's
     * Report row raises it instead of the confirm (ReportConfirm.md:21).
     */
    onRequireAccount: (() -> Unit)? = null,
    /** Where the reader came from, which the back arrow names (`saved` reads `Back to Saved`). */
    from: String? = null,
    /** A comment to land on: the thread opens over the post, scrolled to it. */
    landOn: String? = null,
    viewModel: PostDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LaunchedEffect(postId) { viewModel.start(postId) }
    // In an effect, not the composition body: a recomposition that never
    // commits would otherwise consume the signal and fire the refetch
    // anyway.
    LaunchedEffect(refreshSignal) {
        if (refreshSignal) {
            onRefreshSignalConsumed()
            viewModel.refresh()
        }
    }
    // THE PULL REACHES BOTH OWNERS. The thread is the sheet's and the count
    // on the affordance row is this screen's, so one re-pull has to say so
    // twice — otherwise the reader pulls, opens the thread, and reads the
    // page from before the pull.
    var threadToken by remember { mutableIntStateOf(0) }
    // …and a reply landing changes the POST's own comment count, which is
    // read with the post rather than with the thread.
    // The reader asked for a reply, not for the post's newest version: the
    // count read holds another version behind the line like any other read.
    LaunchedEffect(commentsReturn.landed) { if (commentsReturn.landed) viewModel.recount() }
    PostDetailScreen(
        state = state,
        viewerId = viewerId,
        deletionBand = deletionBand,
        onRefresh = {
            threadToken++
            viewModel.refresh()
        },
        onSwapToNewer = viewModel::swapToNewer,
        onReveal = viewModel::onReveal,
        onEdit = onEdit,
        onOpenActor = onOpenActor,
        onOpenPost = onOpenPost,
        onOpenTopic = onOpenTopic,
        onReference = onReference,
        onShare = { id -> context.sharePost(viewModel.shareUrl(id)) },
        onBack = onBack,
        reportSheet = reportDoor(onRequireAccount, "detail_report_sheet", POST_DETAIL / "reportSheet"),
        stanceControl = nodeStanceControl,
        commentsSheet = { onDismiss ->
            DetailThread(
                postId = postId,
                post = state.post,
                viewerId = viewerId,
                signedIn = signedIn,
                onDismiss = onDismiss,
                onReply = onReply,
                onEditComment = onEditComment,
                onOpenActor = onOpenActor,
                onOpenTopic = onOpenTopic,
                onReference = onReference,
                onSignInOrJoin = onSignInOrJoin,
                onDepart = onCommentsDepart,
                commentsReturn = commentsReturn,
                onReturnConsumed = onCommentsReturnConsumed,
                refreshToken = threadToken,
                landOn = landOn,
                onRequireAccount = onRequireAccount,
            )
        },
        saved = rememberSavedWrites(),
        hidden = rememberHiddenSet(),
        onRequireAccount = onRequireAccount,
        backDescription = if (from == "saved") stringResource(R.string.content_back_saved) else null,
        landOn = landOn,
    )
}

/** The back arrow's spoken name: the origin's when one is named, else the plain `Back`. */
@Composable
private fun backLabel(named: String?): String = named ?: stringResource(R.string.content_back)

/** The thread the detail raises over the post: the same sheet the feed raises. */
@Composable
private fun DetailThread(
    postId: String,
    post: PostView?,
    viewerId: String?,
    signedIn: Boolean?,
    onDismiss: () -> Unit,
    onReply: (ReplyTarget) -> Unit,
    onEditComment: (commentId: String, parentTitle: String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onReference: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    onDepart: (CommentsScroll) -> Unit,
    commentsReturn: CommentsReturn,
    onReturnConsumed: () -> Unit,
    refreshToken: Int,
    landOn: String?,
    onRequireAccount: (() -> Unit)?,
) {
    CommentsSheetRoute(
        postId = postId,
        viewerId = viewerId,
        signedIn = signedIn,
        onDismiss = onDismiss,
        onReply = { request ->
            val target = request.comment?.asReplyTarget() ?: post?.asReplyTarget()
            target?.let(onReply)
        },
        onEditComment = { commentId -> onEditComment(commentId, post?.title?.value.orEmpty()) },
        onOpenActor = onOpenActor,
        onOpenTopic = onOpenTopic,
        onReference = onReference,
        onSignInOrJoin = onSignInOrJoin,
        onDepart = onDepart,
        commentsReturn = commentsReturn,
        onReturnConsumed = onReturnConsumed,
        refreshToken = refreshToken,
        stanceControl = { target, tag ->
            StanceControlRoute(target = StanceTarget.Node(target), testTagPrefix = tag)
        },
        landOn = landOn,
        onRequireAccount = onRequireAccount,
    )
}

/**
 * THE SHEET'S TWO-VALUE RETURN (jakob 2026-09-15).
 *
 * A composer is a destination and the thread is not, so signing one
 * comes back to a sheet that has to be drawn again from nothing. "A
 * reply landed" cannot draw it: the reader has to find themselves where
 * they were, looking at what they just wrote — which sits one level
 * down, behind a count that was collapsed when they left.
 *
 * So the return carries both: [scroll] puts the thread back where it
 * stood, and [parentCommentId] names the branch that unfolds so the new
 * reply is on screen wearing its pending marker. Null [parentCommentId]
 * alongside a landing is a comment on the post itself, already at the
 * top level.
 *
 * [landed] is the third fact and not one of the two: it says whether
 * anything was signed at all. The place comes back from a composer the
 * reader ABANDONED too — leaving one should not cost them their place —
 * and only a landing earns the refetch and the confirmation.
 */
data class CommentsReturn(
    val scroll: CommentsScroll? = null,
    val landed: Boolean = false,
    val parentCommentId: String? = null,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostDetailScreen(
    state: PostDetailUiState,
    viewerId: String?,
    onRefresh: () -> Unit,
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit,
    onEdit: (String) -> Unit,
    /** The reader tapped the newer-version line ([PostDetailUiState.newer]). */
    onSwapToNewer: () -> Unit = {},
    onOpenActor: (String) -> Unit,
    /** A post cited from the tags-and-references sheet. */
    onOpenPost: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onReference: (String) -> Unit,
    /** Hands this post to the platform's own share sheet. */
    onShare: (String) -> Unit,
    onBack: () -> Unit,
    /**
     * The stance control the post carries (design.md §6), handed the
     * control's data-node, which the card's row names.
     */
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit = { _, _, _ -> },
    /**
     * THE THREAD, WHICH THIS SCREEN NO LONGER OWNS. The sheet is the one
     * comments surface and holds its own state, so the detail supplies
     * only the affordance that raises it and the slot it stands in —
     * exactly what the feed supplies.
     */
    commentsSheet: @Composable (onDismiss: () -> Unit) -> Unit = {},
    deletionBand: @Composable () -> Unit = {},
    /**
     * THE REPORT'S CONFIRM, `postDetail.reportSheet` (ReportConfirm.md) — or
     * a guest's join prompt ([reportDoor]) — over this page, handed the
     * page's own snackbar for its aftermath.
     */
    reportSheet: ReportSheetSlot = { _, _, _ -> },
    /** The app's one Saved overlay, which the menu saves through; null stands its Save row inert. */
    saved: SavedWrites? = null,
    /** The guest gate a signed-out reader's Save opens; null when signed in. */
    onRequireAccount: (() -> Unit)? = null,
    /**
     * The back arrow's spoken name: where the reader came from, by the
     * origin-naming table (`Back to Saved` from a Saved row). Null reads the
     * plain `Back`.
     */
    backDescription: String? = null,
    /**
     * A comment to land on (Saved.md "tap a comment's row"): the thread
     * stands raised over the post from the first frame.
     */
    landOn: String? = null,
    /**
     * The reader's hidden set, which the menu hides through; null stands its
     * Hide row inert. HIDING KEEPS THE READER ON THE POST (ReaderPostMenu.md:15):
     * the person leaves the feed, never this page.
     */
    hidden: HiddenSet? = null,
) {
    val snackbar = remember { SnackbarHostState() }
    // THE PAGE'S SNACKBAR (`postDetail.snackbar`): the scope is the screen's,
    // so a confirmation outlives the sheet that raised it.
    val scope = rememberCoroutineScope()
    val notify: (String) -> Unit = { text ->
        scope.launch { snackbar.showSnackbar(NodeSnackbarVisuals(text, POST_DETAIL / "snackbar")) }
    }
    // THE MENU SAVES THROUGH THE ONE OVERLAY AND HIDES THROUGH THE ONE SET, its
    // aftermath on this page's snackbar — `Undo` on `postDetail.snackbar.action`.
    val savedHost = rememberSavedHost(saved, snackbar, POST_DETAIL / "snackbar", onRequireAccount, hidden)
    // Which post's report confirm is up — the post the page is reading.
    var reportFor by remember { mutableStateOf<String?>(null) }
    // THE LICENSE IS NEVER A STATE OF THE CARD (`ReaderPostMenu.jsx:27-29`):
    // one sheet for the screen, raised by the menu row that asked for it.
    // This screen's only such row is the post's own, in the top bar; a
    // comment's is the thread's, and rides the thread.
    var licenseShown by remember { mutableStateOf<LicenseChoice?>(null) }
    var removeOpen by remember { mutableStateOf(false) }
    // SAVED, not merely remembered: the composer and the comment editor are
    // their own destinations, so the thread is left and re-entered rather than
    // covered — and every way out of them comes back to it (`ReplyCompose` and
    // `CommentEdit` both cancel and advance to the thread).
    var commentsOpen by rememberSaveable { mutableStateOf(landOn != null) }
    // THE PLATFORM'S SHARE SHEET IS A SHEET OVER THE POST TOO
    // (PostDetailVideo.md:41): it rises with the tap that hands the post over,
    // and it is down again when this screen is resumed — the chooser is
    // another activity, and its dismissal is the one thing this activity
    // hears of it (developer.android.com/guide/components/activities/activity-lifecycle,
    // `onResume`).
    var shareUp by remember { mutableStateOf(false) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { shareUp = false }
    val share: (String) -> Unit = { id ->
        shareUp = true
        onShare(id)
    }
    val header = POST_DETAIL / "header"
    // EVERY LAYER OVER THE POST SAYS IT IS UP (PostDetailVideo.md:39-51): the
    // detail clip stops under a sheet or a dialog and pauses under the opinion
    // pad, and what resumes it is its own rule ([CoveringLayers]).
    CoveringLayersHost {
        CoversSurface(open = commentsOpen, kind = CoverKind.Suspend)
        CoversSurface(open = licenseShown != null, kind = CoverKind.Suspend)
        CoversSurface(open = removeOpen, kind = CoverKind.Suspend)
        CoversSurface(open = shareUp, kind = CoverKind.Suspend)
        Scaffold(
            modifier = Modifier.dataNodeSurface(),
            snackbarHost = { CograSnackbarHost(snackbar) },
            topBar = {
                // THE DETAIL'S BAR IS PINNED (jakob 2026-09-15): collapsing the
                // top is the READING SURFACES' motion, not every page's, and
                // this bar is the only place the post's one menu and its way
                // back live (`_shared.jsx:341-346` takes the ⋮ off the card
                // here). A bar that leaves with the scroll takes the post's
                // whole set of acts off screen mid-read, which is not a cost
                // the collapse was ever meant to buy.
                Column {
                    TopAppBar(
                        // The 48dp band every board draws (`spacing.css`
                        // `--top-bar-height`, `PageHeader.jsx`); M3's small bar
                        // defaults to 64dp, which is a rung the design does not
                        // have. `expandedHeight` is the documented way to set it.
                        expandedHeight = Layout.TopBarHeight,
                        colors = surfaceTopAppBarColors(),
                        modifier = Modifier.dataNode(header),
                        // No title in the band: the post's title is the card's
                        // heading, above its media (`_shared.jsx:287-289` — the
                        // detail header takes no title prop).
                        title = {},
                        navigationIcon = {
                            IconButton(onClick = onBack, modifier = Modifier.dataNode(header / "back")) {
                                Icon(
                                    Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = backLabel(backDescription),
                                )
                            }
                        },
                        actions = {
                            DetailMenu(
                                post = state.post,
                                viewerId = viewerId,
                                onEdit = onEdit,
                                onCite = onReference,
                                onRemove = { removeOpen = true },
                                // Over the page — never stacked.
                                onLicense = { license -> licenseShown = license },
                                onShare = share,
                                onReport = { id -> reportFor = id },
                                node = header / "menu",
                                saved = savedHost,
                            )
                        },
                    )
                    // Directly under the pinned bar, pinned with it (FeedDeleting.md:5).
                    deletionBand()
                }
            },
        ) { padding ->
            // PULL-TO-REFRESH BELONGS TO THE TOP OF THE THREAD: a reader
            // correcting upward from the middle of a long post is scrolling,
            // not asking for a re-read. With a pinned bar there is no collapse
            // left to absorb that correction's leftover, so the rule is stated
            // here instead of riding the bar's motion.
            //
            // IT IS LATCHED AT THE GESTURE'S START, never read live: a drag
            // that travels through the top has ALREADY been spent as scroll,
            // and re-arming as it arrives would turn the tail of every long
            // correction into a refetch. This is the web's own rule — its
            // `usePullToRefresh` asks `atTop()` on `touchstart` and not again
            // (`lib/ui/pull-to-refresh.ts`).
            val listState = rememberLazyListState()
            var pullArmed by remember { mutableStateOf(true) }
            LaunchedEffect(listState) {
                snapshotFlow { listState.isScrollInProgress }.collect { scrolling ->
                    if (scrolling) {
                        pullArmed = listState.firstVisibleItemIndex == 0 &&
                            listState.firstVisibleItemScrollOffset == 0
                    }
                }
            }
            val refreshState = rememberPullToRefreshState()
            Box(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize()
                    .pullToRefresh(
                        // The read in flight, not the empty screen: a post
                        // opened from the feed is already drawn while its read
                        // runs, and an indicator over content the reader can
                        // see says the screen is still arriving when it has
                        // arrived (HT-10).
                        isRefreshing = state.refreshing,
                        state = refreshState,
                        enabled = pullArmed,
                        onRefresh = onRefresh,
                    ),
            ) {
                Box(Modifier.fillMaxSize()) {
                    when {
                        state.notFound -> ErrorLine(
                            R.string.content_error_not_found,
                            "detail_not_found",
                            modifier = Modifier.padding(24.dp),
                        )
                        state.transportFault != null && state.post == null -> Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                        ) {
                            ErrorLine(R.string.content_error_transport, "detail_transport_error")
                            TextButton(
                                onClick = onRefresh,
                                modifier = Modifier.testTag("detail_retry"),
                            ) {
                                Text(stringResource(R.string.content_retry))
                            }
                        }
                        // Nothing held and nothing arrived: the reader opened
                        // a post this device has never read. The surface says
                        // what it is doing in a line of text — the boards
                        // give a loading state no spinner
                        // (design/components/states/EmptyState.prompt.md).
                        state.loading && state.post == null -> LoadingState(
                            testTag = "detail_loading",
                            modifier = Modifier.padding(24.dp),
                        )
                        state.post != null -> Column(modifier = Modifier.fillMaxSize()) {
                            // A transport fault never blanks content already
                            // on screen, and it surfaces where the failed
                            // fetch was requested: a failed refresh on this
                            // banner, a failed comments page at the load-more
                            // slot in the thread (android.md "Degrade, never
                            // crash").
                            if (state.transportFault == TransportFault.REFRESH) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 24.dp, vertical = 8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    ErrorLine(
                                        R.string.content_error_transport,
                                        "detail_transport_banner",
                                    )
                                    TextButton(
                                        onClick = onRefresh,
                                        modifier = Modifier.testTag("detail_retry"),
                                    ) {
                                        Text(stringResource(R.string.content_retry))
                                    }
                                }
                            }
                            PostDetailBody(
                                state = state,
                                post = state.post,
                                listState = listState,
                                onSwapToNewer = onSwapToNewer,
                                onReveal = onReveal,
                                onOpenActor = onOpenActor,
                                onOpenPost = onOpenPost,
                                onOpenTopic = onOpenTopic,
                                onOpenComments = { commentsOpen = true },
                                onShare = share,
                                stanceControl = stanceControl,
                                saved = savedHost,
                            )
                        }
                    }
                }
                PullToRefreshDefaults.Indicator(
                    state = refreshState,
                    isRefreshing = state.refreshing,
                    modifier = Modifier.align(Alignment.TopCenter),
                )
            }
        }

        if (commentsOpen) {
            commentsSheet { commentsOpen = false }
        }
        // ONLY THE POST'S OWN TERMS REACH THIS MOUNT, so it is never stacked
        // (design/readme.md:2364). A comment's terms are raised from inside the
        // thread and stand over it — that mount moved into the sheet, which is
        // now the one thing that knows it is a sheet over a sheet.
        licenseShown?.let { license ->
            LicenseSheet(license = license, onDismiss = { licenseShown = null })
        }
        // THE DIALOG SHIPS, THE REMOVAL DOES NOT (jakob 2026-09-14): erasure is
        // slice 8's, whole — "we need to do erasure right so it should be one
        // task" — so Remove closes the dialog and changes nothing.
        if (removeOpen) {
            RemoveConfirm(
                onDismiss = { removeOpen = false },
                onRemove = { removeOpen = false },
            )
        }
        // The confirm rises where the menu stood, over this page; it says it
        // is up itself, so the detail clip stops beneath it.
        reportFor?.let { id ->
            reportSheet(id, { reportFor = null }, notify)
        }
    }
}

/**
 * ON A DETAIL SURFACE THE MENU LIVES UP HERE and the card's own dot yields
 * (`_shared.jsx:341-346`): two dots would be two menus for one post.
 *
 * A REMOVED POST HAS NO MENU LEFT — back is the whole header
 * (`Removed.jsx:5-6`). There is nothing of it to edit, cite or license, and
 * the skeleton that holds the thread's place is not a thing a reader keeps.
 *
 * It lives in the top bar, over the plain page — never over the comments
 * thread — so it stays unstacked, unlike the comment's own menu.
 */
@Composable
private fun DetailMenu(
    post: PostView?,
    viewerId: String?,
    onEdit: (String) -> Unit,
    onCite: (String) -> Unit,
    onRemove: () -> Unit,
    onLicense: (LicenseChoice) -> Unit,
    onShare: (String) -> Unit,
    onReport: (String) -> Unit,
    node: DataNode,
    saved: SavedHost?,
) {
    if (post == null) return
    if (isRemoved(post.content, post.attachments, post.attachmentsStatus)) return
    val own = viewerId != null && post.author?.id == viewerId
    // THE NARROW PHONE'S MENU HOLDS THE SHARE IT TOOK (design/readme.md,
    // jakob 2026-09-17, sharpened 2026-09-22 — PR #794): the detail's own
    // ⋮ is the reader's menu too (`_shared.jsx:341-346` — the card's own
    // dot yields to it).
    val narrow = isNarrowShareWidth()
    val shareRow: (() -> Unit)? = if (!own && narrow) {
        { onShare(post.id) }
    } else {
        null
    }
    val menuSheet = POST_DETAIL / "menuSheet"
    CograOverflowMenu(
        items = postMenuRows(
            own = own,
            handle = post.author?.handle,
            license = post.license,
            onEdit = { onEdit(post.id) },
            onCite = { onCite(post.id) },
            onRemove = onRemove,
            onLicense = { onLicense(post.license) },
            onShare = shareRow,
            testTagPrefix = "detail_menu",
            onReport = { onReport(post.id) },
            // Both of the detail's menus are registered whole — the reader's
            // (ReaderPostMenu) and the author's (RemoveMenu) — so every row
            // wears its `postDetail.menuSheet` path.
            rowNode = { row -> menuSheet / row.nodeName },
            saveRow = saved?.menuRow(post.id, post.viewerBookmarkedAt, "detail_menu_save"),
            onHide = post.author?.let { saved?.hideAct(it.asHiddenPerson(), post.id) },
        ),
        contentDescription = stringResource(R.string.content_menu_post),
        testTag = node.tag,
        sheetNode = menuSheet,
    )
}

@Composable
private fun PostDetailBody(
    state: PostDetailUiState,
    post: PostView,
    /** Hoisted: the refresh gesture is gated on this list's own place. */
    listState: LazyListState,
    onSwapToNewer: () -> Unit,
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    /** A post cited from the tags-and-references sheet. */
    onOpenPost: (String) -> Unit,
    /** `ReplyEntry`: the affordance row's count raises the thread. */
    onOpenComments: () -> Unit,
    /** Hands this post to the platform's own share sheet. */
    onShare: (String) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
    saved: SavedHost?,
) {
    // A removed post keeps its skeleton and loses everything the payload
    // carried: the license, the topics and the citations rode it away.
    val removed = isRemoved(post.content, post.attachments, post.attachmentsStatus)
    // A VIDEO POST'S DETAIL IS ITS OWN BOARD (`screens/PostDetailVideo.jsx`):
    // the clip leaves the card body, heads the column above it, and wears the
    // full transport. A post of pictures is untouched — its gallery is still
    // the card's body. A removed record has no clip to raise.
    val clip = if (removed) {
        null
    } else {
        post.attachments.firstOrNull { it.isVideo }?.toItem()
    }
    // THE FULLSCREEN VIEWER, over one of this post's attachments (DV-01/H-25).
    // Null is closed; the number is which attachment it opened on. It is held
    // here rather than in the card because "it never changes the underlying
    // route" (`MediaViewer.jsx:26`) — a layer over this screen, so this screen
    // owns whether it is up.
    var viewerAt by rememberSaveable { mutableStateOf<Int?>(null) }
    val attachments = remember(post.attachments) { post.attachments.map { it.toItem() } }
    // ONE SCOPE FOR THE WHOLE POST (jakob 2026-09-24, the detail-clip veil
    // ruling; `SensitiveScope` in design/components/honesty/SensitiveVeil.jsx):
    // the detail clip and the card body beneath it are two veils over one
    // body, so they read one revealed-state and one tap lifts both. The same
    // set the feed reads: a reader who already chose to look at this post is
    // not asked again on the way in.
    val mark = post.sensitiveMark()
    val revealed = state.reveals.isRevealed(post.id, mark)
    val reveal = { onReveal(post.id, mark) }
    val clipVeiled = !revealed && isSensitive(post.content, post.description, post.attachmentsStatus)

    // Never under the veil: nothing of a veiled clip plays, and the viewer
    // would show it bare.
    TurnToLandscapeOpensTheViewer(
        landscapeClip = clip != null && !clipVeiled && clip.aspectRatio > 1f,
        onTurn = { if (viewerAt == null) viewerAt = 0 },
    )

    // The post is a card here too, edge to edge with its 8dp seam — on the
    // boards the post wears the card and the thread stands in its own sheet
    // over it, not as a second half of this page.
    val flushTop = clip != null || state.newer != null
    LazyColumn(
        state = listState,
        modifier = Modifier
            .fillMaxSize()
            .testTag("detail_list"),
        // The clip heads the column flush under the bar, as the board draws
        // it (`PostDetailVideo.jsx:30-33`); a card alone keeps its seam. The
        // newer-version line, standing, heads it flush the same way
        // (`PostDetail.jsx` — the line is `DetailColumn`'s first child).
        contentPadding = PaddingValues(top = if (flushTop) 0.dp else Space.x2, bottom = Space.x4),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        item {
            // THE CLIP HEADS THE COLUMN, FLUSH ON THE CARD (ruling 100,
            // `DetailClip.prompt.md:15` — "one block, no gap between them"),
            // and IN THE SAME ROW as the card: it scrolls with the page
            // (PostDetailVideo.md:5), and a lazy list disposes a row scrolled
            // out of view — a clip in a row of its own would surrender its
            // player there and stop, where the law says it plays on (:11).
            // The card's row is on screen for as long as any of the post is.
            Column(modifier = Modifier.fillMaxWidth().testTag(DETAIL_BLOCK_TAG)) {
                // BETWEEN THE HEADER AND THE POST (PostDetail.md:7;
                // PostDetailVideo.md:65 — "under the header", so above a video
                // post's clip too), in this same row: in the page's flow, it
                // scrolls away with the post and is never pinned (:11).
                NewerVersionLine(state.newer != null, onSwapToNewer, POST_DETAIL / "newerVersion")
                if (clip != null) {
                    // The clip's two routes into the viewer — the bar's
                    // fullscreen toggle and the clip's own tap (graph.json,
                    // `PostDetailVideo` via 19 and via 3; PostDetailVideo.md:35/37).
                    // A post carries one clip, so the viewer opens on it.
                    VeiledDetailClip(clip, veiled = clipVeiled, onReveal = reveal, onOpenViewer = { viewerAt = 0 })
                }
                DetailCard(
                    post = post,
                    removed = removed,
                    commentCount = (state.newer ?: post).commentCount,
                    mediaAbove = clip != null,
                    // THE POST'S TAP OPENS THE FRAME (graph.json, `PostDetail`
                    // via 4), on the page the reader was looking at.
                    onOpenMedia = { page -> viewerAt = page },
                    revealed = revealed,
                    onReveal = reveal,
                    onOpenActor = onOpenActor,
                    onOpenTopic = onOpenTopic,
                    onOpenPost = onOpenPost,
                    onOpenComments = onOpenComments,
                    onShare = onShare,
                    stanceControl = stanceControl,
                )
                // THE ROW LINE under the face (RowSigning.md): a save or
                // unsave of this post that did not go through.
                ComfortRowLine(saved, post.id, "detail_row_line", Modifier.padding(horizontal = Space.x4))
            }
        }
    }

    // Over everything, answering to nothing behind it.
    viewerAt?.let { at ->
        MediaViewer(
            items = attachments,
            index = at,
            onClose = { viewerAt = null },
        )
    }
}

/**
 * The detail clip in its own veil: a sensitive clip WEARS ITS OWN VEIL IN
 * PLACE — never demoted into the card. The veil is the post body's full face
 * over the clip's frame, and under it the clip is out of the stage and carries
 * no transport ([DetailClip]; PostDetailVideoSensitive.md:3-7).
 */
@Composable
private fun VeiledDetailClip(
    clip: MediaItem,
    veiled: Boolean,
    onReveal: () -> Unit,
    onOpenViewer: () -> Unit,
) {
    SensitiveVeil(
        veiled = veiled,
        onReveal = onReveal,
        modifier = Modifier.fillMaxWidth(),
        testTag = DETAIL_CLIP_VEIL_TAG,
    ) {
        DetailClip(item = clip, onOpenViewer = onOpenViewer)
    }
}

/**
 * THE PHONE TURNING TO LANDSCAPE OPENS THE VIEWER: "WHEN the phone turns to
 * landscape GIVEN the detail holds a landscape clip -> the fullscreen viewer
 * opens on the clip, filling the turned screen" (PostDetailVideo.md:63).
 *
 * A TURN is a change, so the orientation last seen is kept across the
 * activity's own recreation on rotation
 * (developer.android.com/guide/topics/resources/runtime-changes;
 * `rememberSaveable` survives it) — a detail opened already in landscape
 * opens nothing.
 */
@Composable
private fun TurnToLandscapeOpensTheViewer(landscapeClip: Boolean, onTurn: () -> Unit) {
    val orientation = LocalConfiguration.current.orientation
    var orientationSeen by rememberSaveable { mutableIntStateOf(orientation) }
    val turnNow by rememberUpdatedState(onTurn)
    val holdsLandscapeClip by rememberUpdatedState(landscapeClip)
    LaunchedEffect(orientation) {
        val turned = orientation == Configuration.ORIENTATION_LANDSCAPE &&
            orientationSeen != Configuration.ORIENTATION_LANDSCAPE
        orientationSeen = orientation
        if (turned && holdsLandscapeClip) turnNow()
    }
}

/** The post itself, as the card it wears on every surface. */
@Composable
private fun DetailCard(
    post: PostView,
    removed: Boolean,
    /**
     * The thread's size, from the freshest read: the freeze governs the post,
     * and the thread is the sheet's own read, so its count is never held.
     */
    commentCount: Int,
    /** The gallery's tap, handed the page under the reader's thumb. */
    onOpenMedia: (Int) -> Unit,
    /** The clip stands above this card, so the body draws no gallery. */
    mediaAbove: Boolean,
    /** The post's one revealed-state, shared with the detail clip's veil. */
    revealed: Boolean,
    onReveal: () -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    onOpenComments: () -> Unit,
    onShare: (String) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
) {
    // Keyed by the post's id, the key the feed's card and the web's carry.
    val card = POST_DETAIL / "card"
    Card(modifier = Modifier.fillMaxWidth().dataNode(card.keyed(post.id))) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Space.x4),
            verticalArrangement = Arrangement.spacedBy(Space.x1),
        ) {
            // PEOPLE FIRST: the author leads, above the content and never
            // below it as a byline — including on a media post. On the video
            // detail the clip is above the CARD, so the chip leads the card
            // rather than the screen.
            ContentCardHeader(
                author = post.author,
                at = post.createdAt,
                onOpenActor = onOpenActor,
                testTagPrefix = "detail",
                node = card,
            )
            // The title titles the thing, so it stands above the media rather
            // than in the bar: below the picture it would read as a caption,
            // and the caption as a second one. The detail is the read surface,
            // so it never clamps.
            post.title.value?.takeIf { it.isNotEmpty() }?.let { title ->
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.dataNode(card / "title"),
                )
            }
            // Media, words and description are one region because the veil
            // covers them as one state (D12); the title stays outside it.
            PostBody(
                content = post.content,
                description = post.description,
                attachments = post.attachments,
                attachmentsStatus = post.attachmentsStatus,
                moderation = post.moderation,
                testTagPrefix = "detail",
                node = card,
                modifier = Modifier.testTag("detail_body"),
                bleed = Space.x4,
                mediaAbove = mediaAbove,
                onOpenMedia = onOpenMedia,
                revealed = revealed,
                onReveal = onReveal,
            )
            DetailCardFoot(
                post = post,
                removed = removed,
                commentCount = commentCount,
                onOpenTopic = onOpenTopic,
                onOpenActor = onOpenActor,
                onOpenPost = onOpenPost,
                onOpenComments = onOpenComments,
                onShare = onShare,
                stanceControl = stanceControl,
                node = card,
            )
        }
    }
}

/**
 * What closes the detail's card: the markers, the one topics line, and the
 * row of acts.
 *
 * The row is the same one the card wears (`PostCard.jsx`) — stance, comment,
 * share — and it is the skeleton a removal leaves standing, because no record
 * leaves the graph and no removal is silent.
 */
@Composable
private fun DetailCardFoot(
    post: PostView,
    removed: Boolean,
    commentCount: Int,
    onOpenTopic: (String) -> Unit,
    /** The sheet the topics line opens: a mention lands on the profile. */
    onOpenActor: (String) -> Unit,
    /** …and a cited post or comment on the post carrying it. */
    onOpenPost: (String) -> Unit,
    /** `ReplyEntry`: the affordance row's count raises the thread. */
    onOpenComments: () -> Unit,
    onShare: (String) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
    node: DataNode,
) {
    if (post.landing.isPending) {
        PendingMarker(testTag = "detail_pending")
    }
    // The license, the topics and the citations rode the payload away.
    if (!removed) {
        // THE WHOLE LINE IS THE OPENER on a detail surface (`TopicsLine.jsx`),
        // and what it opens is the sheet the counts have always pointed at.
        var refsOpen by rememberSaveable { mutableStateOf(false) }
        // A sheet over the post (PostDetailVideo.md:41).
        CoversSurface(open = refsOpen, kind = CoverKind.Suspend)
        TopicsLine(
            topics = post.topics,
            references = post.references,
            onOpenTopic = onOpenTopic,
            testTagPrefix = "detail_post",
            onOpen = { refsOpen = true },
            node = node / "tagsLine",
        )
        if (refsOpen) {
            RefsSheet(
                topics = post.topics,
                references = post.references,
                onDismiss = { refsOpen = false },
                onOpenTopic = onOpenTopic,
                onOpenActor = onOpenActor,
                onOpenPost = onOpenPost,
                testTagPrefix = "detail_post",
            )
        }
    }
    PostAffordanceRow(
        commentCount = commentCount,
        onOpenComments = onOpenComments,
        onShare = { onShare(post.id) },
        testTagPrefix = "detail_post",
        node = node / "actionRow",
    ) {
        stanceControl(post.id, "detail_post", node / "actionRow" / "stance")
    }
}

/**
 * The detail's registered prefix (`PostDetail` in
 * `design/designs/canonical/nodes.json`): every element the board names
 * wears its `postDetail.…` path.
 */
private val POST_DETAIL = DataNode("postDetail")

/**
 * The post, as the composer's target card reads it (`ReplyEntry` 7).
 *
 * A post leads with its title; the line under it is the body, clipped,
 * because the card gives it one line either way.
 */
internal fun PostView.asReplyTarget(): ReplyTarget = ReplyTarget(
    id = id,
    kind = ReplyTargetKind.Post,
    title = title.value.orEmpty(),
    snippet = content.value.orEmpty().clipForCard(),
    authorHandle = author?.handle.orEmpty(),
    avatarUrl = author?.avatar?.url,
)

/**
 * The comment, as the composer's target card reads it (`ReplyEntry` 5).
 *
 * A comment has no title, so its own opening words become one — the
 * card's two lines are then the answer's subject and its context, the
 * way a post's title and body are.
 */
internal fun CommentView.asReplyTarget(): ReplyTarget = ReplyTarget(
    id = id,
    kind = ReplyTargetKind.Comment,
    title = content.value.orEmpty().clipForCard(TARGET_TITLE_CHARS),
    snippet = content.value.orEmpty().clipForCard(),
    authorHandle = author?.handle.orEmpty(),
    avatarUrl = author?.avatar?.url,
)

/**
 * The card draws one line, and a route carries what it is given — so
 * the words are clipped where they are read rather than where they are
 * drawn.
 */
private fun String.clipForCard(limit: Int = TARGET_SNIPPET_CHARS): String =
    if (length <= limit) this else take(limit).trimEnd() + "…"

/** The detail clip's own veil; its reveal button is `${DETAIL_CLIP_VEIL_TAG}_reveal`. */
internal const val DETAIL_CLIP_VEIL_TAG = "detail_clip_veil"

/** The clip and the card as the one block the board draws, in the list's one row. */
internal const val DETAIL_BLOCK_TAG = "detail_block"

private const val TARGET_TITLE_CHARS = 48
private const val TARGET_SNIPPET_CHARS = 120
