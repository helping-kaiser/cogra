package com.cogra.domain.media

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The media pipeline's arithmetic, on the JVM.
 *
 * These four were reachable only through a `Bitmap` or a
 * `MediaMetadataRetriever` and so were exercised by nothing; lifting
 * them out is what makes every branch cheap to pin (AND-11).
 */
class MediaGeometryTest {

    // -- centredWindow --

    @Test
    fun aWiderPictureIsCroppedOnTheSides() {
        // 200 × 100 down to 1:1 keeps the full height and a centred 100.
        val rect = centredWindow(200, 100, 1f)
        assertThat(rect.toList()).containsExactly(50f, 0f, 150f, 100f).inOrder()
    }

    @Test
    fun aTallerPictureIsCroppedTopAndBottom() {
        // 100 × 200 down to 1:1 keeps the full width and a centred 100.
        val rect = centredWindow(100, 200, 1f)
        assertThat(rect.toList()).containsExactly(0f, 50f, 100f, 150f).inOrder()
    }

    @Test
    fun aPictureAlreadyAtTheTargetIsKeptWhole() {
        val rect = centredWindow(100, 100, 1f)
        assertThat(rect.toList()).containsExactly(0f, 0f, 100f, 100f).inOrder()
    }

    @Test
    fun aFourFifthsTargetTakesTheTallestSliceThatFits() {
        val rect = centredWindow(100, 100, 4f / 5f)
        assertThat(rect[0]).isWithin(0.01f).of(10f)
        assertThat(rect[2] - rect[0]).isWithin(0.01f).of(80f)
        assertThat(rect[3] - rect[1]).isWithin(0.01f).of(100f)
    }

    // -- cropRect --

    @Test
    fun noWindowMeansTheCentredOne() {
        val rect = cropRect(200, 100, CropSpec(targetRatio = 1f))
        assertThat(rect).isEqualTo(PixelRect(50, 0, 100, 100))
    }

    @Test
    fun aWholeWindowAlsoMeansTheCentredOne() {
        val whole = CropSpec(targetRatio = 1f, window = CropWindow(0f, 0f, 1f, 1f))
        assertThat(cropRect(200, 100, whole)).isEqualTo(PixelRect(50, 0, 100, 100))
    }

    @Test
    fun anAuthoredWindowIsScaledIntoPixels() {
        val spec = CropSpec(targetRatio = 1f, window = CropWindow(0.25f, 0.25f, 0.75f, 0.75f))
        assertThat(cropRect(200, 200, spec)).isEqualTo(PixelRect(50, 50, 100, 100))
    }

    /** The clamp is the whole reason this is not the caller's arithmetic. */
    @Test
    fun aWindowReachingPastTheEdgeIsClampedInsideThePicture() {
        val spec = CropSpec(targetRatio = 1f, window = CropWindow(0.9f, 0.9f, 1.5f, 1.5f))
        val rect = cropRect(100, 100, spec)
        assertThat(rect.left + rect.width).isAtMost(100)
        assertThat(rect.top + rect.height).isAtMost(100)
        assertThat(rect.width).isAtLeast(1)
        assertThat(rect.height).isAtLeast(1)
    }

    @Test
    fun aWindowOfNoAreaStillYieldsSomethingCreateBitmapAccepts() {
        val spec = CropSpec(targetRatio = 1f, window = CropWindow(0.5f, 0.5f, 0.5f, 0.5f))
        val rect = cropRect(100, 100, spec)
        assertThat(rect.width).isAtLeast(1)
        assertThat(rect.height).isAtLeast(1)
    }

    // -- the shape the bytes come out at (HT-CROP) --

    /**
     * The defect this closes, in the numbers it was found in: jakob's
     * 4:5 post kept a 426 × 1080 picture — the untouched original — because
     * a window covering (all but a rounding of) the whole picture slipped
     * past the whole-window branch and was baked verbatim.
     */
    @Test
    fun aWindowCoveringThePictureStillCropsToThePostsShape() {
        val nearlyWhole = CropWindow(0f, 0f, 1f, 0.9998f)
        val rect = cropRect(1080, 2738, CropSpec(targetRatio = 4f / 5f, window = nearlyWhole))
        assertThat(rect.width.toFloat() / rect.height).isWithin(0.01f).of(4f / 5f)
    }

    @Test
    fun aWindowOfTheWrongShapeIsCorrectedAboutItsOwnCentre() {
        // Half the width, all the height, of a square picture: 1:2, where
        // the post is 4:5. The centre stays put; the shape does not.
        val spec = CropSpec(targetRatio = 4f / 5f, window = CropWindow(0.25f, 0f, 0.75f, 1f))
        val rect = cropRect(200, 200, spec)
        assertThat(rect.width.toFloat() / rect.height).isWithin(0.01f).of(4f / 5f)
        assertThat(rect.left + rect.width / 2).isEqualTo(100)
    }

