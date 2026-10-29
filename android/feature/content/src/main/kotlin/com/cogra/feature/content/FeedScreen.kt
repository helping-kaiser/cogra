package com.cogra.feature.content

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.ActorChip
import com.cogra.core.designsystem.CollapsingTopBand
import com.cogra.core.designsystem.CollapsingTopBanner
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.EdgeSighting
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.core.designsystem.NodeSnackbarVisuals
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.RowLine
import com.cogra.core.designsystem.SeenCardsEffect
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.core.designsystem.v2.atom.BandBell
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograBandBell
import com.cogra.core.designsystem.v2.atom.CograBandChats
import com.cogra.core.designsystem.v2.atom.CograBandIdentity
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograMark
import com.cogra.core.designsystem.v2.atom.Seam
import com.cogra.core.designsystem.v2.atom.taskRing
import com.cogra.core.designsystem.v2.atom.taskRingColors
import com.cogra.core.designsystem.v2.media.CoverKind
import com.cogra.core.designsystem.v2.media.CoveringLayers
import com.cogra.core.designsystem.v2.media.CoversSurface
import com.cogra.core.designsystem.v2.media.LocalCoveringLayers
import com.cogra.core.designsystem.v2.media.PreloadClips
import com.cogra.core.designsystem.v2.media.ScrollStageHost
import com.cogra.core.designsystem.v2.media.ScrollStageRow
import com.cogra.core.designsystem.v2.media.SurfaceCover
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.LicenseChoice
import com.cogra.domain.PostView
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.isRevealed
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.removal.RemovalKind
import com.cogra.domain.removal.marked
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.stance.StanceTarget
import com.cogra.feature.content.R
import com.cogra.feature.content.reply.ReplyTarget
import com.cogra.feature.saved.LocalSavedHost
import com.cogra.feature.saved.asHiddenPerson
import com.cogra.feature.saved.rememberHiddenSet
import com.cogra.feature.saved.rememberSavedHost
import com.cogra.feature.saved.rememberSavedWrites
import com.cogra.feature.saved.viewState
import com.cogra.feature.stance.StanceControlRoute
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch

/**
 * How many posts short of the end the tail watch sits — the same effective
 * distance as web's `TAIL_DISTANCE` (`infinite-list.ts`): far enough out
 * that the fetch is under way before the reader runs out of posts to read.
 */
internal const val FEED_TAIL_DISTANCE = 5

/**
 * The report confirm over the feed, wearing the registered `feed.reportSheet`
 * (FC-G10); the tag is the fallback the sheet shows only without its node.
 */
internal const val FEED_REPORT_SHEET = "feed_report_sheet"

/** Which post to watch in a list of this length, or -1 when there is none. */
internal fun feedTailIndexOf(count: Int): Int {
    if (count <= 0) return -1
    return maxOf(0, count - FEED_TAIL_DISTANCE)
}

