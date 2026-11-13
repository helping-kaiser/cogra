package com.cogra.core.designsystem.v2.media

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import kotlin.math.abs

/**
 * The window one picture is framed to, as fractions of the UPRIGHT picture —
 * the picture as the reader sees it, its EXIF orientation applied.
 *
 * Fractions rather than pixels because the stage that produced them and the
 * bitmap the crop is finally applied to are different sizes, and because a
 * fraction survives rotation, process death, and the trip out of the design
 * system without either side learning the other's dimensions. The upload
 * (`AndroidMediaProcessor`) and every later preview ([CropTransformation])
 * apply it to the upright picture, which is what the stage draws.
 *
 * The rectangle is always inside the unit square and never inverted.
 */
data class CropFraming(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float,
) {
    val width: Float get() = right - left
    val height: Float get() = bottom - top

    companion object {
        /** The whole picture — what an untouched, never-measured framing means. */
        val Whole = CropFraming(0f, 0f, 1f, 1f)

        /** Clamps a candidate into the unit square, keeping it non-empty. */
        fun of(left: Float, top: Float, right: Float, bottom: Float): CropFraming {
            val l = left.coerceIn(0f, 1f)
            val t = top.coerceIn(0f, 1f)
            return CropFraming(
                left = l,
                top = t,
                right = right.coerceIn(l, 1f),
                bottom = bottom.coerceIn(t, 1f),
            )
        }
    }
}

/** The four discrete directions the non-drag route offers. */
enum class NudgeDirection(val x: Int, val y: Int) {
    Left(-1, 0),
    Right(1, 0),
    Up(0, -1),
    Down(0, 1),
}

/**
 * One picture's framing under a FIXED frame (the one crop model, seam 301):
 * the frame stands still at its shape and the picture is moved and zoomed
 * under it ([CropGeometry]).
 *
 * **What it holds.** The placement — zoom and the picture's offset from the
 * stage's centre — once the author has moved anything, with the offset kept
 * as a share of the stage's width so a rotation or a wider screen keeps the
 * picture where it was. Before that, the window it was opened with
 * ([framing] reports it back verbatim, so re-entering a crop never reads as a
 * change), or nothing: the picture at rest, centred at the frame's fill.
 *
 * **What it reports.** [framing], the window the frame shows as fractions of
 * the upright picture: the crop's output, and what a return to the crop
 * starts from. The geometry needs the picture's upright ratio
 * ([sourceRatio]); until it is known nothing can be framed, and the framing
 * is the one it was given.
 *
 * Every write happens in an event — a gesture, the slider, a key, an action,
 * a shape chip, a layout pass — never in composition.
 */
