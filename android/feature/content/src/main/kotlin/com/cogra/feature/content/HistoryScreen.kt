// HISTORY — everything the reader has seen, as a feed (History.md,
// HistoryEmpty.md, HistoryFilter.md, HistoryNone.md, HistoryHidden.md,
// HistorySearch.md; design/designs/canonical/screens/History*.jsx). Reached
// from the reader's own profile's ⋮, Saved's sibling, in the Profile tab's
// stack. web's twin is `web/src/app/history/history-view.tsx`.
//
// THE SEEN-LIST, AND NOTHING ELSE (History.md:3). A content joins it the
// first time it was fully in the viewport (the seen tracker); the seeing
// stays in the app and never becomes a graph record. The page surfaces
// exactly that list — append-only, never compacted, with no way to clear it
// and no way to take one thing out (History.md:45), because taking a thing
// out would put it back into the reader's feed.
//
// EVERY KIND AS ITS OWN FEED CARD (History.md:19-21): a post as the feed's
// `PostCard`, a comment as the `CommentFeedCard`, a person as the
// `ProfileFeedCard`, a topic as the `TagFeedCard` — unchanged and fully live.
// No card wears the age of the seeing (History.md:31). A removed thing keeps
// its place wearing its card's own removal mark; sensitive content keeps its
// card's veil.
//
// NEWEST FIRST, BY FIRST SEEING, FROZEN PER OPEN, with a quiet day divider
// above the first thing seen on each day — part of the list, never of a card.
//
// SEARCH AND FILTER ON TOP: the one search law over the seen set, run on the
// server, and the kinds trigger, whose sheet stages and whose Done re-reads
// once. Under a query the list stands in sections — people, then tags, then
// the content — each capped at three behind its door, and no day divider
// stands. HistoryEmpty draws neither the field nor the trigger.
//
// A HIDDEN ACCOUNT'S POSTS AND COMMENTS STAY OUT WHILE IT IS HIDDEN, its own
// profile card stays (History.md:41); the open History never rearranges under
// a hide (HistoryHidden.md:3-5) — it takes hold at the next open or pull.

package com.cogra.feature.content

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
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CollapsingTop
import com.cogra.core.designsystem.CollapsingTopBand
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.core.designsystem.NodeSnackbarVisuals
import com.cogra.core.designsystem.StanceAxes
import com.cogra.core.designsystem.StanceZeroWords
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograChip
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.EmptyState
import com.cogra.core.designsystem.v2.atom.FilterFoot
import com.cogra.core.designsystem.v2.atom.FilterSection
import com.cogra.core.designsystem.v2.atom.FilterTrigger
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.SearchBar
import com.cogra.core.designsystem.v2.atom.SectionLabel
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.media.CoveringLayers
import com.cogra.core.designsystem.v2.media.LocalCoveringLayers
import com.cogra.core.designsystem.v2.media.ScrollStageHost
import com.cogra.core.designsystem.v2.media.ScrollStageRow
import com.cogra.core.designsystem.v2.media.SurfaceCover
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.PostView
import com.cogra.domain.content.isRevealed
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.history.HISTORY_KINDS
import com.cogra.domain.history.HistoryCard
import com.cogra.domain.history.HistoryEntry
import com.cogra.domain.history.HistorySection
import com.cogra.domain.history.KindsReading
import com.cogra.domain.history.historyDayKey
import com.cogra.domain.history.historyDividers
import com.cogra.domain.history.kindsReading
import com.cogra.domain.history.section
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.stance.StanceTarget
import com.cogra.feature.content.reply.ReplyTarget
import com.cogra.feature.saved.LocalSavedHost
import com.cogra.feature.saved.rememberHiddenSet
import com.cogra.feature.saved.rememberSavedHost
import com.cogra.feature.stance.StanceControlRoute
import kotlinx.coroutines.launch
import java.time.Instant
import com.cogra.feature.saved.R as SavedR

/** The registered prefix (`History`, `HistoryEmpty`, `HistoryFilter`, `HistoryNone`, … in `nodes.json`). */
private val HISTORY = DataNode("history")

