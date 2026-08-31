package com.cogra.core.designsystem.v2.media

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size

/**
 * The framing of one picture inside the post's chosen shape.
 *
 * The picture is first fitted to *cover* the viewport, so [scale] starts at
 * 1 and only ever zooms in from there — that guarantee is what keeps the
 * clamping simple and the frame always full: there is no state in which the
 * reserved surface shows through a crop.
 *
 * Pure state with no composition inside it, so the clamping arithmetic is
 * unit-testable directly — the same split `StanceFieldGeometry` already uses
 * for the stance pad.
 */
@Stable
class CropState internal constructor(initialScale: Float, initialOffset: Offset) {

    var scale: Float by mutableFloatStateOf(initialScale)
        private set

    var offset: Offset by mutableStateOf(initialOffset)
        private set

    /**
     * Set by the viewport as it measures; clamping needs the real pixels.
     *
     * Observable rather than a plain field: [framing] is read during
     * composition, so a viewport that changed without waking the reader
     * would hand the pipeline fractions measured against the previous
     * shape — which is how switching Tall to Square used to publish the
     * tall frame's offsets at the square's ratio.
     */
    internal var viewport: Size by mutableStateOf(Size.Zero)
        private set

    /**
     * The picture's own width/height, which the cover fit needs.
     *
     * Without it the clamp assumes the picture exactly fills the frame,
     * which is only true when the two ratios agree — and that is what
     * pinned a wide picture's square crop to its centre with no way to
     * slide along the long axis.
     */
    internal var sourceRatio: Float by mutableFloatStateOf(UNKNOWN_RATIO)
        private set

    /**
     * Hands the state what it can only learn from layout. Idempotent, so
     * the caller may report the same measurement after every composition
     * — which is what lets a state that arrives in an already-measured
     * viewport (the second picture of a gallery) be framed at all.
     */
    internal fun measured(viewport: Size, sourceRatio: Float) {
        if (this.viewport == viewport && this.sourceRatio == sourceRatio) return
        this.viewport = viewport
        this.sourceRatio = sourceRatio
        offset = clampOffset(offset, scale, viewport, sourceRatio)
    }

    /**
     * The framing in units that survive leaving the screen.
     *
     * The pixels this state holds belong to the viewport it was framed
     * in; the bitmap the crop is finally applied to is a different size
     * entirely. Expressing the translation as a fraction of the
     * viewport is what lets the two agree without either learning the
     * other's dimensions — and it is why the viewport itself stays
     * internal, so no screen is tempted to do the arithmetic.
     */
    val framing: CropFraming
        get() = CropFraming(
            scale = scale,
            offsetFractionX = if (viewport.width > 0f) offset.x / viewport.width else 0f,
            offsetFractionY = if (viewport.height > 0f) offset.y / viewport.height else 0f,
        )

    /** Multiplies the current zoom and re-clamps, e.g. from a pinch. */
    fun zoomBy(factor: Float) {
        val next = (scale * factor).coerceIn(MIN_SCALE, MAX_SCALE)
        scale = next
        offset = clampOffset(offset, next, viewport, sourceRatio)
    }

    /** Moves the framing by a pixel delta and re-clamps, e.g. from a drag. */
    fun panBy(delta: Offset) {
        offset = clampOffset(offset + delta, scale, viewport, sourceRatio)
    }

    /**
     * The non-gesture equivalent design/readme.md §10 requires of every drag:
     * one discrete step, as a fraction of the viewport.
     */
    fun nudge(direction: NudgeDirection) {
        val step = Offset(
            x = viewport.width * NUDGE_FRACTION * direction.x,
            y = viewport.height * NUDGE_FRACTION * direction.y,
        )
        panBy(step)
    }

    /** The non-gesture equivalent of a pinch. */
    fun stepZoom(inward: Boolean) {
        zoomBy(if (inward) ZOOM_STEP else 1f / ZOOM_STEP)
    }

    /** True when zooming further in that direction would change nothing. */
    fun canZoom(inward: Boolean): Boolean =
        if (inward) scale < MAX_SCALE else scale > MIN_SCALE