@Composable
fun FeedRoute(
    onOpenPost: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    /**
     * A person tapped inside the comments sheet — its own door, so the
     * profile it opens can name the sheet as the way back (`Back to the
     * comments`, ProfileOther.md:73). Null routes it through [onOpenActor].
     */
    onOpenCommentActor: ((String) -> Unit)? = null,
    /**
     * The band's chats affordance. Null draws no control: the signed-in
     * reader's chat surface is an explicit gap on the canvas
     * (`graph.json`, `"the chat surface (not designed)"`), and a control
     * that opens nothing teaches the reader the band lies.
     */
    onChats: (() -> Unit)? = null,
    /** The band's bell (FeedUnread.md); null for a guest, who has no list. */
    bell: BandBell? = null,
    keyBanner: @Composable () -> Unit = {},
    /** The borrowed-view band, for the reader whose feed is not their own. */
    borrowedViewBand: @Composable () -> Unit = {},
    /** The deletion band, while the account's confirmed deletion is in its grace (`FeedDeleting`). */
    deletionBand: @Composable () -> Unit = {},
    refreshSignal: Boolean = false,
    onRefreshSignalConsumed: () -> Unit = {},
    banners: @Composable () -> Unit = {},
    /**
     * The vouch card (`VouchBack`): the list's first card, above the posts,
     * after the head's notices (ruling 45). The feed's own slot — the own
     * profile carries the banner stack but never this card.
     */
    vouchCard: @Composable () -> Unit = {},
    /**
     * The reader pulled for newer posts: the shell's readers that ride the
     * feed (the borrowed-view band, the vouch card) read again with it.
     */
    onPulled: () -> Unit = {},
    /**
     * A post the wizard staged whose acts were collected before they
     * landed: the label names it, and null means there is nothing to
     * say (`ComposeExpired`).
     */
    expiredLabel: String? = null,
    onExpiredDismissed: () -> Unit = {},
    onOpenDraft: () -> Unit = {},
    /**
     * The viewer's account id, for the card's ⋮ — it gates the creator's rows
     * against the reader's, the way the detail's own menu does.
     */
    viewerId: String? = null,
    /** The ⋮'s Edit and Mark-as-sensitive rows, both doors into the edit flow. */
    onEditPost: (String) -> Unit = {},
    /** The ⋮'s Cite row — the composer, with the post staged. */
    onCitePost: (String) -> Unit = {},
    /** Null while the auth phase resolves; the thread's affordances wait. */
    signedIn: Boolean? = null,
    /** The composer the thread's own affordances open (`ReplyEntry` 5, 7). */
    onReply: (ReplyTarget) -> Unit = {},
    /** `ReplyMedia` 6 — `CommentEdit`, on an own comment. */
    onEditComment: (commentId: String, parentTitle: String) -> Unit = { _, _ -> },
    onSignInOrJoin: () -> Unit = {},
    /** The sheet's two-value return — see `CommentsReturn`. */
    commentsReturn: CommentsReturn = CommentsReturn(),
    onCommentsReturnConsumed: () -> Unit = {},
    onCommentsDepart: (CommentsScroll) -> Unit = {},
    /**
     * The guest gate: non-null means the reader is signed out, and the menu's
     * Report row raises it instead of the confirm (ReportConfirm.md:21).
     */
    onRequireAccount: (() -> Unit)? = null,
    /** The bar's Feed slot re-tapped over this root, counted ([FeedReselectEffect]). */
    reselectSignal: Int = 0,
    viewModel: FeedViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    consumeRefreshSignal(refreshSignal, onRefreshSignalConsumed, viewModel::refresh)
    // THE FEED'S REMOVAL, for every own card's ⋮ and the thread a count raises:
    // a card removed here stands as its mark in place (RM-G9).
    ProvideRemoval {
        FeedScreen(
            commentsSheet = { postId, onDismiss ->
                val post = state.posts.firstOrNull { it.id == postId }
                CommentsSheetRoute(
                    postId = postId,
                    viewerId = viewerId,
                    signedIn = signedIn,
                    onDismiss = onDismiss,
                    onReply = { request -> (request.comment?.asReplyTarget() ?: post?.asReplyTarget())?.let(onReply) },
                    onEditComment = { commentId -> onEditComment(commentId, post?.title?.value.orEmpty()) },
                    onOpenActor = onOpenCommentActor ?: onOpenActor,
                    onOpenTopic = onOpenTopic,
                    onReference = onCitePost,
                    onSignInOrJoin = onSignInOrJoin,
                    onDepart = onCommentsDepart,
                    commentsReturn = commentsReturn,
                    onReturnConsumed = onCommentsReturnConsumed,
                    stanceControl = { target, tag ->
                        StanceControlRoute(target = StanceTarget.Node(target), testTagPrefix = tag)
                    },
                )
            },
            reportSheet = reportDoor(onRequireAccount, FEED_REPORT_SHEET, FEED / "reportSheet"),
            reselectSignal = reselectSignal,
            onShare = { postId -> context.sharePost(viewModel.shareUrl(postId)) },
            state = state,
            expiredLabel = expiredLabel,
            onExpiredDismissed = onExpiredDismissed,
            onOpenDraft = onOpenDraft,
            onRefresh = then(onPulled, viewModel::refresh),
            onLoadMore = viewModel::loadMore,
            onCardsSeen = viewModel::onCardsSeen,
            onCardEdgesSeen = viewModel::onCardEdgesSeen,
            onSeenCheckpoint = viewModel::onSeenCheckpoint,
            onReveal = viewModel::onReveal,
            onOpenPost = onOpenPost,
            onOpenActor = onOpenActor,
            onOpenTopic = onOpenTopic,
            onChats = onChats,
            bell = bell,
            keyBanner = keyBanner,
            borrowedViewBand = borrowedViewBand,
            deletionBand = deletionBand,
            banners = banners,
            vouchCard = vouchCard,
            viewerId = viewerId,
            onEditPost = onEditPost,
            onCitePost = onCitePost,
            stanceControl = nodeStanceControl,
            saved = rememberSavedWrites(),
            onRequireAccount = onRequireAccount,
            hidden = rememberHiddenSet(),
        )
    }
}

/**
 * WHAT IS DRAWN (FeedHidden.md:3, hidden-actors §4.3): the held cards less the
 * hidden people's rows — they leave, the rows behind move up, and nothing
 * marks the space. The ViewModel keeps them, so Undo stands the feed as it was
 * (:11), and a hide made on another surface clears this list on return (:9).
 * A hide that took every drawn card while more wait asks for the next window,
 * since the tail watch has nothing left to hang on.
 */
@Composable
private fun rememberShownFeed(state: FeedUiState, hidden: HiddenSet?, onLoadMore: () -> Unit): FeedUiState {
    val view = hidden.viewState()
    // …and every held card as this device knows it now: a removal taken since
    // the page was read stands as its mark in place, its clip gone from the
    // stage with its payload (RM-G9; the remembered pages pick it up).
    val marks = rememberRemovedMarks()
    val shown = remember(state, view, marks) {
        val kept = state.posts.filterNot { view.hides(it.author?.id, it.id) }.map { it.marked(marks) }
        if (kept == state.posts) state else state.copy(posts = kept)
    }
    val emptied = shown.posts.isEmpty() && state.posts.isNotEmpty() && state.hasNextPage
    LaunchedEffect(emptied) { if (emptied) onLoadMore() }
    return shown
}

/** The stance control a route hands its cards: the live control on the node, wearing its registered path. */
internal val nodeStanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit =
    { target, tag, node -> StanceControlRoute(target = StanceTarget.Node(target), testTagPrefix = tag, node = node) }

/** One callback after another — the pull tells the shell, then refreshes. */
private fun then(first: () -> Unit, second: () -> Unit): () -> Unit = {
    first()
    second()
}

/**
 * The feed's registered prefix (`Feed`/`FeedCover` in
 * `design/designs/canonical/nodes.json`): every element those boards name
 * wears its `feed.…` path, so the conformance harness pairs this screen with
 * them by id.
 */
private val FEED = DataNode("feed")

/** A signed act the shell reported asks the feed to read again — once, then the signal is consumed. */
private fun consumeRefreshSignal(signal: Boolean, consume: () -> Unit, refresh: () -> Unit) {
    if (!signal) return
    consume()
    refresh()
}

