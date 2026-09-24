package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.node.GlobalPositionAwareModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.platform.InspectorInfo

/**
 * THE STAGE LAW (jakob 2026-09-23 — `design/readme.md`, "The feed-video
 * rulings"; the docblock of `design/components/media/MediaAttachment.jsx`):
 * which of a scroll surface's clips is the one playing.
 *
 * Each scroll surface has **one stage**, and a post's clip and a comment's
 * clip compete for the same one. In order:
 *
 * - **(a) Incumbency.** The clip on stage keeps it for as long as it stays
 *   past the 70% gate. Nothing takes the stage from a clip that still
 *   qualifies: a second clip scrolling into view changes nothing, and
 *   scrolling back up past a playing clip never ricochets playback to the
 *   one above.
 * - **(b) Instant succession.** The moment the incumbent falls below the
 *   gate — or leaves the list outright — the stage is re-decided, mid-scroll
 *   with the finger still down. Nothing waits for the scroll to settle:
 *   jakob rejected the settle-deferral Toro and its descendants use, because
 *   "users are not used to even stop scrolling anymore".
 * - **(c) Topmost when empty.** An empty stage goes to the topmost
 *   qualifying clip in list order. No most-visible arithmetic.
 * - **(d) Nothing qualifies, nothing plays** until something does.
 *
 * A fling needs no clause of its own: incumbents succeed each other faster
 * than playback can start, and a clip that leaves before painting never
 * leaves its still face.
 *
 * **What this decides, and what it does not.** The election says which clip
 * is *entitled* to play. Playing it is still [VideoStage]'s business: the
 * elected frame composes a [VideoPlayer], whose surface claims the one
 * player, and the frame it replaced surrenders. The two are layered on
 * purpose — the stage has one player for the whole app and cannot tell a
 * feed card from a comment, while this has one decision per scroll surface
 * and knows nothing about players.
 */
internal object StageElection {

    /**
     * How much of a clip has to be on screen before it may play — the 70%
     * gate (`design/readme.md` §13, the video conform round).
     *
     * High rather than a bare majority: two clips can be on screen at once
     * on a tall display, and the bar for "the reader is looking at this one"
     * has to be more than half a card.
     */
    const val GATE = 0.7f

    /**
     * Who holds the stage, given who held it and where every clip stands.
     *
     * A pure function of its arguments, so each clause of the law is
     * testable without composing anything.
     *
     * @param incumbent the clip on stage before this decision, or null.
     * @param places every clip on the surface, by its key. A clip that left
     *   the list is simply absent.
     */
    fun <K : Any> elect(incumbent: K?, places: Map<K, StagePlace>): K? {
        // (a) The incumbent keeps the stage while it qualifies.
        if (incumbent != null && places[incumbent]?.qualifies == true) return incumbent
        // (b), (c), (d): otherwise the stage goes to the topmost qualifying
        // clip — decided now, whatever the scroll is doing — or to nobody.
        return places.entries
            .filter { it.value.qualifies }
            .minWithOrNull(compareBy<Map.Entry<K, StagePlace>>({ it.value.top }, { it.value.page }))
            ?.key
    }
}

/**
 * Where one clip stands on its surface, as the last layout pass measured it.
 *
 * @property top the frame's top edge in the window. In a vertical list the
 *   order of the tops IS the list order, nested comment threads included.
 * @property page the frame's page within its gallery: two clips side by side
 *   in one pager share a top, and the gallery's own order ranks them.
 * @property visible how much of the frame is on screen, as a fraction of its
 *   own height.
 * @property row the key of the lazy-list item the frame stands in
 *   ([ScrollStageRow]), or null outside any — the part of the place the list,
 *   not the frame, is the authority on.
 */
@Immutable
internal data class StagePlace(val top: Float, val page: Int, val visible: Float, val row: Any? = null) {
    val qualifies: Boolean get() = visible >= StageElection.GATE
}

/**
 * One scroll surface's stage: the clips on it, and which of them holds it.
 *
 * **Measured every frame, decided once per change.** A clip's place moves on
 * every layout pass while its list scrolls, so it is written into a snapshot
 * map that nothing composes from; the election reads that map through
 * `snapshotFlow`, which runs once the frame's layout has been committed —
 * every clip's place from the same pass, never one fresh beside one stale.
 * Only [holder] is composed from, and it changes only when the stage does,
 * so a scroll recomposes the two frames that swapped and nothing else
 * (developer.android.com/develop/ui/compose/side-effects, `snapshotFlow`).
 *
 * **The list says which rows are there; the frames say where they stand.** A
 * lazy list keeps rows it has just scrolled away composed but UNPLACED, ready
 * to come back, and an unplaced node gets no callback at all — no detach, no
 * reset, no position — so a row flung out in one frame would keep its last
 * place, fully visible, and hold the stage forever. The node-level hook for
 * unplacement (`OnUnplacedModifierNode`) is internal to Compose UI 1.9, and
 * Compose's own `onVisibilityChanged` does not see unplacement either: its
 * rect bookkeeping drops a node only on detach or deactivation. What the
 * platform does document for "which items are showing" is the list's own
 * `LazyListState.layoutInfo` (developer.android.com/develop/ui/compose/lists,
 * "React to scroll position"), rewritten on every measure pass. So when
 * [placedRows] is given, a place counts only while its row is among the rows
 * the list laid out in that same pass; a frame's geometry is always fresh
 * while its row is placed, because a placed row that moves reports again.
 *
 * @param placedRows the keys of the rows the list placed in its latest pass,
 *   read inside the election's snapshot; null for a stage with no list.
 */