/** History's post card: the feed's own, keyed by the post's id as the feed keys it. */
private val HISTORY_PLACEMENT = CardPlacement(
    card = HISTORY / "card",
    // No sheet of History's is drawn: the card's menu and terms keep their tags.
    menuSheet = null,
    licenseSheet = null,
    tag = "history",
    menuRows = emptySet(),
)

/** The report confirm over History — no History board draws one, so it keeps its tag. */
internal const val HISTORY_REPORT_SHEET = "history_report_sheet"

/** Where History's doors land beyond the cards' own: the tag card's act. */
data class HistoryDoors(
    val cards: CardDoors,
    /** `Tag a new post with it` (History.md:63): the composer at its first stage, the tag staged. */
    val onComposeWithTag: (String) -> Unit,
)

@Composable
fun HistoryRoute(
    onBack: () -> Unit,
    doors: HistoryDoors,
    viewerId: String?,
    signedIn: Boolean?,
    onEditPost: (String) -> Unit,
    onCitePost: (String) -> Unit,
    onReply: (ReplyTarget) -> Unit,
    onEditComment: (commentId: String, parentTitle: String) -> Unit,
    onSignInOrJoin: () -> Unit,
    commentsReturn: CommentsReturn = CommentsReturn(),
    onCommentsReturnConsumed: () -> Unit = {},
    onCommentsDepart: (CommentsScroll) -> Unit = {},
    viewModel: HistoryViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    HistoryScreen(
        state = state,
        writes = viewModel.writes,
        hidden = rememberHiddenSet(),
        callbacks = HistoryCallbacks(
            onRefresh = viewModel::refresh,
            onLoadMore = viewModel::loadMore,
            onRetryMore = viewModel::retryMore,
            onSearch = viewModel::search,
            onApplyKinds = viewModel::applyKinds,
            onNarrowTo = viewModel::narrowTo,
            onShowEverything = viewModel::showEverything,
            onBack = onBack,
        ),
        doors = doors,
        hooks = viewModel.cardHooks(viewerId, onEditPost, onCitePost) { url -> context.sharePost(url) },
        tagCards = TagCardHooks(
            onShare = { name -> context.sharePost(viewModel.topicShareUrl(name)) },
            stance = topicStanceControl,
        ),
        commentsSheet = { postId, onDismiss ->
            ListThread(
                postId = postId,
                post = state.postOf(postId),
                viewerId = viewerId,
                signedIn = signedIn,
                onDismiss = onDismiss,
                doors = doors.cards,
                onCitePost = onCitePost,
                onReply = onReply,
                onEditComment = onEditComment,
                onSignInOrJoin = onSignInOrJoin,
                commentsReturn = commentsReturn,
                onCommentsReturnConsumed = onCommentsReturnConsumed,
                onCommentsDepart = onCommentsDepart,
            )
        },
        reportSheet = reportDoor(null, HISTORY_REPORT_SHEET),
    )
}

/** What History's cards are handed: the viewer, the shares, the menus' routes, the reveal and the stance control. */
private fun HistoryViewModel.cardHooks(
    viewerId: String?,
    onEditPost: (String) -> Unit,
    onCitePost: (String) -> Unit,
    share: (String) -> Unit,
) = CardHooks(
    viewerId = viewerId,
    onShare = share,
    shareUrls = CardShareUrls(::postShareUrl, ::commentShareUrl, ::profileShareUrl),
    onEditPost = onEditPost,
    onCitePost = onCitePost,
    onReveal = ::onReveal,
    stanceControl = nodeStanceControl,
)

/** The topic's Affinity on a tag card: the tag page's own control, its four ends and its disconnect words. */
private val topicStanceControl: @Composable (name: String, node: DataNode) -> Unit = { name, node ->
    StanceControlRoute(
        target = StanceTarget.Topic(name),
        testTagPrefix = "history_tag_$name",
        axes = StanceAxes.Affinity,
        zeroWords = StanceZeroWords.Disconnected,
        targetLabel = "#$name",
        node = node,
    )
}

/** A seen post by its id — the one whose thread is raised over History. */
private fun HistoryUiState.postOf(id: String): PostView? =
    entries.firstNotNullOfOrNull { (it.card as? HistoryCard.Post)?.post?.takeIf { post -> post.id == id } }

