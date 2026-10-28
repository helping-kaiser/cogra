// EXPLORE — the bar's search slot (Explore.md, ExploreSearch.md,
// ExploreFilter.md, ExploreNone.md, ExploreUnscoped.md, ExplorePerson.md;
// design/designs/canonical/screens/Explore*.jsx). web's twin is
// `web/src/app/explore/explore-view.tsx`.
//
// AT REST it reads the band holding the field, the Sky's card, the door into
// Your topics, then Recent (Explore.md:3). TYPING TAKES THE SCREEN: the band
// gives way to the field, the worded trigger and the "?" stand under it, and
// the results refine as the reader types. The field keeps ONE place in the
// tree in both states, so the typing that takes the screen never drops the
// input it is typed into.
//
// THE ANSWER IS DRAWN AS SERVED (`layoutResults`). The results take the
// pull-down; Explore at rest takes none (Explore.md:45). Back from a standing
// search empties the field and never leaves Explore (:15).

package com.cogra.feature.explore

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.RootReselectEffect
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.BandBell
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograBandBell
import com.cogra.core.designsystem.v2.atom.CograBandChats
import com.cogra.core.designsystem.v2.atom.CograBandIdentity
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograChip
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.ContentRow
import com.cogra.core.designsystem.v2.atom.ContentRowDisc
import com.cogra.core.designsystem.v2.atom.ContentRowDoorSecond
import com.cogra.core.designsystem.v2.atom.EmptyState
import com.cogra.core.designsystem.v2.atom.FilterFoot
import com.cogra.core.designsystem.v2.atom.FilterSection
import com.cogra.core.designsystem.v2.atom.FilterTrigger
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.HelpDot
import com.cogra.core.designsystem.v2.atom.LoadingState
import com.cogra.core.designsystem.v2.atom.MarkKind
import com.cogra.core.designsystem.v2.atom.ReferenceRow
import com.cogra.core.designsystem.v2.atom.RowEdge
import com.cogra.core.designsystem.v2.atom.Seam
import com.cogra.core.designsystem.v2.atom.SearchBar
import com.cogra.core.designsystem.v2.atom.SectionLabel
import com.cogra.core.designsystem.v2.atom.SegmentedFilter
import com.cogra.core.designsystem.v2.atom.SegmentedOption
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.filterTriggerName
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.search.KindsHead
import com.cogra.domain.search.ResultDoor
import com.cogra.domain.search.ResultItem
import com.cogra.domain.search.ResultKind
import com.cogra.domain.search.ResultSub
import com.cogra.domain.search.ResultsContext
import com.cogra.domain.search.SEARCH_KINDS
import com.cogra.domain.search.SearchFilter
import com.cogra.domain.search.SearchFilterReading
import com.cogra.domain.search.SearchOrder
import com.cogra.domain.search.layoutResults
import com.cogra.domain.search.reading
import com.cogra.domain.search.recentNodeKey
import com.cogra.domain.search.unscopedComments
import java.time.Instant

/** The registered prefix (nodes.json `explore`). */
internal val EXPLORE = DataNode("explore")

/** Where each result opens; the shell owns the routes. */
data class ExploreDoors(
    val onOpenPost: (postId: String) -> Unit,
    val onOpenComment: (postId: String, commentId: String) -> Unit,
    val onOpenPerson: (handle: String) -> Unit,
    val onOpenOwnProfile: () -> Unit,
    val onOpenTopic: (name: String) -> Unit,
    val onOpenYourTopics: () -> Unit,
)

/** What the screen answers with; one bundle so the screen stays previewable. */
data class ExploreActions(
    val onQueryChange: (String) -> Unit = {},
    val onClear: () -> Unit = {},
    val onAction: () -> Unit = {},
    val onRecent: (String) -> Unit = {},
    val onOpenResult: () -> Unit = {},
    val onCommit: (SearchFilter) -> Unit = {},
    val onAllProfiles: () -> Unit = {},
    val onRetry: () -> Unit = {},
    val onPull: () -> Unit = {},
    val onLoadMore: () -> Unit = {},
    val onRetryMore: () -> Unit = {},
)

