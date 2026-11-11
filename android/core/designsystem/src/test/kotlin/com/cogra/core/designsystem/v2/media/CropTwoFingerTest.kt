package com.cogra.core.designsystem.v2.media

import android.graphics.RectF
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.dp
import com.canhub.cropper.CropImageView
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.MediaShape
import com.google.common.truth.Truth.assertThat
import com.google.common.truth.Truth.assertWithMessage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.math.abs
import kotlin.math.max

/**
 * Two fingers on the crop (jakob 2026-11-11): "with two fingers we get
 * completely random behavior. the frame jumps around and even changes its
 * dimensions … a vertical sliver roughly 50 times as tall as wide".
 *
 * Every sequence is injected through Compose's own touch injection into
 * the **real** `CropImageView`, and after every single event the window the
 * view is showing is held to the invariants that must ALWAYS hold
 * (ComposeCrop.md): the window keeps the post's shape, stays inside the
 * picture, stays between the fill and about 4×, and never jumps — a
 * bounded finger movement makes a bounded window movement. Violations are
 * collected with their numbers rather than failing on the first, so a red
 * run says how far off the window went.
 */
@RunWith(RobolectricTestRunner::class)
@Config(
    shadows = [ShadowBitmapLoadingWorkerJob::class],
    instrumentedPackages = ["com.canhub.cropper"],
    // Room for a stage wide enough to hold a real pinch (below).
    qualifiers = "w800dp-h1200dp",
)
class CropTwoFingerTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private lateinit var state: CropState

    private fun cropView(): CropImageView = requireNotNull(
        compose.activity.window.decorView.findCropView(),
    ) { "the crop stage is not showing a CropImageView" }

    /** A square picture framed square, zoomed to 2× so the window can grow and shrink. */
    private fun stage() {
        state = CropState(CropFraming.Whole)
        compose.setContent {
            Cogra2PreviewTheme {
                MediaCrop(
                    item = MediaItem(PICTURE_URL, 1f, "a picture"),
                    shape = MediaShape.Square,
                    state = state,
                    modifier = Modifier.width(STAGE),
                    bleed = 0.dp,
                    testTag = TAG,
                )
            }
        }
        compose.waitForIdle()
        compose.runOnUiThread { cropView().completeDecode(PICTURE_URL, PICTURE, PICTURE) }
        compose.waitForIdle()
        compose.runOnUiThread { state.zoomTo(START_ZOOM) }
        compose.waitForIdle()
    }

    /** The window as drawn, in the view's (= the viewport's) pixels. */
    private fun drawn(): RectF = RectF(requireNotNull(cropView().cropWindowRect))

    /**
     * The fingers, and the invariants checked after every event they make.
     */
    private inner class Hand {
        private val at = mutableMapOf<Int, Offset>()
        private var last: RectF = drawn()
        private var events = 0
        val violations = mutableListOf<String>()

        fun down(id: Int, position: Offset) {
            at[id] = position
            compose.onNodeWithTag(TAG).performTouchInput { down(id, position) }
            check("down $id", step = 0f)
        }

        fun move(vararg moves: Pair<Int, Offset>) {
            var step = 0f
            compose.onNodeWithTag(TAG).performTouchInput {
                moves.forEach { (id, to) ->
                    val from = requireNotNull(at[id])
                    step = max(step, max(abs(to.x - from.x), abs(to.y - from.y)))
                    updatePointerTo(id, to)
                    at[id] = to
                }
                move()
            }
            check("move ${moves.joinToString { it.first.toString() }}", step)
        }

        fun up(id: Int) {
            compose.onNodeWithTag(TAG).performTouchInput { up(id) }
            at.remove(id)
            check("up $id", step = 0f)
        }

        private fun check(event: String, step: Float) {
            compose.waitForIdle()
            events++
            val view = cropView()
            val rect = requireNotNull(view.cropRect)
            val whole = requireNotNull(view.wholeImageRect)
            val window = drawn()
            val label = "event $events ($event)"

            // The post's shape, exactly (square here), in the picture's pixels and as drawn.
            val shape = rect.width().toFloat() / rect.height()
            if (abs(shape - 1f) > SHAPE_SLACK) {
                violations += "$label: window ${rect.width()}x${rect.height()} px is ${"%.2f".format(shape)}:1, not 1:1"
            }
            val drawnShape = window.width() / window.height()
            if (abs(drawnShape - 1f) > SHAPE_SLACK) {
                violations += "$label: drawn window ${"%.1f".format(window.width())}x" +
                    "${"%.1f".format(window.height())} is ${"%.3f".format(drawnShape)}:1"
            }
            // Inside the picture.
            if (rect.left < whole.left - PX || rect.top < whole.top - PX ||
                rect.right > whole.right + PX || rect.bottom > whole.bottom + PX
            ) {
                violations += "$label: window $rect leaves the picture $whole"
            }
            // Between the fill and about 4×.
            val zoom = whole.width().toFloat() / max(rect.width(), rect.height())
            if (zoom < CROP_ZOOM_MIN - ZOOM_SLACK || zoom > CROP_ZOOM_MAX + ZOOM_SLACK) {
                violations += "$label: zoom ${"%.2f".format(zoom)} outside $CROP_ZOOM_MIN..$CROP_ZOOM_MAX"
            }
            // No jump: the window moves and resizes no further than the fingers did.
            val moved = max(abs(window.centerX() - last.centerX()), abs(window.centerY() - last.centerY()))
            val resized = max(abs(window.width() - last.width()), abs(window.height() - last.height()))
            val bound = JUMP_FACTOR * step + PX
            if (moved > bound || resized > bound) {
                violations += "$label: window jumped ${"%.1f".format(moved)} px / resized " +
                    "${"%.1f".format(resized)} px for a finger step of ${"%.1f".format(step)} px"
            }
            last = window
        }

        fun assertClean() {
            assertWithMessage(violations.joinToString("\n", prefix = "\n")).that(violations).isEmpty()
        }
    }

    private fun centre(): Offset = drawn().let { Offset(it.centerX(), it.centerY()) }

    /*
     * The fingers sit further apart than the platform's minimum pinch span
     * (`ScaleGestureDetector`'s `config_minScalingSpan`, 27 mm — 170 px at
     * the test's 160 dpi): closer than that, Android does not read two
     * fingers as a pinch at all. On jakob's phone the same 27 mm is ~450 px,
     * an ordinary two-finger hold.
     */

    @Test
    fun aVerticalPinchKeepsTheShape() {
        stage()
        val c = centre()
        Hand().apply {
            down(0, c + Offset(-3f, -120f))
            down(1, c + Offset(3f, 120f))
            repeat(STEPS) { move(0 to c + Offset(-3f, -120f + (it + 1) * 3f), 1 to c + Offset(3f, 120f - (it + 1) * 3f)) }
            up(1)
            up(0)
        }.assertClean()
    }

    /** ComposeCrop.md:9 — "the framed picture zooms within the shape AND the zoom slider follows". */
    @Test
    fun aPinchMovesTheZoomSliderWithTheWindow() {
        stage()
        val c = centre()
        // Fingers 240 px apart close to 192: the window shrinks to 0.8 of
        // itself, so the zoom goes from 2× to 2 / 0.8 = 2.5×.
        Hand().apply {
            down(0, c + Offset(0f, -120f))
            down(1, c + Offset(0f, 120f))
            repeat(STEPS) { move(0 to c + Offset(0f, -120f + (it + 1) * 3f), 1 to c + Offset(0f, 120f - (it + 1) * 3f)) }
            up(1)
            up(0)
        }.assertClean()

        assertThat(state.zoom).isWithin(ZOOM_SLACK).of(2.5f)
        val slider = compose.onNodeWithTag("${TAG}_zoom").fetchSemanticsNode()
        assertThat(slider.config[SemanticsProperties.ProgressBarRangeInfo].current).isWithin(ZOOM_SLACK).of(state.zoom)
    }

    @Test
    fun aSpreadWithAMovingCentroidKeepsTheShapeAndFollowsTheFingers() {
        stage()
        val c = centre()
        Hand().apply {
            down(0, c + Offset(-100f, -30f))
            down(1, c + Offset(100f, 30f))
            repeat(STEPS) {
                val k = (it + 1).toFloat()
                move(0 to c + Offset(-100f - k * 2f + k * 6f, -30f - k * 2f), 1 to c + Offset(100f + k * 2f + k * 6f, 30f + k * 2f))
            }
            up(0)
            up(1)
        }.assertClean()
    }

    @Test
    fun liftingOneFingerMidPinchDoesNotJump() {
        stage()
        val c = centre()
        Hand().apply {
            down(0, c + Offset(-110f, 0f))
            down(1, c + Offset(110f, 0f))
            repeat(STEPS / 2) { move(0 to c + Offset(-110f - (it + 1) * 3f, 0f), 1 to c + Offset(110f + (it + 1) * 3f, 0f)) }
            up(0)
            val from = c + Offset(110f + STEPS / 2 * 3f, 0f)
            repeat(STEPS / 2) { move(1 to from + Offset(0f, (it + 1) * 5f)) }
            up(1)
        }.assertClean()
    }

    @Test
    fun aSecondFingerLandingDuringACornerDragKeepsTheShape() {
        stage()
        val w = drawn()
        val corner = Offset(w.left + 1f, w.top + 1f)
        Hand().apply {
            down(0, corner)
            repeat(3) { move(0 to corner + Offset((it + 1) * 4f, (it + 1) * 4f)) }
            val held = corner + Offset(12f, 12f)
            val second = Offset(w.centerX() + 60f, w.bottom - 40f)
            down(1, second)
            repeat(STEPS) {
                move(0 to held + Offset(0f, (it + 1) * 3f), 1 to second + Offset((it + 1) * 3f, 0f))
            }
            up(1)
            up(0)
        }.assertClean()
    }

    @Test
    fun fingersCrossingKeepTheShapeAndTheCeiling() {
        stage()
        val c = centre()
        Hand().apply {
            down(0, c + Offset(-110f, -6f))
            down(1, c + Offset(110f, 6f))
            repeat(CROSSING_STEPS) {
                val k = (it + 1) * 10f
                move(0 to c + Offset(-110f + k, -6f), 1 to c + Offset(110f - k, 6f))
            }
            up(0)
            up(1)
        }.assertClean()
    }

    private companion object {
        const val TAG = "crop"
        const val PICTURE_URL = "content://cogra.test/two-fingers"
        const val PICTURE = 800
        val STAGE = 600.dp
        const val START_ZOOM = 2f
        const val STEPS = 8
        const val CROSSING_STEPS = 22

        /** The window's integer trips, as a share of its shape. */
        const val SHAPE_SLACK = 0.03f

        /** The ceiling's integer rounding. */
        const val ZOOM_SLACK = 0.05f

        /** One pixel of rounding, wherever pixels are compared. */
        const val PX = 1.5f

        /**
         * How far a window may travel for each pixel the fingers moved. A
         * pinch about a centroid moves the far edge by the zoom times the
         * edge's distance, so a step can legitimately be amplified; four is
         * far above that here and far below a jump.
         */
        const val JUMP_FACTOR = 4f
    }
}
