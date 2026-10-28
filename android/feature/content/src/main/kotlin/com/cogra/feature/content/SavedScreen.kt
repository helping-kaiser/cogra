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
// SEARCH ON TOP: the one search law, run by the server over the whole saved
// set (`bookmarks(query:)`, seam 220) — the screen never narrows or re-sorts
// what it holds, so a narrowed list stands as served: people, then content. A
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
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CollapsingTop
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
import com.cogra.domain.PostView
import com.cogra.domain.content.isRevealed
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.saved.ComfortKind
import com.cogra.domain.saved.SavedCard
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedOverlay
import com.cogra.domain.saved.SavedWrites
import com.cogra.feature.content.reply.ReplyTarget
import com.cogra.feature.saved.LocalSavedHost
import com.cogra.feature.saved.SavedUiState
import com.cogra.feature.saved.SavedViewModel
import com.cogra.feature.saved.overlayState
import com.cogra.feature.saved.rememberHiddenSet
import com.cogra.feature.saved.rememberSavedHost
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

@Composable
fun SavedRoute(
    onBack: () -> Unit,
    doors: CardDoors,
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
    // SAVED'S REMOVAL, for the own cards' ⋮ and the thread a count raises: a
    // card removed here stands as its mark in place (RM-G9).
    ProvideRemoval {
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
            hooks = CardHooks(
                viewerId = viewerId,
                onShare = { url -> context.sharePost(url) },
                shareUrls = CardShareUrls(
                    viewModel::postShareUrl,
                    viewModel::commentShareUrl,
                    viewModel::profileShareUrl,
                ),
                onEditPost = onEditPost,
                onCitePost = onCitePost,
                onReveal = viewModel::onReveal,
                stanceControl = nodeStanceControl,
            ),
            commentsSheet = { postId, onDismiss ->
                ListThread(
                    postId = postId,
                    post = state.postOf(postId),
                    viewerId = viewerId,
                    signedIn = signedIn,
                    onDismiss = onDismiss,
                    doors = doors,
                    onCitePost = onCitePost,
                    onReply = onReply,
                    onEditComment = onEditComment,
                    onSignInOrJoin = onSignInOrJoin,
                    commentsReturn = commentsReturn,
                    onCommentsReturnConsumed = onCommentsReturnConsumed,
                    onCommentsDepart = onCommentsDepart,
                )
            },
            reportSheet = reportDoor(null, SAVED_REPORT_SHEET),
        )
    }
}

/** The report confirm over Saved — no Saved board draws one, so it keeps its tag. */
internal const val SAVED_REPORT_SHEET = "saved_report_sheet"

/** A kept post by its id — the one whose thread is raised over Saved. */
private fun SavedUiState.postOf(id: String): PostView? =
    entries.firstNotNullOfOrNull { (it.card as? SavedCard.Post)?.post?.takeIf { post -> post.id == id } }

/** Cards on screen: what the reader still keeps, plus a failed Undo's card, which stays with its line. */
fun keptEntries(entries: List<SavedEntry>, overlay: SavedOverlay): List<SavedEntry> =
    entries.filter { overlay.kept(it.id, it.bookmarkedAt) != null || overlay.failure(it.id) == ComfortKind.RESTORE }

/** What Saved stands as: the cards, in the order served, and which state the page is in. */
internal data class SavedView(
    /** The held list less the reader's own unsaves — the server's order, never re-sorted. */
    val shown: List<SavedEntry>,
    /** SAVEDEMPTY: nothing kept and no query standing. */
    val empty: Boolean,
    /** SAVEDNONE: the server's narrowed list holds nothing (or nothing the reader still keeps). */
    val none: Boolean,
    /** The field stands wherever something is kept or a query still stands. */
    val fielded: Boolean,
)