@Composable
fun ExploreRoute(
    /** The bar's Explore slot re-tapped over this root, counted (the ladder's last rungs). */
    reselects: Int,
    /** The band's bell; null for a guest, whose band stands bare (Explore.md:35). */
    bell: BandBell?,
    /** The band's chats; a guest's asks to join. */
    onChats: () -> Unit,
    doors: ExploreDoors,
    viewModel: ExploreViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    // The door's count is read on each return: a topic held elsewhere is counted here.
    LifecycleResumeEffect(viewModel) {
        viewModel.readHeldCount()
        onPauseOrDispose {}
    }
    ExploreScreen(
        state = state,
        reselects = reselects,
        bell = bell,
        onChats = onChats,
        doors = doors,
        actions = ExploreActions(
            onQueryChange = viewModel::onQueryChange,
            onClear = viewModel::toRest,
            onAction = viewModel::onAction,
            onRecent = viewModel::onRecent,
            onOpenResult = viewModel::onOpenResult,
            onCommit = viewModel::commit,
            onAllProfiles = viewModel::allProfiles,
            onRetry = viewModel::retry,
            onPull = viewModel::pull,
            onLoadMore = viewModel::loadMore,
            onRetryMore = viewModel::retryMore,
        ),
    )
}

@Composable
fun ExploreScreen(
    state: ExploreUiState,
    doors: ExploreDoors,
    actions: ExploreActions,
    modifier: Modifier = Modifier,
    reselects: Int = 0,
    bell: BandBell? = null,
    onChats: (() -> Unit)? = null,
    now: Instant = Instant.now(),
) {
    val restList = rememberLazyListState()
    // The results keep their own scroll, so the way back finds them as they were (Explore.md:19).
    val resultsList = rememberLazyListState()
    // A transient — the sheet, a dialog — is never part of what comes back (design/readme.md §13).
    var sheetOpen by remember { mutableStateOf(false) }
    var help by remember { mutableStateOf<HelpTopic?>(null) }
    var announced by remember { mutableStateOf<SearchFilter?>(null) }
    // THE RE-TAP LADDER (BottomNav.jsx): scrolled, back to the top; at the top, nothing.
    RootReselectEffect(reselects, if (state.searching) resultsList else restList)
    // SEARCHING IS A STATE OF THE ROOT: Back empties the field and never leaves Explore (Explore.md:15).
    BackHandler(enabled = state.searching) { actions.onClear() }
    val reading = readingWords(state.filter.reading(state.defaultFilter))
    val purpose = stringResource(R.string.explore_filter_purpose)
    Column(modifier.fillMaxSize().dataNodeSurface()) {
        ExploreTop(
            state = state,
            bell = bell,
            onChats = onChats,
            actions = actions,
            reading = reading,
            purpose = purpose,
            sheetOpen = sheetOpen,
            onOpenSheet = { sheetOpen = true },
            onHelp = { help = HelpTopic.Searching },
        )
        if (state.searching) {
            Results(state, resultsList, doors, actions, now)
        } else {
            AtRest(state, restList, doors, actions)
        }
    }
    // THE APPLY IS SAID ONCE (FeedFilter.jsx; WCAG 4.1.3): Done leaves the trigger's new name in a polite region.
    announced?.let { applied ->
        val name = filterTriggerName(readingWords(applied.reading(state.defaultFilter)), purpose)
        Box(
            Modifier.semantics {
                liveRegion = LiveRegionMode.Polite
                contentDescription = name
            },
        )
    }
    if (sheetOpen) {
        ExploreFilterSheet(
            committed = state.filter,
            default = state.defaultFilter,
            guest = state.guest,
            onHelp = { help = HelpTopic.TheSearchFilter },
            onDone = { staged ->
                sheetOpen = false
                actions.onCommit(staged)
                announced = staged
            },
            onDismiss = { sheetOpen = false },
        )
    }
    help?.let { topic ->
        HelpDialog(
            title = topic.title,
            paragraphs = topic.paragraphs,
            onClose = { help = null },
            testTag = if (topic == HelpTopic.Searching) "explore_help_dialog" else "explore_filter_help_dialog",
        )
    }
}