/** The band's working edge: chats, then the bell, right-most (Profile.md:3; ChatsComingSoon.md:3). */
@Composable
private fun FeedBandActions(onChats: (() -> Unit)?, bell: BandBell?, band: DataNode) {
    onChats?.let { CograBandChats(it, testTag = "feed_band", node = band) }
    bell?.let { CograBandBell(it, testTag = "feed_band", node = band) }
    // The band's own 16dp end (`CograBand.jsx` `0 var(--space-4)`): the bar's
    // actions row already insets 4dp, so the cluster's last icon ends 16dp in.
    Spacer(Modifier.width(BAND_END_INSET))
}

/** What the top app bar's 4dp actions inset leaves of the band's 16dp end. */
private val BAND_END_INSET = Space.x3

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    state: FeedUiState,
    onRefresh: () -> Unit,
    onLoadMore: () -> Unit,
    onOpenPost: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    /** Post cards that stood fully in the viewport (`SeenCardsEffect`). */
    onCardsSeen: (List<String>) -> Unit = {},
    /** Tall cards with an edge on screen this frame (History.md:13). */
    onCardEdgesSeen: (List<EdgeSighting>) -> Unit = {},
    /** The reading paused: the scroll rested, or the reader left. */
    onSeenCheckpoint: () -> Unit = {},
    /** Hands a post to the platform's own share sheet. */
    onShare: (String) -> Unit = {},
    onChats: (() -> Unit)? = null,
    bell: BandBell? = null,
    keyBanner: @Composable () -> Unit = {},
    borrowedViewBand: @Composable () -> Unit = {},
    deletionBand: @Composable () -> Unit = {},
    banners: @Composable () -> Unit = {},
    vouchCard: @Composable () -> Unit = {},
    expiredLabel: String? = null,
    onExpiredDismissed: () -> Unit = {},
    onOpenDraft: () -> Unit = {},
    /** The viewer's account id; picks the card ⋮'s own-post rows. */
    viewerId: String? = null,
    onEditPost: (String) -> Unit = {},
    onCitePost: (String) -> Unit = {},
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit = { _, _ -> },
    /**
     * The stance control a post card carries (design.md §6), hoisted so
     * the screen stays free of DI and previewable. It is handed the
     * control's data-node, which the card's row names.
     */
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit = { _, _, _ -> },
    /**
     * THE THREAD, OVER THE FEED. A card's comment count raises the same
     * full-function sheet the detail's count does (jakob 2026-09-15) —
     * a layer over this list, never a destination, so the feed keeps its
     * scroll and its pages underneath.
     */
    commentsSheet: @Composable (postId: String, onDismiss: () -> Unit) -> Unit = { _, _ -> },
    /**
     * THE REPORT'S CONFIRM, OVER THE FEED (FeedPostMenu.md:23) — or a guest's
     * join prompt ([reportDoor]) — handed the feed's own snackbar for its
     * aftermath. Hoisted for the same reason the thread is: the confirm sends
     * through a view model this screen keeps out of its own signature.
     */
    reportSheet: ReportSheetSlot = { _, _, _ -> },
    /**
     * The app's one Saved overlay (`SavedWrites`), which the cards' menus
     * save through; null stands their Save rows inert.
     */
    saved: SavedWrites? = null,
    /** The guest gate a signed-out reader's Save opens; null when signed in. */
    onRequireAccount: (() -> Unit)? = null,
    /** The reader's hidden set, which the cards' menus hide through; null stands their Hide rows inert. */
    hidden: HiddenSet? = null,
    /** The bar's Feed slot re-tapped over this root, counted ([FeedReselectEffect]). */
    reselectSignal: Int = 0,
) {
    // EVERY LAYER RAISED OVER THE FEED SAYS IT IS UP (Feed.md:31-37): the
    // card's menu, the terms and the report's confirm each stop the playing
    // clip while they stand, the way the raised thread does, and the stage
    // re-elects when the last of them drops.
    val drawn = rememberShownFeed(state, hidden, onLoadMore)
    val layers = remember { CoveringLayers() }
    // Which post's report confirm is up. Remembered, not saved: a reader who
    // comes back to the feed finds it as they left it, never a sheet still
    // standing over it (Feed.md:97).
    var reportFor by remember { mutableStateOf<String?>(null) }
    // THE FEED'S SNACKBAR (`feed.snackbar`) is the shell's host, which the
    // feed hands its own node. The scope is the screen's, so a confirmation
    // outlives the sheet that raised it.
    val snackbar = LocalSnackbarHostState.current
    val scope = rememberCoroutineScope()
    val notify: (String) -> Unit = { text ->
        scope.launch { snackbar?.showSnackbar(NodeSnackbarVisuals(text, FEED / "snackbar")) }
    }
    // Which post's thread is raised, or null for none. SAVED, not merely
    // remembered: the composer the sheet opens is its own destination,
    // so the feed is left and re-entered rather than covered — and the
    // thread has to be standing again when the reader comes back.
    var commentsFor by rememberSaveable { mutableStateOf<String?>(null) }
    // THE NEXT PAGE ARRIVES BECAUSE THE READER KEPT GOING — no Show more,
    // no page numbers, nothing drawn at rest (design readme §13, the same
    // rule web's `infinite-list.ts` cites). `listState` is the Compose
    // analogue of web's `IntersectionObserver`: `snapshotFlow` turns its
    // `layoutInfo` into a cold flow of scroll-driven snapshots (Android
    // "Compose side-effects" guide, "Restarting effects with LaunchedEffect"
    // / snapshotFlow), so the watch costs nothing while the reader is
    // nowhere near the end and needs no manual scroll listener.
    val listState = rememberLazyListState()
    // The re-tap rungs of the ladder (Feed.md:85-91): up when scrolled, a
    // refresh at the top.
    FeedReselectEffect(signal = reselectSignal, listState = listState, onRefresh = onRefresh)
    // THE CLIPS AHEAD ARE READ BEFORE THE READER GETS THERE: the stage
    // preloads the opening of the clips around the reader, nearest first
    // (`VideoPreload`). The feed knows which posts carry one and where the
    // reader is; the position is read off the layout inside a snapshot, so
    // scrolling moves it without recomposing the screen.
    val clips = remember(drawn.posts) { FeedClips.of(drawn.posts) }
    PreloadClips(clips = clips.urls, focus = { clips.focus(listState.layoutInfo) })
    // The collapsing top (design.md §6): the bar hides scrolling down
    // and returns after a third of a screen of upward scroll; the
    // borrowed-view band and the key banner ride the same region and
    // gate, so they follow the reader.
    //
    // The band's two pieces sit IN the bar rather than in a block of
    // their own above it. Nesting band and cards inside one gate makes
    // the whole 96dp region leave in a single step, which re-clamps the
    // list underneath, and the leftover scroll that produces reads back
    // to the gate as "the reader is at the top" — the region returned
    // the moment it left.
    val collapsingTop = rememberCollapsingTop()
    WatchFeedTail(listState = listState, state = drawn, onLoadMore = onLoadMore)
    // SEEN, AT THE LIST: a post card fully in the viewport joins the
    // reader's History, as itself (History.md). Only the post rows map to
    // an id; the banner and expiry rows are not cards.
    val postIds = remember(drawn.posts) { drawn.posts.mapTo(HashSet()) { it.id } }
    SeenCardsEffect(
        listState = listState,
        nodeIdOf = { key -> (key as? String)?.takeIf { it in postIds } },
        onSeen = onCardsSeen,
        onEdgesSeen = onCardEdgesSeen,
        onCheckpoint = onSeenCheckpoint,
        suspended = commentsFor != null,
    )
    val band = FEED / "band"
    // THE CARDS' MENUS SAVE THROUGH THE ONE OVERLAY AND HIDE THROUGH THE ONE
    // SET, their aftermath on the feed's own snackbar (`saveMenuRow`, `hidePerson`).
    val savedHost = rememberSavedHost(saved, snackbar, FEED / "snackbar", onRequireAccount, hidden)
    CompositionLocalProvider(LocalCoveringLayers provides layers, LocalSavedHost provides savedHost) {
        Scaffold(
            modifier = Modifier.dataNodeSurface(),
            topBar = {
                Column {
                    TopAppBar(
                        // A tab root wears the band, never a page title: its
                        // name is the bar slot the reader tapped to get here
                        // (FE-09). The 48dp band is the drawn one (F-10).
                        title = { CograBandIdentity(testTag = "feed_band", node = band) },
                        modifier = Modifier.dataNode(band),
                        actions = { FeedBandActions(onChats, bell, band) },
                        expandedHeight = Layout.TopBarHeight,
                        colors = surfaceTopAppBarColors(),
                        scrollBehavior = collapsingTop.scrollBehavior,
                    )
                    // The deletion band rides the root's band, directly under it,
                    // collapsing and returning with it (FeedDeleting.md:5) — full
                    // bleed, its own fill, so outside the banner strip's inset.
                    CollapsingTopBand(collapsingTop) { deletionBand() }
                    CollapsingTopBanner(collapsingTop) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            borrowedViewBand()
                            keyBanner()
                        }
                    }
                }
            },
        ) { padding ->
            PullToRefreshBox(
                isRefreshing = state.loading,
                onRefresh = onRefresh,
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize(),
            ) {
                // The collapsing top wires up inside the pull-to-refresh
                // box, not on the Scaffold: post-scroll flows innermost
                // first, and the refresh gesture would swallow the
                // unconsumed at-the-top leftover — the gate's signal that
                // the reader is back at the top — before an outer gate
                // ever saw it.
                Box(
                    Modifier
                        .fillMaxSize()
                        .collapsingTop(collapsingTop),
                ) {
                    // The status banners ride every branch — an applicant with an
                    // empty feed still sees their application cards.
                    when {
                        state.transportFault != null && drawn.posts.isEmpty() -> Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState())
                                .padding(vertical = 24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            Box(Modifier.padding(horizontal = 16.dp)) { banners() }
                            vouchCard()
                            ErrorLine(R.string.content_error_transport, "feed_transport_error")
                            TextButton(onClick = onRefresh, modifier = Modifier.testTag("feed_retry")) {
                                Text(stringResource(R.string.content_retry))
                            }
                        }
                        !state.loading && drawn.posts.isEmpty() -> Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState())
                                .padding(vertical = 24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            Box(Modifier.padding(horizontal = 16.dp)) { banners() }
                            vouchCard()
                            Text(
                                stringResource(R.string.content_feed_empty),
                                modifier = Modifier.testTag("feed_empty"),
                            )
                        }
                        else -> Column(modifier = Modifier.fillMaxSize()) {
                            // A transport fault never blanks content already on
                            // screen, and it surfaces where the failed fetch was
                            // requested: a failed refresh on this banner, a
                            // failed page fetch at the load-more slot below
                            // (android.md "Degrade, never crash").
                            if (state.transportFault == TransportFault.REFRESH) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 24.dp, vertical = 8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    ErrorLine(R.string.content_feed_stale, "feed_transport_banner")
                                    TextButton(
                                        onClick = onRefresh,
                                        modifier = Modifier.testTag("feed_retry"),
                                    ) {
                                        Text(stringResource(R.string.content_retry))
                                    }
                                }
                            }
                            // ONE STAGE FOR THE FEED (the stage law, design/readme.md
                            // "The feed-video rulings"): its clips compete for one,
                            // the playing clip keeps it while past 70%, and the
                            // topmost qualifying clip takes it the moment it drops.
                            // The raised thread SUSPENDS it (jakob 2026-09-24, the
                            // same rulings): a card under the sheet is not on
                            // screen in the law's sense, however much of it the
                            // window still measures, and the thread's own stage
                            // decides what plays until it drops. Settling at the
                            // feed's hard top hands the stage to the first
                            // qualifying clip (jakob 2026-09-30): two clips that
                            // both fit at the top would otherwise keep the lower
                            // one on stage for good.
                            // Every other sheet or dialog over the feed — the
                            // card's menu, the terms, the report's confirm —
                            // suspends it the same way while it stands
                            // (Feed.md:31-35).
                            ScrollStageHost(
                                listState,
                                suspended = feedCovered(commentsFor, layers),
                                hardTopReelects = true,
                            ) {
                                // A feed post spans the screen edge to edge,
                                // and 8dp of surface between cards is the seam
                                // (design/readme.md §13). Only the rows that are
                                // not cards keep the gutter.
                                LazyColumn(
                                    state = listState,
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .testTag("feed_list"),
                                    verticalArrangement = Arrangement.spacedBy(Space.x2),
                                ) {
                                    // THE LIST'S HEAD IS ONE ROW, and each of its
                                    // slots spends its 8dp seam only when it draws
                                    // something: an empty slot is no row at all, so
                                    // the first card stands 8dp under the band as
                                    // the board draws it (`_shared.jsx` `FeedList`).
                                    item(key = "feed_banners") {
                                        Column {
                                            SeamedSlot { Gutter { banners() } }
                                            // The vouch card is a feed card, full-width,
                                            // the list's first above the posts (`VouchBack.jsx`).
                                            SeamedSlot { vouchCard() }
                                            // "Your post didn't land." The canonical
                                            // `ComposeExpired` board puts this here, at
                                            // the top of the feed the author returns
                                            // to, rather than in the composer they have
                                            // already left.
                                            // A `TaskCard` in the FeedList, full width, as the
                                            // vouch card stands.
                                            expiredLabel?.let { label ->
                                                SeamedSlot {
                                                    ExpiredCard(
                                                        label = label,
                                                        onDismiss = onExpiredDismissed,
                                                        onOpenDraft = onOpenDraft,
                                                    )
                                                }
                                            }
                                        }
                                    }
                                    val postRow: @Composable (PostView) -> Unit = { post ->
                                        // The row's key again, so the stage can ask
                                        // the list whether this card is still placed.
                                        ScrollStageRow(post.id) {
                                            PostCard(
                                                post = post,
                                                onClick = { onOpenPost(post.id) },
                                                onOpenComments = { commentsFor = post.id },
                                                onOpenPost = onOpenPost,
                                                onOpenActor = onOpenActor,
                                                onOpenTopic = onOpenTopic,
                                                onShare = onShare,
                                                viewerId = viewerId,
                                                onEdit = onEditPost,
                                                onCite = onCitePost,
                                                onReport = { reportFor = post.id },
                                                revealed = state.reveals.isRevealed(post.id, post.sensitiveMark()),
                                                onReveal = { onReveal(post.id, post.sensitiveMark()) },
                                                stanceControl = stanceControl,
                                            )
                                        }
                                    }
                                    // THE SEEN TAIL (FeedSeenTail.md): the unseen
                                    // cards, then the separator, then the cards the
                                    // reader has already seen — each run in the
                                    // feed's own order. The separator stands only
                                    // once a seen card is drawn, so with nothing
                                    // unseen the feed opens at it.
                                    val split = seenSplit(drawn.posts, state.seenTail)
                                    val unseen = drawn.posts.subList(0, split)
                                    val seen = drawn.posts.subList(split, drawn.posts.size)
                                    items(unseen, key = { it.id }) { postRow(it) }
                                    if (seen.isNotEmpty()) {
                                        item(key = FEED_SEEN_SEPARATOR) { SeenSeparator() }
                                        items(seen, key = { it.id }) { postRow(it) }
                                    }
                                    // The slot the next page fills. At rest it draws
                                    // nothing — the page comes because the reader
                                    // kept going (`WatchFeedTail` above). In flight
                                    // it is the list's own loading spinner, and a
                                    // page that did not arrive stands here with its
                                    // way back — the drawn twin of `MoreComments`.
                                    val appendFault = state.transportFault == TransportFault.APPEND
                                    if (state.hasNextPage && (state.loadingMore || appendFault)) {
                                        item { Gutter { FeedTailSlot(state = drawn, onLoadMore = onLoadMore) } }
                                    }
                                }
                            }
                        }
                    }
                    // THE WAY BACK UP (FeedScrolled.md), over the list and
                    // directly under the band — never part of the band.
                    FeedBackToTop(
                        bandShown = collapsingTop.showTop,
                        listState = listState,
                        modifier = Modifier.align(Alignment.TopCenter),
                    )
                }
            }
        }
        commentsFor?.let { postId ->
            commentsSheet(postId) { commentsFor = null }
        }
        reportFor?.let { postId ->
            reportSheet(postId, { reportFor = null }, notify)
        }
    }
}

