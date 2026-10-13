// SAVED — everything the reader kept, in one list (Saved.md, SavedUndo.md,
// SavedEmpty.md; design/designs/canonical/screens/Saved.jsx). Reached from the
// reader's own profile's ⋮. web's twin is `web/src/app/saved/saved-view.tsx`.
//
// ONE MIXED LIST, newest first by when the reader saved each thing, with no
// kind label, filter or heading: the disc says what a row is. Every row
// carries its own Unsave — the filled bookmark, no word on screen, in the
// chevron's slot outboard of the age.
//
// THE LIST IS THE LAST READ WITH THE READER'S OWN ACTS LAID OVER IT
// (`SavedWrites`): an unsave here takes the row out at the tap and Undo puts it
// back in its place; an unsave made inside a page opened from here is gone on
// return, with no snackbar (design digest item 57); a revert brings the row
// back where it stood. A comfort that did not go through says so in the row's
// second line with Retry, the Unsave staying (item 46); a failed Undo's row
// stays on screen carrying that line (item 47).

package com.cogra.feature.saved

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.DynamicFeed
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.core.designsystem.RowLine
import com.cogra.core.designsystem.RowLineState
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.ContentRow
import com.cogra.core.designsystem.v2.atom.ContentRowDisc
import com.cogra.core.designsystem.v2.atom.ContentRowSecond
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.domain.ageLadder
import com.cogra.domain.saved.ComfortKind
import com.cogra.domain.saved.SavedDisc
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedOverlay
import com.cogra.domain.saved.SavedTarget
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.saved.savedRow
import java.time.Instant

private val SAVED = DataNode("saved")

@Composable
fun SavedRoute(
    onBack: () -> Unit,
    onOpen: (SavedTarget) -> Unit,
    viewModel: SavedViewModel = androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    SavedScreen(
        state = state,
        writes = viewModel.writes,
        onRefresh = viewModel::refresh,
        onLoadMore = viewModel::loadMore,
        onBack = onBack,
        onOpen = onOpen,
    )
}

/** Rows on screen: what the reader has not dropped, plus a failed Undo's row, which stays with its line. */
fun visibleEntries(entries: List<SavedEntry>, overlay: SavedOverlay): List<SavedEntry> =
    entries.filter { overlay.kept(it.id, it.bookmarkedAt) != null || overlay.failure(it.id) == ComfortKind.RESTORE }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SavedScreen(
    state: SavedUiState,
    writes: SavedWrites?,
    onRefresh: () -> Unit,
    onLoadMore: () -> Unit,
    onBack: () -> Unit,
    onOpen: (SavedTarget) -> Unit,
    now: Instant = Instant.now(),
) {
    val overlay = writes.overlayState()
    val host = LocalSnackbarHostState.current
    val snackbar = rememberSavedSnackbar(host, SAVED / "snackbar")
    ClearSnackbarOnRevert(writes, host)
    val visible = visibleEntries(state.entries, overlay)
    val list = rememberLazyListState()
    // FOCUS AFTER A ROW REMOVES ITSELF (Saved.md; the K13 focus law): the next
    // row, else the previous, else the empty state.
    val focus = remember { mutableMapOf<String, FocusRequester>() }
    val emptyFocus = remember { FocusRequester() }
    var focusAfter by remember { mutableStateOf<Pair<String?, String?>?>(null) }
    LaunchedEffect(focusAfter, visible.size) {
        val after = focusAfter ?: return@LaunchedEffect
        focusAfter = null
        val target = after.first?.let(focus::get) ?: after.second?.let(focus::get)
        runCatching { (target ?: emptyFocus).requestFocus() }
    }
    LoadNextAtTheTail(list, state, visible.size, onLoadMore)
    Column(Modifier.fillMaxSize().dataNodeSurface()) {
        PageHeader(
            title = stringResource(R.string.saved_title),
            onBack = onBack,
            backContentDescription = stringResource(R.string.saved_back),
            node = SAVED / "header",
        )
        PullToRefreshBox(
            isRefreshing = state.loading && state.entries.isNotEmpty(),
            onRefresh = onRefresh,
            modifier = Modifier.fillMaxSize(),
        ) {
            when {
                state.loading && state.entries.isEmpty() -> Text(
                    stringResource(com.cogra.core.designsystem.R.string.loading_state),
                    modifier = Modifier.padding(16.dp).testTag("saved_loading"),
                )

                state.failed && state.entries.isEmpty() -> SavedLoadFailed(onRefresh)

                visible.isEmpty() && !state.hasNextPage -> SavedEmpty(emptyFocus)

                else -> SavedList(
                    list = list,
                    visible = visible,
                    overlay = overlay,
                    writes = writes,
                    now = now,
                    moreFailed = state.moreFailed,
                    requester = { id -> focus.getOrPut(id) { FocusRequester() } },
                    onOpen = onOpen,
                    onLoadMore = onLoadMore,
                    onUnsave = { index, entry ->
                        focusAfter = visible.getOrNull(index + 1)?.id to visible.getOrNull(index - 1)?.id
                        snackbar.unsave(writes, overlay, entry)
                    },
                )
            }
        }
    }
}

