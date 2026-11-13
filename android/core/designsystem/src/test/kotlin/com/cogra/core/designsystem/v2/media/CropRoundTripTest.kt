package com.cogra.core.designsystem.v2.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Shader
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import androidx.test.core.app.ApplicationProvider
import coil3.ImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.request.transformations
import coil3.toBitmap
import com.cogra.core.media.AndroidMediaProcessor
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.CropWindow
import com.google.common.truth.Truth.assertThat
import com.google.common.truth.Truth.assertWithMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.GraphicsMode
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.abs

/**
 * THE BAR (jakob, A1 2026-11-13): what is framed is exactly what the details
 * thumbnail shows, what a return to the crop shows, and what the published
 * post shows.
 *
 * One framing is made on the crop's own state, then cut three ways — by the
 * REAL upload pipeline (`AndroidMediaProcessor`, the bytes the post
 * publishes), by the REAL preview transformation on Coil's REAL decode
 * ([CropTransformation], every thumbnail after the crop) and by a fresh state
 * opened on the reported window (a return to the crop) — and all three must
 * be the same region of the same upright picture.
 *
 * The picture is a gradient that encodes its own coordinates — red across,
 * green down — so a pixel of any cut says where in the upright picture it
 * came from. It is stored the way a camera stores it: the pixels turned and
 * an EXIF orientation telling the reader how to stand them up. Fixtures are
 * generated, as `ImageProcessingTest`'s are; Robolectric's native graphics
 * runs the real decoders and encoders.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CropRoundTripTest {

    private val context: Context = ApplicationProvider.getApplicationContext()

    @Test
    fun aCameraPictureStoredSidewaysIsCutWhereItWasFramed_rotate90() =
        roundTrip(ExifInterface.ORIENTATION_ROTATE_90)

    @Test
    fun aCameraPictureStoredSidewaysIsCutWhereItWasFramed_rotate270() =
        roundTrip(ExifInterface.ORIENTATION_ROTATE_270)

    @Test
    fun anUpsideDownPictureIsCutWhereItWasFramed_rotate180() =
        roundTrip(ExifInterface.ORIENTATION_ROTATE_180)

    @Test
    fun aMirroredPictureIsCutWhereItWasFramed_flipHorizontal() =
        roundTrip(ExifInterface.ORIENTATION_FLIP_HORIZONTAL)

    @Test
    fun aMirroredSidewaysPictureIsCutWhereItWasFramed_transpose() =
        roundTrip(ExifInterface.ORIENTATION_TRANSPOSE)

    @Test
    fun anUprightPictureIsCutWhereItWasFramed() =
        roundTrip(ExifInterface.ORIENTATION_NORMAL)

    /**
     * A 12-megapixel camera frame stored sideways, framed at the fill: its
     * 3000-pixel cut is decoded at half the source's pixels
     * (`cropSampleSize`), and the cut is still the region framed, at the
     * full output edge.
     */
    @Test
    fun aLargePictureIsCutWhereItWasFramedAtTheFullOutputEdge() =
        roundTrip(ExifInterface.ORIENTATION_ROTATE_90, width = 4000, height = 3000, zoom = 1f, expectEdge = 1080)

    @Suppress("LongParameterList")
    private fun roundTrip(
        orientation: Int,
        width: Int = 480,
        height: Int = 360,
        zoom: Float = 2f,
        expectEdge: Int? = null,
    ) {
        val file = cameraFile(width, height, orientation)
        val uri = Uri.fromFile(file).toString()
        val processor = AndroidMediaProcessor(context.contentResolver)

        // The stage measures against the ratio the picker reads from the
        // header — EXIF applied, so the upright picture's.
        val sourceRatio = runBlocking { processor.aspectRatio(uri) }
        assertThat(sourceRatio).isWithin(RATIO_SLACK).of(width.toFloat() / height)

        // The author frames: Square, zoomed to [zoom] of the fill, the picture
        // moved right (and up, where the zoom leaves room) — a section that
        // is neither centred nor whole.
        val state = CropState(CropFraming.Whole, sourceRatio, CropKind.Post, 1f)
        state.zoomTo(zoom)
        state.panBy(0.08f, -0.05f)
        val framed = state.framing
        // Moved off the centre the frame would show at rest.
        assertThat(framed.left).isLessThan((1f - framed.width) / 2f - 0.05f)
        if (zoom > 1f) assertThat(framed.top).isGreaterThan((1f - framed.height) / 2f + 0.03f)

        // 1. The published post: the real pipeline's bytes.
        val spec = CropSpec(1f, CropWindow(framed.left, framed.top, framed.right, framed.bottom))
        val published = runBlocking { processor.process(uri, spec) }
        requireNotNull(published) { "the pipeline refused the fixture" }
        val post = BitmapFactory.decodeByteArray(published.bytes, 0, published.bytes.size)
        assertThat(abs(post.width - post.height)).isAtMost(1)
        if (expectEdge != null) assertThat(maxOf(post.width, post.height)).isEqualTo(expectEdge)
        assertShows(post, framed, "the published post")

        // 2. The details thumbnail: Coil's decode, then the crop's transformation.
        assertShows(thumbnail(file, framed), framed, "the thumbnail")

        // 3. A return to the crop: a new state opened on the reported window
        // shows that window, at the zoom the author left.
        val reentered = CropState(framed, sourceRatio, CropKind.Post, 1f)
        assertThat(reentered.framing).isEqualTo(framed)
        assertThat(reentered.zoomShare).isWithin(1e-3f).of(zoom)
    }

    /** Coil's own decode of the file, EXIF as Coil applies it, cut by [CropTransformation]. */
    private fun thumbnail(file: File, framing: CropFraming): Bitmap {
        // Resumed where the decode finishes rather than on the main looper,
        // which a blocking test thread holds.
        val loader = ImageLoader.Builder(context).mainCoroutineContext(Dispatchers.Unconfined).build()
        val request = ImageRequest.Builder(context)
            .data(file)
            .allowHardware(false)
            .transformations(CropTransformation(framing))
            .build()
        val result = runBlocking { loader.execute(request) }
        assertWithMessage("Coil could not decode the fixture: $result")
            .that(result)
            .isInstanceOf(SuccessResult::class.java)
        return (result as SuccessResult).image.toBitmap()
    }

    /**
     * Every sample of [cut] comes from the upright picture where [framing]
     * says it does: a pixel's red is its x across the upright picture, its
     * green its y down it.
     */
    private fun assertShows(cut: Bitmap, framing: CropFraming, what: String) {
        for (u in SAMPLES) {
            for (v in SAMPLES) {
                val pixel = cut.getPixel((u * cut.width).toInt(), (v * cut.height).toInt())
                val x = Color.red(pixel) / CHANNEL
                val y = Color.green(pixel) / CHANNEL
                val label = "$what at ($u, $v)"
                assertWithMessage(label).that(x).isWithin(COLOUR_SLACK).of(framing.left + u * framing.width)
                assertWithMessage(label).that(y).isWithin(COLOUR_SLACK).of(framing.top + v * framing.height)
            }
        }
    }

    /**
     * A JPEG as a camera writes it: the upright picture's pixels turned by
     * the inverse of [orientation], and the tag that stands them up again.
     */
    private fun cameraFile(width: Int, height: Int, orientation: Int): File {
        val upright = gradient(width, height)
        val inverse = Matrix().also { orientationMatrix(orientation).invert(it) }
        val stored = Bitmap.createBitmap(upright, 0, 0, width, height, inverse, true)
        val jpeg = ByteArrayOutputStream().also { stored.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, it) }
        val file = File.createTempFile("crop-fixture", ".jpg").apply { writeBytes(jpeg.toByteArray()) }
        ExifInterface(file.absolutePath).apply {
            setAttribute(ExifInterface.TAG_ORIENTATION, orientation.toString())
            saveAttributes()
        }
        return file
    }

    /** Red 0→255 across, green 0→255 down: each pixel names where it stands. */
    private fun gradient(width: Int, height: Int): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.BLACK)
        val across = Paint().apply {
            shader = LinearGradient(0f, 0f, width.toFloat(), 0f, Color.BLACK, Color.RED, Shader.TileMode.CLAMP)
        }
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), across)
        val down = Paint().apply {
            shader = LinearGradient(0f, 0f, 0f, height.toFloat(), Color.BLACK, Color.GREEN, Shader.TileMode.CLAMP)
            xfermode = PorterDuffXfermode(PorterDuff.Mode.ADD)
        }
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), down)
        return bitmap
    }

    /** The matrix that stands a stored picture up — the EXIF specification's eight orientations. */
    private fun orientationMatrix(orientation: Int): Matrix = Matrix().apply {
        when (orientation) {
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> setScale(-1f, 1f)
            ExifInterface.ORIENTATION_ROTATE_180 -> setRotate(180f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> setScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> {
                setRotate(90f)
                postScale(-1f, 1f)
            }
            ExifInterface.ORIENTATION_ROTATE_90 -> setRotate(90f)
            ExifInterface.ORIENTATION_TRANSVERSE -> {
                setRotate(-90f)
                postScale(-1f, 1f)
            }
            ExifInterface.ORIENTATION_ROTATE_270 -> setRotate(-90f)
            else -> reset()
        }
    }

    private companion object {
        val SAMPLES = listOf(0.2f, 0.5f, 0.8f)
        const val CHANNEL = 255f

        /** A JPEG and a WebP round trip of a smooth gradient, plus a pixel of sampling: 4 % of the picture. */
        const val COLOUR_SLACK = 0.04f
        const val RATIO_SLACK = 1e-3f
        const val JPEG_QUALITY = 100
    }
}