/**
 * The top: at rest the band holds the field (`explore.band`, Explore.jsx);
 * searching, the band gives way and the trigger row stands under the field
 * (`SearchTriggerRow`: `0 16 8`, the trigger and the "?" on the far edge).
 */
@Composable
private fun ExploreTop(
    state: ExploreUiState,
    bell: BandBell?,
    onChats: (() -> Unit)?,
    actions: ExploreActions,
    reading: String,
    purpose: String,
    sheetOpen: Boolean,
    onOpenSheet: () -> Unit,
    onHelp: () -> Unit,
) {
    val band = EXPLORE / "band"
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    val field = stringResource(R.string.explore_field_name)
    Column(if (state.searching) Modifier else Modifier.dataNode(band)) {
        if (state.searching) {
            Spacer(Modifier.height(Space.x3))
        } else {
            Row(
                modifier = Modifier
                    .defaultMinSize(minHeight = Layout.TopBarHeight)
                    .padding(horizontal = Space.x4),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Space.x2),
            ) {
                CograBandIdentity(Modifier.weight(1f), node = band)
                onChats?.let { CograBandChats(it, node = band) }
                bell?.let { CograBandBell(it, node = band) }
            }
        }
        SearchBar(
            query = state.query,
            onQueryChange = actions.onQueryChange,
            placeholder = stringResource(R.string.explore_placeholder),
            label = field,
            node = EXPLORE / "searchField",
            onClear = actions.onClear,
            // THE ACTION KEY ONLY DISMISSES THE KEYBOARD (Explore.md:25), and the query joins the recents.
            onAction = {
                keyboard?.hide()
                focus.clearFocus()
                actions.onAction()
            },
        )
        if (state.searching) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = Space.x4, end = Space.x4, bottom = Space.x2),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                FilterTrigger(
                    reading = reading,
                    purpose = purpose,
                    onOpen = onOpenSheet,
                    expanded = sheetOpen,
                    node = EXPLORE / "filterTrigger",
                )
                HelpDot(onHelp, stringResource(R.string.explore_help), testTag = (EXPLORE / "help").tag)
            }
        }
    }
}

/** Explore at rest (Explore.md:3): the Sky's card, the door into Your topics, then Recent. No pull-down. */
@Composable
private fun AtRest(state: ExploreUiState, list: LazyListState, doors: ExploreDoors, actions: ExploreActions) {
    LazyColumn(state = list, modifier = Modifier.fillMaxSize().testTag("explore_rest")) {
        item(key = "sky") { SkyCard() }
        // NO DOOR FOR A GUEST (Explore.md:37): no guest can hold a topic.
        if (state.resolved && !state.guest) {
            item(key = "topics") {
                val topics = EXPLORE / "topics"
                val held = state.heldCount?.let { stringResource(R.string.explore_topics_held, it) }
                ContentRow(
                    title = stringResource(R.string.explore_topics),
                    disc = ContentRowDisc.Letter("#", loud = true),
                    testTag = topics.tag,
                    second = if (held != null) {
                        { ContentRowDoorSecond(held) }
                    } else {
                        null
                    },
                    onOpen = doors.onOpenYourTopics,
                    node = topics,
                    chevron = true,
                    modifier = Modifier.padding(start = Space.x6, end = Space.x6, bottom = Space.x2),
                )
            }
        }
        if (state.recents.isNotEmpty()) {
            item(key = "recentLabel") {
                SectionLabel(stringResource(R.string.explore_recent), node = EXPLORE / "recentLabel")
            }
            state.recents.forEach { recent ->
                item(key = "recent-$recent") { RecentRow(recent) { actions.onRecent(recent) } }
            }
        }
    }
}

/**
 * The Sky, announced (Explore.md:5): it opens nothing. `Card` on `surface-card`
 * at the medium radius, its field bleeding the card's padding at the top and
 * sides (Explore.jsx), then the title and the line 12 apart, 16 in.
 */