/**
 * Whether something covers the feed's stage (Feed.md:31-35): the raised
 * thread, or any other sheet or dialog announced into [layers]. The opinion
 * pad only pauses (:39) and is not a cover here.
 */
private fun feedCovered(commentsFor: String?, layers: CoveringLayers): Boolean =
    commentsFor != null || layers.cover == SurfaceCover.Suspended

/**
 * THE NEXT PAGE ARRIVES BECAUSE THE READER KEPT GOING (design readme §13,
 * the same rule web's `infinite-list.ts` cites): no button, no page
 * numbers — nothing drawn at rest. `listState` is the Compose analogue of
 * web's `IntersectionObserver`: `snapshotFlow` turns its `layoutInfo` into
 * a cold flow of scroll-driven snapshots (Android "Compose side-effects"
 * guide, "Restarting effects with LaunchedEffect" / snapshotFlow), so the
 * watch costs nothing while the reader is nowhere near the end and needs
 * no manual scroll listener.
 *
 * The watch sits `FEED_TAIL_DISTANCE` posts short of the end — the same
 * effective distance as web's `TAIL_DISTANCE` — so the fetch is already
 * under way before the reader runs out of posts to read. It is rebuilt
 * whenever the posts, `hasNextPage`, or the fault change, and a page that
 * failed is not re-asked automatically (`transportFault != APPEND`); the
 * drawn Retry is the way back, same as web.
 */
