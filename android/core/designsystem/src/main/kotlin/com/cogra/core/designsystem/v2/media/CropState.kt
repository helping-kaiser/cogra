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

    /** Set by the viewport as it measures; clamping needs the real pixels. */
    internal var viewport: Size = Size.Zero
        set(value) {
            field = value
            offset = clampOffset(offset, scale, value)
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
        offset = clampOffset(offset, next, viewport)
    }

    /** Moves the framing by a pixel delta and re-clamps, e.g. from a drag. */
    fun panBy(delta: Offset) {
        offset = clampOffset(offset + delta, scale, viewport)
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

    fun reset() {
        scale = MIN_SCALE
        offset = Offset.Zero
    }

    internal companion object {
        const val MIN_SCALE = 1f
        const val MAX_SCALE = 4f
        const val ZOOM_STEP = 1.25f
        const val NUDGE_FRACTION = 0.08f

        /**
         * A zoomed picture may be pushed until its own edge reaches the
         * viewport's, and no further — so the frame is never let off the
         * picture.
         */
        fun clampOffset(candidate: Offset, scale: Float, viewport: Size): Offset {
            if (viewport == Size.Zero) return candidate
            val maxX = (scale - 1f) * viewport.width / 2f
            val maxY = (scale - 1f) * viewport.height / 2f
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
