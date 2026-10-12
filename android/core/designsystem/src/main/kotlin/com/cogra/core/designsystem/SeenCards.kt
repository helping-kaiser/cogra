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
 * THE SEEN RULE, AS H1 BUILDS IT: a list card is seen the first time it
 * stands FULLY inside the list's viewport (History.md "a content joins
 * History the first time it was fully in the viewport"; HistoryEmpty.md
 * "NEVER the reader has to act for it").
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
 * **What H1 leaves out, on purpose (history packet HG-1, HG-2):**
 * - A card TALLER than the viewport is never fully inside it, so it never
 *   fires. That is the tall-card rule's branch, held until it is ruled;
 *   building it means remembering, per key, that the card's top edge and
 *   its bottom edge have each been inside the viewport at some point
 *   (the two need not be at once), and reporting the card when the second
 *   one arrives.
 * - Page renderings — a post's detail, a profile's header, a tag page's
 *   header — are not list cards and wear no effect.
 * - The comments sheet's thread wears no effect either.
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
 * @param suspended true while a sheet covers the list: a card under a
 *   raised sheet is not on screen (the same reading `ScrollStageHost`'s
 *   suspension gives it), so nothing is reported until the sheet drops.
 */
@Composable
fun SeenCardsEffect(
    listState: LazyListState,
    nodeIdOf: (key: Any) -> String?,
    onSeen: (nodeIds: List<String>) -> Unit,
    onCheckpoint: () -> Unit,
    suspended: Boolean = false,
) {
    val currentNodeIdOf by rememberUpdatedState(nodeIdOf)
    val currentOnSeen by rememberUpdatedState(onSeen)
    val currentOnCheckpoint by rememberUpdatedState(onCheckpoint)
    val currentSuspended by rememberUpdatedState(suspended)
    LaunchedEffect(listState) {
        var wasScrolling = false
        // One flow for both readings, so a frame's seen cards are handed
        // over BEFORE that same frame's coming to rest raises the
        // checkpoint — the last cards of a scroll ride its own flush.
        snapshotFlow {
            val seen = if (currentSuspended) {
                emptyList()
            } else {
                fullySeenKeys(listState.layoutInfo).mapNotNull { currentNodeIdOf(it) }
            }
            SeenFrame(seen, listState.isScrollInProgress)
        }
            .distinctUntilChanged()
            .collect { frame ->
                if (frame.seen.isNotEmpty()) currentOnSeen(frame.seen)
                if (wasScrolling && !frame.scrolling) currentOnCheckpoint()
                wasScrolling = frame.scrolling
            }
    }
    DisposableEffect(Unit) {
        onDispose { currentOnCheckpoint() }
    }
}

@Immutable
private data class SeenFrame(val seen: List<String>, val scrolling: Boolean)

/** The keys of the items standing fully inside the viewport, in list order. */
internal fun fullySeenKeys(layout: LazyListLayoutInfo): List<Any> {
    val start = layout.viewportStartOffset
    val end = layout.viewportEndOffset
    return layout.visibleItemsInfo
        .filter { isFullyInViewport(it.offset, it.size, start, end) }
        .map { it.key }
}

/**
 * Whether an item spanning [offset] to `offset + size` lies wholly within
 * [viewportStart]..[viewportEnd] — the coordinates `LazyListLayoutInfo`
 * reports both in. An item taller than the viewport can never pass, which
 * is H1's tall-card boundary (see [SeenCardsEffect]); an item of no size
 * shows nothing and is never seen.
 */
internal fun isFullyInViewport(offset: Int, size: Int, viewportStart: Int, viewportEnd: Int): Boolean =
    size > 0 && offset >= viewportStart && offset + size <= viewportEnd
