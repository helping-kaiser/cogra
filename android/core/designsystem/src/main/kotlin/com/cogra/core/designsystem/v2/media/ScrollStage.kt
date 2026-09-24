package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
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
 * **A veiled clip is out of the rotation** (jakob 2026-09-24, backlog item
 * 103: "the sensitive veil covers its clip the same way" a sheet covers a
 * surface). It never qualifies, however much of it shows, so it is never
 * elected and an incumbent the veil falls over surrenders by clause (b). **The
 * unveil re-elects the stage exactly as a sheet's dismissal does** — from an
 * empty stage, the topmost qualifying clip taking it, whoever held it before
 * — so the unveiled clip plays iff it is that clip, with no knob of its own.
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
     * @param liftedBefore the clips whose veil had already lifted at the
     *   previous decision. A clip standing [StageVeil.Lifted] that is not
     *   among them is an unveil since then, and the stage is decided from
     *   empty, as after a sheet's dismissal.
     */
    fun <K : Any> elect(incumbent: K?, places: Map<K, StagePlace>, liftedBefore: Set<K> = emptySet()): K? {
        val unveiled = places.any { (key, place) -> place.veil == StageVeil.Lifted && key !in liftedBefore }
        // (a) The incumbent keeps the stage while it qualifies — unless a veil
        // just lifted, which re-elects the stage from empty.
        if (!unveiled && incumbent != null && places[incumbent]?.qualifies == true) return incumbent
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
 * @property veil where the frame stands with a sensitive veil
 *   ([LocalStageVeil]): a veiled clip never qualifies, however much of it
 *   shows.
 */
@Immutable
internal data class StagePlace(
    val top: Float,
    val page: Int,
    val visible: Float,
    val row: Any? = null,
    val veil: StageVeil = StageVeil.None,
) {
    val qualifies: Boolean get() = veil != StageVeil.Veiled && visible >= StageElection.GATE
}

/**
 * A clip's standing with the sensitive veil, as its stage needs to know it.
 *
 * Three states rather than a flag because the unveil is an event the stage
 * re-elects on, and the two faces of the veil deliver it differently: the
 * post's veil covers its clip in place, so one clip goes from [Veiled] to
 * [Lifted]; the comment's veil REPLACES its body, so the clip first stands on
 * the stage at the reveal, already [Lifted]. Either way the stage meets a
 * [Lifted] clip it had not met lifted before, and that is the unveil.
 */
internal enum class StageVeil {
    /** No veil has covered the clip while it stood here. */
    None,

    /** Under the veil: out of the rotation. */
    Veiled,

    /** Out from under a veil the reader lifted while the clip stood here. */
    Lifted,
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
 * **A sheet over the surface suspends its stage** (jakob 2026-09-24,
 * `design/readme.md`, "The feed-video rulings": "a clip behind a sheet is not
 * on screen in the law's sense"). Visibility is measured in the frame's own
 * window, so a clip under a raised sheet still stands past the gate — the
 * geometry cannot see the sheet, and the surface that raised it has to say so.
 * While [suspended] answers true nobody holds the stage, and that is not a
 * clause of the election but the absence of one: the elected frame drops its
 * player and surrenders it, exactly as when it leaves the gate. When the
 * suspension lifts, the stage is decided afresh from an empty stage — the
 * law's topmost qualifying clip, claiming the player anew.
 *
 * @param placedRows the keys of the rows the list placed in its latest pass,
 *   read inside the election's snapshot; null for a stage with no list.
 * @param suspended whether a sheet covers the surface, read inside the same
 *   snapshot.
 */
@Stable
internal class ScrollStage(
    private val placedRows: (() -> Set<Any>)? = null,
    private val suspended: () -> Boolean = { false },
) {

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
     * A clip's page, row or veil changed without its frame moving — so
     * without a new report — and the place it stands in keeps its geometry.
     */
    fun amend(key: Any, page: Int, row: Any?, veil: StageVeil) {
        val place = places[key] ?: return
        if (place.page != page || place.row != row || place.veil != veil) {
            places[key] = place.copy(page = page, row = row, veil = veil)
        }
    }

    /**
     * Re-decides the stage every time a clip's place, its veil, the list's
     * rows, or the suspension change — and holds nobody while the surface is
     * suspended.
     *
     * Which clips stood lifted is carried from each decision to the next, over
     * every place the stage holds rather than only the rows placed now, so a
     * lifted clip scrolled away and back is not mistaken for a fresh unveil.
     */
    suspend fun run() {
        var liftedBefore = emptySet<Any>()
        snapshotFlow { Standing(if (suspended()) null else standing(), lifted()) }
            .collect { now ->
                holder = now.places?.let { StageElection.elect(holder, it, liftedBefore) }
                liftedBefore = now.lifted
            }
    }

    /** The places that count now: all of them, less those whose row the list did not place. */
    private fun standing(): Map<Any, StagePlace> {
        val rows = placedRows?.invoke() ?: return places.toMap()
        return places.filterValues { it.row == null || it.row in rows }
    }

    /** Every clip on the stage whose veil has lifted, placed or not. */
    private fun lifted(): Set<Any> = places.filterValues { it.veil == StageVeil.Lifted }.keys

    /** One read of the stage for one decision: who counts (null while suspended), and who stood lifted. */
    private data class Standing(val places: Map<Any, StagePlace>?, val lifted: Set<Any>)
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
 * Where this composition stands with a sensitive veil, provided by
 * [SensitiveVeil] and [SensitiveVeilCompact] ([rememberStageVeil]): a clip
 * under one stands on its stage out of the rotation.
 *
 * Dynamic rather than static because it changes on the reveal, and only the
 * frames that read it should recompose when it does.
 */
internal val LocalStageVeil = compositionLocalOf { StageVeil.None }

/**
 * What a veil tells the clips under it, given whether it is [veiled] now: it
 * remembers having been veiled, so that after the reveal its clips stand
 * [StageVeil.Lifted] — the unveil their stage re-elects on — for as long as
 * this veil stays composed.
 */
@Composable
internal fun rememberStageVeil(veiled: Boolean): StageVeil {
    val memory = remember { VeilMemory() }
    // Monotonic, so a recomposition that is retried or abandoned leaves it
    // no different from one that was not.
    if (veiled) memory.veiledOnce = true
    return when {
        veiled -> StageVeil.Veiled
        memory.veiledOnce -> StageVeil.Lifted
        else -> StageVeil.None
    }
}

/** Whether a veil has covered its body at any point while composed. */
private class VeilMemory {
    var veiledOnce = false
}

/**
 * A stage, and the election that keeps it decided for as long as it is
 * composed. With [list], only clips in the rows it placed may hold it; while
 * [suspended], none may.
 */
@Composable
internal fun rememberScrollStage(list: LazyListState? = null, suspended: Boolean = false): ScrollStage {
    // The latest answer, read by the long-lived election rather than restarting
    // it (developer.android.com/develop/ui/compose/side-effects,
    // `rememberUpdatedState`): the stage keeps its places across a suspension.
    val covered = rememberUpdatedState(suspended)
    val stage = remember(list) {
        ScrollStage(
            placedRows = list?.let { { it.layoutInfo.visibleItemsInfo.mapTo(HashSet()) { item -> item.key } } },
            suspended = { covered.value },
        )
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
 *
 * **Raising the sheet suspends the stage beneath it** (jakob 2026-09-24,
 * `design/readme.md`, "The feed-video rulings": "a sheet over a surface
 * suspends that surface's stage"). The surface that owns the sheet's open
 * state passes it as [suspended]: its playing clip stops, and the sheet's own
 * stage then decides by the law what plays — not whichever player happened to
 * claim last. Dismissing the sheet lifts it, and the stage is decided again
 * as if the list had scrolled.
 */
@Composable
fun ScrollStageHost(list: LazyListState, suspended: Boolean = false, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalScrollStage provides rememberScrollStage(list, suspended), content = content)
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
 *
 * A [StageVeil.Veiled] frame still stands on the stage — out of the rotation,
 * not off the surface — so that the stage sees its veil lift and re-elects.
 */
internal fun Modifier.standOn(stage: ScrollStage, key: Any, page: Int, row: Any?, veil: StageVeil): Modifier =
    this then StandOnElement(stage, key, page, row, veil)

private data class StandOnElement(
    val stage: ScrollStage,
    val key: Any,
    val page: Int,
    val row: Any?,
    val veil: StageVeil,
) : ModifierNodeElement<StandOnNode>() {
    override fun create() = StandOnNode(stage, key, page, row, veil)

    override fun update(node: StandOnNode) {
        if (node.stage !== stage || node.key !== key) node.leave()
        node.stage = stage
        node.key = key
        node.page = page
        node.row = row
        node.veil = veil
        stage.amend(key, page, row, veil)
    }

    override fun InspectorInfo.inspectableProperties() {
        name = "standOn"
        properties["page"] = page
        properties["row"] = row
        properties["veil"] = veil
    }
}

private class StandOnNode(var stage: ScrollStage, var key: Any, var page: Int, var row: Any?, var veil: StageVeil) :
    Modifier.Node(),
    GlobalPositionAwareModifierNode {

    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        val height = coordinates.size.height
        val visible = if (height == 0) {
            0f
        } else {
            (coordinates.boundsInWindow().height / height.toFloat()).coerceIn(0f, 1f)
        }
        stage.report(
            key,
            StagePlace(top = coordinates.positionInWindow().y, page = page, visible = visible, row = row, veil = veil),
        )
    }

    override fun onDetach() = leave()

    fun leave() = stage.leave(key)
}