@Composable
private fun WatchFeedTail(
    listState: LazyListState,
    state: FeedUiState,
    onLoadMore: () -> Unit,
) {
    LaunchedEffect(state.posts, state.hasNextPage, state.transportFault) {
        if (!state.hasNextPage || state.transportFault == TransportFault.APPEND) return@LaunchedEffect
        val tailId = state.posts.getOrNull(feedTailIndexOf(state.posts.size))?.id ?: return@LaunchedEffect
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.any { it.key == tailId } }
            .distinctUntilChanged()
            .filter { it }
            .collect { onLoadMore() }
    }
}

/**
 * The slot the next page fills — drawn only while a fetch is in flight or
 * one failed; at rest (`WatchFeedTail` above) nothing is drawn here at
 * all. The drawn twin of `MoreComments`'s own failure row.
 */
@Composable
private fun FeedTailSlot(state: FeedUiState, onLoadMore: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (state.loadingMore) {
            CircularProgressIndicator(
                modifier = Modifier
                    .padding(8.dp)
                    .testTag("feed_loading_more"),
            )
        } else {
            ErrorLine(R.string.content_feed_stale, "feed_load_more_error")
            TextButton(onClick = onLoadMore, modifier = Modifier.testTag("feed_load_more_retry")) {
                Text(stringResource(R.string.content_retry))
            }
        }
    }
}