/** THE NEXT PAGE ARRIVES BECAUSE THE READER KEPT GOING (readme §13): asked a few rows short of the end. */
@Composable
private fun LoadNextAtTheTail(list: LazyListState, state: SavedUiState, rows: Int, onLoadMore: () -> Unit) {
    LaunchedEffect(list, state.hasNextPage, state.moreFailed) {
        snapshotFlow { list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1 }
            .collect { last ->
                val nearEnd = last >= rows - TAIL_DISTANCE
                if (state.hasNextPage && !state.moreFailed && nearEnd) onLoadMore()
            }
    }
}

@Composable
private fun SavedList(
    list: LazyListState,
    visible: List<SavedEntry>,
    overlay: SavedOverlay,
    writes: SavedWrites?,
    now: Instant,
    moreFailed: Boolean,
    requester: (String) -> FocusRequester,
    onOpen: (SavedTarget) -> Unit,
    onLoadMore: () -> Unit,
    onUnsave: (Int, SavedEntry) -> Unit,
) {
    LazyColumn(
        state = list,
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxSize().dataNode(SAVED / "list"),
    ) {
        itemsIndexed(visible, key = { _, entry -> entry.id }) { index, entry ->
            SavedEntryRow(
                entry = entry,
                overlay = overlay,
                writes = writes,
                now = now,
                requester = requester(entry.id),
                onOpen = onOpen,
                onUnsave = { onUnsave(index, entry) },
            )
        }
        if (moreFailed) {
            item(key = "more-failed") { SavedMoreFailed(onLoadMore) }
        }
    }
}

/** Takes the row out at the tap and offers Undo, which puts it back where it stood. */
private fun SavedSnackbar.unsave(writes: SavedWrites?, overlay: SavedOverlay, entry: SavedEntry) {
    if (writes == null) return
    val kept = overlay.kept(entry.id, entry.bookmarkedAt)
    writes.drop(entry.id, entry.bookmarkedAt)
    removed(entry.id) { writes.keep(entry.id, null, kept ?: entry.bookmarkedAt, ComfortKind.RESTORE) }
}

@Composable
private fun SavedEntryRow(
    entry: SavedEntry,
    overlay: SavedOverlay,
    writes: SavedWrites?,
    now: Instant,
    requester: FocusRequester,
    onOpen: (SavedTarget) -> Unit,
    onUnsave: () -> Unit,
) {
    val row = savedRow(entry.node)
    val failure = overlay.failure(entry.id)
    val unsaveLabel = stringResource(R.string.saved_unsave, row.name)
    ContentRow(
        title = row.title,
        titleAside = row.aside,
        titleQuiet = row.titleQuiet,
        disc = row.disc.toContentRowDisc(),
        // A FAILED COMFORT TAKES THE SECOND LINE'S SLOT (item 46).
        second = when {
            failure != null && writes != null -> {
                {
                    RowLine(RowLineState.DidntGoThrough { writes.retry(entry.id) }, "saved_row_line_${entry.id}")
                }
            }

            row.second != null -> {
                { ContentRowSecond(row.second.orEmpty()) }
            }

            else -> null
        },
        trailing = ageLadder(entry.bookmarkedAt, now),
        onOpen = { onOpen(row.target) },
        node = (SAVED / "list" / "entry").keyed(row.key),
        testTag = "saved_entry_${entry.id}",
        modifier = Modifier.focusRequester(requester),
        action = {
            IconButton(
                onClick = onUnsave,
                modifier = Modifier
                    .size(40.dp)
                    .testTag("saved_unsave_${entry.id}")
                    .semantics { contentDescription = unsaveLabel },
            ) {
                Icon(Icons.Filled.Bookmark, contentDescription = null, modifier = Modifier.size(22.dp))
            }
        },
    )
}

@Composable
private fun SavedLoadFailed(onRefresh: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(16.dp)) {
        Text(
            stringResource(R.string.saved_load_failed),
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.weight(1f).testTag("saved_transport_error"),
        )
        TextButton(onClick = onRefresh, modifier = Modifier.testTag("saved_retry")) {
            Text(stringResource(R.string.saved_retry))
        }
    }
}

/** SAVEDEMPTY: words only — no action, no error colour, and the save named in words, never drawn as its glyph. */
@Composable
private fun SavedEmpty(focus: FocusRequester) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp).dataNode(SAVED / "empty")) {
        Text(
            stringResource(R.string.saved_empty),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .padding(vertical = 8.dp)
                .dataNode(SAVED / "empty" / "title")
                .focusRequester(focus)
                .focusable(),
        )
    }
}

@Composable
private fun SavedMoreFailed(onLoadMore: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            stringResource(R.string.saved_more_failed),
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag("saved_more_failed"),
        )
        TextButton(onClick = onLoadMore, modifier = Modifier.testTag("saved_more_retry")) {
            Text(stringResource(R.string.saved_retry))
        }
    }
}

/** How close to the end of the list the next page is asked for. */
private const val TAIL_DISTANCE = 5

private fun SavedDisc.toContentRowDisc(): ContentRowDisc = when (this) {
    is SavedDisc.Glyph -> ContentRowDisc.Glyph(if (comment) Icons.Filled.ChatBubble else Icons.Filled.DynamicFeed)
    is SavedDisc.Picture -> ContentRowDisc.Picture(url, name)
    is SavedDisc.Monogram -> ContentRowDisc.Monogram(name)
    SavedDisc.Redacted -> ContentRowDisc.Redacted
}
