// SAVED — everything the reader kept, as a feed (Saved.md, SavedUndo.md,
// SavedEmpty.md, SavedNone.md; design/designs/canonical/screens/Saved.jsx,
// round 12). Reached from the reader's own profile's ⋮. web's twin is
// `web/src/app/saved/saved-view.tsx`.
//
// It lives beside the feed because it IS the feed's cards: a post as the
// feed's own `PostCard`, a comment as the `CommentFeedCard`, a person as the
// `ProfileFeedCard` — unchanged and fully live. No card anatomy is this page's
// own: no age of the save, no kind label, no heading, no saved mark and no
// unsave control of Saved's own (the quiet-card law). The list's reads stay
// `feature:saved`'s ([SavedViewModel]).
//
// NEWEST FIRST, BY WHEN THE READER SAVED EACH THING — never by when it was
// written or seen, and never by score.
//
// THE UNSAVE IS THE CARD'S OWN SAVE. Every card's ⋮ leads with `Save` /
// `Unsave`, and here every card is kept, so the row reads `Unsave`: the sheet
// closes, the card leaves, the cards behind it move up, and `Removed from
// Saved.` with `Undo` answers on this page's snackbar.
//
// THE LIST IS THE LAST READ WITH THE READER'S OWN ACTS LAID OVER IT
// (`SavedWrites`): Undo puts the card back in its place; an unsave made inside
// a page opened from here is gone on return, with no snackbar; a failed unsave
// brings the card back carrying `That didn't go through.` with Retry; a failed
// Undo's card stays on screen carrying that line.
//
// SEARCH ON TOP: the one search rule over the saved set (`SavedSearch.kt`). A
// search that finds nothing is SavedNone; a reader who has kept nothing meets
// SavedEmpty, which draws no field.
//
// A HIDDEN ACCOUNT'S THINGS STAY: the hidden list is the feed's, not this
// one's (ruling 49d), so the hidden set only lends the menus their Hide row.

package com.cogra.feature.content

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CollapsingTopBand
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.core.designsystem.NodeSnackbarVisuals
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.SearchBar
import com.cogra.core.designsystem.v2.media.CoveringLayers
import com.cogra.core.designsystem.v2.media.LocalCoveringLayers
import com.cogra.core.designsystem.v2.media.ScrollStageHost
import com.cogra.core.designsystem.v2.media.ScrollStageRow
import com.cogra.core.designsystem.v2.media.SurfaceCover
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.isRevealed
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.saved.ComfortKind
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.saved.SavedCard
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedOverlay
import com.cogra.domain.saved.SavedQuery
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.saved.matches
import com.cogra.domain.saved.searchable
import com.cogra.domain.stance.StanceTarget
import com.cogra.feature.content.reply.ReplyTarget
import com.cogra.feature.saved.LocalSavedHost
import com.cogra.feature.saved.SavedUiState
import com.cogra.feature.saved.SavedViewModel
import com.cogra.feature.saved.overlayState
import com.cogra.feature.saved.rememberHiddenSet
import com.cogra.feature.saved.rememberSavedHost
import com.cogra.feature.stance.StanceControlRoute
import kotlinx.coroutines.launch
import com.cogra.feature.saved.R as SavedR

/** The registered prefix (`Saved`, `SavedUndo`, `SavedEmpty`, `SavedNone` in `nodes.json`). */
private val SAVED = DataNode("saved")

/** Saved's post card: the feed's own, keyed by the post's id as the feed keys it. */
private val SAVED_PLACEMENT = CardPlacement(
    card = SAVED / "card",
    // No sheet of Saved's is drawn: the card's menu and terms keep their tags.
    menuSheet = null,
    licenseSheet = null,
    tag = "saved",
    menuRows = emptySet(),
)

/** Where the doors a Saved card opens are asked to land. */
data class SavedDoors(
    val onOpenPost: (String) -> Unit,
    /** The thread over [postId], landed on [commentId]; [aimReply] opens the composer aimed at it. */
    val onOpenComment: (postId: String, commentId: String, aimReply: Boolean) -> Unit,
    val onOpenActor: (String) -> Unit,
    val onOpenTopic: (String) -> Unit,
)

