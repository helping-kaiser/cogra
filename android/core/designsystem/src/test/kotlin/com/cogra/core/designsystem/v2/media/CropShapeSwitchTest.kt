package com.cogra.core.designsystem.v2.media

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import com.canhub.cropper.CropImageView
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.MediaShape
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * A shape switch changes only the frame (jakob 2026-11-11: "when swapping
 * from tall to square or wide the image shrinks. i would just expect the
 * rectangle/frame to change").
 *
 * ComposeCrop.md (round 35): "WHEN tap a shape chip -> each picture keeps
 * its scale and its position AND the shape's frame changes around it AND
 * NEVER the picture shrinks to fit the new frame". In android's window
 * model the picture's stage keeps its size, and the window keeps its centre
 * and its zoom — measured against each shape's own fill, so it never stands
 * below the new fill (the sidecar's next line) — slid inside the picture
 * only as far as the new shape forces.
 */
@RunWith(RobolectricTestRunner::class)
@Config(
    shadows = [ShadowBitmapLoadingWorkerJob::class],
    instrumentedPackages = ["com.canhub.cropper"],
)
class CropShapeSwitchTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private fun cropView(): CropImageView = requireNotNull(compose.activity.window.decorView.findCropView())

    @Test
    fun switchingTheShapeKeepsThePictureAndChangesOnlyTheWindow() {
        val state = CropState(CropFraming.Whole)
        var shape by mutableStateOf(MediaShape.Square)
        compose.setContent {
            Cogra2PreviewTheme {
                MediaCrop(
                    item = MediaItem(URL, 1f, "a picture"),
                    shape = shape,
                    state = state,
                    modifier = Modifier.width(300.dp),
                    bleed = 0.dp,
                    testTag = TAG,
                )
            }
        }
        compose.waitForIdle()
        compose.runOnUiThread { cropView().completeDecode(URL, PICTURE, PICTURE) }
        compose.waitForIdle()
        // Square at 2×, framing the upper left: (0.1, 0.1) – (0.6, 0.6).
        compose.runOnUiThread {
            state.zoomTo(2f)
            state.panBy(-0.15f, -0.15f)
        }
        compose.waitForIdle()
        val stageBefore = compose.onNodeWithTag(TAG).fetchSemanticsNode().size
        val before = state.framing

        shape = MediaShape.Wide
        compose.waitForIdle()

        // The picture's stage did not move: same width, same height.
        val stageAfter = compose.onNodeWithTag(TAG).fetchSemanticsNode().size
        assertThat(stageAfter).isEqualTo(stageBefore)

        // The window: Wide's fill on a square picture is 1 × 0.5236, so at
        // the kept 2× it is 0.5 × 0.2618 about the kept centre (0.35, 0.35).
        val after = state.framing
        assertThat(state.zoom).isWithin(ZOOM_SLACK).of(2f)
        assertThat((after.left + after.right) / 2f).isWithin(SLACK).of((before.left + before.right) / 2f)
        assertThat((after.top + after.bottom) / 2f).isWithin(SLACK).of((before.top + before.bottom) / 2f)
        assertThat(after.width / after.height).isWithin(SHAPE_SLACK).of(MediaShape.Wide.ratio)

        // And it is the window the view draws.
        val view = cropView()
        val shown = CropWindowMath.framingOf(requireNotNull(view.cropRect), requireNotNull(view.wholeImageRect))
        assertThat(shown.left).isWithin(SLACK).of(after.left)
        assertThat(shown.top).isWithin(SLACK).of(after.top)
        assertThat(shown.width).isWithin(SLACK).of(after.width)
    }

    private companion object {
        const val TAG = "crop"
        const val URL = "content://cogra.test/shape-switch"
        const val PICTURE = 400
        const val SLACK = 0.01f
        const val ZOOM_SLACK = 0.05f
        const val SHAPE_SLACK = 0.05f
    }
}
