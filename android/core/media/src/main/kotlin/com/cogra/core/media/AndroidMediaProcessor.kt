package com.cogra.core.media

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.ProcessedPicture
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * [MediaProcessor] over the platform: read the picker's content URI,
 * bake the author's crop, then hand the result to [ImageProcessing] for
 * the downscale, the re-encode and the strip.
 *
 * **The crop is baked here rather than carried as parameters.** D17
 * settles that the client crops before upload and the stored bytes *are*
 * the post's bytes — which is also what makes the metadata strip
 * meaningful, since a picture cropped to hide something and then
 * uploaded whole would publish exactly what the author cut out.
 *
 * Everything runs on [Dispatchers.IO]: a picker hands over ten of these
 * at once and each one decodes a multi-megapixel bitmap.
 */
class AndroidMediaProcessor(
    private val resolver: ContentResolver,
) : MediaProcessor {

    override suspend fun process(uri: String, crop: CropSpec): ProcessedPicture? =
        withContext(Dispatchers.IO) {
            val source = readBytes(uri) ?: return@withContext null
            val decoded = BitmapFactory.decodeByteArray(source, 0, source.size)
                ?: return@withContext null
            val upright = decoded.applyOrientation(ImageProcessing.orientationOf(source))
            val cropped = upright.cropped(crop)
            val processed = ImageProcessing.processBitmap(cropped)

            if (cropped !== upright) cropped.recycle()
            if (upright !== decoded) upright.recycle()
            decoded.recycle()
            ProcessedPicture(processed.bytes, processed.width, processed.height)
        }

    override suspend fun aspectRatio(uri: String): Float? = withContext(Dispatchers.IO) {
        val source = readBytes(uri) ?: return@withContext null
        // `inJustDecodeBounds` reads the header only — the picker's grid
        // needs every picked asset's shape, and decoding ten full
        // bitmaps to learn ten ratios is how a phone runs out of heap.
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(source, 0, source.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return@withContext null
        // The header's dimensions are pre-rotation, so a portrait photo
        // stored sideways would report landscape without this swap.
        val rotated = ImageProcessing.orientationOf(source) in QUARTER_TURNS
        val width = if (rotated) bounds.outHeight else bounds.outWidth
        val height = if (rotated) bounds.outWidth else bounds.outHeight
        width.toFloat() / height.toFloat()
    }

    private fun readBytes(uri: String): ByteArray? = runCatching {
        resolver.openInputStream(Uri.parse(uri))?.use { it.readBytes() }
    }.getOrNull()

    private companion object {
        /** The four EXIF orientations that swap width and height. */
        val QUARTER_TURNS = setOf(
            androidx.exifinterface.media.ExifInterface.ORIENTATION_ROTATE_90,
            androidx.exifinterface.media.ExifInterface.ORIENTATION_ROTATE_270,
            androidx.exifinterface.media.ExifInterface.ORIENTATION_TRANSPOSE,
            androidx.exifinterface.media.ExifInterface.ORIENTATION_TRANSVERSE,
        )
    }
}

/**
 * Takes the rectangle the author framed.
 *
 * The crop step hands its window over as fractions of the picture, so
 * this only has to scale them into source pixels — the geometry itself
 * was settled on screen, by the cropper, against the picture shown
 * whole. Where the author never framed a picture at all, the largest
 * [CropSpec.targetRatio] rectangle is centred on it, which is what the
 * crop step's own untouched window shows.
 *
 * The clamp is re-applied here rather than trusted from the caller: a
 * rounding difference between a view's pixels and a bitmap's is exactly
 * how an out-of-bounds rectangle gets made, and `createBitmap` throws on
 * one.
 */
internal fun Bitmap.cropped(crop: CropSpec): Bitmap {
    if (!crop.targetRatio.isFinite() || crop.targetRatio <= 0f) return this

    val window = crop.window
    val rect = if (window == null || window.isWhole) {
        centredWindow(crop.targetRatio)
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
    val w = (rect[2].toInt() - x).coerceIn(1, width - x)
    val h = (rect[3].toInt() - y).coerceIn(1, height - y)
    if (x == 0 && y == 0 && w == width && h == height) return this
    return Bitmap.createBitmap(this, x, y, w, h)
}

/**
 * The largest [targetRatio] rectangle the picture holds, centred — the
 * framing a picture carries when the author left it alone.
 */
private fun Bitmap.centredWindow(targetRatio: Float): FloatArray {
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

