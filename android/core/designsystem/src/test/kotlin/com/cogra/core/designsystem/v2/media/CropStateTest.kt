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

    // ComposeCrop.md (round 22): where the whole picture shows under a movable
    // window, an arrow moves the window the arrow's way, never past the edge.
    @Test
    fun anArrowMovesTheWindowItsWayAndNeverPastThePicturesEdge() {
        val state = CropState(centred)
        state.panBy(-0.01f, 0f)
        assertThat(state.framing.left).isWithin(TOLERANCE).of(0.24f)
        state.panBy(0f, 0.1f)
        assertThat(state.framing.top).isWithin(TOLERANCE).of(0.35f)
        repeat(TOO_MANY_STEPS) { state.panBy(0.1f, 0f) }
        assertThat(state.framing.right).isWithin(TOLERANCE).of(1f)
    }

    // -- The state's own reporting --

    @Test
    fun resetFramingGoesBackToTheWholePicture() {
        val state = CropState(centred)

        // TalkBack's `Reset framing`: back to the original.
        state.reset()

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

        state.onWindowChanged(CropFraming(0f, 0f, 0.2f, 0.2f), pictureRatio = 1f)

        // That window was measured against the picture still on the
        // shared view — the one this framing was moved away from
        // (jakob 2026-09-01).
        assertThat(state.framing).isEqualTo(centred)
    }

    // -- Which windows are framings at all (HT-CROP) --

    /**
     * A window is a fraction of its picture, so the same fractions are
     * different shapes on different pictures — which is why the picture's
     * own ratio has to come in with the window.
     */
    @Test
    fun aWindowsShapeIsItsOwnShapeTimesThePictures() {
        // Full width, four fifths of the height, of a square picture: 5:4.
        val window = CropFraming(0f, 0f, 1f, 0.8f)
        assertThat(CropWindowMath.isAtRatio(window, pictureRatio = 1f, targetRatio = 1.25f)).isTrue()
        assertThat(CropWindowMath.isAtRatio(window, pictureRatio = 1f, targetRatio = 0.8f)).isFalse()
        // The same fractions on a 4:5 picture are 1:1.
        assertThat(CropWindowMath.isAtRatio(window, pictureRatio = 0.8f, targetRatio = 1f)).isTrue()
    }

    /**
     * The whole picture is the shape the HT-CROP defect uploaded: a
     * report covering everything is never a 4:5 framing of a picture that
     * is not already 4:5.
     */
    @Test
    fun aWholePictureWindowIsNotAFramingOfAnyOtherShape() {
        val tall = 1080f / 2738f
        assertThat(CropWindowMath.isAtRatio(CropFraming.Whole, tall, 0.8f)).isFalse()
        assertThat(CropWindowMath.isAtRatio(CropFraming(0f, 0f, 1f, 0.9998f), tall, 0.8f)).isFalse()
        // Unless it genuinely is: a 4:5 picture framed whole is 4:5.
        assertThat(CropWindowMath.isAtRatio(CropFraming.Whole, 0.8f, 0.8f)).isTrue()
    }

    @Test
    fun theSlackCoversTheRoundingAndNothingWider() {
        val window = CropFraming(0f, 0f, 1f, 1f)
        val nearly = CropWindowMath.RATIO_SLACK / 2f
        assertThat(CropWindowMath.isAtRatio(window, 0.8f * (1f + nearly), 0.8f)).isTrue()
        assertThat(CropWindowMath.isAtRatio(window, 0.8f * 1.1f, 0.8f)).isFalse()
    }

    @Test
    fun aDegenerateWindowOrPictureIsNeverAFraming() {
        assertThat(CropWindowMath.isAtRatio(CropFraming(0.5f, 0.5f, 0.5f, 0.5f), 1f, 1f)).isFalse()
        assertThat(CropWindowMath.isAtRatio(CropFraming.Whole, 0f, 1f)).isFalse()
        assertThat(CropWindowMath.isAtRatio(CropFraming.Whole, Float.NaN, 1f)).isFalse()
        assertThat(CropWindowMath.isAtRatio(CropFraming.Whole, 1f, 0f)).isFalse()
    }

    /** Every discrete move keeps the window a framing of the same shape. */
    @Test
    fun theNonGestureRouteNeverLeavesTheShape() {
        val picture = 0.5f
        var window = CropWindowMath.largestWindow(targetRatio = 0.8f, pictureRatio = picture)
        assertThat(CropWindowMath.isAtRatio(window, picture, 0.8f)).isTrue()
        listOf(NudgeDirection.Left, NudgeDirection.Up, NudgeDirection.Right).forEach {
            window = CropWindowMath.nudged(window, it)
            assertThat(CropWindowMath.isAtRatio(window, picture, 0.8f)).isTrue()
        }
        window = CropWindowMath.zoomed(window, inward = true)
        assertThat(CropWindowMath.isAtRatio(window, picture, 0.8f)).isTrue()
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

    // -- Two fingers (jakob 2026-11-11: the sliver) --
    //
    // A half-size square window in the middle of a square picture drawn whole
    // over a 300 px stage: the window sits at 75..225 px, one pixel is 1/300.

    private val picture = ScreenWindow(left = 0f, top = 0f, width = 300f, height = 300f)

    private fun pinch(zoom: Float, cx: Float = 150f, cy: Float = 150f, panX: Float = 0f, panY: Float = 0f) =
        CropWindowMath.pinched(centred, CropFraming.Whole, picture, cx, cy, panX, panY, zoom)

    private fun CropFraming.assertIs(l: Float, t: Float, r: Float, b: Float) {
        assertThat(left).isWithin(TOLERANCE).of(l)
        assertThat(top).isWithin(TOLERANCE).of(t)
        assertThat(right).isWithin(TOLERANCE).of(r)
        assertThat(bottom).isWithin(TOLERANCE).of(b)
    }

    @Test
    fun spreadingTheFingersGrowsTheWindowAboutTheirCentroid() {
        // Zoom 2 → 2 / 2 = 1×, the fill: the whole picture.
        pinch(zoom = 2f).assertIs(0f, 0f, 1f, 1f)
    }

    @Test
    fun closingTheFingersShrinksTheWindowAboutTheirCentroid() {
        // 2× / 0.5 = 4×: a quarter-wide window about the centre.
        pinch(zoom = 0.5f).assertIs(0.375f, 0.375f, 0.625f, 0.625f)
    }

    @Test
    fun aPinchNeverGoesPastTheCeilingOrBelowTheFill() {
        // 2× / 0.1 = 20× → held at 4×; 2× / 10 = 0.2× → held at the fill.
        pinch(zoom = 0.1f).assertIs(0.375f, 0.375f, 0.625f, 0.625f)
        pinch(zoom = 10f).assertIs(0f, 0f, 1f, 1f)
    }

    @Test
    fun aPinchAboutACornerKeepsThatCornerUnderTheFingers() {
        // Centroid on the window's top-left (75, 75) = (0.25, 0.25): it stays put.
        pinch(zoom = 0.5f, cx = 75f, cy = 75f).assertIs(0.25f, 0.25f, 0.5f, 0.5f)
    }

    @Test
    fun theFingersTravellingCarryTheWindowWithThem() {
        // 15 px right, 30 px up at 1/300 a pixel: +0.05, −0.1.
        pinch(zoom = 1f, panX = 15f, panY = -30f).assertIs(0.30f, 0.15f, 0.80f, 0.65f)
    }

    @Test
    fun noArrangementOfFingersChangesTheWindowsShape() {
        // A square shape on a 1:2 picture: the fill is (0, .25, 1, .75). The
        // window's shape in pixels is its shape in fractions times 0.5.
        val fill = CropWindowMath.largestWindow(targetRatio = 1f, pictureRatio = 0.5f)
        val window = CropFraming(0.25f, 0.375f, 0.75f, 0.625f)
        val onScreen = ScreenWindow(100f, 100f, 100f, 100f)
        listOf(0.37f, 0.9f, 1f, 1.3f, 3f).forEach { zoom ->
            val next = CropWindowMath.pinched(window, fill, onScreen, 103f, 190f, 2f, -7f, zoom)
            assertThat(next.width / next.height * 0.5f).isWithin(TOLERANCE).of(1f)
        }
    }

    @Test
    fun aDegenerateStepLeavesTheWindowWhereItIs() {
        pinch(zoom = Float.NaN).assertIs(0.25f, 0.25f, 0.75f, 0.75f)
        CropWindowMath.pinched(centred, CropFraming.Whole, ScreenWindow(0f, 0f, 0f, 0f), 1f, 1f, 1f, 1f, 2f)
            .assertIs(0.25f, 0.25f, 0.75f, 0.75f)
    }

    @Test
    fun thePictureIsDrawnWholeAndCentredOnTheStage() {
        // A square picture on the 4:5 stage at 411 × 514: 411 wide, 51.5 down.
        assertThat(CropWindowMath.fitted(411f, 514f, 1f)).isEqualTo(ScreenWindow(0f, 51.5f, 411f, 411f))
        // A 1:2 picture there: 257 wide (514 × 0.5), 77 in from each side.
        assertThat(CropWindowMath.fitted(411f, 514f, 0.5f)).isEqualTo(ScreenWindow(77f, 0f, 257f, 514f))
    }

    // -- A shape switch changes only the frame (jakob 2026-11-11) --

    @Test
    fun aShapeSwitchKeepsTheWindowsCentreAndZoom() {
        // Square at 2× on a square picture, framing the upper left. Wide's
        // fill is 1 × 1/1.91 = 0.5236, so at 2× the window is 0.5 × 0.2618.
        val next = CropWindowMath.reshaped(CropFraming(0.1f, 0.1f, 0.6f, 0.6f), from = 1f, to = 1.91f, pictureRatio = 1f)

        next.assertIs(0.1f, 0.2191f, 0.6f, 0.4809f)
    }

    @Test
    fun aShapeSwitchSlidesTheWindowOnlyAsFarAsTheNewShapeNeeds() {
        // Wide at the fill on a 1:2 picture, at its top: (0, 0, 1, 0.2618).
        // Tall's fill there is 1 × 0.625; centred on 0.1309 it would start at
        // −0.1816, so it slides down to the edge and no further.
        val next = CropWindowMath.reshaped(CropFraming(0f, 0f, 1f, 0.2618f), from = 1.91f, to = 0.8f, pictureRatio = 0.5f)

        next.assertIs(0f, 0f, 1f, 0.625f)
    }

    private companion object {
        const val TOLERANCE = 0.001f

        /** More zoom steps than the clamp can possibly allow. */
        const val TOO_MANY_STEPS = 100
    }
}
