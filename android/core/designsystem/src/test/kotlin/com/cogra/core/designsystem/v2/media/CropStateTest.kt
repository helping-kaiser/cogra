package com.cogra.core.designsystem.v2.media

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The framing arithmetic, tested without composition — the same split the
 * stance pad uses, and the reason the clamping lives in a plain class.
 *
 * The invariant under test throughout: **the frame never leaves the
 * picture.** Every offset is bounded by how far the zoom has pushed the
 * picture past the viewport, so no state can expose the reserved surface.
 */
class CropStateTest {

    private val viewport = Size(300f, 400f)

    private fun state(sourceRatio: Float = CropState.UNKNOWN_RATIO): CropState =
        CropState(CropState.MIN_SCALE, Offset.Zero)
            .apply { measured(this@CropStateTest.viewport, sourceRatio) }

    @Test
    fun anUnzoomedFrameOfTheSameShapeCannotBePannedAtAll() {
        val state = state()

        state.panBy(Offset(500f, 500f))

        // A picture whose ratio matches the frame's exactly covers it, so
        // there is nowhere to go without zooming.
        assertThat(state.offset).isEqualTo(Offset.Zero)
    }

    @Test
    fun aWiderPictureSlidesAcrossItsFrameWithoutAnyZoom() {
        // 2:1 into the 3:4 frame: the cover fit draws it 800 wide against a
        // 300-wide frame, so there is 250px of slack on each side — and
        // reaching it is the whole point of choosing a shape.
        val state = state(sourceRatio = 2f)

        state.panBy(Offset(1000f, 1000f))

        assertThat(state.offset.x).isWithin(0.01f).of(250f)
        assertThat(state.offset.y).isEqualTo(0f)
    }

    @Test
    fun aTallerPictureSlidesUpAndDownRatherThanSideways() {
        val state = state(sourceRatio = 0.5f)

        state.panBy(Offset(1000f, 1000f))

        assertThat(state.offset.x).isEqualTo(0f)
        // Drawn 300x600 in a 300x400 frame: 100px of slack each way.
        assertThat(state.offset.y).isWithin(0.01f).of(100f)
    }

    @Test
    fun changingTheFramesShapeReFramesAgainstTheNewOneAndNotTheOld() {
        val state = state(sourceRatio = 2f)
        state.panBy(Offset(1000f, 0f))
        assertThat(state.offset.x).isWithin(0.01f).of(250f)

        // The author switches the post to a wide shape. The same picture
        // now nearly fills it, so the framing that was legal has to come
        // back inside the new geometry — the crop is cut from the original
        // either way, never from the previous crop.
        state.measured(Size(300f, 200f), sourceRatio = 2f)

        // Drawn 400x200 in a 300x200 frame: 50px of slack each way.
        assertThat(state.offset.x).isWithin(0.01f).of(50f)
    }

    @Test
    fun theSameMeasurementReportedAgainChangesNothing() {
        val state = state(sourceRatio = 2f)
        state.panBy(Offset(200f, 0f))

        repeat(5) { state.measured(viewport, 2f) }

        assertThat(state.offset.x).isWithin(0.01f).of(200f)
    }

    @Test
    fun theFramingReadsBackTheZoomAndWhereTheFrameSits() {
        val state = state(sourceRatio = 2f)

        assertThat(state.framingDescription()).isEqualTo("Zoom 100%, centred")

        state.panBy(Offset(1000f, 0f))

        assertThat(state.framingDescription()).isEqualTo("Zoom 100%, at the left")
    }

    @Test
    fun zoomingInAllowsPanningInProportion() {
        val state = state()

        state.zoomBy(2f)
        state.panBy(Offset(1000f, 1000f))

        // (scale - 1) * size / 2 — half the overhang, on each axis.
        assertThat(state.offset.x).isWithin(0.01f).of(150f)
        assertThat(state.offset.y).isWithin(0.01f).of(200f)
    }

    @Test
    fun panningIsClampedOnBothSides() {
        val state = state()

        state.zoomBy(2f)
        state.panBy(Offset(-1000f, -1000f))

        assertThat(state.offset.x).isWithin(0.01f).of(-150f)
        assertThat(state.offset.y).isWithin(0.01f).of(-200f)
    }

