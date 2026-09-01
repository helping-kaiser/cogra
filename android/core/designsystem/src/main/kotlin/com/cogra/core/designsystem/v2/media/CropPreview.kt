package com.cogra.core.designsystem.v2.media

import android.graphics.Rect
import androidx.compose.runtime.Composable
import coil3.Bitmap
import coil3.compose.LocalPlatformContext
import coil3.request.ImageRequest
import coil3.request.transformations
import coil3.size.Size
import coil3.transform.Transformation

/**
 * Draws a picture as the author framed it, wherever it is previewed
 * after the crop stage.
 *
 * **Why every later preview needs this.** The client crops before
 * upload and the stored bytes *are* the post's bytes (D17), but every
 * preview between the crop and the upload still draws the picker's
 * original local URI — so without the framing applied, an author who
 * cropped a picture met the uncropped one again on the details stage,
 * the picked sheet and the seal, and read it as their crop having been
 * thrown away ("the previews on the next pages afterwards should
 * display the cropped version so that people dont think it has reset",
 * jakob 2026-09-01).
 *
 * It rides Coil's own transformation seam rather than a layout trick:
 * the transformed bitmap *is* what the upload will carry, so the
 * preview and the uploaded bytes cannot drift, and the result is
 * memory-cached under [cacheKey] like any other transformed image.
 */
internal data class CropTransformation(val framing: CropFraming) : Transformation() {

    override val cacheKey: String =
        "crop-${framing.left}-${framing.top}-${framing.right}-${framing.bottom}"

    override suspend fun transform(input: Bitmap, size: Size): Bitmap {
        val source = sourceRect(framing, input.width, input.height)
        if (source.width() == input.width && source.height() == input.height) return input
        return Bitmap.createBitmap(input, source.left, source.top, source.width(), source.height())
    }

    internal companion object {
        /**
         * The framed section in the picture's own pixels.
         *
         * Kept a pure function of three numbers so the framing that
         * reaches a preview is testable on the JVM with no bitmap
         * anywhere near it — the same split [CropWindowMath] uses.
         *
         * It never returns an empty or out-of-bounds rectangle:
         * `Bitmap.createBitmap` throws on either, and a rounding
         * difference between a view's fractions and a bitmap's pixels is
         * exactly how one gets made.
         */
        fun sourceRect(framing: CropFraming, width: Int, height: Int): Rect {
            if (width <= 0 || height <= 0) return Rect(0, 0, width, height)
            val left = (framing.left * width).toInt().coerceIn(0, width - 1)
            val top = (framing.top * height).toInt().coerceIn(0, height - 1)
            val right = (framing.right * width).toInt().coerceIn(left + 1, width)
            val bottom = (framing.bottom * height).toInt().coerceIn(top + 1, height)
            return Rect(left, top, right, bottom)
        }
    }
}

/**
 * What a media component hands Coil for this item.
 *
 * A picture framed to the whole of itself is passed as its plain model,
 * so nothing but a genuinely cropped preview pays for a transformation
 * or a second cache entry.
 */
@Composable
internal fun MediaItem.imageModel(): Any? {
    if (framing == CropFraming.Whole || url == null) return url
    val context = LocalPlatformContext.current
    return ImageRequest.Builder(context)
        .data(url)
        .transformations(CropTransformation(framing))
        .build()
}
