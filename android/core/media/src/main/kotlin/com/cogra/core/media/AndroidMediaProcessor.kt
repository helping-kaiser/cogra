package com.cogra.core.media

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.media.cropRect
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

    /**
     * The file's own length, from the provider rather than by reading
     * it: the pick step weighs a file it has not decoded, and reading a
     * hundred megabytes to find out how big it is defeats the point.
     *
     * `OpenableColumns.SIZE` is what a content provider publishes for
     * exactly this
     * (developer.android.com/training/secure-file-sharing/retrieve-info),
     * and a provider may leave it null — which is not a refusal.
     */
    override suspend fun sizeBytes(uri: String): Long? = withContext(Dispatchers.IO) {
        runCatching {
            resolver.query(Uri.parse(uri), arrayOf(OpenableColumns.SIZE), null, null, null)
                ?.use { row ->
                    val column = row.getColumnIndex(OpenableColumns.SIZE)
                    if (column >= 0 && row.moveToFirst() && !row.isNull(column)) {
                        row.getLong(column)
                    } else {
                        null
                    }
                }
        }.getOrNull()
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
    // The arithmetic is `core:domain`'s, where it is a plain JVM test;
    // what stays here is the one platform call it feeds.
    val rect = cropRect(width, height, crop)
    if (rect.isWhole(width, height)) return this
    return Bitmap.createBitmap(this, rect.left, rect.top, rect.width, rect.height)
}