    @Test
    fun zoomIsBoundedAtBothEnds() {
        val state = state()

        state.zoomBy(100f)
        assertThat(state.scale).isEqualTo(CropState.MAX_SCALE)

        state.zoomBy(0.001f)
        assertThat(state.scale).isEqualTo(CropState.MIN_SCALE)
    }

    @Test
    fun zoomingBackOutPullsAnOutOfRangeOffsetWithIt() {
        val state = state()
        state.zoomBy(3f)
        state.panBy(Offset(1000f, 1000f))
        val panned = state.offset
        assertThat(panned.x).isGreaterThan(0f)

        state.zoomBy(1f / 3f)

        // Back at scale 1 there is no overhang left, so the offset that was
        // legal a moment ago has to be pulled home rather than left dangling.
        assertThat(state.offset).isEqualTo(Offset.Zero)
    }

    @Test
    fun eachNudgeMovesOneStepOfTheViewport() {
        val state = state()
        state.zoomBy(2f)

        state.nudge(NudgeDirection.Left)

        assertThat(state.offset.x)
            .isWithin(0.01f)
            .of(viewport.width * CropState.NUDGE_FRACTION)
        assertThat(state.offset.y).isEqualTo(0f)
    }

    @Test
    fun oppositeNudgesCancel() {
        val state = state()
        state.zoomBy(2f)

        state.nudge(NudgeDirection.Left)
        state.nudge(NudgeDirection.Right)

        assertThat(state.offset.x).isWithin(0.01f).of(0f)
    }

    @Test
    fun verticalNudgesMoveOnlyTheVerticalAxis() {
        val state = state()
        state.zoomBy(2f)

        state.nudge(NudgeDirection.Up)

        assertThat(state.offset.x).isEqualTo(0f)
        assertThat(state.offset.y)
            .isWithin(0.01f)
            .of(viewport.height * CropState.NUDGE_FRACTION)

        state.nudge(NudgeDirection.Down)
        assertThat(state.offset.y).isWithin(0.01f).of(0f)
    }

    @Test
    fun nudgingIsClampedLikeDragging() {
        val state = state()
        state.zoomBy(2f)

        repeat(50) { state.nudge(NudgeDirection.Left) }

        assertThat(state.offset.x).isWithin(0.01f).of(150f)
    }

    @Test
    fun steppedZoomWalksInBothDirections() {
        val state = state()

        state.stepZoom(inward = true)
        assertThat(state.scale).isWithin(0.001f).of(CropState.ZOOM_STEP)

        state.stepZoom(inward = false)
        assertThat(state.scale).isWithin(0.001f).of(CropState.MIN_SCALE)
    }

    @Test
    fun theZoomControlsReportWhenTheyWouldDoNothing() {
        val state = state()

        // Fully out: only inward is available.
        assertThat(state.canZoom(inward = true)).isTrue()
        assertThat(state.canZoom(inward = false)).isFalse()

        state.zoomBy(CropState.MAX_SCALE)

        assertThat(state.canZoom(inward = true)).isFalse()
        assertThat(state.canZoom(inward = false)).isTrue()
    }

    @Test
    fun resetReturnsToTheUntouchedFraming() {
        val state = state()
        state.zoomBy(3f)
        state.panBy(Offset(100f, 100f))

        state.reset()

        assertThat(state.scale).isEqualTo(CropState.MIN_SCALE)
        assertThat(state.offset).isEqualTo(Offset.Zero)
    }

    @Test
    fun aLateMeasurementReClampsWhateverWasAlreadyThere() {
        val state = CropState(2f, Offset(1000f, 1000f))

        state.measured(viewport, CropState.UNKNOWN_RATIO)

        // The offset was set before anything knew how big the viewport was;
        // measuring has to bring it inside rather than trust it.
        assertThat(state.offset.x).isWithin(0.01f).of(150f)
        assertThat(state.offset.y).isWithin(0.01f).of(200f)
    }
}