internal fun savedView(state: SavedUiState, overlay: SavedOverlay): SavedView {
    val shown = keptEntries(state.entries, overlay)
    val narrowed = state.narrowedBy != null
    // A query typed but not yet read still keeps the field: the reader is
    // mid-word, and the list under it is the last one read.
    val searching = narrowed || state.query.isNotBlank()
    val settled = !state.loading && !state.failed && !state.hasNextPage
    // SAVEDEMPTY draws no field: it arrives with the first thing saved. A
    // query still standing keeps it, so `Show everything` is the way back.
    val empty = settled && shown.isEmpty() && !searching
    val none = settled && narrowed && shown.isEmpty() && !state.loadingMore
    return SavedView(shown, empty, none, fielded = !empty && (shown.isNotEmpty() || searching))
}

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
    doors: CardDoors,
    hidden: HiddenSet? = null,
    hooks: CardHooks = CardHooks(),
    commentsSheet: @Composable (postId: String, onDismiss: () -> Unit) -> Unit = { _, _ -> },
    reportSheet: ReportSheetSlot = { _, _, _ -> },
) {
    val overlay = writes.overlayState()
    val snackbar = LocalSnackbarHostState.current
    // THE CARDS' MENUS SAVE THROUGH THE ONE OVERLAY AND HIDE THROUGH THE ONE
    // SET, their aftermath on this page's snackbar (`saved.snackbar`).
    val savedHost = rememberSavedHost(writes, snackbar, SAVED / "snackbar", null, hidden)
    val view = savedView(state, overlay)
    val listState = rememberLazyListState()
    val layers = remember { CoveringLayers() }
    var commentsFor by rememberSaveable { mutableStateOf<String?>(null) }
    var reportFor by remember { mutableStateOf<String?>(null) }
    val notify = rememberSavedNotify(snackbar)
    LoadNextAtTheTail(listState, state.hasNextPage, state.moreFailed, view.shown.size, onLoadMore)
    val actions = CardActions(hooks, doors, state.reveals, { commentsFor = it }, { reportFor = it })
    CompositionLocalProvider(LocalCoveringLayers provides layers, LocalSavedHost provides savedHost) {
        SavedScaffold(
            state = state,
            view = view,
            listState = listState,
            focus = rememberCardFocus(view.shown, overlay),
            actions = actions,
            suspended = commentsFor != null || layers.cover == SurfaceCover.Suspended,
            onRefresh = onRefresh,
            onRetryMore = onRetryMore,
            onSearch = onSearch,
            onBack = onBack,
        )
        commentsFor?.let { postId -> commentsSheet(postId) { commentsFor = null } }
        reportFor?.let { postId -> reportSheet(postId, { reportFor = null }, notify) }
    }
}

/** A line on this page's own snackbar (`saved.snackbar`) — the report's aftermath. */
@Composable
private fun rememberSavedNotify(snackbar: SnackbarHostState?): (String) -> Unit {
    val scope = rememberCoroutineScope()
    return { text -> scope.launch { snackbar?.showSnackbar(NodeSnackbarVisuals(text, SAVED / "snackbar")) } }
}

/** The page: its collapsing top over the pull-to-refresh body and the way back up. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SavedScaffold(
    state: SavedUiState,
    view: SavedView,
    listState: LazyListState,
    focus: CardFocus,
    actions: CardActions,
    suspended: Boolean,
    onRefresh: () -> Unit,
    onRetryMore: () -> Unit,
    onSearch: (String) -> Unit,
    onBack: () -> Unit,
) {
    val collapsingTop = rememberCollapsingTop()
    Scaffold(
        modifier = Modifier.dataNodeSurface(),
        topBar = { SavedTopBar(collapsingTop, view.fielded, state.query, onBack, onSearch) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.loading && state.entries.isNotEmpty(),
            onRefresh = onRefresh,
            modifier = Modifier.padding(padding).fillMaxSize(),
        ) {
            Box(Modifier.fillMaxSize().collapsingTop(collapsingTop)) {
                SavedContent(
                    state = state,
                    view = view,
                    listState = listState,
                    suspended = suspended,
                    focus = focus,
                    actions = actions,
                    onRefresh = onRefresh,
                    onRetryMore = onRetryMore,
                    onShowEverything = { onSearch("") },
                )
                // THE WAY BACK UP (Saved.md): with the band from three screens
                // down; it goes up, animated, and never re-reads.
                FeedBackToTop(
                    bandShown = collapsingTop.showTop,
                    listState = listState,
                    modifier = Modifier.align(Alignment.TopCenter),
                )
            }
        }
    }
}

/** THE HEADER AND THE FIELD COLLAPSE ON THE WAY DOWN AND RETURN ON THE WAY UP (Saved.md), one region. */
@Composable
private fun SavedTopBar(
    collapsingTop: CollapsingTop,
    fielded: Boolean,
    query: String,
    onBack: () -> Unit,
    onSearch: (String) -> Unit,
) {
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
                    query = query,
                    onQueryChange = onSearch,
                    placeholder = stringResource(R.string.content_saved_search),
                    label = stringResource(R.string.content_saved_search),
                    node = SAVED / "searchField",
                )
            }
        }
    }
}

