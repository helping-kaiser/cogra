package com.cogra.core.designsystem.v2.media

import com.cogra.core.designsystem.v2.token.MediaShape
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The framing's own rules, on the JVM: what it reports untouched, re-entered,
 * re-shaped and restored. The gestures that move it are [CropGestureTest]'s;
 * the cut it makes is [CropRoundTripTest]'s.
 */
class CropStateTest {

    private val landscape = 4f / 3f

    @Test
    fun anUntouchedPictureReportsTheLargestWindowOfTheShapeCentred() {
        val state = CropState(CropFraming.Whole, landscape, CropKind.Post, 1f)
        val framing = state.framing
        assertThat(framing.left).isWithin(1e-5f).of(0.125f)
        assertThat(framing.right).isWithin(1e-5f).of(0.875f)
        assertThat(framing.top).isWithin(1e-5f).of(0f)
        assertThat(framing.bottom).isWithin(1e-5f).of(1f)
        assertThat(state.zoomShare).isWithin(1e-5f).of(1f)
        assertThat(state.zoomShareMax).isWithin(1e-4f).of(CropGeometry.MAX_ZOOM * (487.5f / 292.5f) / (390f / 292.5f))
    }

    @Test
    fun aPictureWhoseShapeIsNotYetKnownReportsTheWindowItWasGiven() {
        val given = CropFraming(0.1f, 0.2f, 0.5f, 0.7f)
        assertThat(CropState(given, null, CropKind.Post, 1f).framing).isEqualTo(given)
        assertThat(CropState(CropFraming.Whole, null, CropKind.Post, 1f).framing).isEqualTo(CropFraming.Whole)
    }

    @Test
    fun aReenteredCropReportsItsWindowExactlySoNothingIsSentAgain() {
        val first = CropState(CropFraming.Whole, landscape, CropKind.Post, 1f).apply {
            zoomTo(2.5f)
            panBy(0.03f, 0.02f)
        }
        val left = first.framing
        val again = CropState(left, landscape, CropKind.Post, 1f)
        // Bit for bit: an equal spec is what keeps a finished upload.
        assertThat(again.framing).isEqualTo(left)
        assertThat(again.zoomShare).isWithin(1e-4f).of(2.5f)
    }

    @Test
    fun aShapeSwitchKeepsTheScaleAndThePositionAndNeverShrinks() {
        val state = CropState(CropFraming.Whole, landscape, CropKind.Post, MediaShape.Wide.ratio)
        state.zoomTo(3f)
        state.panBy(-0.05f, 0.04f)
        val zoomed = state.zoomShare
        val scale = state.placement(requireNotNull(state.geometry())).zoom
        state.reshape(MediaShape.Tall.ratio)
        // Tall's fill (487.5 / 292.5) is above Wide's (1), so the same picture
        // reads a lower share of the new fill — but the picture itself keeps
        // its scale, and coming back it is where it was.
        assertThat(state.placement(requireNotNull(state.geometry())).zoom).isWithin(1e-4f).of(scale)
        assertThat(state.zoomShare).isLessThan(zoomed)
        state.reshape(MediaShape.Wide.ratio)
        assertThat(state.zoomShare).isWithin(1e-4f).of(zoomed)
    }

    @Test
    fun anOffStagePictureTakesTheNewShapeToo() {
        val state = CropState(CropFraming.Whole, 1.5f, CropKind.Post, MediaShape.Tall.ratio)
        state.reshape(MediaShape.Wide.ratio)
        val framing = state.framing
        assertThat(framing.width / framing.height * 1.5f).isWithin(1e-4f).of(MediaShape.Wide.ratio)
    }

    @Test
    fun aRestoredStateFramesWhatTheSavedOneFramed() {
        val state = CropState(CropFraming.Whole, landscape, CropKind.Cover, 16f / 9f).apply {
            zoomTo(1.7f)
            panBy(0.02f, -0.02f)
        }
        val restored = CropState.restored(state.saved())
        assertThat(restored.kind).isEqualTo(CropKind.Cover)
        assertThat(restored.frameRatio).isEqualTo(16f / 9f)
        assertThat(restored.framing).isEqualTo(state.framing)
    }

    @Test
    fun resetPutsThePictureBackAtRest() {
        val state = CropState(CropFraming(0f, 0f, 0.4f, 0.4f), 1f, CropKind.Avatar, 1f)
        state.reset()
        assertThat(state.framing.left).isWithin(1e-5f).of(0f)
        assertThat(state.framing.right).isWithin(1e-5f).of(1f)
        assertThat(state.zoomShare).isWithin(1e-5f).of(1f)
    }
}