/**
 * The gutter the cards no longer take.
 *
 * Words never touch the screen edge — only media does — so everything
 * in the list that is not a full-width card keeps the 16dp inset the
 * card now owns internally.
 */
@Composable
private fun Gutter(content: @Composable () -> Unit) {
    Box(Modifier.padding(horizontal = Space.x4)) { content() }
}

/**
 * A head slot of the feed's list: whatever it draws stands under the list's
 * 8dp seam, and a slot that draws nothing takes no room and no seam.
 */
@Composable
private fun SeamedSlot(content: @Composable () -> Unit) {
    Layout(content = content) { measurables, constraints ->
        val placeables = measurables.map { it.measure(constraints.copy(minHeight = 0)) }
        val drawn = placeables.sumOf { it.height }
        val seam = if (drawn > 0) Space.x2.roundToPx() else 0
        layout(constraints.maxWidth, drawn + seam) {
            var y = seam
            placeables.forEach {
                it.place(0, y)
                y += it.height
            }
        }
    }
}

/** The separator's list key — never a post id, so no post-keyed watch reads it as a card. */
internal const val FEED_SEEN_SEPARATOR = "feed_seen_separator"

/**
 * Where the drawn cards cross into the seen tail: the index of the first
 * card under `feed.seenSeparator`, or the card count when none is drawn
 * yet. The derive stands every tail row after every unseen one, so the
 * cards split at one point.
 */
internal fun seenSplit(posts: List<PostView>, seenTail: Set<String>): Int {
    val first = posts.indexOfFirst { it.id in seenTail }
    return if (first < 0) posts.size else first
}

/**
 * `feed.seenSeparator` (FeedSeenTail.md, the `FeedSeenTail` board): a
 * hairline with "Already seen" centred on it, quiet, and no control — the
 * system's one seam ([Seam]) with the feed's own words.
 */
@Composable
private fun SeenSeparator() {
    Seam(stringResource(R.string.content_feed_seen_separator), node = FEED / "seenSeparator")
}

/**
 * `ComposeExpired` — a staged batch collected before it landed.
 *
 * The tone is the whole point: nothing was spent, and the draft is
 * already saved, so this states two facts and offers the draft back. No
 * error colouring — an expiry is the substrate working as designed, not
 * a failure the author caused.
 */
@Composable
private fun ExpiredCard(
    label: String,
    onDismiss: () -> Unit,
    onOpenDraft: () -> Unit,
) {
    // `TaskCard` (`_shared.jsx`): a `Card` — surface-card, the medium rung,
    // padding 16, gap 12 — wearing the task ring OUTSIDE its padding; the
    // title in title-medium beside the mark, the body in body-medium
    // secondary, the two `sm` answers at the end. The feed card's ground,
    // not the olive: it says how things stand, nothing is the reader's to do.
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("feed_expired")
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .taskRing(taskRingColors(), MaterialTheme.shapes.medium)
            .padding(Space.x4 + 2.dp),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            Text(
                text = stringResource(R.string.content_expired_title),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f).semantics { heading() },
            )
            CograMark(size = 20.dp)
        }
        Text(
            text = stringResource(R.string.content_expired_body, label),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Space.x2, Alignment.End),
        ) {
            CograButton(
                text = stringResource(R.string.content_expired_dismiss),
                onClick = onDismiss,
                kind = ButtonKind.Text,
                size = ButtonSize.Compact,
                testTag = "feed_expired_dismiss",
            )
            CograButton(
                text = stringResource(R.string.content_expired_open),
                onClick = onOpenDraft,
                size = ButtonSize.Compact,
                testTag = "feed_expired_open",
            )
        }
    }
}