/** What stands under the top: the first read, its fault, SavedEmpty, SavedNone, or the cards. */
@Composable
private fun SavedContent(
    state: SavedUiState,
    view: SavedView,
    listState: LazyListState,
    suspended: Boolean,
    focus: CardFocus,
    actions: CardActions,
    onRefresh: () -> Unit,
    onRetryMore: () -> Unit,
    onShowEverything: () -> Unit,
) {
    when {
        state.loading && state.entries.isEmpty() -> Text(
            stringResource(com.cogra.core.designsystem.R.string.loading_state),
            modifier = Modifier.padding(Space.x4).testTag("saved_loading"),
        )

        state.failed && state.entries.isEmpty() -> SavedLoadFailed(onRefresh)

        view.empty -> SavedEmpty(focus.empty)

        view.none -> SavedNone(focus.empty, onShowEverything)

        // THE FEED'S ONE STAGE (Saved.md): at most one clip plays, and the
        // stage re-elects at the list's hard top, by the feed's law.
        else -> ScrollStageHost(listState, suspended = suspended, hardTopReelects = true) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize().testTag("saved_list"),
                contentPadding = PaddingValues(top = Space.x2, bottom = Space.x4),
                verticalArrangement = Arrangement.spacedBy(Space.x2),
            ) {
                items(view.shown, key = { it.id }) { entry ->
                    ScrollStageRow(entry.id) {
                        Box(Modifier.focusRequester(focus.card(entry.id)).focusable()) {
                            SavedCardFor(entry, actions)
                        }
                    }
                }
                if (state.moreFailed) {
                    item(key = "saved_more_failed") { SavedMoreFailed(onRetryMore) }
                }
            }
        }
    }
}

/** One kept thing, as its kind's own feed card. */
@Composable
private fun SavedCardFor(entry: SavedEntry, actions: CardActions) {
    val doors = actions.doors
    when (val card = entry.card) {
        is SavedCard.Post -> PostCard(
            post = card.post,
            onClick = { doors.onOpenPost(card.post.id) },
            onOpenComments = { actions.onOpenComments(card.post.id) },
            onOpenPost = doors.onOpenPost,
            onOpenActor = doors.onOpenActor,
            onOpenTopic = doors.onOpenTopic,
            onShare = { id -> actions.onShare(actions.shareUrls.post(id)) },
            viewerId = actions.viewerId,
            onEdit = actions.onEditPost,
            onCite = actions.onCitePost,
            onReport = { actions.onReport(card.post.id) },
            revealed = actions.reveals.isRevealed(card.post.id, card.post.sensitiveMark()),
            onReveal = { actions.onReveal(card.post.id, card.post.sensitiveMark()) },
            stanceControl = actions.stanceControl,
            placement = SAVED_PLACEMENT,
        )

        is SavedCard.Comment -> ListCommentCard(
            listed = card.comment,
            target = card.target,
            threadPostId = card.threadPostId,
            node = SAVED / "commentCard",
            testTagPrefix = "saved_comment_${card.comment.id}",
            actions = actions,
        )

        is SavedCard.Person -> ProfileFeedCard(
            profile = card.profile,
            node = SAVED / "profileCard",
            testTagPrefix = "saved_person_${card.profile.id}",
            viewerId = actions.viewerId,
            onOpen = { doors.onOpenActor(card.profile.handle) },
            onShare = { actions.onShare(actions.shareUrls.profile(card.profile.handle)) },
            stanceControl = actions.stanceControl,
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
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Space.x6, vertical = Space.x2)
            .dataNode(SAVED / "empty"),
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
