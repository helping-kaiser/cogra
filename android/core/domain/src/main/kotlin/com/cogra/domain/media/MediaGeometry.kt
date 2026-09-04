// The media pipeline's arithmetic, lifted out of the platform binding.
//
// `core:media` binds `Bitmap`, `MediaMetadataRetriever` and Media3's
// `Transformer` directly, so anything reachable only through it is
// reachable only through a device. These four are pure functions over
// numbers — they live here beside `VideoBitrate`, where they are plain
// JVM tests, and the platform classes call them.

package com.cogra.domain.media

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
        floatArrayOf(
            window.left * width,
            window.top * height,
            window.right * width,
            window.bottom * height,
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