/**
 * The summary card's heading.
 *
 * It stays outside the veil (D12): a reader has to be able to tell what
 * they are choosing not to look at. And it clamps to ONE line — the
 * collapse order gives the title away before media or the affordance
 * row ever shrink.
 */
@Composable
private fun SummaryTitle(post: PostView, node: DataNode) {
    post.title.value?.takeIf { it.isNotEmpty() }?.let { title ->
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.dataNode(node),
        )
    }
}

/**
 * Where a post card stands: the card's registered node, the sheets its ⋮
 * raises, the scope its fallback tags read under (`<tag>_post_<id>`,
 * `<tag>_<id>`), and which menu rows the host's board registers. The feed's
 * is [FEED_PLACEMENT]; Saved places the same card (Saved.md: "the same card
 * the feed draws, fully live").
 */
internal data class CardPlacement(
    val card: DataNode,
    val menuSheet: DataNode?,
    val licenseSheet: DataNode?,
    val tag: String,
    val menuRows: Set<PostMenuRow>,
)

/**
 * The rows FeedPostMenu registers (`feed.menuSheet.*`) — the reader menu's.
 * The author's own rows on the feed have no drawn board, so they keep their
 * own tags rather than wear a path the registry does not hold.
 */
private val FEED_MENU_ROWS = setOf(
    PostMenuRow.Save,
    PostMenuRow.Cite,
    PostMenuRow.Hide,
    PostMenuRow.License,
    PostMenuRow.Report,
)

internal val FEED_PLACEMENT = CardPlacement(
    card = FEED / "card",
    menuSheet = FEED / "menuSheet",
    licenseSheet = FEED / "licenseSheet",
    tag = "feed",
    menuRows = FEED_MENU_ROWS,
)

@Composable
internal fun PostCard(
    post: PostView,
    onClick: () -> Unit,
    /** The count's own destination: the comments sheet, over the feed. */
    onOpenComments: () -> Unit,
    /** A post cited from the tags-and-references sheet. */
    onOpenPost: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    /** The platform's own share sheet, for this post. */
    onShare: (String) -> Unit,
    /** The viewer's account id; picks the own-post rows over the reader's. */
    viewerId: String?,
    /** The ⋮'s Edit and Mark-as-sensitive rows, both doors into the edit flow. */
    onEdit: (String) -> Unit,
    /** The ⋮'s Cite row — the composer, with this post staged. */
    onCite: (String) -> Unit,
    /** The ⋮'s Report row — the feed's confirm, or the guest gate. */
    onReport: () -> Unit,
    revealed: Boolean,
    onReveal: () -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
    placement: CardPlacement = FEED_PLACEMENT,
) {
    // The instance the board keys by author handle is keyed here by the
    // post's id — the same key the web's card carries, so the harness pairs
    // both platforms' cards with one live post.
    // THE CARD AS THIS DEVICE KNOWS IT NOW: a removal taken since the post was
    // read — on this card or anywhere — stands as its mark in place (RM-G9),
    // remembered pages included.
    val shown = post.marked(rememberRemovedMarks())
    val card = placement.card
    val tag = "${placement.tag}_post_${post.id}"
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .dataNode(card.keyed(shown.id)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            // THE CARD'S ONE RHYTHM (`Card.jsx` `--card-gap`): 12dp between
            // its children, and the 4dp seam only inside a words post's text
            // block (`TitledBody`).
            verticalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            CardMenuHeader(
                post = shown,
                viewerId = viewerId,
                onOpenActor = onOpenActor,
                onEdit = onEdit,
                onCite = onCite,
                onReport = onReport,
                onShare = onShare,
                node = card,
                placement = placement,
            )
            TitledBody(shown, title = { SummaryTitle(shown, card / "title") }) {
                PostBody(
                    content = shown.content,
                    description = shown.description,
                    attachments = shown.attachments,
                    attachmentsStatus = shown.attachmentsStatus,
                    moderation = shown.moderation,
                    removal = shown.removal,
                    testTagPrefix = tag,
                    node = card,
                    collapsed = true,
                    bleed = Space.x4,
                    // The whole gallery is one target opening the post: a
                    // reader scrolling the feed is choosing between posts,
                    // not looking at one picture. Which page they were on is
                    // the DETAIL's question — "the card's tap opens the post,
                    // the post's tap opens the frame"
                    // (`ViewerPicture.jsx:2-3`) — so it is dropped here.
                    onOpenMedia = { onClick() },
                    revealed = revealed,
                    onReveal = onReveal,
                )
            }
            if (shown.landing.isPending) PendingMarker(testTag = "${placement.tag}_post_pending_${shown.id}")
            CardTopicsLine(
                post = shown,
                onOpenTopic = onOpenTopic,
                onOpenActor = onOpenActor,
                onOpenPost = onOpenPost,
                node = card / "tagsLine",
                testTagPrefix = tag,
            )
            CardRow(shown, card, tag, onOpenComments, onShare, stanceControl)
        }
    }
}

/**
 * Stance, comment, share — the master's row, minus the two it gates (see
 * `PostAffordanceRow`) — and the row line under the face. THE COUNT RAISES
 * THE THREAD (graph.json: every `comment count` edge advances to
 * `ReplyEntry`), which is the master's own destination — the card's tap, its
 * fallback, opens the post instead.
 */
