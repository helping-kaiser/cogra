package com.cogra.core.designsystem

import androidx.compose.foundation.lazy.LazyListLayoutInfo
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.flow.distinctUntilChanged

/**
 * THE SEEN RULE AT A LIST: a list card is seen the first time it stands
 * FULLY inside the list's viewport (History.md "a content joins History
 * the first time it was fully in the viewport"; HistoryEmpty.md "NEVER the
 * reader has to act for it") — or, for a card TALLER than the viewport,
 * once both its edges have been on screen (History.md:13, below).
 *
 * **What the viewport is.** The list's own, as its layout reports it:
 * `LazyListLayoutInfo.viewportStartOffset` to `viewportEndOffset`, the
 * span the list draws into, its content padding included — padding is
 * drawn area, and a card scrolled into it is on screen. Chrome outside the
 * list (the top bar, the bottom bar) is outside the viewport by
 * construction, because the scaffold sizes the list between them; the
 * collapsing top bar resizes the list as it moves, so the viewport follows
 * it.
 *
 * **What is reported.** The card's own node and nothing inside it: the
 * screen maps each item key to the id of the post or comment the card IS,
 * and to null for every row that is not a card (History.md "only the
 * top-layer content joins History … never its author's avatar or handle,
 * its citations or its tags").
 *
 * **A card taller than the viewport** is never fully inside it, so the
 * whole-card reading never takes it. A second pass over the same
 * `visibleItemsInfo` reports, frame by frame, which of such a card's edges
 * stand on screen ([onEdgesSeen]); the receiver remembers each card's first
 * edge for the session and counts the card seen when the other one arrives
 * — "once both its top and its bottom edge have been on screen, not
 * necessarily at once" (History.md:13). A card that fits has no edges to
 * report: two halves of it seen apart are not a whole view.
 *
 * **What wears no effect.** Page renderings — a post's detail, a tag
 * page's header — and the comments sheet's thread. An opened profile joins
 * History as a page event, not here (`ProfileViewModel`).
 *
 * **When the surface reports.** On every layout the list commits, read
 * through `snapshotFlow` over `layoutInfo` — the documented way to observe
 * a lazy list's visible items (developer.android.com/develop/ui/compose/lists,
 * "React to scroll position"; .../side-effects, `snapshotFlow`). Ids
 * already reported come round again on every frame they stay in view; the
 * receiver is the one that remembers, so this stays stateless.
 *
 * **The checkpoints it raises**, where reading pauses and a batch should
 * go out: the scroll coming to rest, and the list leaving composition (the
 * reader navigated away). The app going to the background is the process
 * lifecycle's checkpoint, not a screen's.
 *
 * @param onEdgesSeen the tall cards with an edge on screen this frame.
 * @param suspended true while a sheet covers the list: a card under a
 *   raised sheet is not on screen (the same reading `ScrollStageHost`'s
 *   suspension gives it), so nothing is reported until the sheet drops.
 */