/** What the screen asks of its ViewModel, hoisted. */
data class HistoryCallbacks(
    val onRefresh: () -> Unit = {},
    val onLoadMore: () -> Unit = {},
    val onRetryMore: () -> Unit = {},
    val onSearch: (String) -> Unit = {},
    val onApplyKinds: (Set<FeedKind>) -> Unit = {},
    val onNarrowTo: (FeedKind) -> Unit = {},
    val onShowEverything: () -> Unit = {},
    val onBack: () -> Unit = {},
)

/** What a tag card is handed beyond its doors: the share and the topic's Affinity. */
data class TagCardHooks(
    val onShare: (String) -> Unit = {},
    val stance: @Composable (name: String, node: DataNode) -> Unit = { _, _ -> },
)

/** Which empty line HistoryNone reads (HistoryNone.md:3, :5). */
enum class NoneCause { SEARCH, KINDS }

/** One row of History's column. */
internal sealed interface HistoryRow {
    val key: String

    data class Caption(val section: HistorySection) : HistoryRow {
        override val key: String get() = "caption-$section"
    }

    data class Door(val section: HistorySection) : HistoryRow {
        override val key: String get() = "door-$section"
    }

    data class Day(val label: String) : HistoryRow {
        override val key: String get() = "day-${historyDayKey(label)}"
    }

    data class Card(val entry: HistoryEntry) : HistoryRow {
        override val key: String get() = entry.id
    }
}

/** What History stands as: its rows, and which state the page is in. */
internal data class HistoryView(
    val rows: List<HistoryRow>,
    /** HISTORYEMPTY: the whole list holds nothing — no field and no trigger (HistoryEmpty.md:7). */
    val empty: Boolean,
    /** HISTORYNONE: the reader's own narrowing holds nothing, and why. */
    val none: NoneCause?,
    /** The field and the trigger stand wherever History is not empty, once a read has landed. */
    val fielded: Boolean,
)

/**
 * HISTORY'S LAYOUT LAWS, as a function: the empty and none states, and the
 * column — whole with its day dividers, or under a query in sections
 * (HistorySearch.md:3-35), each kind narrowed alone standing without its
 * caption and its door, and no day divider at all.
 */
internal fun historyView(state: HistoryUiState, now: Instant): HistoryView {
    val answered = state.answered
    val searching = state.query.isNotBlank()
    val byQuery = answered?.query != null
    val byKinds = answered != null && answered.kinds.isNotEmpty()
    val nothingShown = !state.loading && !state.failed && state.entries.isEmpty() &&
        !state.hasNextPage && !state.loadingMore
    val empty = nothingShown && !byQuery && !byKinds && !searching && state.kinds.isEmpty()
    val none = when {
        !nothingShown || empty -> null
        byQuery -> NoneCause.SEARCH
        byKinds -> NoneCause.KINDS
        else -> null
    }
    val rows = if (byQuery) sectioned(state) else dated(state.entries, now)
    return HistoryView(rows, empty, none, fielded = !empty && answered != null)
}

private fun dated(entries: List<HistoryEntry>, now: Instant): List<HistoryRow> {
    val days = historyDividers(entries.map { it.firstSeenAt }, now)
    return entries.flatMapIndexed { index, entry ->
        listOfNotNull(days[index]?.let { HistoryRow.Day(it) }, HistoryRow.Card(entry))
    }
}