@Stable
class CropState internal constructor(
    initial: CropFraming?,
    sourceRatio: Float?,
    kind: CropKind,
    frameRatio: Float,
    edited: CropPlacement? = null,
) {

    /** Which crop this is: its stage and its frame's construction. */
    var kind: CropKind by mutableStateOf(kind)
        private set

    /** The frame's shape, width ÷ height: the post's chosen shape, or a locked crop's. */
    var frameRatio: Float by mutableStateOf(frameRatio)
        private set

    /** The upright picture's width ÷ height, once known. */
    var sourceRatio: Float? by mutableStateOf(sourceRatio?.takeIf { it.isFinite() && it > 0f })
        private set

    /** The window this framing was opened with, until the author moves the picture. */
    private var given: CropFraming? by mutableStateOf(initial?.takeUnless { it == CropFraming.Whole })

    /** The author's placement, the offset as shares of the stage's width; null until moved. */
    private var edited: CropPlacement? by mutableStateOf(edited)

    /** The stage on screen, in pixels, and the gutter the cover's and the circle's frames stand between. */
    private var stage: StageMeasure? by mutableStateOf(null)

    /** Whether the stage has been laid out, so the geometry is in its pixels. */
    internal val isMeasured: Boolean get() = stage != null

    /** The geometry the picture is framed in: the real stage, or the board's 390 before layout. */
    internal fun geometry(): CropLayout? {
        val ratio = sourceRatio ?: return null
        val measured = stage ?: StageMeasure(CropGeometry.BOARD_WIDTH, CropGeometry.BOARD_GUTTER)
        val stageSize = CropGeometry.stageOf(kind, measured.width)
        val picture = CropGeometry.fittedPicture(ratio, stageSize)
        val frame = CropGeometry.frameOf(kind, frameRatio, measured.width, measured.gutter)
        val bounds = CropGeometry.zoomBounds(kind, picture, frameRatio, measured.width, measured.gutter)
        return CropLayout(stageSize, picture, frame, bounds)
    }

    /** Where the picture stands now, in the geometry's units, held to the frame. */
    internal fun placement(layout: CropLayout): CropPlacement {
        val width = layout.stage.width
        val raw = edited?.let { CropPlacement(it.zoom, it.x * width, it.y * width) }
            ?: given?.let { CropGeometry.placementOf(it, layout.picture, layout.frame.size) }
            ?: CropGeometry.rest(layout.bounds)
        return CropGeometry.hold(raw, layout.picture, layout.frame.size, layout.bounds)
    }

    /**
     * What the frame shows, as fractions of the upright picture — the crop's
     * output. A window opened and not moved comes back exactly as it was
     * given, so a return to the crop never re-uploads a picture nobody touched.
     */
    val framing: CropFraming
        get() {
            val layout = geometry() ?: return given ?: CropFraming.Whole
            val shown = CropGeometry.windowOf(placement(layout), layout.picture, layout.frame.size)
            val opened = given
            return if (edited == null && opened != null && shown.sameAs(opened)) opened else shown
        }

    /** The zoom as a share of the fill: the slider's value, 1 at the floor. */
    val zoomShare: Float
        get() {
            val layout = geometry() ?: return CropGeometry.MIN_ZOOM
            return placement(layout).zoom / layout.bounds.floor
        }

    /** The slider's top: the ceiling as a share of the fill (4 on the tallest frame, more on a shorter one). */
    val zoomShareMax: Float
        get() {
            val layout = geometry() ?: return CropGeometry.MAX_ZOOM
            return layout.bounds.ceiling / layout.bounds.floor
        }

    /** The picture's upright ratio, learned from the picker's header or from the decoded picture. */
    fun learnSource(ratio: Float) {
        if (sourceRatio == null && ratio.isFinite() && ratio > 0f) sourceRatio = ratio
    }

    /** The stage was laid out [widthPx] wide, the column's gutter [gutterPx]. */
    internal fun onStage(widthPx: Float, gutterPx: Float) {
        if (widthPx <= 0f) return
        val next = StageMeasure(widthPx, gutterPx)
        if (stage != next) stage = next
    }

    /**
     * A shape chip: the frame changes to [ratio] around the picture, which
     * keeps its scale and position, rising only to the new fill and shifting
     * only as far as the new frame needs (ComposeCrop.md:19-23). Every picture
     * of the post takes it — not only the one on the stage — so none is left
     * framed at a shape the post no longer has.
     */
    fun reshape(ratio: Float) {
        if (ratio == frameRatio) return
        val before = geometry()
        if (before == null) {
            frameRatio = ratio
            return
        }
        val kept = placement(before)
        frameRatio = ratio
        val after = geometry() ?: return
        commit(CropGeometry.hold(kept, after.picture, after.frame.size, after.bounds), after)
    }

    /** One step of a gesture, in the stage's pixels ([CropGeometry.transformed]). */
    internal fun transform(centroidX: Float, centroidY: Float, panX: Float, panY: Float, zoomBy: Float) {
        val layout = geometry() ?: return
        val next = CropGeometry.transformed(
            placement(layout),
            centroidX,
            centroidY,
            panX,
            panY,
            zoomBy,
            layout.stage,
            layout.picture,
            layout.frame.size,
            layout.bounds,
        )
        commit(next, layout)
    }

    /** The slider's move: the zoom at [share] of the fill, about the frame's centre. */
    fun zoomTo(share: Float) {
        val layout = geometry() ?: return
        commit(
            CropGeometry.zoomedTo(share * layout.bounds.floor, placement(layout), layout.picture, layout.frame.size, layout.bounds),
            layout,
        )
    }

    /**
     * The arrow keys' move (ComposeCrop.md): the picture moves [dx]/[dy]
     * shares of its own size — 1 % a press, 10 % with Shift — and stops where
     * its edge meets the frame's.
     */
    fun panBy(dx: Float, dy: Float) {
        val layout = geometry() ?: return
        commit(CropGeometry.pannedBy(dx, dy, placement(layout), layout.picture, layout.frame.size), layout)
    }

    /**
     * TalkBack's nudge (design/readme.md §10): the FRAMING moves toward
     * [direction] — `Nudge left` shows more of the picture's left — so the
     * picture moves the other way, one tenth of itself.
     */
    fun nudge(direction: NudgeDirection) = panBy(-direction.x * NUDGE_STEP, -direction.y * NUDGE_STEP)

    /** TalkBack's zoom step: a tenth of the fill in or out, about the frame's centre. */
    fun stepZoom(inward: Boolean) = zoomTo(zoomShare + if (inward) ZOOM_STEP else -ZOOM_STEP)

    /** True when zooming further in that direction would change anything. */
    fun canZoom(inward: Boolean): Boolean =
        if (inward) zoomShare < zoomShareMax - EPSILON else zoomShare > CropGeometry.MIN_ZOOM + EPSILON

    /** TalkBack's `Reset framing`: the picture at rest, centred at the fill. */
    fun reset() {
        given = null
        edited = null
    }

    private fun commit(next: CropPlacement, layout: CropLayout) {
        val width = layout.stage.width
        edited = CropPlacement(next.zoom, next.x / width, next.y / width)
    }

    /**
     * What the framing currently is, in words.
     *
     * With no visible controls this is the only way a screen-reader user
     * learns whether a nudge did anything, so it names how much of the
     * picture is kept and where the frame sits on it.
     */
    fun framingDescription(): String {
        val shown = framing
        val kept = (shown.width * shown.height * PERCENT).toInt().coerceIn(0, PERCENT.toInt())
        val across = edgeWord(shown.left, shown.right, "left", "right")
        val down = edgeWord(shown.top, shown.bottom, "top", "bottom")
        val where = listOfNotNull(across, down).ifEmpty { listOf("centred") }
        return "Keeping $kept% of the picture, ${where.joinToString(" and ")}"
    }

    /** Which edge the frame is against, or null when it is centred on that axis. */
    private fun edgeWord(low: Float, high: Float, lowWord: String, highWord: String): String? {
        val slack = 1f - (high - low)
        if (slack <= EDGE_SLACK) return null
        return when {
            low <= slack * (1f - EDGE_FRACTION) -> "at the $lowWord"
            high >= 1f - slack * (1f - EDGE_FRACTION) -> "at the $highWord"
            else -> null
        }
    }

    internal fun saved(): List<Float?> {
        val opened = given
        val moved = edited
        return listOf(
            kind.ordinal.toFloat(),
            frameRatio,
            sourceRatio,
            opened?.left,
            opened?.top,
            opened?.right,
            opened?.bottom,
            moved?.zoom,
            moved?.x,
            moved?.y,
        )
    }

    internal companion object {
        private const val PERCENT = 100f

        /** Below this there is nothing to be at an edge of. */
        private const val EDGE_SLACK = 0.01f

        /** How near an edge counts as being at it, as a share of the slack. */
        private const val EDGE_FRACTION = 0.9f

        /** One nudge, as a share of the picture's own size: the Shift arrow's step. */
        const val NUDGE_STEP = 0.1f

        /** One zoom action, as a share of the fill (the web twin's `ZOOM_STEP`). */
        const val ZOOM_STEP = 0.1f

        /** How far a recomputed window may sit from the one given and still be it. */
        private const val SAME_WINDOW = 1e-4f

        private const val EPSILON = 1e-4f

        private fun CropFraming.sameAs(other: CropFraming): Boolean =
            abs(left - other.left) <= SAME_WINDOW &&
                abs(top - other.top) <= SAME_WINDOW &&
                abs(right - other.right) <= SAME_WINDOW &&
                abs(bottom - other.bottom) <= SAME_WINDOW

        /** [saved]'s list read back; a slot that is missing reads as nothing having been framed. */
        @Suppress("MagicNumber")
        fun restored(values: List<Float?>): CropState {
            fun at(index: Int): Float? = values.getOrNull(index)
            val window = (3..6).mapNotNull(::at).takeIf { it.size == 4 }
                ?.let { (left, top, right, bottom) -> CropFraming(left, top, right, bottom) }
            val moved = (7..9).mapNotNull(::at).takeIf { it.size == 3 }
                ?.let { (zoom, x, y) -> CropPlacement(zoom, x, y) }
            return CropState(
                initial = window,
                sourceRatio = at(2),
                kind = CropKind.entries.getOrElse(at(0)?.toInt() ?: 0) { CropKind.Post },
                frameRatio = at(1) ?: CropGeometry.TALL_RATIO,
                edited = moved,
            )
        }
    }
}

