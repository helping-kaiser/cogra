package com.cogra.core.designsystem.v2.media

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The only crop geometry we still own: the discrete nudge and zoom the
 * invisible non-gesture route needs, which the cropper library has no
 * notion of.
 *
 * Dragging, pinching and the ratio itself belong to `CropImageView` and
 * are not re-tested here — adopting a cropper was precisely so that they
 * would stop being ours to get wrong. What is tested is what we added
 * around it, in fractions of the picture so it runs on the JVM with no
 * view anywhere near it.
 *
 * The invariant throughout: **the window never leaves the picture, and
 * never changes shape.** A nudge or a zoom that clipped instead of
 * sliding would silently re-shape a post the author set to one ratio.
 */
class CropStateTest {

    /** A half-size window sitting in the middle of the picture. */
    private val centred = CropFraming(0.25f, 0.25f, 0.75f, 0.75f)

    private fun CropFraming.assertShapeMatches(other: CropFraming) {
        assertThat(width).isWithin(TOLERANCE).of(other.width)
        assertThat(height).isWithin(TOLERANCE).of(other.height)
    }

    // -- Nudging --

    @Test
    fun aNudgeMovesTheWindowByAShareOfItsOwnSize() {
        val moved = CropWindowMath.nudged(centred, NudgeDirection.Right)

        assertThat(moved.left)
            .isWithin(TOLERANCE)
            .of(centred.left + centred.width * CropWindowMath.NUDGE_FRACTION)
        moved.assertShapeMatches(centred)
    }

    @Test
    fun aNudgeAtTheEdgeStopsThereRatherThanLeavingThePicture() {
        val atRight = CropFraming(0.5f, 0.25f, 1f, 0.75f)

        val moved = CropWindowMath.nudged(atRight, NudgeDirection.Right)

        assertThat(moved.right).isWithin(TOLERANCE).of(1f)
        assertThat(moved.left).isWithin(TOLERANCE).of(atRight.left)
        moved.assertShapeMatches(atRight)
    }

    @Test
    fun aNudgePastTheEdgeSlidesBackWholeInsteadOfBeingClipped() {
        // Nearly at the edge: the step would overshoot, and clipping it
        // would hand back a window of a different shape.
        val nearRight = CropFraming(0.49f, 0.25f, 0.99f, 0.75f)

        val moved = CropWindowMath.nudged(nearRight, NudgeDirection.Right)

        assertThat(moved.right).isWithin(TOLERANCE).of(1f)
        moved.assertShapeMatches(nearRight)
    }

    @Test
    fun everyDirectionMovesTheWayItIsNamed() {
        assertThat(CropWindowMath.nudged(centred, NudgeDirection.Left).left)
            .isLessThan(centred.left)
        assertThat(CropWindowMath.nudged(centred, NudgeDirection.Right).left)
            .isGreaterThan(centred.left)
        assertThat(CropWindowMath.nudged(centred, NudgeDirection.Up).top)
            .isLessThan(centred.top)
        assertThat(CropWindowMath.nudged(centred, NudgeDirection.Down).top)
            .isGreaterThan(centred.top)
    }

    // -- Zooming --

    @Test
    fun zoomingInShrinksTheWindowAboutItsCentreAndKeepsItsShape() {
        val zoomed = CropWindowMath.zoomed(centred, inward = true)

        assertThat(zoomed.width).isLessThan(centred.width)
        // One factor on both axes: the ratio is what the whole post was
        // set to, and a discrete zoom may not change it.
        assertThat(zoomed.width / zoomed.height)
            .isWithin(TOLERANCE)
            .of(centred.width / centred.height)
        assertThat((zoomed.left + zoomed.right) / 2f)
            .isWithin(TOLERANCE)
            .of((centred.left + centred.right) / 2f)
    }

    @Test
    fun zoomingOutStopsWhereTheWindowWouldOutgrowThePicture() {
        val nearlyWhole = CropFraming(0.01f, 0.01f, 0.99f, 0.99f)

        val zoomed = CropWindowMath.zoomed(nearlyWhole, inward = false)

        assertThat(zoomed.width).isAtMost(1f + TOLERANCE)
        assertThat(zoomed.height).isAtMost(1f + TOLERANCE)
        assertThat(zoomed.left).isAtLeast(-TOLERANCE)
        assertThat(zoomed.top).isAtLeast(-TOLERANCE)
    }

    @Test
    fun aWholeWindowCannotZoomOutAnyFurther() {
        val zoomed = CropWindowMath.zoomed(CropFraming.Whole, inward = false)

        assertThat(zoomed.width).isWithin(TOLERANCE).of(1f)
        assertThat(zoomed.height).isWithin(TOLERANCE).of(1f)
    }

    @Test
    fun zoomingInStopsAtTheSmallestWindowWorthFraming() {
        var window = centred
        repeat(TOO_MANY_STEPS) { window = CropWindowMath.zoomed(window, inward = true) }

        assertThat(window.width).isAtLeast(CropWindowMath.MIN_WINDOW - TOLERANCE)
        assertThat(window.height).isAtLeast(CropWindowMath.MIN_WINDOW - TOLERANCE)
    }

    // -- The state's own reporting --