private fun sectioned(state: HistoryUiState): List<HistoryRow> {
    val kinds = state.answered?.kinds.orEmpty()
    val bySection = state.entries.groupBy { it.card.section() }
    return buildList {
        listOf(
            Triple(HistorySection.PEOPLE, FeedKind.PROFILE, state.hasMorePeople),
            Triple(HistorySection.TAGS, FeedKind.TAG, state.hasMoreTags),
        ).forEach { (section, kind, more) ->
            val cards = bySection[section].orEmpty()
            if (cards.isEmpty()) return@forEach
            val alone = kinds == setOf(kind)
            if (!alone) add(HistoryRow.Caption(section))
            cards.forEach { add(HistoryRow.Card(it)) }
            if (!alone && more) add(HistoryRow.Door(section))
        }
        // THE CONTENT TAKES NO CAPTION OF ITS OWN (HistorySearch.md:23).
        bySection[HistorySection.CONTENT].orEmpty().forEach { add(HistoryRow.Card(it)) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(
    state: HistoryUiState,
    writes: SavedWrites?,
    callbacks: HistoryCallbacks,
    doors: HistoryDoors,
    hidden: HiddenSet? = null,
    hooks: CardHooks = CardHooks(),
    tagCards: TagCardHooks = TagCardHooks(),
    now: Instant = Instant.now(),
    commentsSheet: @Composable (postId: String, onDismiss: () -> Unit) -> Unit = { _, _ -> },
    reportSheet: ReportSheetSlot = { _, _, _ -> },
) {
    val snackbar = LocalSnackbarHostState.current
    // THE CARDS' MENUS SAVE THROUGH THE ONE OVERLAY AND HIDE THROUGH THE ONE
    // SET, their aftermath on this page's snackbar (`history.snackbar`,
    // HistoryHidden.md:3).
    val savedHost = rememberSavedHost(writes, snackbar, HISTORY / "snackbar", null, hidden)
    val view = historyView(state, now)
    val listState = rememberLazyListState()
    val layers = remember { CoveringLayers() }
    var commentsFor by rememberSaveable { mutableStateOf<String?>(null) }
    var reportFor by remember { mutableStateOf<String?>(null) }
    var sheetOpen by rememberSaveable { mutableStateOf(false) }
    val notify = rememberHistoryNotify(snackbar)
    LoadNextAtTheTail(listState, state.hasNextPage, state.moreFailed, view.rows.size, callbacks.onLoadMore)
    val actions = CardActions(hooks, doors.cards, state.reveals, { commentsFor = it }, { reportFor = it })
    val tagActions = TagCardActions(
        onOpen = doors.cards.onOpenTopic,
        onCompose = doors.onComposeWithTag,
        onShare = tagCards.onShare,
        stance = tagCards.stance,
    )
    CompositionLocalProvider(LocalCoveringLayers provides layers, LocalSavedHost provides savedHost) {
        HistoryScaffold(
            state = state,
            view = view,
            listState = listState,
            sheetOpen = sheetOpen,
            onOpenSheet = { sheetOpen = true },
            callbacks = callbacks,
        ) {
            HistoryContent(
                state = state,
                view = view,
                listState = listState,
                suspended = commentsFor != null || layers.cover == SurfaceCover.Suspended,
                callbacks = callbacks,
            ) { entry -> HistoryCardFor(entry, actions, tagActions, now) }
        }
        if (sheetOpen) {
            HistoryFilterSheet(
                committed = state.kinds,
                onDone = { staged ->
                    sheetOpen = false
                    callbacks.onApplyKinds(staged)
                },
                onDismiss = { sheetOpen = false },
            )
        }
        commentsFor?.let { postId -> commentsSheet(postId) { commentsFor = null } }
        reportFor?.let { postId -> reportSheet(postId, { reportFor = null }, notify) }
    }
}

/** A line on this page's own snackbar (`history.snackbar`) — the report's aftermath. */
@Composable
private fun rememberHistoryNotify(snackbar: SnackbarHostState?): (String) -> Unit {
    val scope = rememberCoroutineScope()
    return { text -> scope.launch { snackbar?.showSnackbar(NodeSnackbarVisuals(text, HISTORY / "snackbar")) } }
}

/** The page: its collapsing top over the pull-to-refresh body and the way back up. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HistoryScaffold(
    state: HistoryUiState,
    view: HistoryView,
    listState: LazyListState,
    sheetOpen: Boolean,
    onOpenSheet: () -> Unit,
    callbacks: HistoryCallbacks,
    body: @Composable () -> Unit,
) {
    val collapsingTop = rememberCollapsingTop()
    Scaffold(
        modifier = Modifier.dataNodeSurface(),
        topBar = { HistoryTopBar(collapsingTop, view.fielded, state, sheetOpen, onOpenSheet, callbacks) },
    ) { padding ->
        PullToRefreshBox(
            // PULL DOWN AT THE TOP RE-READS (History.md:111), with the
            // platform's own refresh indicator.
            isRefreshing = state.loading && state.entries.isNotEmpty(),
            onRefresh = callbacks.onRefresh,
            modifier = Modifier.padding(padding).fillMaxSize(),
        ) {
            Box(Modifier.fillMaxSize().collapsingTop(collapsingTop)) {
                body()
                // THE WAY BACK UP (History.md:113-117): with the band from
                // three screens down; it goes up, animated, and never re-reads.
                FeedBackToTop(
                    bandShown = collapsingTop.showTop,
                    listState = listState,
                    modifier = Modifier.align(Alignment.TopCenter),
                )
            }
        }
    }
}

/** THE HEADER, THE FIELD AND THE TRIGGER COLLAPSE ON THE WAY DOWN AND RETURN ON THE WAY UP (History.md:119). */
@Composable
private fun HistoryTopBar(
    collapsingTop: CollapsingTop,
    fielded: Boolean,
    state: HistoryUiState,
    sheetOpen: Boolean,
    onOpenSheet: () -> Unit,
    callbacks: HistoryCallbacks,
) {
    CollapsingTopBand(collapsingTop) {
        Column {
            PageHeader(
                title = stringResource(R.string.content_history_title),
                onBack = callbacks.onBack,
                backContentDescription = stringResource(R.string.content_history_back),
                node = HISTORY / "header",
            )
            if (fielded) {
                val search = stringResource(R.string.content_history_search)
                SearchBar(
                    query = state.query,
                    onQueryChange = callbacks.onSearch,
                    placeholder = search,
                    label = search,
                    node = HISTORY / "searchField",
                )
                Row(Modifier.padding(start = Space.x4, end = Space.x4, bottom = Space.x2)) {
                    FilterTrigger(
                        reading = kindsWords(kindsReading(state.kinds)),
                        purpose = stringResource(R.string.content_history_filter_purpose),
                        onOpen = onOpenSheet,
                        expanded = sheetOpen,
                        node = HISTORY / "filterTrigger",
                    )
                }
            }
        }
    }
}

/** The trigger's words: `Everything`, a kind's name, `2 kinds`, `All kinds`. */
@Composable
private fun kindsWords(reading: KindsReading): String = when (reading) {
    KindsReading.Everything -> stringResource(R.string.content_history_everything)
    KindsReading.All -> stringResource(R.string.content_history_all_kinds)
    is KindsReading.One -> kindLabel(reading.kind)
    is KindsReading.Some -> pluralStringResource(R.plurals.content_history_some_kinds, reading.count, reading.count)
}

@Composable
private fun kindLabel(kind: FeedKind): String = stringResource(
    when (kind) {
        FeedKind.POST -> R.string.content_history_kind_posts
        FeedKind.COMMENT -> R.string.content_history_kind_comments
        FeedKind.PROFILE -> R.string.content_history_kind_profiles
        FeedKind.TAG -> R.string.content_history_kind_tags
    },
)

/** The chip's registered value (`FeedFilter.jsx` `FEED_KINDS`: `posts`, `comments`, `profiles`, `topics`). */
private fun FeedKind.chipValue(): String = when (this) {
    FeedKind.POST -> "posts"
    FeedKind.COMMENT -> "comments"
    FeedKind.PROFILE -> "profiles"
    FeedKind.TAG -> "topics"
}

/**
 * THE HISTORY'S FILTER SHEET (HistoryFilter.md): kinds and only kinds, no
 * "?", Reset in the corner and Done at the end. It stages on a copy taken as
 * it opens; Done commits once, and the scrim, a swipe down and Back drop what
 * it staged. Reset stages the default — no kind narrowed — and reads nothing.
 */
@Composable
private fun HistoryFilterSheet(committed: Set<FeedKind>, onDone: (Set<FeedKind>) -> Unit, onDismiss: () -> Unit) {
    var staged by remember { mutableStateOf(committed) }
    val sheet = HISTORY / "filterSheet"
    CograSheetHost(onDismissRequest = onDismiss) {
        CograSheetSurface(testTag = sheet.tag, handleTestTag = (sheet / "dragHandle").tag, gap = 0.dp) {
            SheetTitle(
                text = stringResource(R.string.content_history_filter_purpose),
                modifier = Modifier.padding(bottom = Space.x2).dataNode(sheet / "title"),
            )
            FilterSection(
                label = stringResource(R.string.content_history_filter_kinds),
                hint = stringResource(R.string.content_history_filter_hint),
                node = sheet / "kinds",
            ) {
                HISTORY_KINDS.forEach { kind ->
                    CograChip(
                        label = kindLabel(kind),
                        selected = kind in staged,
                        onClick = { staged = if (kind in staged) staged - kind else staged + kind },
                        testTag = (sheet / "kinds" / "${kind.chipValue()}Chip").tag,
                    )
                }
            }
            FilterFoot(
                resetLabel = stringResource(R.string.content_history_reset),
                doneLabel = stringResource(R.string.content_history_done),
                onReset = { staged = emptySet() },
                onDone = { onDone(staged) },
                node = sheet / "foot",
            )
        }
    }
}

/** What stands under the top: the first read, its fault, HistoryEmpty, HistoryNone, or the column. */
@Composable
private fun HistoryContent(
    state: HistoryUiState,
    view: HistoryView,
    listState: LazyListState,
    suspended: Boolean,
    callbacks: HistoryCallbacks,
    card: @Composable (HistoryEntry) -> Unit,
) {
    when {
        state.loading && state.entries.isEmpty() -> Text(
            stringResource(com.cogra.core.designsystem.R.string.loading_state),
            modifier = Modifier.padding(Space.x4).testTag("history_loading"),
        )

        state.failed && state.entries.isEmpty() -> HistoryLoadFailed(callbacks.onRefresh)

        view.empty -> HistoryEmpty()

        view.none != null -> HistoryNone(view.none, callbacks.onShowEverything)

        // THE FEED'S ONE STAGE (History.md:77-83): at most one clip plays, and
        // the stage re-elects at the list's hard top, by the feed's law.
        else -> ScrollStageHost(listState, suspended = suspended, hardTopReelects = true) {
            HistoryColumn(state, view, listState, callbacks, card)
        }
    }
}

/** ONE COLUMN AT THE FEED LIST'S 8dp RHYTHM (`FeedList`): captions, cards, doors and days are its rows. */
@Composable
private fun HistoryColumn(
    state: HistoryUiState,
    view: HistoryView,
    listState: LazyListState,
    callbacks: HistoryCallbacks,
    card: @Composable (HistoryEntry) -> Unit,
) {
    // A caption leading the column stands right under the trigger; the
    // list's own 8dp top otherwise.
    val captionLeads = view.rows.firstOrNull() is HistoryRow.Caption
    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize().testTag("history_list"),
        contentPadding = PaddingValues(top = if (captionLeads) 0.dp else Space.x2, bottom = Space.x4),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        items(view.rows, key = { it.key }) { row ->
            when (row) {
                is HistoryRow.Caption -> SectionLabel(
                    text = sectionWords(row.section),
                    node = HISTORY / if (row.section == HistorySection.PEOPLE) "profilesLabel" else "tagsLabel",
                )

                is HistoryRow.Door -> SectionDoor(row.section, callbacks.onNarrowTo)

                is HistoryRow.Day -> DayDivider(row.label)

                is HistoryRow.Card -> ScrollStageRow(row.entry.id) { card(row.entry) }
            }
        }
        if (state.moreFailed) {
            item(key = "history_more_failed") { HistoryMoreFailed(callbacks.onRetryMore) }
        }
    }
}

@Composable
private fun sectionWords(section: HistorySection): String =
    kindLabel(if (section == HistorySection.PEOPLE) FeedKind.PROFILE else FeedKind.TAG)

/** A section's door (HistorySearch.md:7, :15): its kind alone becomes the filter, the query kept. */
@Composable
private fun SectionDoor(section: HistorySection, onNarrowTo: (FeedKind) -> Unit) {
    val people = section == HistorySection.PEOPLE
    Row(Modifier.padding(horizontal = Space.x2)) {
        CograButton(
            text = stringResource(
                if (people) R.string.content_history_see_all_profiles else R.string.content_history_see_all_tags,
            ),
            onClick = { onNarrowTo(if (people) FeedKind.PROFILE else FeedKind.TAG) },
            kind = ButtonKind.Text,
            size = ButtonSize.Compact,
            testTag = (HISTORY / if (people) "profilesDoor" else "tagsDoor").tag,
        )
    }
}

/**
 * A QUIET DAY DIVIDER (History.md:25-27; `_shared.jsx` `HistoryDayDivider`):
 * label-small, secondary, centred, no rule and no fill — part of the list,
 * never of a card; keyed by its own words.
 */
@Composable
private fun DayDivider(label: String) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .padding(vertical = Space.x1)
                .semantics { heading() }
                .dataNode((HISTORY / "day").keyed(historyDayKey(label))),
        )
    }
}