@Stable
internal class ScrollStage(private val placedRows: (() -> Set<Any>)? = null) {

    private val places = mutableStateMapOf<Any, StagePlace>()

    /** The key of the clip holding the stage, or null when nothing plays. */
    var holder: Any? by mutableStateOf(null)
        private set

    /** A clip reports where it stands. Called from layout, every frame. */
    fun report(key: Any, place: StagePlace) {
        if (places[key] != place) places[key] = place
    }

    /** A clip left the surface — scrolled out of the list, or gone from it. */
    fun leave(key: Any) {
        places.remove(key)
    }

    /** How much of [key]'s frame was last on screen, for the trace. */
    fun visibleOf(key: Any): Float = places[key]?.visible ?: 0f

    /**
     * A clip's page or row changed without its frame moving — so without a
     * new report — and the place it stands in keeps its geometry.
     */
    fun amend(key: Any, page: Int, row: Any?) {
        val place = places[key] ?: return
        if (place.page != page || place.row != row) places[key] = place.copy(page = page, row = row)
    }

    /** Re-decides the stage every time a clip's place, or the list's rows, change. */
    suspend fun run() {
        snapshotFlow { standing() }.collect { holder = StageElection.elect(holder, it) }
    }

    /** The places that count now: all of them, less those whose row the list did not place. */
    private fun standing(): Map<Any, StagePlace> {
        val rows = placedRows?.invoke() ?: return places.toMap()
        return places.filterValues { it.row == null || it.row in rows }
    }
}

/**
 * The stage of the scroll surface this composition is inside, provided by
 * [ScrollStageHost]. Null outside any: a gallery there is its own surface.
 */
internal val LocalScrollStage = staticCompositionLocalOf<ScrollStage?> { null }

/**
 * The key of the lazy-list row this composition stands in, provided by
 * [ScrollStageRow]. Null outside any.
 */
internal val LocalScrollStageRow = staticCompositionLocalOf<Any?> { null }

/**
 * A stage, and the election that keeps it decided for as long as it is
 * composed. With [list], only clips in the rows it placed may hold it.
 */
@Composable
internal fun rememberScrollStage(list: LazyListState? = null): ScrollStage {
    val stage = remember(list) {
        ScrollStage(list?.let { { it.layoutInfo.visibleItemsInfo.mapTo(HashSet()) { item -> item.key } } })
    }
    LaunchedEffect(stage) { stage.run() }
    return stage
}

/**
 * Gives a scroll surface its one stage: every clip composed inside [content]
 * competes for it, and none outside does.
 *
 * Wrap the scrolling list itself, handing over its [list] state, and wrap each
 * row that can hold a clip in a [ScrollStageRow] under the row's own key — the
 * list's layout is what says which of those rows are still on screen. A sheet
 * raised over a list is a surface of its own and hosts its own — a comment
 * thread over the feed does not share the feed's stage — while a post's clips
 * and a comment's clips inside one list do share it, which is the law's "the
 * same one".
 */
@Composable
fun ScrollStageHost(list: LazyListState, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalScrollStage provides rememberScrollStage(list), content = content)
}

/**
 * One row of a [ScrollStageHost]'s list, under the same [key] the row was
 * given in the list (`items(..., key = ...)`): a clip inside it counts for the
 * stage only while the list has this row placed.
 */
@Composable
fun ScrollStageRow(key: Any, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalScrollStageRow provides key, content = content)
}

/**
 * Puts this frame on [stage] under [key]: its place after every layout pass
 * that moves it, and its departure when it leaves the composition.
 *
 * Measured through layout rather than a scroll listener: `boundsInWindow` is
 * already clipped to what is on screen, so its height against the frame's own
 * is the fraction showing, and `positionInWindow` is where the frame starts
 * whether or not it is clipped.
 *
 * A row the list stops placing without disposing it is not this node's to
 * notice — it gets no callback — and is answered by the list's own layout
 * through [row] ([ScrollStage]).
 */
internal fun Modifier.standOn(stage: ScrollStage, key: Any, page: Int, row: Any?): Modifier =
    this then StandOnElement(stage, key, page, row)

private data class StandOnElement(val stage: ScrollStage, val key: Any, val page: Int, val row: Any?) :
    ModifierNodeElement<StandOnNode>() {
    override fun create() = StandOnNode(stage, key, page, row)

    override fun update(node: StandOnNode) {
        if (node.stage !== stage || node.key !== key) node.leave()
        node.stage = stage
        node.key = key
        node.page = page
        node.row = row
        stage.amend(key, page, row)
    }

    override fun InspectorInfo.inspectableProperties() {
        name = "standOn"
        properties["page"] = page
        properties["row"] = row
    }
}

private class StandOnNode(var stage: ScrollStage, var key: Any, var page: Int, var row: Any?) :
    Modifier.Node(),
    GlobalPositionAwareModifierNode {

    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        val height = coordinates.size.height
        val visible = if (height == 0) {
            0f
        } else {
            (coordinates.boundsInWindow().height / height.toFloat()).coerceIn(0f, 1f)
        }
        stage.report(key, StagePlace(top = coordinates.positionInWindow().y, page = page, visible = visible, row = row))
    }

    override fun onDetach() = leave()

    fun leave() = stage.leave(key)
}
