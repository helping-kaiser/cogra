// The media pipeline's arithmetic, lifted out of the platform binding.
//
// `core:media` binds `Bitmap`, `MediaMetadataRetriever` and Media3's
// `Transformer` directly, so anything reachable only through it is
// reachable only through a device. These four are pure functions over
// numbers — they live here beside `VideoBitrate`, where they are plain
// JVM tests, and the platform classes call them.

package com.cogra.domain.media

import kotlin.math.abs

/** A crop window in source pixels: left, top, right, bottom. */
data class PixelRect(val left: Int, val top: Int, val width: Int, val height: Int) {
    /** Whether this rectangle is the whole picture, so no crop is needed. */
    fun isWhole(sourceWidth: Int, sourceHeight: Int): Boolean =
        left == 0 && top == 0 && width == sourceWidth && height == sourceHeight
}

/**
 * The largest [targetRatio] rectangle a [width] × [height] picture
 * holds, centred — the framing a picture carries when the author left
 * it alone.
 */
fun centredWindow(width: Int, height: Int, targetRatio: Float): FloatArray {
    val sourceRatio = width.toFloat() / height.toFloat()
    val w: Float
    val h: Float
    if (sourceRatio > targetRatio) {
        h = height.toFloat()
        w = h * targetRatio
    } else {
        w = width.toFloat()
        h = w / targetRatio
    }
    val left = (width - w) / 2f
    val top = (height - h) / 2f
    return floatArrayOf(left, top, left + w, top + h)
}

/**
 * How far a window's own shape may sit from the shape it is framing in
 * before it is taken as a report about something other than the framing.
 *
 * The window travels as fractions and comes back through two integer
 * rounding steps, so an exact match is not on offer; two percent is far
 * below any shape the composer offers being mistaken for another, and far
 * above the rounding.
 */
const val RATIO_SLACK = 0.02f

/** Whether [ratio] is [targetRatio], allowing for the rounding. */
fun isAtRatio(ratio: Float, targetRatio: Float): Boolean {
    if (!ratio.isFinite() || ratio <= 0f) return false
    if (!targetRatio.isFinite() || targetRatio <= 0f) return false
    return abs(ratio - targetRatio) <= RATIO_SLACK * targetRatio
}

/**
 * The largest [targetRatio] rectangle inside [rect], centred on it.
 *
 * **This is what makes the crop real rather than advisory.** The window
 * that arrives says where the author was looking; the post's shape says
 * what shape the bytes are (D17 — one shape for the whole post, and the
 * stored bytes *are* the post's bytes). A window is measured on a screen,
 * reported by a view, rounded twice and carried through state, and a
 * window that comes back the wrong shape — a view reporting before it has
 * a layout to report against is the way that happens — would otherwise
 * bake that wrong shape into the upload: at the limit, a window covering
 * the whole picture uploads the untouched original, which is the defect
 * this exists to close. Correcting the shape here means no reporter
 * upstream has to be trusted for the bytes to be right.
 *
 * A window already at the shape is returned untouched, so the author's
 * own framing survives to the pixel.
 */
fun atTargetRatio(rect: FloatArray, targetRatio: Float): FloatArray {
    val wide = rect[2] - rect[0]
    val high = rect[3] - rect[1]
    if (wide <= 0f || high <= 0f) return rect
    if (!targetRatio.isFinite() || targetRatio <= 0f) return rect
    val ratio = wide / high
    if (isAtRatio(ratio, targetRatio)) return rect

    val fitWide = if (ratio > targetRatio) high * targetRatio else wide
    val fitHigh = if (ratio > targetRatio) high else wide / targetRatio
    val centreX = (rect[0] + rect[2]) / 2f
    val centreY = (rect[1] + rect[3]) / 2f
    return floatArrayOf(
        centreX - fitWide / 2f,
        centreY - fitHigh / 2f,
        centreX + fitWide / 2f,
        centreY + fitHigh / 2f,
    )
}

/**
 * The pixel rectangle a crop names on a [width] × [height] picture.
 *
 * The clamp is applied here rather than trusted from the caller: a
 * rounding difference between a view's pixels and a bitmap's is exactly
 * how an out-of-bounds rectangle gets made, and the platform's
 * `createBitmap` throws on one.
 */
fun cropRect(width: Int, height: Int, crop: CropSpec): PixelRect {
    val window = crop.window
    val rect = if (window == null || window.isWhole) {
        centredWindow(width, height, crop.targetRatio)
    } else {
        atTargetRatio(
            floatArrayOf(
                window.left * width,
                window.top * height,
                window.right * width,
                window.bottom * height,
            ),
            crop.targetRatio,
        )
    }
    val x = rect[0].toInt().coerceIn(0, (width - 1).coerceAtLeast(0))
    val y = rect[1].toInt().coerceIn(0, (height - 1).coerceAtLeast(0))
    return PixelRect(
        left = x,
        top = y,
        width = (rect[2].toInt() - x).coerceIn(1, width - x),
        height = (rect[3].toInt() - y).coerceIn(1, height - y),
    )
}

/**
 * The displayed dimensions of a recording that reports [rotation].
 *
 * A rotated recording states its *stored* dimensions, so the quarter
 * turns swap them back before anything reasons about which side is
 * short.
 */
fun rotatedDimensions(width: Int, height: Int, rotation: Int): Pair<Int, Int> =
    if (rotation == 90 || rotation == 270) height to width else width to height

/**
 * Whether a clip carries more bits than we mean to send.
 *
 * Compared against the whole budget — the video rate plus the audio
 * beside it — because a container's figure covers both.
 *
 * **A clip that will not say is treated as too rich.** The cost of
 * re-encoding something already lean is a little quality; the cost of
 * waving through something that was not is the fault this exists to
 * fix.
 */
fun richerThan(bitrate: Int?, targetVideoBps: Int): Boolean =
    bitrate == null || bitrate > targetVideoBps + VideoBitrate.AUDIO_BPS

/**
 * Where the [index]th of [count] cover frames sits, in milliseconds.
 *
 * The midpoints of equal slices rather than 0, half and end: the first
 * frame of a clip is often black, and the last is often the moment the
 * recorder reached for the button.
 */
fun coverFrameAtMs(durationMs: Int, index: Int, count: Int): Int =
    (durationMs.toLong() * (2 * index + 1) / (2L * count)).toInt()