    /**
     * What the framing currently is, in words.
     *
     * With no visible controls this is the only way a screen-reader user
     * learns whether a nudge did anything, so it names the zoom and the
     * position rather than only announcing that a crop exists. Positions
     * are reported as "centred" or a side, because a percentage of a
     * viewport nobody can see is not information.
     */
    fun framingDescription(): String {
        val zoom = "Zoom ${((scale * ZOOM_PERCENT).toInt())}%"
        val drawn = coverSize(viewport, sourceRatio)
        val slackX = (drawn.width * scale - viewport.width) / 2f
        val slackY = (drawn.height * scale - viewport.height) / 2f
        val across = edgeWord(offset.x, slackX, "left", "right")
        val down = edgeWord(offset.y, slackY, "top", "bottom")
        val where = listOfNotNull(across, down).ifEmpty { listOf("centred") }
        return "$zoom, ${where.joinToString(" and ")}"
    }

    private fun edgeWord(value: Float, slack: Float, low: String, high: String): String? = when {
        slack <= 0f -> null
        value >= slack * EDGE_FRACTION -> "at the $low"
        value <= -slack * EDGE_FRACTION -> "at the $high"
        else -> null
    }

    fun reset() {
        scale = MIN_SCALE
        offset = Offset.Zero
    }

    internal companion object {
        const val MIN_SCALE = 1f
        const val MAX_SCALE = 4f
        const val ZOOM_STEP = 1.25f
        const val NUDGE_FRACTION = 0.08f

        /** No ratio reported yet; the clamp falls back to the frame's own. */
        const val UNKNOWN_RATIO = 0f

        private const val ZOOM_PERCENT = 100f

        /** How near an edge counts as being at it, as a share of the slack. */
        private const val EDGE_FRACTION = 0.9f

        /**
         * The size the picture is drawn at to *cover* the frame — the
         * larger of the two fits, so one axis matches the frame exactly
         * and the other overflows. That overflow is the slack the author
         * slides through, and it exists at scale 1: a wide picture in a
         * square frame can be framed left, centre or right without ever
         * zooming.
         */
        fun coverSize(viewport: Size, sourceRatio: Float): Size {
            val ratio = if (sourceRatio.isFinite() && sourceRatio > 0f) {
                sourceRatio
            } else {
                return viewport
            }
            val frameRatio = viewport.width / viewport.height
            return if (ratio > frameRatio) {
                Size(viewport.height * ratio, viewport.height)
            } else {
                Size(viewport.width, viewport.width / ratio)
            }
        }

        /**
         * A picture may be pushed until its own edge reaches the frame's,
         * and no further — so the frame is never let off the picture.
         */
        fun clampOffset(
            candidate: Offset,
            scale: Float,
            viewport: Size,
            sourceRatio: Float = UNKNOWN_RATIO,
        ): Offset {
            if (viewport == Size.Zero) return candidate
            val drawn = coverSize(viewport, sourceRatio)
            val maxX = ((drawn.width * scale - viewport.width) / 2f).coerceAtLeast(0f)
            val maxY = ((drawn.height * scale - viewport.height) / 2f).coerceAtLeast(0f)
            return Offset(
                x = candidate.x.coerceIn(-maxX, maxX),
                y = candidate.y.coerceIn(-maxY, maxY),
            )
        }
    }
}

/**
 * One picture's framing, in viewport-relative units — what a screen
 * hands to whatever finally cuts the bytes.
 */
data class CropFraming(
    val scale: Float,
    val offsetFractionX: Float,
    val offsetFractionY: Float,
)

/** The four discrete directions the non-drag route offers. */
enum class NudgeDirection(val x: Float, val y: Float) {
    Left(1f, 0f),
    Right(-1f, 0f),
    Up(0f, 1f),
    Down(0f, -1f),
}

private val CropStateSaver: Saver<CropState, List<Float>> = Saver(
    save = { listOf(it.scale, it.offset.x, it.offset.y) },
    restore = { CropState(it[0], Offset(it[1], it[2])) },
)

/** Survives rotation and process death, so a half-framed crop is not lost. */
@androidx.compose.runtime.Composable
fun rememberCropState(): CropState =
    rememberSaveable(saver = CropStateSaver) {
        CropState(CropState.MIN_SCALE, Offset.Zero)
    }