    @Test
    fun aShapeSwitchIsWhatResetsTheFramingRatherThanCarryingItOver() {
        val state = CropState(centred)

        state.reset()

        // The re-frame is against the original: the next shape starts
        // from the whole picture, never from where the last one sat
        // (jakob 2026-08-31).
        assertThat(state.framing).isEqualTo(CropFraming.Whole)
    }

    @Test
    fun anActionWithNoViewAttachedIsStillRecorded() {
        val state = CropState(centred)

        state.nudge(NudgeDirection.Right)

        assertThat(state.framing.left).isGreaterThan(centred.left)
    }

    @Test
    fun aWindowReportedBeforeThisPicturesOwnIsPlacedIsNotRecorded() {
        val state = CropState(centred)
        // The filmstrip has just moved here; the picture has not landed.
        state.beginAttach()

        state.onWindowChanged(CropFraming(0f, 0f, 0.2f, 0.2f))

        // That window was measured against the picture still on the
        // shared view — the one this framing was moved away from
        // (jakob 2026-09-01).
        assertThat(state.framing).isEqualTo(centred)
    }

    @Test
    fun theFramingReadsBackAsWordsForAReaderWhoCannotSeeIt() {
        val state = CropState(CropFraming(0f, 0.25f, 0.5f, 0.75f))

        val description = state.framingDescription()

        // Named rather than a percentage of a viewport nobody can see.
        assertThat(description).contains("at the left")
        assertThat(description).contains("%")
    }

    @Test
    fun aCentredWindowSaysSoRatherThanNamingAnEdge() {
        val state = CropState(centred)

        assertThat(state.framingDescription()).contains("centred")
    }

    // -- The opening window (jakob 2026-09-01: "the area for cropping
    // was to small") --

    @Test
    fun aPictureTallerThanTheShapeOpensOnTheFullWidthOfIt() {
        // A 2:3 portrait framed to the 4:5 post shape.
        val window = CropWindowMath.largestWindow(targetRatio = 0.8f, pictureRatio = 2f / 3f)

        // The wide axis is whole: there is no more picture to take.
        assertThat(window.width).isWithin(TOLERANCE).of(1f)
        assertThat(window.height).isLessThan(1f)
        assertThat(window.width / window.height).isWithin(TOLERANCE).of(0.8f / (2f / 3f))
    }

    @Test
    fun aPictureWiderThanTheShapeOpensOnTheFullHeightOfIt() {
        // A 3:2 landscape framed to the same 4:5 shape.
        val window = CropWindowMath.largestWindow(targetRatio = 0.8f, pictureRatio = 1.5f)

        assertThat(window.height).isWithin(TOLERANCE).of(1f)
        assertThat(window.width).isLessThan(1f)
    }

    @Test
    fun aPictureAlreadyOfTheShapeOpensOnTheWholeOfIt() {
        val window = CropWindowMath.largestWindow(targetRatio = 0.8f, pictureRatio = 0.8f)

        assertThat(window.width).isWithin(TOLERANCE).of(1f)
        assertThat(window.height).isWithin(TOLERANCE).of(1f)
    }

    @Test
    fun theOpeningWindowIsCentredAndInsideThePicture() {
        val window = CropWindowMath.largestWindow(targetRatio = 1f, pictureRatio = 2f)

        assertThat(window.left).isAtLeast(0f)
        assertThat(window.right).isAtMost(1f)
        assertThat((window.left + window.right) / 2f).isWithin(TOLERANCE).of(0.5f)
        assertThat((window.top + window.bottom) / 2f).isWithin(TOLERANCE).of(0.5f)
    }

    @Test
    fun theOpeningWindowIsTheLargestOneTheShapeAllows() {
        // Nothing bigger fits: growing it on either axis would leave the
        // picture. This is the property that makes the full-bleed stage
        // actually full — the library's own default opens inset inside it.
        val window = CropWindowMath.largestWindow(targetRatio = 0.8f, pictureRatio = 1.5f)

        val grown = CropWindowMath.zoomed(window, inward = false)

        assertThat(grown.width).isWithin(TOLERANCE).of(window.width)
        assertThat(grown.height).isWithin(TOLERANCE).of(window.height)
    }

    @Test
    fun aPictureWithNoUsableRatioYetOpensOnTheWholeOfIt() {
        // The ratio is unknown until the decode; nothing is cropped away
        // on a guess.
        assertThat(CropWindowMath.largestWindow(0.8f, 0f)).isEqualTo(CropFraming.Whole)
        assertThat(CropWindowMath.largestWindow(0f, 1.5f)).isEqualTo(CropFraming.Whole)
    }

    // -- Clamping on the way in --

    @Test
    fun aWindowFromOutsideTheUnitSquareIsClampedIntoIt() {
        val clamped = CropFraming.of(-0.5f, -0.5f, 1.5f, 1.5f)

        assertThat(clamped).isEqualTo(CropFraming.Whole)
    }

    @Test
    fun anInvertedWindowIsFlattenedRatherThanLeftNegative() {
        val clamped = CropFraming.of(0.8f, 0.8f, 0.2f, 0.2f)

        assertThat(clamped.width).isAtLeast(0f)
        assertThat(clamped.height).isAtLeast(0f)
    }

    private companion object {
        const val TOLERANCE = 0.001f

        /** More zoom steps than the clamp can possibly allow. */
        const val TOO_MANY_STEPS = 100
    }
}