@Composable
fun SavedRoute(
    onBack: () -> Unit,
    doors: SavedDoors,
    viewerId: String?,
    signedIn: Boolean?,
    onEditPost: (String) -> Unit,
    onCitePost: (String) -> Unit,
    /** The composer the raised thread's own affordances open (`ReplyEntry` 5, 7). */
    onReply: (ReplyTarget) -> Unit,
    onEditComment: (commentId: String, parentTitle: String) -> Unit,
    onSignInOrJoin: () -> Unit,
    commentsReturn: CommentsReturn = CommentsReturn(),
    onCommentsReturnConsumed: () -> Unit = {},
    onCommentsDepart: (CommentsScroll) -> Unit = {},
    viewModel: SavedViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    SavedScreen(
        state = state,
        writes = viewModel.writes,
        hidden = rememberHiddenSet(),
        onRefresh = viewModel::refresh,
        onLoadMore = viewModel::loadMore,
        onRetryMore = viewModel::retryMore,
        onSearch = viewModel::search,
        onBack = onBack,
        doors = doors,
        onShare = { url -> context.sharePost(url) },
        shareUrls = SavedShareUrls(viewModel::postShareUrl, viewModel::commentShareUrl, viewModel::profileShareUrl),
        viewerId = viewerId,
        onEditPost = onEditPost,
        onCitePost = onCitePost,
        onReveal = viewModel::onReveal,
        stanceControl = nodeStanceControl,
        commentsSheet = { postId, onDismiss ->
            val post = state.entries.firstNotNullOfOrNull { (it.card as? SavedCard.Post)?.post?.takeIf { p -> p.id == postId } }
            CommentsSheetRoute(
                postId = postId,
                viewerId = viewerId,
                signedIn = signedIn,
                onDismiss = onDismiss,
                onReply = { request -> (request.comment?.asReplyTarget() ?: post?.asReplyTarget())?.let(onReply) },
                onEditComment = { commentId -> onEditComment(commentId, post?.title?.value.orEmpty()) },
                onOpenActor = doors.onOpenActor,
                onOpenTopic = doors.onOpenTopic,
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
        reportSheet = reportDoor(null, SAVED_REPORT_SHEET),
    )
}

/** What a card's share hands over: the thing's own address. */
data class SavedShareUrls(
    val post: (String) -> String,
    val comment: (postId: String, commentId: String) -> String,
    val profile: (String) -> String,
)

/** The report confirm over Saved — no Saved board draws one, so it keeps its tag. */
internal const val SAVED_REPORT_SHEET = "saved_report_sheet"

/** Cards on screen: what the reader still keeps, plus a failed Undo's card, which stays with its line. */
fun keptEntries(entries: List<SavedEntry>, overlay: SavedOverlay): List<SavedEntry> =
    entries.filter { overlay.kept(it.id, it.bookmarkedAt) != null || overlay.failure(it.id) == ComfortKind.RESTORE }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SavedScreen(
    state: SavedUiState,
    writes: SavedWrites?,
    onRefresh: () -> Unit,
    onLoadMore: () -> Unit,
    onRetryMore: () -> Unit,
    onSearch: (String) -> Unit,
    onBack: () -> Unit,
    doors: SavedDoors,
    hidden: HiddenSet? = null,
    onShare: (String) -> Unit = {},
    shareUrls: SavedShareUrls = SavedShareUrls({ it }, { _, c -> c }, { it }),
    viewerId: String? = null,
    onEditPost: (String) -> Unit = {},
    onCitePost: (String) -> Unit = {},
    onReveal: (String, SensitiveMark) -> Unit = { _, _ -> },
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit = { _, _, _ -> },
    commentsSheet: @Composable (postId: String, onDismiss: () -> Unit) -> Unit = { _, _ -> },
    reportSheet: ReportSheetSlot = { _, _, _ -> },
) {
    val overlay = writes.overlayState()
    val snackbar = LocalSnackbarHostState.current
    // THE CARDS' MENUS SAVE THROUGH THE ONE OVERLAY AND HIDE THROUGH THE ONE
    // SET, their aftermath on this page's snackbar (`saved.snackbar`).
    val savedHost = rememberSavedHost(writes, snackbar, SAVED / "snackbar", null, hidden)
    val kept = keptEntries(state.entries, overlay)
    val parsed = state.parsed
    val shown = kept.filter { matches(it.card.searchable(), parsed) }
    val idle = !state.loading && !state.failed
    // SAVEDEMPTY draws no field: it arrives with the first thing saved. A
    // query still standing keeps it, so `Show everything` is the way back.
    val empty = idle && kept.isEmpty() && !state.hasNextPage && parsed == SavedQuery.Blank
    val none = idle && parsed != SavedQuery.Blank && shown.isEmpty() && !state.hasNextPage && !state.loadingMore
    val fielded = !empty && (kept.isNotEmpty() || parsed != SavedQuery.Blank)
    val listState = rememberLazyListState()
    val layers = remember { CoveringLayers() }
    var commentsFor by rememberSaveable { mutableStateOf<String?>(null) }
    var reportFor by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val notify: (String) -> Unit = { text ->
        scope.launch { snackbar?.showSnackbar(NodeSnackbarVisuals(text, SAVED / "snackbar")) }
    }
    val focus = rememberCardFocus(shown, overlay)
    LoadNextAtTheTail(listState, state, shown.size, onLoadMore)
    val collapsingTop = rememberCollapsingTop()
    CompositionLocalProvider(LocalCoveringLayers provides layers, LocalSavedHost provides savedHost) {
        Scaffold(
            modifier = Modifier.dataNodeSurface(),
            topBar = {
                // THE HEADER AND THE FIELD COLLAPSE ON THE WAY DOWN AND RETURN
                // ON THE WAY UP (Saved.md), one region.
                CollapsingTopBand(collapsingTop) {
                    Column {
                        PageHeader(
                            title = stringResource(SavedR.string.saved_title),
                            onBack = onBack,
                            backContentDescription = stringResource(SavedR.string.saved_back),
                            node = SAVED / "header",
                        )
                        if (fielded) {
                            SearchBar(
                                query = state.query,
                                onQueryChange = onSearch,
                                placeholder = stringResource(R.string.content_saved_search),
                                label = stringResource(R.string.content_saved_search),
                                node = SAVED / "searchField",
                            )
                        }
                    }
                }
            },
        ) { padding ->
            PullToRefreshBox(
                isRefreshing = state.loading && state.entries.isNotEmpty(),
                onRefresh = onRefresh,
                modifier = Modifier.padding(padding).fillMaxSize(),
            ) {
                Box(Modifier.fillMaxSize().collapsingTop(collapsingTop)) {
                    when {
                        state.loading && state.entries.isEmpty() -> Text(
                            stringResource(com.cogra.core.designsystem.R.string.loading_state),
                            modifier = Modifier.padding(Space.x4).testTag("saved_loading"),
                        )

                        state.failed && state.entries.isEmpty() -> SavedLoadFailed(onRefresh)

                        empty -> SavedEmpty(focus.empty)

                        none -> SavedNone(focus.empty) { onSearch("") }

                        else -> ScrollStageHost(
                            listState,
                            suspended = commentsFor != null || layers.cover == SurfaceCover.Suspended,
                            hardTopReelects = true,
                        ) {
                            LazyColumn(
                                state = listState,
                                modifier = Modifier.fillMaxSize().testTag("saved_list"),
                                contentPadding = PaddingValues(top = Space.x2, bottom = Space.x4),
                                verticalArrangement = Arrangement.spacedBy(Space.x2),
                            ) {
                                items(shown, key = { it.id }) { entry ->
                                    ScrollStageRow(entry.id) {
                                        Box(Modifier.focusRequester(focus.card(entry.id)).focusable()) {
                                            SavedCardFor(
                                                entry = entry,
                                                state = state,
                                                doors = doors,
                                                viewerId = viewerId,
                                                onShare = onShare,
                                                shareUrls = shareUrls,
                                                onEditPost = onEditPost,
                                                onCitePost = onCitePost,
                                                onReveal = onReveal,
                                                onOpenComments = { commentsFor = it },
                                                onReport = { reportFor = it },
                                                stanceControl = stanceControl,
                                            )
                                        }
                                    }
                                }
                                if (state.moreFailed) {
                                    item(key = "saved_more_failed") { SavedMoreFailed(onRetryMore) }
                                }
                            }
                        }
                    }
                    // THE WAY BACK UP (Saved.md): with the band from three
                    // screens down; it goes up, animated, and never re-reads.
                    FeedBackToTop(
                        bandShown = collapsingTop.showTop,
                        listState = listState,
                        modifier = Modifier.align(Alignment.TopCenter),
                    )
                }
            }
        }
        commentsFor?.let { postId -> commentsSheet(postId) { commentsFor = null } }
        reportFor?.let { postId -> reportSheet(postId, { reportFor = null }, notify) }
    }
}

/** One kept thing, as its kind's own feed card. */
@Composable
private fun SavedCardFor(
    entry: SavedEntry,
    state: SavedUiState,
    doors: SavedDoors,
    viewerId: String?,
    onShare: (String) -> Unit,
    shareUrls: SavedShareUrls,
    onEditPost: (String) -> Unit,
    onCitePost: (String) -> Unit,
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenComments: (String) -> Unit,
    onReport: (String) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
) {
    when (val card = entry.card) {
        is SavedCard.Post -> PostCard(
            post = card.post,
            onClick = { doors.onOpenPost(card.post.id) },
            onOpenComments = { onOpenComments(card.post.id) },
            onOpenPost = doors.onOpenPost,
            onOpenActor = doors.onOpenActor,
            onOpenTopic = doors.onOpenTopic,
            onShare = { id -> onShare(shareUrls.post(id)) },
            viewerId = viewerId,
            onEdit = onEditPost,
            onCite = onCitePost,
            onReport = { onReport(card.post.id) },
            revealed = state.reveals.isRevealed(card.post.id, card.post.sensitiveMark()),
            onReveal = { onReveal(card.post.id, card.post.sensitiveMark()) },
            stanceControl = stanceControl,
            placement = SAVED_PLACEMENT,
        )

        is SavedCard.Comment -> {
            val comment = card.comment
            val post = card.threadPostId
            var licenseOpen by remember(comment.id) { mutableStateOf(false) }
            CommentFeedCard(
                comment = comment,
                target = card.target,
                node = SAVED / "commentCard",
                testTagPrefix = "saved_comment_${comment.id}",
                revealed = state.reveals.isRevealed(comment.id, comment.sensitiveMark()),
                onReveal = { onReveal(comment.id, comment.sensitiveMark()) },
                onOpenTarget = {
                    when (val target = card.target) {
                        is CommentTarget.Post -> doors.onOpenPost(target.id)
                        is CommentTarget.Comment -> post?.let { doors.onOpenComment(it, target.id, false) }
                        null -> Unit
                    }
                },
                onOpenPlace = { post?.let { doors.onOpenComment(it, comment.id, false) } },
                onReply = { post?.let { doors.onOpenComment(it, comment.id, true) } },
                onShare = { post?.let { onShare(shareUrls.comment(it, comment.id)) } },
                onOpenActor = doors.onOpenActor,
                onOpenTopic = doors.onOpenTopic,
                onCite = { onCitePost(comment.id) },
                onLicense = { licenseOpen = true },
                stanceControl = stanceControl,
            )
            if (licenseOpen) {
                LicenseSheet(license = comment.license, onDismiss = { licenseOpen = false })
            }
        }

        is SavedCard.Person -> ProfileFeedCard(
            profile = card.profile,
            node = SAVED / "profileCard",
            testTagPrefix = "saved_person_${card.profile.id}",
            viewerId = viewerId,
            onOpen = { doors.onOpenActor(card.profile.handle) },
            onShare = { onShare(shareUrls.profile(card.profile.handle)) },
            stanceControl = stanceControl,
        )
    }
}

/** Where focus goes after a card's unsave lands: the next card, else the previous, else the empty state. */
private class CardFocus {
    private val cards = mutableMapOf<String, FocusRequester>()
    val empty = FocusRequester()

    fun card(id: String): FocusRequester = cards.getOrPut(id) { FocusRequester() }

    fun has(id: String): Boolean = cards.containsKey(id)
}

/** FOCUS AFTER A CARD'S UNSAVE LANDS (Saved.md; the K13 focus law). */
@Composable
private fun rememberCardFocus(shown: List<SavedEntry>, overlay: SavedOverlay): CardFocus {
    val focus = remember { CardFocus() }
    val ids = shown.map { it.id }
    var before by remember { mutableStateOf(ids) }
    LaunchedEffect(ids) {
        val previous = before
        before = ids
        val gone = previous.filter { it !in ids && overlay.kept(it, null) == null && overlay.shown.containsKey(it) }
        if (gone.size != 1) return@LaunchedEffect
        val at = previous.indexOf(gone.single())
        val next = previous.drop(at + 1).firstOrNull { it in ids } ?: previous.take(at).lastOrNull { it in ids }
        runCatching { (next?.takeIf(focus::has)?.let(focus::card) ?: focus.empty).requestFocus() }
    }
    return focus
}

/** THE NEXT PAGE ARRIVES BECAUSE THE READER KEPT GOING (readme §13): asked a few cards short of the end. */
@Composable
private fun LoadNextAtTheTail(list: LazyListState, state: SavedUiState, cards: Int, onLoadMore: () -> Unit) {
    LaunchedEffect(list, state.hasNextPage, state.moreFailed, cards) {
        snapshotFlow { list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1 }
            .collect { last ->
                val nearEnd = last >= cards - FEED_TAIL_DISTANCE
                if (state.hasNextPage && !state.moreFailed && nearEnd) onLoadMore()
            }
    }
}

@Composable
private fun SavedLoadFailed(onRefresh: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(Space.x4)) {
        Text(
            stringResource(SavedR.string.saved_load_failed),
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.weight(1f).testTag("saved_transport_error"),
        )
        TextButton(onClick = onRefresh, modifier = Modifier.testTag("saved_retry")) {
            Text(stringResource(SavedR.string.saved_retry))
        }
    }
}

/** SAVEDEMPTY: words only — no action, no error colour, and the save named in words, never drawn as its glyph. */
@Composable
private fun SavedEmpty(focus: FocusRequester) {
    Column(Modifier.fillMaxWidth().padding(horizontal = Space.x6, vertical = Space.x2).dataNode(SAVED / "empty")) {
        Text(
            stringResource(SavedR.string.saved_empty),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .padding(vertical = Space.x2)
                .dataNode(SAVED / "empty" / "title")
                .focusRequester(focus)
                .focusable(),
        )
    }
}

/** SAVEDNONE: the reader's own search found nothing — the field keeps the query, and the one way back clears it. */
@Composable
private fun SavedNone(focus: FocusRequester, onShowEverything: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Space.x6, vertical = Space.x2).dataNode(SAVED / "empty"),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        Text(
            stringResource(R.string.content_saved_none),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .padding(vertical = Space.x2)
                .dataNode(SAVED / "empty" / "title")
                .focusRequester(focus)
                .focusable(),
        )
        OutlinedButton(onClick = onShowEverything, modifier = Modifier.dataNode(SAVED / "empty" / "action")) {
            Text(stringResource(R.string.content_saved_show_everything))
        }
    }
}

@Composable
private fun SavedMoreFailed(onRetry: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = Space.x4)) {
        Text(
            stringResource(SavedR.string.saved_more_failed),
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag("saved_more_failed"),
        )
        TextButton(onClick = onRetry, modifier = Modifier.testTag("saved_more_retry")) {
            Text(stringResource(SavedR.string.saved_retry))
        }
    }
}