@Composable
private fun SkyCard() {
    val sky = EXPLORE / "skyCard"
    Column(
        modifier = Modifier
            .padding(bottom = Space.x2)
            .fillMaxWidth()
            .clip(RoundedCornerShape(CARD_RADIUS))
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .dataNode(sky),
    ) {
        SkyField(Modifier.dataNode(sky / "field"))
        Column(
            modifier = Modifier.padding(start = Space.x4, end = Space.x4, top = Space.x3, bottom = Space.x4),
            verticalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            Text(
                text = stringResource(R.string.explore_sky_title),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.semantics { heading() }.dataNode(sky / "title"),
            )
            Text(
                text = stringResource(R.string.explore_sky_description),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.dataNode(sky / "description"),
            )
        }
    }
}

/** `--radius-medium`. */
private val CARD_RADIUS = 12.dp

/** A recent query (`RecentRow`): min 48, `0 24`, 12 between, the search glyph 18 and the query body-medium. */
@Composable
private fun RecentRow(query: String, onTap: () -> Unit) {
    val row = (EXPLORE / "recent").keyed(recentNodeKey(query))
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = Layout.TouchTargetMin)
            .clickable(onClick = onTap)
            .dataNode(row)
            .padding(horizontal = Space.x6),
    ) {
        Icon(
            Icons.Filled.Search,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(18.dp).dataNode(EXPLORE / "recent" / "glyph"),
        )
        Text(
            text = query,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.dataNode(EXPLORE / "recent" / "query"),
        )
    }
}

/**
 * The Sky, teased (`_shared.jsx` `SkyField`): token roles only — `outline`
 * far, `primaryContainer` near, `primary` the most-weighted point — on the
 * hairline's edges, 180 tall, sliced to the card's width on its 358 box.
 */
@Composable
private fun SkyField(modifier: Modifier = Modifier) {
    val hairline = MaterialTheme.colorScheme.outlineVariant
    val near = MaterialTheme.colorScheme.primaryContainer
    val most = MaterialTheme.colorScheme.primary
    val far = MaterialTheme.colorScheme.outline
    Canvas(modifier.fillMaxWidth().height(SKY_HEIGHT)) {
        // `xMidYMid slice` on a 358 × 180 box: scale to cover, centred.
        val scale = maxOf(size.width / SKY_BOX_WIDTH, size.height / SKY_BOX_HEIGHT)
        val dx = (size.width - SKY_BOX_WIDTH * scale) / 2f
        val dy = (size.height - SKY_BOX_HEIGHT * scale) / 2f
        fun at(x: Float, fraction: Float) = Offset(dx + x * scale, dy + SKY_BOX_HEIGHT * fraction * scale)
        val stroke = 1.dp.toPx()
        drawLine(hairline, at(40f, 0.55f), at(140f, 0.3f), stroke)
        drawLine(hairline, at(140f, 0.3f), at(230f, 0.62f), stroke)
        drawLine(hairline, at(230f, 0.62f), at(318f, 0.38f), stroke)
        drawLine(hairline, at(140f, 0.3f), at(196f, 0.14f), stroke)
        drawCircle(near, 7f * scale, at(40f, 0.55f))
        drawCircle(most, 12f * scale, at(140f, 0.3f))
        drawCircle(far, 4f * scale, at(196f, 0.14f))
        drawCircle(near, 9f * scale, at(230f, 0.62f))
        drawCircle(near, 6f * scale, at(318f, 0.38f))
        drawCircle(far, 3f * scale, at(286f, 0.78f))
        drawCircle(far, 4f * scale, at(90f, 0.82f))
    }
}

private val SKY_HEIGHT = 180.dp
private const val SKY_BOX_WIDTH = 358f
private const val SKY_BOX_HEIGHT = 180f

