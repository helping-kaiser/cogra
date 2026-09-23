package com.cogra.core.designsystem.v2.media

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
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow

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
 */
@Immutable
internal data class StagePlace(val top: Float, val page: Int, val visible: Float) {
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
 */
@Stable
internal class ScrollStage {

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

    /** Re-decides the stage every time a clip's place changes. */
    suspend fun run() {
        snapshotFlow { places.toMap() }.collect { holder = StageElection.elect(holder, it) }
    }
}

/**
 * The stage of the scroll surface this composition is inside, provided by
 * [ScrollStageHost]. Null outside any: a gallery there is its own surface.
 */
internal val LocalScrollStage = staticCompositionLocalOf<ScrollStage?> { null }

/** A stage, and the election that keeps it decided for as long as it is composed. */
@Composable
internal fun rememberScrollStage(): ScrollStage {
    val stage = remember { ScrollStage() }
    LaunchedEffect(stage) { stage.run() }
    return stage
}

/**
 * Gives a scroll surface its one stage: every clip composed inside [content]
 * competes for it, and none outside does.
 *
 * Wrap the scrolling list itself. A sheet raised over a list is a surface of
 * its own and hosts its own — a comment thread over the feed does not share
 * the feed's stage — while a post's clips and a comment's clips inside one
 * list do share it, which is the law's "the same one".
 */
@Composable
fun ScrollStageHost(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalScrollStage provides rememberScrollStage(), content = content)
}

/**
 * Reports this frame's place on [stage] under [key], every time layout moves
 * it.
 *
 * Measured through layout rather than a scroll listener: `boundsInWindow` is
 * already clipped to what is on screen, so its height against the frame's own
 * is the fraction showing, and `positionInWindow` is where the frame starts
 * whether or not it is clipped.
 */
internal fun Modifier.standOn(stage: ScrollStage, key: Any, page: Int): Modifier =
    onGloballyPositioned { coordinates ->
        val height = coordinates.size.height
        val visible = if (height == 0) {
            0f
        } else {
            (coordinates.boundsInWindow().height / height.toFloat()).coerceIn(0f, 1f)
        }
        stage.report(key, StagePlace(top = coordinates.positionInWindow().y, page = page, visible = visible))
    }