/** One seen thing, as its kind's own feed card. */
@Composable
private fun HistoryCardFor(entry: HistoryEntry, actions: CardActions, tags: TagCardActions, now: Instant) {
    val doors = actions.doors
    when (val card = entry.card) {
        is HistoryCard.Post -> PostCard(
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
            placement = HISTORY_PLACEMENT,
        )

        // A HISTORY COMMENT CARD CARRIES NO VIEW-REPLIES LINE (History.md:37):
        // the comment feed card never draws one.
        is HistoryCard.Comment -> ListCommentCard(
            comment = card.comment,
            target = card.target,
            threadPostId = card.threadPostId,
            node = HISTORY / "commentCard",
            testTagPrefix = "history_comment_${card.comment.id}",
            actions = actions,
        )

        is HistoryCard.Person -> ProfileFeedCard(
            profile = card.profile,
            node = HISTORY / "profileCard",
            testTagPrefix = "history_person_${card.profile.id}",
            viewerId = actions.viewerId,
            onOpen = { doors.onOpenActor(card.profile.handle) },
            onShare = { actions.onShare(actions.shareUrls.profile(card.profile.handle)) },
            stanceControl = actions.stanceControl,
        )

        is HistoryCard.Tag -> TagFeedCard(topic = card.topic, node = HISTORY / "tagCard", actions = tags, now = now)
    }
}