/** The stage as laid out on screen, in pixels. */
internal data class StageMeasure(val width: Float, val gutter: Float)

/** Everything a framing is measured in: the stage, the picture laid at 1×, the frame, the zoom's bounds. */
internal data class CropLayout(
    val stage: CropSize,
    val picture: CropSize,
    val frame: CropFrame,
    val bounds: ZoomBounds,
)

private val CropStateSaver: Saver<CropState, List<Float?>> = Saver(
    save = { it.saved() },
    restore = { CropState.restored(it) },
)

/**
 * A framing that survives rotation and process death.
 *
 * [initial] is the window this picture was last left at, where the host kept
 * one: a crop the author walks back into is a NEW composition, so the
 * saveable state alone cannot carry the framing across it; the host hands the
 * remembered window back in and the author finds the crop they made
 * (jakob 2026-09-01). [sourceRatio] is the upright picture's width ÷ height
 * where the host already knows it (the picker reads it from the header, EXIF
 * applied); [kind] and [frameRatio] say which frame the picture stands under.
 */
@Composable
fun rememberCropState(
    initial: CropFraming = CropFraming.Whole,
    sourceRatio: Float? = null,
    kind: CropKind = CropKind.Post,
    frameRatio: Float = CropGeometry.TALL_RATIO,
): CropState = rememberSaveable(saver = CropStateSaver) {
    CropState(initial, sourceRatio, kind, frameRatio)
}