/** The searching view's results, top to bottom, under the pull-down (Explore.md:45). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Results(
    state: ExploreUiState,
    list: LazyListState,
    doors: ExploreDoors,
    actions: ExploreActions,
    now: Instant,
) {
    val results = state.results
    val items = remember(results, state.guest, state.reader, now) {
        results?.let {
            layoutResults(
                hits = it.hits,
                kinds = it.filter.kinds,
                hasMorePeople = it.hasMorePeople,
                context = ResultsContext(
                    query = it.query,
                    reader = state.reader,
                    order = if (state.guest) SearchOrder.NEWEST else it.filter.order,
                    now = now,
                ),
            )
        }.orEmpty()
    }
    val rowCount = items.count { it is ResultItem.Row }
    val asked = state.query.trim()
    val unscopedLine = results != null && unscopedComments(results.query, results.filter.kinds)
    val nothing = results != null && results.hits.isEmpty() && !state.failed && results.query == asked &&
        !state.pending && !unscopedLine
    LoadNextAtTheTail(list, rowCount, results?.hasNextPage == true && !state.moreFailed, actions.onLoadMore)
    PullToRefreshBox(
        isRefreshing = state.refreshing,
        onRefresh = actions.onPull,
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(state = list, modifier = Modifier.fillMaxSize().testTag("explore_results")) {
            if (state.slow && state.pending) {
                item(key = "loading") {
                    LoadingState("explore_loading", Modifier.padding(horizontal = Space.x6, vertical = Space.x2))
                }
            }
            if (state.failed && !state.pending) {
                item(key = "failed") {
                    if (rowCount > 0) {
                        FaultLine(stringResource(R.string.explore_couldnt_load_more), "explore_refine_failed") {
                            actions.onRetry()
                        }
                    } else {
                        HouseFault(actions.onRetry)
                    }
                }
            }
            if (state.rowsShown) {
                items.forEach { item -> resultItem(item, doors, actions) }
                if (unscopedLine) item(key = "unscoped") { ResultsLine(stringResource(R.string.explore_unscoped)) }
                if (nothing) item(key = "none") { ResultsLine(stringResource(R.string.explore_none)) }
            }
            if (state.moreFailed) {
                item(key = "moreFailed") {
                    FaultLine(stringResource(R.string.explore_couldnt_load_more), "explore_more_failed") {
                        actions.onRetryMore()
                    }
                }
            }
            if (state.loadingMore) {
                item(key = "loadingMore") {
                    LoadingState("explore_loading_more", Modifier.padding(horizontal = Space.x6, vertical = Space.x3))
                }
            }
        }
    }
}

/** One item of the results region. */
private fun LazyListScope.resultItem(item: ResultItem, doors: ExploreDoors, actions: ExploreActions) {
    when (item) {
        ResultItem.ProfilesLabel -> item(key = "profilesLabel") {
            SectionLabel(stringResource(R.string.explore_profiles), node = EXPLORE / "profilesLabel")
        }
        ResultItem.ProfilesDoor -> item(key = "profilesDoor") {
            // `Button variant="text" size="sm"` on its own line, `0 8 8` (ExplorePerson.jsx).
            Row(Modifier.padding(start = Space.x2, end = Space.x2, bottom = Space.x2)) {
                CograButton(
                    text = stringResource(R.string.explore_see_all_profiles),
                    onClick = actions.onAllProfiles,
                    kind = ButtonKind.Text,
                    size = ButtonSize.Compact,
                    testTag = (EXPLORE / "profilesDoor").tag,
                )
            }
        }
        is ResultItem.Seam -> item(key = "seam-${item.section}") {
            // The registry names the seam unkeyed (nodes.json `explore.seam`); each section stands its own.
            Seam(stringResource(R.string.explore_seam), node = EXPLORE / "seam")
        }
        is ResultItem.Row -> item(key = "row-${item.kind}-${item.id}") {
            ReferenceRow(
                kind = item.kind.mark(),
                name = item.name,
                sub = item.sub?.let { subWords(it) },
                src = item.src,
                edge = item.rank?.let(RowEdge::Rank) ?: item.value?.let(RowEdge::Value),
                onOpen = item.door?.let { door ->
                    {
                        // Opening a result writes the query into the recents (Explore.md:23).
                        actions.onOpenResult()
                        door.open(doors)
                    }
                },
                node = (EXPLORE / "result").keyed(item.position.toString()),
            )
        }
    }
}

private fun ResultKind.mark(): MarkKind = when (this) {
    ResultKind.POST -> MarkKind.POST
    ResultKind.COMMENT -> MarkKind.COMMENT
    ResultKind.PERSON -> MarkKind.PERSON
    ResultKind.TOPIC -> MarkKind.TOPIC
}