    /** The author's own framing survives to the pixel when it is already the shape. */
    @Test
    fun aWindowAlreadyAtTheShapeIsUntouched() {
        val spec = CropSpec(targetRatio = 4f / 5f, window = CropWindow(0.1f, 0.2f, 0.5f, 0.7f))
        assertThat(cropRect(200, 200, spec)).isEqualTo(PixelRect(20, 40, 80, 100))
    }

    @Test
    fun everyPostShapeComesOutAtItsOwnRatio() {
        val window = CropWindow(0f, 0f, 0.99f, 0.99f)
        listOf(4f / 5f, 1f, 1.91f).forEach { target ->
            val rect = cropRect(1080, 1920, CropSpec(targetRatio = target, window = window))
            assertThat(rect.width.toFloat() / rect.height).isWithin(0.02f * target).of(target)
        }
    }

    @Test
    fun atTargetRatioLeavesADegenerateRectangleAlone() {
        val flat = floatArrayOf(10f, 10f, 10f, 10f)
        assertThat(atTargetRatio(flat, 1f).toList()).isEqualTo(flat.toList())
        assertThat(atTargetRatio(floatArrayOf(0f, 0f, 10f, 10f), 0f).toList())
            .containsExactly(0f, 0f, 10f, 10f).inOrder()
    }

    @Test
    fun aRatioIsAtItsTargetOnlyWithinTheSlack() {
        assertThat(isAtRatio(0.8f, 0.8f)).isTrue()
        assertThat(isAtRatio(0.8f * (1f + RATIO_SLACK / 2f), 0.8f)).isTrue()
        assertThat(isAtRatio(0.8f * (1f + RATIO_SLACK * 2f), 0.8f)).isFalse()
        assertThat(isAtRatio(Float.NaN, 0.8f)).isFalse()
        assertThat(isAtRatio(0f, 0.8f)).isFalse()
    }

    @Test
    fun theWholePictureIsRecognisedAsSuch() {
        val rect = cropRect(100, 100, CropSpec(targetRatio = 1f))
        assertThat(rect.isWhole(100, 100)).isTrue()
        assertThat(cropRect(200, 100, CropSpec(targetRatio = 1f)).isWhole(200, 100)).isFalse()
    }

    // -- rotatedDimensions --

    @Test
    fun quarterTurnsSwapTheStoredDimensions() {
        assertThat(rotatedDimensions(1920, 1080, 90)).isEqualTo(1080 to 1920)
        assertThat(rotatedDimensions(1920, 1080, 270)).isEqualTo(1080 to 1920)
    }

    @Test
    fun halfTurnsAndNoTurnLeaveThemAlone() {
        assertThat(rotatedDimensions(1920, 1080, 0)).isEqualTo(1920 to 1080)
        assertThat(rotatedDimensions(1920, 1080, 180)).isEqualTo(1920 to 1080)
    }

    // -- richerThan --

    @Test
    fun aClipOverTheWholeBudgetIsRicher() {
        val target = 4_000_000
        assertThat(richerThan(target + VideoBitrate.AUDIO_BPS + 1, target)).isTrue()
    }

    @Test
    fun aClipInsideTheWholeBudgetIsNot() {
        val target = 4_000_000
        assertThat(richerThan(target + VideoBitrate.AUDIO_BPS, target)).isFalse()
        assertThat(richerThan(1_000, target)).isFalse()
    }

    /** A container that will not say is treated as too rich, deliberately. */
    @Test
    fun aClipThatStatesNoRateIsTreatedAsRicher() {
        assertThat(richerThan(null, 4_000_000)).isTrue()
    }

    // -- coverFrameAtMs --

    @Test
    fun coverFramesSitAtTheMidpointsOfEqualSlices() {
        val ats = (0 until 4).map { coverFrameAtMs(8_000, it, 4) }
        assertThat(ats).containsExactly(1_000, 3_000, 5_000, 7_000).inOrder()
    }

    @Test
    fun coverFramesNeverSitOnTheFirstOrLastFrame() {
        val ats = (0 until 4).map { coverFrameAtMs(8_000, it, 4) }
        assertThat(ats.first()).isGreaterThan(0)
        assertThat(ats.last()).isLessThan(8_000)
    }

    /** A long clip's arithmetic must not overflow on the way. */
    @Test
    fun aLongClipDoesNotOverflow() {
        val hours = 3 * 60 * 60 * 1000
        assertThat(coverFrameAtMs(hours, 3, 4)).isEqualTo(hours * 7 / 8)
    }
}
