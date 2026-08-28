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
 * The viewport shows the picture scaled to *cover* it, so the visible
 * window is the largest [CropSpec.targetRatio] rectangle that fits the
 * scaled picture, translated by the framing offset. Working in source
 * pixels rather than in viewport pixels is what lets the design system
 * hold the framing as fractions and stay ignorant of bitmaps.
 */
internal fun Bitmap.cropped(crop: CropSpec): Bitmap {
    val sourceRatio = width.toFloat() / height.toFloat()
    if (!crop.targetRatio.isFinite() || crop.targetRatio <= 0f) return this

    // The cover fit: the window is bounded by whichever edge runs out
    // first, then shrunk further by the author's zoom.
    val scale = crop.scale.coerceAtLeast(1f)
    val windowWidth: Float
    val windowHeight: Float
    if (sourceRatio > crop.targetRatio) {
        windowHeight = height / scale
        windowWidth = windowHeight * crop.targetRatio
    } else {
        windowWidth = width / scale
        windowHeight = windowWidth / crop.targetRatio
    }

    // The offset is a fraction of the window, and it can never push the
    // window off the picture — the same clamp `CropState` applies on
    // screen, re-applied here so a rounding difference cannot produce
    // an out-of-bounds rectangle.
    val maxLeft = width - windowWidth
    val maxTop = height - windowHeight
    val left = ((maxLeft / 2f) - crop.offsetFractionX * windowWidth).coerceIn(0f, maxLeft.coerceAtLeast(0f))
    val top = ((maxTop / 2f) - crop.offsetFractionY * windowHeight).coerceIn(0f, maxTop.coerceAtLeast(0f))

    val w = windowWidth.toInt().coerceIn(1, width)
    val h = windowHeight.toInt().coerceIn(1, height)
    val x = left.toInt().coerceIn(0, width - w)
    val y = top.toInt().coerceIn(0, height - h)
    if (x == 0 && y == 0 && w == width && h == height) return this
    return Bitmap.createBitmap(this, x, y, w, h)
}