private fun ResultDoor.open(doors: ExploreDoors) = when (this) {
    is ResultDoor.Post -> doors.onOpenPost(postId)
    is ResultDoor.Comment -> doors.onOpenComment(postId, commentId)
    is ResultDoor.Person -> if (own) doors.onOpenOwnProfile() else doors.onOpenPerson(handle)
    is ResultDoor.Topic -> doors.onOpenTopic(name)
}

@Composable
private fun subWords(sub: ResultSub): String = when (sub) {
    is ResultSub.On -> stringResource(R.string.explore_sub_on, sub.title)
    is ResultSub.TaggedBy -> stringResource(R.string.explore_sub_tagged_by, sub.handle)
    is ResultSub.Handle -> stringResource(R.string.explore_sub_handle, sub.handle)
}

/** The results' own line where rows would stand, or after the last row (`explore.empty`, `8 24`). */
@Composable
private fun ResultsLine(text: String) {
    EmptyState(
        testTag = (EXPLORE / "empty").tag,
        title = text,
        registered = true,
        modifier = Modifier.padding(horizontal = Space.x6, vertical = Space.x2),
    )
}

/** `Couldn't load more` with Retry: a failed refine at the rows' head, a failed page at their tail. */
@Composable
private fun FaultLine(text: String, testTag: String, onRetry: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
        modifier = Modifier
            .padding(horizontal = Space.x6, vertical = Space.x1)
            .semantics { liveRegion = LiveRegionMode.Polite },
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag(testTag),
        )
        CograButton(
            text = stringResource(R.string.explore_retry),
            onClick = onRetry,
            kind = ButtonKind.Text,
            size = ButtonSize.Compact,
            testTag = "${testTag}_retry",
        )
    }
}

/** A read with nothing loaded: the house line with Retry in the results' place (ExploreSearch.md:61). */
@Composable
private fun HouseFault(onRetry: () -> Unit) {
    EmptyState(
        testTag = "explore_transport_error",
        title = stringResource(R.string.explore_cant_reach),
        actionLabel = stringResource(R.string.explore_retry),
        onAction = onRetry,
        modifier = Modifier.padding(horizontal = Space.x6, vertical = Space.x2),
    )
}

/** Asks for the next page as the list nears its tail. */
@Composable
private fun LoadNextAtTheTail(list: LazyListState, rows: Int, more: Boolean, onLoadMore: () -> Unit) {
    val load by rememberUpdatedState(onLoadMore)
    val wanted by rememberUpdatedState(more)
    LaunchedEffect(list, rows) {
        snapshotFlow { list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1 }
            .collect { last ->
                if (wanted && rows > 0 && last >= list.layoutInfo.totalItemsCount - TAIL_DISTANCE) load()
            }
    }
}

/** How close to the tail the next page is asked for. */
private const val TAIL_DISTANCE = 5