@Composable
private fun HistoryLoadFailed(onRefresh: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(Space.x4)) {
        Text(
            stringResource(SavedR.string.saved_load_failed),
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.weight(1f).testTag("history_transport_error"),
        )
        TextButton(onClick = onRefresh, modifier = Modifier.testTag("history_retry")) {
            Text(stringResource(SavedR.string.saved_retry))
        }
    }
}

/** HISTORYEMPTY (HistoryEmpty.md): words only — no action button, no error colour. */
@Composable
private fun HistoryEmpty() {
    Column(Modifier.fillMaxWidth().padding(horizontal = Space.x6, vertical = Space.x2)) {
        EmptyState(
            testTag = (HISTORY / "empty").tag,
            title = stringResource(R.string.content_history_empty),
            registered = true,
        )
    }
}

/**
 * HISTORYNONE (HistoryNone.md): the field keeps the query and the trigger its
 * reading; the line says which narrowing found nothing, and `Show everything`
 * is the one way back.
 */
@Composable
private fun HistoryNone(cause: NoneCause, onShowEverything: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = Space.x6, vertical = Space.x2)) {
        EmptyState(
            testTag = (HISTORY / "empty").tag,
            title = stringResource(
                when (cause) {
                    NoneCause.SEARCH -> R.string.content_history_none_search
                    NoneCause.KINDS -> R.string.content_history_none_kinds
                },
            ),
            registered = true,
            action = {
                CograButton(
                    text = stringResource(R.string.content_saved_show_everything),
                    onClick = onShowEverything,
                    kind = ButtonKind.Outlined,
                    size = ButtonSize.Compact,
                    testTag = (HISTORY / "empty" / "action").tag,
                )
            },
        )
    }
}

@Composable
private fun HistoryMoreFailed(onRetry: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = Space.x4)) {
        Text(
            stringResource(SavedR.string.saved_more_failed),
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag("history_more_failed"),
        )
        TextButton(onClick = onRetry, modifier = Modifier.testTag("history_more_retry")) {
            Text(stringResource(SavedR.string.saved_retry))
        }
    }
}