@Composable
fun SeenCardsEffect(
    listState: LazyListState,
    nodeIdOf: (key: Any) -> String?,
    onSeen: (nodeIds: List<String>) -> Unit,
    onEdgesSeen: (sightings: List<EdgeSighting>) -> Unit,
    onCheckpoint: () -> Unit,
    suspended: Boolean = false,
) {
    val currentNodeIdOf by rememberUpdatedState(nodeIdOf)
    val currentOnSeen by rememberUpdatedState(onSeen)
    val currentOnEdgesSeen by rememberUpdatedState(onEdgesSeen)
    val currentOnCheckpoint by rememberUpdatedState(onCheckpoint)
    val currentSuspended by rememberUpdatedState(suspended)
    LaunchedEffect(listState) {
        var wasScrolling = false
        // One flow for every reading, so a frame's seen cards are handed
        // over BEFORE that same frame's coming to rest raises the
        // checkpoint — the last cards of a scroll ride its own flush.
        snapshotFlow {
            val layout = listState.layoutInfo
            if (currentSuspended) {
                SeenFrame(emptyList(), emptyList(), listState.isScrollInProgress)
            } else {
                SeenFrame(
                    seen = fullySeenKeys(layout).mapNotNull { currentNodeIdOf(it) },
                    edges = tallCardEdges(layout).mapNotNull { (key, top, bottom) ->
                        currentNodeIdOf(key)?.let { EdgeSighting(it, top = top, bottom = bottom) }
                    },
                    scrolling = listState.isScrollInProgress,
                )
            }
        }
            .distinctUntilChanged()
            .collect { frame ->
                if (frame.seen.isNotEmpty()) currentOnSeen(frame.seen)
                if (frame.edges.isNotEmpty()) currentOnEdgesSeen(frame.edges)
                if (wasScrolling && !frame.scrolling) currentOnCheckpoint()
                wasScrolling = frame.scrolling
            }
    }
    DisposableEffect(Unit) {
        onDispose { currentOnCheckpoint() }
    }
}

/**
 * A card taller than the viewport, and which of its edges stand on screen
 * in one frame — at least one of them, never both (a card showing both
 * edges fits the viewport).
 */
@Immutable
data class EdgeSighting(val nodeId: String, val top: Boolean, val bottom: Boolean)

@Immutable
private data class SeenFrame(val seen: List<String>, val edges: List<EdgeSighting>, val scrolling: Boolean)

/** The keys of the items standing fully inside the viewport, in list order. */
internal fun fullySeenKeys(layout: LazyListLayoutInfo): List<Any> {
    val start = layout.viewportStartOffset
    val end = layout.viewportEndOffset
    return layout.visibleItemsInfo
        .filter { isFullyInViewport(it.offset, it.size, start, end) }
        .map { it.key }
}

/** One item's edges on screen, by key. */
internal data class KeyEdges(val key: Any, val top: Boolean, val bottom: Boolean)

/** The items taller than the viewport with an edge on screen, in list order. */
internal fun tallCardEdges(layout: LazyListLayoutInfo): List<KeyEdges> {
    val start = layout.viewportStartOffset
    val end = layout.viewportEndOffset
    return layout.visibleItemsInfo.mapNotNull { item ->
        if (!isTallerThanViewport(item.size, start, end)) return@mapNotNull null
        val top = isTopEdgeOnScreen(item.offset, start, end)
        val bottom = isBottomEdgeOnScreen(item.offset, item.size, start, end)
        if (top || bottom) KeyEdges(item.key, top, bottom) else null
    }
}

/**
 * Whether an item spanning [offset] to `offset + size` lies wholly within
 * [viewportStart]..[viewportEnd] — the coordinates `LazyListLayoutInfo`
 * reports both in. An item taller than the viewport can never pass; its
 * edges decide it instead ([tallCardEdges]). An item of no size shows
 * nothing and is never seen.
 */
internal fun isFullyInViewport(offset: Int, size: Int, viewportStart: Int, viewportEnd: Int): Boolean =
    size > 0 && offset >= viewportStart && offset + size <= viewportEnd

/** Whether an item of [size] is taller than the viewport — the tall-card rule's alone. */
internal fun isTallerThanViewport(size: Int, viewportStart: Int, viewportEnd: Int): Boolean =
    size > viewportEnd - viewportStart

/** Whether the item's first pixel row, at [offset], is inside the viewport. */
internal fun isTopEdgeOnScreen(offset: Int, viewportStart: Int, viewportEnd: Int): Boolean =
    offset >= viewportStart && offset < viewportEnd

/** Whether the item's last pixel row, ending at `offset + size`, is inside the viewport. */
internal fun isBottomEdgeOnScreen(offset: Int, size: Int, viewportStart: Int, viewportEnd: Int): Boolean =
    offset + size > viewportStart && offset + size <= viewportEnd