/**
 * THE SEARCH FILTER SHEET (ExploreFilter.md; ExploreFilter.jsx). It STAGES on a
 * copy taken as it opens: a chip, an order or the seen toggle changes only the
 * copy and nothing behind moves (:25-29); Reset stages the default and asks
 * nothing (:31); Done closes and re-queries once (:33); the scrim, a swipe
 * down and Back drop what is staged (:35-37). A guest gets no Order section —
 * no viewpoint to rank from, no seen-list (ExploreFilter.md:41).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ExploreFilterSheet(
    committed: SearchFilter,
    default: SearchFilter,
    guest: Boolean,
    onHelp: () -> Unit,
    onDone: (SearchFilter) -> Unit,
    onDismiss: () -> Unit,
) {
    var staged by remember { mutableStateOf(committed) }
    val sheet = EXPLORE / "filterSheet"
    CograSheetHost(onDismissRequest = onDismiss) {
        Box {
            CograSheetSurface(testTag = sheet.tag, handleTestTag = (sheet / "dragHandle").tag, gap = 0.dp) {
                SheetTitle(
                    text = stringResource(R.string.explore_filter_purpose),
                    modifier = Modifier.padding(bottom = Space.x2).dataNode(sheet / "title"),
                )
                FilterSection(
                    label = stringResource(R.string.explore_kinds),
                    hint = stringResource(R.string.explore_kinds_hint),
                    node = sheet / "kinds",
                ) {
                    SEARCH_KINDS.forEach { kind ->
                        CograChip(
                            label = kindLabel(kind),
                            selected = kind in staged.kinds,
                            onClick = { staged = staged.toggle(kind) },
                            testTag = (sheet / "kinds" / "${kind.chipValue()}Chip").tag,
                        )
                    }
                }
                if (!guest) OrderSection(staged, onStage = { staged = it }, node = sheet / "order")
                FilterFoot(
                    resetLabel = stringResource(R.string.explore_reset),
                    doneLabel = stringResource(R.string.explore_done),
                    onReset = { staged = default },
                    onDone = { onDone(staged) },
                    node = sheet / "foot",
                )
            }
            // THE "?" RIDES THE SHEET'S CORNER (ExploreFilter.jsx: absolute at `--space-1` / `--space-2`).
            HelpDot(
                onHelp,
                stringResource(R.string.explore_filter_help),
                modifier = Modifier.align(Alignment.TopEnd).padding(top = Space.x1, end = Space.x2),
                testTag = (sheet / "help").tag,
            )
        }
    }
}

/** `OrderSection`: the feed's own — Ranked or Newest, and Show what you've already seen under it. */
@Composable
private fun OrderSection(staged: SearchFilter, onStage: (SearchFilter) -> Unit, node: DataNode) {
    FilterSection(
        label = stringResource(R.string.explore_order),
        hint = stringResource(R.string.explore_order_hint),
        node = node,
    ) {
        SegmentedFilter(
            options = listOf(
                SegmentedOption(SearchOrder.RANKED, stringResource(R.string.explore_order_ranked), "rankedOption"),
                SegmentedOption(SearchOrder.NEWEST, stringResource(R.string.explore_order_newest), "newestOption"),
            ),
            selected = staged.order,
            onSelect = { onStage(staged.copy(order = it)) },
            ariaLabel = stringResource(R.string.explore_order),
            node = node / "picker",
        )
        val seen = node / "seen"
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x3),
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = Layout.TouchTargetMin)
                .toggleable(
                    value = staged.seen,
                    role = Role.Checkbox,
                    onValueChange = { onStage(staged.copy(seen = it)) },
                )
                .dataNode(seen),
        ) {
            Checkbox(checked = staged.seen, onCheckedChange = null, modifier = Modifier.dataNode(seen / "box"))
            Text(
                text = stringResource(R.string.explore_seen),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.dataNode(seen / "label"),
            )
        }
    }
}

/** The trigger's words: the kinds' head, then each deviation, joined ` · ` (copy-voice, the filter's state words). */
@Composable
internal fun readingWords(reading: SearchFilterReading): String {
    val head = when (val kinds = reading.head) {
        KindsHead.Everything -> stringResource(R.string.explore_everything)
        KindsHead.All -> stringResource(R.string.explore_all_kinds)
        is KindsHead.One -> kindLabel(kinds.kind)
        is KindsHead.Some -> stringResource(R.string.explore_some_kinds, kinds.count)
    }
    val order = reading.order?.let {
        stringResource(
            if (it == SearchOrder.NEWEST) R.string.explore_reading_newest else R.string.explore_reading_ranked,
        )
    }
    val seen = reading.seen?.let {
        stringResource(if (it) R.string.explore_reading_showing_seen else R.string.explore_reading_hiding_seen)
    }
    return listOfNotNull(head, order, seen).joinToString(" · ")
}

@Composable
private fun kindLabel(kind: FeedKind): String = stringResource(
    when (kind) {
        FeedKind.POST -> R.string.explore_kind_posts
        FeedKind.COMMENT -> R.string.explore_kind_comments
        FeedKind.PROFILE -> R.string.explore_kind_profiles
        FeedKind.TAG -> R.string.explore_kind_tags
    },
)

/** The chip's registered value (`FEED_KINDS`: `posts`, `comments`, `profiles`, `topics`). */
private fun FeedKind.chipValue(): String = when (this) {
    FeedKind.POST -> "posts"
    FeedKind.COMMENT -> "comments"
    FeedKind.PROFILE -> "profiles"
    FeedKind.TAG -> "topics"
}