@Composable
private fun CardRow(
    post: PostView,
    card: DataNode,
    tag: String,
    onOpenComments: () -> Unit,
    onShare: (String) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
) {
    PostAffordanceRow(
        commentCount = post.commentCount,
        onOpenComments = onOpenComments,
        onShare = { onShare(post.id) },
        testTagPrefix = tag,
        node = card / "actionRow",
    ) {
        stanceControl(post.id, tag, card / "actionRow" / "stance")
    }
    // THE ROW LINE under the face (RowSigning.md): a save or unsave of this
    // post that did not go through.
    LocalSavedHost.current?.comfortLine(post.id)?.let { RowLine(it, "${tag}_row_line") }
}

/**
 * THE CARD'S HEADER AND THE ⋮ IT CARRIES, with the sheets its rows raise.
 *
 * The menu OWNS ITS OWN STATE here rather than the screen's, the way
 * `CardTopicsLine` owns the refs sheet beside it: a feed is a list of cards,
 * and the terms a reader asked for belong to the card they asked from — a
 * screen-level sheet would show one card's license over another's. Only one
 * card's sheet is ever composed, so every card's wears the one registered
 * `feed.menuSheet` (FeedPostMenu.md) without two ever standing at once.
 */
@Composable
private fun CardMenuHeader(
    post: PostView,
    viewerId: String?,
    onOpenActor: (String) -> Unit,
    onEdit: (String) -> Unit,
    onCite: (String) -> Unit,
    onReport: () -> Unit,
    onShare: (String) -> Unit,
    node: DataNode,
    placement: CardPlacement,
) {
    var licenseShown by remember { mutableStateOf<LicenseChoice?>(null) }
    var removeOpen by remember { mutableStateOf(false) }
    CoversSurface(open = licenseShown != null, kind = CoverKind.Suspend)
    CoversSurface(open = removeOpen, kind = CoverKind.Suspend)
    val menuSheet = placement.menuSheet
    val tag = "${placement.tag}_${post.id}"
    // A REMOVED POST HAS NO MENU LEFT (`Removed.jsx:5-6`): there is nothing
    // of it to edit, cite or license, so the ⋮ goes wholesale rather than a
    // row at a time. An empty list draws no trigger.
    val removed = post.removed
    val own = viewerId != null && post.author?.id == viewerId
    // THE NARROW PHONE'S MENU HOLDS THE SHARE IT TOOK (design/readme.md,
    // jakob 2026-09-17, sharpened 2026-09-22 — PR #794): only the reader's
    // menu gains it, and only where the row itself sheds it (`isNarrowShareWidth`).
    val narrow = isNarrowShareWidth()
    val shareRow: (() -> Unit)? = if (!own && narrow) {
        { onShare(post.id) }
    } else {
        null
    }
    ContentCardHeader(
        author = post.author,
        at = post.createdAt,
        onOpenActor = onOpenActor,
        testTagPrefix = tag,
        menu = if (removed) {
            emptyList()
        } else {
            postMenuRows(
                own = own,
                handle = post.author?.handle,
                license = post.license,
                onEdit = { onEdit(post.id) },
                onCite = { onCite(post.id) },
                onRemove = { removeOpen = true },
                onLicense = { licenseShown = post.license },
                onShare = shareRow,
                // The rows sit under the trigger's own tag, which
                // `ContentCardHeader` derives the same way.
                testTagPrefix = "${tag}_menu",
                onReport = onReport,
                rowNode = { row -> menuSheet?.div(row.nodeName)?.takeIf { row in placement.menuRows } },
                saveRow = LocalSavedHost.current?.menuRow(
                    post.id,
                    post.viewerBookmarkedAt,
                    "${tag}_menu_save",
                ),
                onHide = post.author?.let { LocalSavedHost.current?.hideAct(it.asHiddenPerson(), post.id) },
            )
        },
        menuContentDescription = stringResource(R.string.content_menu_post),
        menuSheetNode = menuSheet,
        node = node,
    )
    licenseShown?.let { license ->
        LicenseSheet(license = license, onDismiss = { licenseShown = null }, node = placement.licenseSheet)
    }
    // THE OWN MENU OFF THE DETAIL (RM-G9, undrawn): the same confirm as the
    // detail's, over the surface the menu was opened from. Taken, the card
    // stands as its mark in place — NEVER the post leaves without a mark
    // (RemoveConfirm.md:11) — and the menu goes with the payload.
    if (removeOpen) {
        RemoveConfirm(
            kind = RemovalKind.Post,
            nodeId = post.id,
            record = post.genesisRecordId,
            onClose = { removeOpen = false },
            testTag = "${tag}_remove_confirm",
        )
    }
}

/**
 * The card's one line for tags and citations, and the sheet its counts open.
 *
 * THE COUNTS ARE THE WAY IN on a summary card (graph.json: every `reference
 * count` edge advances to `RefsSheet`), and the chips still reach the topic
 * screen beside them — the master's own split against a detail surface, where
 * the whole line is the opener instead.
 */
@Composable
private fun CardTopicsLine(
    post: PostView,
    onOpenTopic: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    node: DataNode,
    testTagPrefix: String,
) {
    var refsOpen by rememberSaveable { mutableStateOf(false) }
    // A sheet over the feed like any other (Feed.md:31).
    CoversSurface(open = refsOpen, kind = CoverKind.Suspend)
    TopicsLine(
        topics = post.topics,
        references = post.references,
        onOpenTopic = onOpenTopic,
        testTagPrefix = testTagPrefix,
        onOpenReferences = { refsOpen = true },
        node = node,
    )
    if (refsOpen) {
        RefsSheet(
            topics = post.topics,
            references = post.references,
            onDismiss = { refsOpen = false },
            onOpenTopic = onOpenTopic,
            onOpenActor = onOpenActor,
            onOpenPost = onOpenPost,
            testTagPrefix = testTagPrefix,
        )
    }
}
