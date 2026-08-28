package com.cogra.core.media

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.os.Build
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

/**
 * What one processed picture is: the bytes to upload and the shape the server
 * will derive from them.
 */
data class ProcessedImage(
    val bytes: ByteArray,
    val width: Int,
    val height: Int,
) {
    val aspectRatio: Float get() = width.toFloat() / height.toFloat()

    // Identity on a ByteArray is reference identity, which makes the
    // generated equals/hashCode lie. Both are spelled out so a processed
    // image compares by content.
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ProcessedImage) return false
        return width == other.width &&
            height == other.height &&
            bytes.contentEquals(other.bytes)
    }

    override fun hashCode(): Int =
        31 * (31 * bytes.contentHashCode() + width) + height
}

/**
 * The on-device image pipeline: **downscale, re-encode to WebP, and drop
 * every piece of metadata except the orientation, which is applied first.**
 *
 * This exists because of D11 (jakob, 2026-08-28): clients process before
 * uploading, to state-of-the-art phone quality, and location and device data
 * are stripped on the client and re-checked on the server. A phone photo
 * carries GPS coordinates and a device serial; the graph is public and needs
 * no account to read, so publishing an untouched original publishes the
 * author's home address.
 *
 * ### The numbers, and where they come from
 *
 * [MAX_EDGE_PX] is **1080**, which is Instagram's own display width — it
 * downsizes anything wider, so 1080 is what a phone-class feed actually
 * shows. Against the three post shapes that is 1080×1350 (Tall 4:5),
 * 1080×1080 (Square) and 1080×566 (Wide); the width is the constrained
 * dimension in all three, and 1350 is the largest long edge the pipeline
 * ever emits.
 *
 * [WEBP_QUALITY] is **80**. Android's own payload guidance
 * (developer.android.com/topic/performance/network-xfer) recommends 75 for
 * general images and notes that WebP lossy runs 25–34% smaller than JPEG at
 * equivalent quality; the extra five points spend part of that saving on the
 * one thing on the screen the reader came to look at. Both are single
 * constants precisely so they can be retuned against real photographs
 * without touching the pipeline.
 *
 * ### Why the strip is total rather than selective
 *
 * Nothing here walks the tag list deleting entries. The source is decoded to
 * a [Bitmap] — which holds pixels and nothing else — the orientation is baked
 * into those pixels by rotating them, and the result is re-encoded. Metadata
 * does not survive that round trip, so there is no tag that can be forgotten.
 * Applying the orientation before dropping the tag is also what avoids the
 * classic sideways-photo bug.
 */
object ImageProcessing {

    /** The constrained dimension, in pixels. */
    const val MAX_EDGE_PX = 1080

    /** WebP lossy quality, 0..100. */
    const val WEBP_QUALITY = 80

    /**
     * Processes one source image.
     *
     * @param source the original bytes, straight from the picker.
     * @return the WebP bytes to upload, or null when [source] does not decode
     *   as an image at all — which is itself the client-side half of the
     *   decode gate D11 asks for.
     */
    fun process(source: ByteArray): ProcessedImage? {
        val decoded = BitmapFactory.decodeByteArray(source, 0, source.size) ?: return null
        val upright = decoded.applyOrientation(orientationOf(source))
        val result = processBitmap(upright)

        // Free the intermediates eagerly: a picker can hand over a dozen of
        // these in a row, and a phone's heap is the binding constraint.
        if (upright !== decoded) upright.recycle()
        decoded.recycle()
        return result
    }

    /**
     * The pixel half of [process], for a caller that already holds an
     * upright — and, in the composer's case, already cropped — bitmap.
     *
     * The crop has to happen between the orientation and the downscale
     * (D17: the client crops, and the stored bytes are the post's
     * bytes), which is why the two halves are separable at all.
     */
    fun processBitmap(upright: Bitmap): ProcessedImage {
        val scaled = upright.downscaled(MAX_EDGE_PX)
        val bytes = scaled.toWebP(WEBP_QUALITY)
        val result = ProcessedImage(bytes, scaled.width, scaled.height)
        if (scaled !== upright) scaled.recycle()
        return result
    }

    /**
     * The EXIF orientation of [source], or [ExifInterface.ORIENTATION_NORMAL]
     * when it carries none or cannot be read. An unreadable header is not an
     * error here — it only means there is no rotation to apply.
     */
    internal fun orientationOf(source: ByteArray): Int = runCatching {
        ExifInterface(ByteArrayInputStream(source))
            .getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL,
            )
    }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
}

/**
 * Bakes an EXIF orientation into the pixels. Every one of the eight values is
 * handled, mirrored ones included — a half-handled set is how pictures end up
 * flipped rather than merely sideways.
 */
internal fun Bitmap.applyOrientation(orientation: Int): Bitmap {
    val matrix = Matrix()
    when (orientation) {
        ExifInterface.ORIENTATION_NORMAL, ExifInterface.ORIENTATION_UNDEFINED -> return this
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.setScale(-1f, 1f)
        ExifInterface.ORIENTATION_ROTATE_180 -> matrix.setRotate(180f)
        ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.setScale(1f, -1f)
        ExifInterface.ORIENTATION_TRANSPOSE -> {
            matrix.setRotate(90f)
            matrix.postScale(-1f, 1f)
        }
        ExifInterface.ORIENTATION_ROTATE_90 -> matrix.setRotate(90f)
        ExifInterface.ORIENTATION_TRANSVERSE -> {
            matrix.setRotate(-90f)
            matrix.postScale(-1f, 1f)
        }
        ExifInterface.ORIENTATION_ROTATE_270 -> matrix.setRotate(-90f)
        else -> return this
    }
    return Bitmap.createBitmap(this, 0, 0, width, height, matrix, true)
}

/**
 * Shrinks so neither edge exceeds [maxEdge], preserving the ratio. A picture
 * already inside the bound is returned untouched — upscaling would add bytes
 * and no detail.
 */
internal fun Bitmap.downscaled(maxEdge: Int): Bitmap {
    val longest = maxOf(width, height)
    if (longest <= maxEdge) return this
    val factor = maxEdge.toFloat() / longest
    val targetWidth = (width * factor).toInt().coerceAtLeast(1)
    val targetHeight = (height * factor).toInt().coerceAtLeast(1)
    return Bitmap.createScaledBitmap(this, targetWidth, targetHeight, true)
}

/**
 * Encodes to WebP. `WEBP_LOSSY` is the current constant but arrived in API
 * 30, and this app supports 26 — so the deprecated `WEBP` is the path below
 * that, which is the same lossy encoder under the old name.
 */
@Suppress("DEPRECATION")
internal fun Bitmap.toWebP(quality: Int): ByteArray {
    val format = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Bitmap.CompressFormat.WEBP_LOSSY
    } else {
        Bitmap.CompressFormat.WEBP
    }
    return ByteArrayOutputStream().use { out ->
        compress(format, quality, out)
        out.toByteArray()
    }
}
