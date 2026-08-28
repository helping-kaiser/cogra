package com.cogra.core.media

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import androidx.exifinterface.media.ExifInterface
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.GraphicsMode
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * The pipeline is tested against **real encoded bytes**, not mocks: the whole
 * point of the strip is what survives a decode/encode round trip, and a
 * shadowed Bitmap would answer that question with fiction. Robolectric's
 * native graphics mode runs the real Skia encoder on the JVM, so these are
 * the same operations a device performs.
 *
 * Fixtures are generated rather than committed as binaries — a checked-in
 * JPEG is a blob nobody can review, and building one here states exactly
 * which tags the test is about.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ImageProcessingTest {

    /**
     * A real JPEG carrying GPS coordinates, a device make and model, and an
     * orientation — the tag set a phone photo actually arrives with.
     */
    private fun jpegWithMetadata(
        width: Int = 1200,
        height: Int = 900,
        orientation: Int = ExifInterface.ORIENTATION_NORMAL,
    ): ByteArray {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply {
            // A flat fill compresses to almost nothing and can hide sizing
            // bugs, so the fixture carries two bands.
            for (x in 0 until width) {
                for (y in 0 until height) {
                    setPixel(x, y, if (y < height / 2) Color.RED else Color.BLUE)
                }
            }
        }
        val jpeg = ByteArrayOutputStream()
            .also { bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it) }
            .toByteArray()

        val file = File.createTempFile("fixture", ".jpg").apply { writeBytes(jpeg) }
        ExifInterface(file.absolutePath).apply {
            setAttribute(ExifInterface.TAG_GPS_LATITUDE, "48/1,8/1,0/1")
            setAttribute(ExifInterface.TAG_GPS_LATITUDE_REF, "N")
            setAttribute(ExifInterface.TAG_GPS_LONGITUDE, "11/1,34/1,0/1")
            setAttribute(ExifInterface.TAG_GPS_LONGITUDE_REF, "E")
            setAttribute(ExifInterface.TAG_MAKE, "ACME")
            setAttribute(ExifInterface.TAG_MODEL, "Phone X")
            setAttribute(ExifInterface.TAG_ORIENTATION, orientation.toString())
            saveAttributes()
        }
        return file.readBytes()
    }

    private fun ByteArray.exif() = ExifInterface(ByteArrayInputStream(this))

    /**
     * No rotation is left for a viewer to re-apply. The check is on the value
     * rather than on the tag's presence: a WebP with no EXIF chunk at all
     * still reports orientation `0` (undefined) rather than nothing, and both
     * `0` and `1` mean "draw as-is".
     */
    private fun ByteArray.hasNoResidualRotation(): Boolean {
        val orientation = exif().getAttributeInt(
            ExifInterface.TAG_ORIENTATION,
            ExifInterface.ORIENTATION_NORMAL,
        )
        return orientation == ExifInterface.ORIENTATION_NORMAL ||
            orientation == ExifInterface.ORIENTATION_UNDEFINED
    }

    private fun ByteArray.isWebP(): Boolean =
        size > 12 &&
            String(copyOfRange(0, 4), Charsets.US_ASCII) == "RIFF" &&
            String(copyOfRange(8, 12), Charsets.US_ASCII) == "WEBP"

    @Test
    fun theFixtureReallyCarriesTheMetadataTheStripHasToRemove() {
        // Without this the GPS assertions below could pass against a fixture
        // that never had coordinates in the first place.
        val exif = jpegWithMetadata().exif()
        assertThat(exif.latLong).isNotNull()
        assertThat(exif.getAttribute(ExifInterface.TAG_MAKE)).isEqualTo("ACME")
    }

    @Test
    fun locationAndDeviceMetadataAreGone() {
        val processed = ImageProcessing.process(jpegWithMetadata())!!
        val exif = processed.bytes.exif()

        assertThat(exif.latLong).isNull()
        assertThat(exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE)).isNull()
        assertThat(exif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE)).isNull()
        assertThat(exif.getAttribute(ExifInterface.TAG_MAKE)).isNull()
        assertThat(exif.getAttribute(ExifInterface.TAG_MODEL)).isNull()
    }

    @Test
    fun theOutputIsWebP() {
        val processed = ImageProcessing.process(jpegWithMetadata())!!
        assertThat(processed.bytes.isWebP()).isTrue()
    }

    @Test
    fun anOversizedPictureIsDownscaledToTheCapAndKeepsItsRatio() {
        val processed = ImageProcessing.process(jpegWithMetadata(3000, 2250))!!

        assertThat(maxOf(processed.width, processed.height))
            .isEqualTo(ImageProcessing.MAX_EDGE_PX)
        // 4:3 in, 4:3 out.
        assertThat(processed.aspectRatio).isWithin(0.01f).of(4f / 3f)
    }

    @Test
    fun aPictureInsideTheCapIsNotUpscaled() {
        val processed = ImageProcessing.process(jpegWithMetadata(640, 480))!!

        assertThat(processed.width).isEqualTo(640)
        assertThat(processed.height).isEqualTo(480)
    }

    @Test
    fun aQuarterTurnIsBakedIntoThePixelsSoTheShapeSwaps() {
        val upright = ImageProcessing.process(jpegWithMetadata(1200, 900))!!
        val turned = ImageProcessing.process(
            jpegWithMetadata(1200, 900, ExifInterface.ORIENTATION_ROTATE_90),
        )!!

        assertThat(upright.width).isGreaterThan(upright.height)
        // Rotated by 90°, the landscape fixture must come out portrait — and
        // with no orientation tag left to re-apply it a second time.
        assertThat(turned.height).isGreaterThan(turned.width)
        assertThat(turned.bytes.hasNoResidualRotation()).isTrue()
    }

    @Test
    fun aHalfTurnKeepsTheShapeButStillStripsTheTag() {
        val turned = ImageProcessing.process(
            jpegWithMetadata(1200, 900, ExifInterface.ORIENTATION_ROTATE_180),
        )!!

        assertThat(turned.width).isGreaterThan(turned.height)
        assertThat(turned.bytes.hasNoResidualRotation()).isTrue()
    }

    @Test
    fun aMirroredOrientationIsHandledRatherThanIgnored() {
        val flipped = ImageProcessing.process(
            jpegWithMetadata(1200, 900, ExifInterface.ORIENTATION_TRANSPOSE),
        )!!

        // TRANSPOSE rotates as well as mirrors, so the shape swaps.
        assertThat(flipped.height).isGreaterThan(flipped.width)
    }

    @Test
    fun bytesThatAreNotAnImageAreRefusedRatherThanGuessedAt() {
        assertThat(ImageProcessing.process("this is not a jpeg".toByteArray())).isNull()
    }

    @Test
    fun theProcessedBytesStillDecodeAsAnImageOfTheStatedSize() {
        val processed = ImageProcessing.process(jpegWithMetadata(2000, 2000))!!
        val decoded = BitmapFactory.decodeByteArray(processed.bytes, 0, processed.bytes.size)

        assertThat(decoded).isNotNull()
        assertThat(decoded.width).isEqualTo(processed.width)
        assertThat(decoded.height).isEqualTo(processed.height)
    }

    @Test
    fun processingShrinksAPhotoSizedOriginal() {
        val source = jpegWithMetadata(3000, 2250)
        val processed = ImageProcessing.process(source)!!

        assertThat(processed.bytes.size).isLessThan(source.size)
    }
}
