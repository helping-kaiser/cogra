package com.cogra.core.designsystem.v2.media

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.TouchInjectionScope
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.withKeyDown
import androidx.compose.ui.unit.dp
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

/**
 * The crop under real fingers (jakob, A1 2026-11-13: "two finger motions still
 * don't work … no jank, no guessing").
 *
 * Every sequence is injected through Compose's own touch injection
 * (developer.android.com/develop/ui/compose/testing/apis, "Actions" —
 * `performTouchInput` with `TouchInjectionScope.down` / `moveTo` /
 * `updatePointerTo` / `move` / `up` per pointer id), through the real
 * gesture loop, into the real [CropState] — and the picture is held to what
 * ComposeCrop.md says it does: the point under the fingers stays under the
 * fingers, a finger landing or lifting never moves the picture, the picture
 * never leaves the frame, and the zoom stays between the fill and the ceiling.
 */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w420dp-h900dp")
class CropGestureTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private lateinit var state: CropState

    /** The post's shape, as the chips hold it. */
    private var shape by mutableStateOf(MediaShape.Tall)

    /** A 3:2 picture under the Tall frame — wider than the frame, so it has room across from the start. */
    private fun stage(startShape: MediaShape = MediaShape.Tall, zoomShare: Float = 1f) {
        shape = startShape
        state = CropState(CropFraming.Whole, PICTURE_RATIO, CropKind.Post, startShape.ratio)
        compose.setContent {
            Cogra2PreviewTheme {
                MediaCrop(
                    item = MediaItem(null, PICTURE_RATIO, "a picture"),
                    shape = shape,
                    state = state,
                    modifier = Modifier.width(390.dp),
                    bleed = 0.dp,
                    testTag = TAG,
                )
            }
        }
        compose.waitForIdle()
        if (zoomShare != 1f) {
            compose.runOnUiThread { state.zoomTo(zoomShare) }
            compose.waitForIdle()
        }
    }

    private fun crop() = compose.onNodeWithTag(TAG)

    private fun layout(): CropLayout = requireNotNull(state.geometry()) { "the crop has no geometry" }

    private fun placement(): CropPlacement = state.placement(layout())

    /** Where a stage point stands on the picture, as a fraction of it. */
    private fun pictureAt(point: Offset): Offset {
        val layout = layout()
        val p = placement()
        val width = layout.picture.width * p.zoom
        val height = layout.picture.height * p.zoom
        val left = layout.stage.width / 2f + p.x - width / 2f
        val top = layout.stage.height / 2f + p.y - height / 2f
        return Offset((point.x - left) / width, (point.y - top) / height)
    }

    private fun near(actual: Offset, expected: Offset, within: Float = 1e-3f, what: String) {
        assertWithMessage("$what x").that(actual.x).isWithin(within).of(expected.x)
        assertWithMessage("$what y").that(actual.y).isWithin(within).of(expected.y)
    }

    private fun touch(block: TouchInjectionScope.() -> Unit) {
        crop().performTouchInput(block)
        compose.waitForIdle()
    }

    /** The picture never shows anything outside itself inside the frame. */
    private fun assertCoversTheFrame() {
        val framing = state.framing
        assertThat(framing.left).isAtLeast(0f)
        assertThat(framing.top).isAtLeast(0f)
        assertThat(framing.right).isAtMost(1f)
        assertThat(framing.bottom).isAtMost(1f)
        assertThat(state.zoomShare).isAtLeast(1f - 1e-4f)
        assertThat(state.zoomShare).isAtMost(state.zoomShareMax + 1e-4f)
    }

    // ---- one finger

    @Test
    fun oneFingerMovesThePictureWithTheFingerOnceItIsPastTheTouchSlop() {
        stage(zoomShare = 2f)
        val start = placement()
        val origin = crop().centerNow()
        touch {
            down(0, origin)
            // Past the slop in small steps, as a finger moves.
            repeat(SLOP_STEPS) { moveBy(0, Offset(STEP, 0f)) }
        }
        val finger = origin + Offset(STEP * SLOP_STEPS, 0f)
        val under = pictureAt(finger)
        assertThat(placement().x - start.x).isGreaterThan(0f)
        touch {
            repeat(DRAG_STEPS) { moveBy(0, Offset(STEP, STEP / 2f)) }
        }
        // From the moment it is past the slop, the picture point under the
        // finger stays under it, step for step.
        near(pictureAt(finger + Offset(STEP * DRAG_STEPS, STEP / 2f * DRAG_STEPS)), under, what = "the dragged point")
        touch { up(0) }
        assertCoversTheFrame()
    }

    @Test
    fun aDragStopsWhereThePictureEdgeMeetsTheFrame() {
        stage()
        touch {
            down(0, center)
            repeat(FAR_STEPS) { moveBy(0, Offset(STEP * 4, STEP * 4)) }
            up(0)
        }
        // Dragged right and down as far as a finger goes: the left edge meets
        // the frame's, and at the fill there is no room down at all.
        assertThat(state.framing.left).isWithin(1e-4f).of(0f)
        assertThat(state.framing.top).isWithin(1e-4f).of(0f)
        assertThat(state.framing.bottom).isWithin(1e-4f).of(1f)
        assertCoversTheFrame()
    }

    // ---- two fingers

    @Test
    fun twoFingersZoomAboutTheirMidpoint() {
        stage()
        val mid = crop().centerNow() + Offset(-40f, 60f)
        val before = pictureAt(mid)
        touch {
            down(0, mid - Offset(SPAN / 2f, 0f))
            down(1, mid + Offset(SPAN / 2f, 0f))
            repeat(PINCH_STEPS) { step ->
                val half = SPAN / 2f + (step + 1) * STEP
                updatePointerTo(0, mid - Offset(half, 0f))
                updatePointerTo(1, mid + Offset(half, 0f))
                move()
            }
        }
        assertThat(state.zoomShare).isGreaterThan(1.2f)
        near(pictureAt(mid), before, what = "the point between the fingers")
        touch {
            up(0)
            up(1)
        }
        assertCoversTheFrame()
    }

    @Test
    fun twoFingersPinchAndPanAtOnceAndThePointUnderThemStaysUnderThem() {
        stage(zoomShare = 1.5f)
        var mid = crop().centerNow()
        touch {
            down(0, mid - Offset(SPAN / 2f, 0f))
            down(1, mid + Offset(SPAN / 2f, 0f))
            // Past the slop by a spread alone.
            repeat(SLOP_STEPS) { step ->
                val half = SPAN / 2f + (step + 1) * STEP
                updatePointerTo(0, mid - Offset(half, 0f))
                updatePointerTo(1, mid + Offset(half, 0f))
                move()
            }
        }
        val under = pictureAt(mid)
        var half = SPAN / 2f + SLOP_STEPS * STEP
        touch {
            // Then both at once: the fingers spread while their centroid
            // travels down and to the left.
            repeat(PINCH_STEPS) {
                half += STEP
                mid += Offset(-STEP, STEP / 2f)
                updatePointerTo(0, mid - Offset(half, 0f))
                updatePointerTo(1, mid + Offset(half, 0f))
                move()
            }
        }
        near(pictureAt(mid), under, what = "the point under the moving pinch")
        touch {
            up(0)
            up(1)
        }
        assertCoversTheFrame()
    }

    @Test
    fun aSecondFingerLandingMidDragDoesNotMoveThePicture() {
        stage(zoomShare = 2f)
        val origin = crop().centerNow()
        val first = origin + Offset(STEP * (SLOP_STEPS + DRAG_STEPS), 0f)
        val second = origin + Offset(-SPAN / 2f, SPAN / 2f)
        touch {
            down(0, origin)
            repeat(SLOP_STEPS + DRAG_STEPS) { moveBy(0, Offset(STEP, 0f)) }
        }
        val before = placement()
        touch { down(1, second) }
        assertThat(placement()).isEqualTo(before)
        // And from there the two fingers carry it on together, by the
        // distance they travel.
        touch {
            updatePointerTo(0, first + Offset(STEP, 0f))
            updatePointerTo(1, second + Offset(STEP, 0f))
            move()
        }
        assertThat(placement().x - before.x).isWithin(1e-2f).of(STEP)
        assertThat(placement().zoom).isWithin(1e-4f).of(before.zoom)
        touch {
            up(0)
            up(1)
        }
    }

    @Test
    fun aFingerLiftingMidPinchDoesNotMoveThePictureAndTheOtherKeepsPanning() {
        stage()
        val mid = crop().centerNow()
        touch {
            down(0, mid - Offset(SPAN / 2f, 0f))
            down(1, mid + Offset(SPAN / 2f, 0f))
            repeat(PINCH_STEPS) { step ->
                val half = SPAN / 2f + (step + 1) * STEP
                updatePointerTo(0, mid - Offset(half, 0f))
                updatePointerTo(1, mid + Offset(half, 0f))
                move()
            }
        }
        val before = placement()
        touch { up(1) }
        assertThat(placement()).isEqualTo(before)
        val remaining = mid - Offset(SPAN / 2f + PINCH_STEPS * STEP, 0f)
        val under = pictureAt(remaining)
        touch { repeat(DRAG_STEPS) { moveBy(0, Offset(-STEP, 0f)) } }
        near(pictureAt(remaining - Offset(STEP * DRAG_STEPS, 0f)), under, what = "the point under the finger left")
        assertThat(placement().zoom).isEqualTo(before.zoom)
        touch { up(0) }
        assertCoversTheFrame()
    }

    @Test
    fun aThirdFingerLandingAndLiftingNeverMovesThePicture() {
        stage(zoomShare = 2f)
        val mid = crop().centerNow()
        touch {
            down(0, mid - Offset(SPAN / 2f, 0f))
            down(1, mid + Offset(SPAN / 2f, 0f))
            repeat(SLOP_STEPS) { step ->
                updatePointerTo(0, mid - Offset(SPAN / 2f + (step + 1) * STEP, 0f))
                updatePointerTo(1, mid + Offset(SPAN / 2f + (step + 1) * STEP, 0f))
                move()
            }
        }
        val before = placement()
        touch { down(2, mid + Offset(0f, SPAN)) }
        assertThat(placement()).isEqualTo(before)
        touch { up(2) }
        assertThat(placement()).isEqualTo(before)
        touch {
            up(0)
            up(1)
        }
    }

    @Test
    fun aPinchOutStopsAtTheCeilingWithoutSlidingThePicture() {
        stage()
        val mid = crop().centerNow()
        touch {
            down(0, mid - Offset(SPAN / 4f, 0f))
            down(1, mid + Offset(SPAN / 4f, 0f))
            repeat(FAR_STEPS) { step ->
                val half = SPAN / 4f + (step + 1) * STEP * 3
                updatePointerTo(0, mid - Offset(half, 0f))
                updatePointerTo(1, mid + Offset(half, 0f))
                move()
            }
        }
        assertThat(state.zoomShare).isWithin(1e-3f).of(CropGeometry.MAX_ZOOM)
        val atCeiling = placement()
        // Spreading further changes nothing: a held zoom is a pure pan, and
        // these fingers' centroid stands still.
        touch {
            updatePointerTo(0, mid - Offset(SPAN * 1.5f, 0f))
            updatePointerTo(1, mid + Offset(SPAN * 1.5f, 0f))
            move()
        }
        assertThat(abs(placement().x - atCeiling.x)).isLessThan(1e-2f)
        assertThat(abs(placement().y - atCeiling.y)).isLessThan(1e-2f)
        touch {
            up(0)
            up(1)
        }
        assertCoversTheFrame()
    }

    @Test
    fun aPinchInStopsAtTheFillAndThePictureStillCoversTheFrame() {
        stage(zoomShare = 1.6f)
        // Both fingers land ON the stage (a finger landing outside it is not
        // the stage's), 30 short of its width apart, and close to 110: the spread zooms until
        // they are the minimum scaling span apart, past the floor however
        // much the slop takes.
        val mid = crop().centerNow() + Offset(0f, -80f)
        val start = crop().fetchSemanticsNode().size.width / 2f - EDGE_ROOM
        touch {
            down(0, mid - Offset(start, 0f))
            down(1, mid + Offset(start, 0f))
            repeat(FAR_STEPS) { step ->
                val half = (start - (step + 1) * STEP).coerceAtLeast(SPAN / 4f)
                updatePointerTo(0, mid - Offset(half, 0f))
                updatePointerTo(1, mid + Offset(half, 0f))
                move()
            }
            up(0)
            up(1)
        }
        compose.waitForIdle()
        assertThat(state.zoomShare).isWithin(1e-3f).of(1f)
        assertCoversTheFrame()
    }

    // ---- the slider and the keys

    @Test
    fun thePinchMovesTheSliderAndTheSliderZoomsThePicture() {
        stage()
        val mid = crop().centerNow()
        touch {
            down(0, mid - Offset(SPAN / 2f, 0f))
            down(1, mid + Offset(SPAN / 2f, 0f))
            repeat(PINCH_STEPS) { step ->
                val half = SPAN / 2f + (step + 1) * STEP
                updatePointerTo(0, mid - Offset(half, 0f))
                updatePointerTo(1, mid + Offset(half, 0f))
                move()
            }
            up(0)
            up(1)
        }
        compose.waitForIdle()
        val slider = compose.onNodeWithTag("${TAG}_zoom").fetchSemanticsNode()
            .config[SemanticsProperties.ProgressBarRangeInfo]
        assertThat(slider.current).isWithin(1e-3f).of(state.zoomShare)
        assertThat(slider.range.endInclusive).isWithin(1e-3f).of(state.zoomShareMax)

        compose.onNodeWithTag("${TAG}_zoom").performSemanticsAction(SemanticsActions.SetProgress) { it(3f) }
        compose.waitForIdle()
        assertThat(state.zoomShare).isWithin(1e-2f).of(3f)
        assertCoversTheFrame()
    }

    @OptIn(ExperimentalTestApi::class)
    @Test
    fun anArrowMovesThePictureOnePercentOfItselfAndShiftTen() {
        stage(zoomShare = 2f)
        crop().performSemanticsAction(SemanticsActions.RequestFocus)
        val laid = layout().picture.width * placement().zoom
        val start = placement().x
        crop().performKeyInput { pressKey(Key.DirectionRight) }
        compose.waitForIdle()
        assertThat(placement().x - start).isWithin(1e-2f).of(0.01f * laid)
        crop().performKeyInput { withKeyDown(Key.ShiftLeft) { pressKey(Key.DirectionLeft) } }
        compose.waitForIdle()
        assertThat(placement().x - start).isWithin(1e-2f).of(-0.09f * laid)
    }

    // ---- the shape switch

    @Test
    fun aShapeSwitchKeepsThePictureWhereItStoodAndRisesOnlyToTheNewFill() {
        stage(startShape = MediaShape.Wide, zoomShare = 1f)
        // Wide's fill is far below Tall's for a 3:2 picture: the switch raises
        // the zoom to Tall's fill and no further; centred, it stays centred.
        switchTo(MediaShape.Tall)
        val layout = layout()
        assertThat(placement().zoom).isWithin(1e-4f).of(layout.bounds.floor)
        assertThat(placement().x).isWithin(1e-3f).of(0f)
        // Back to Wide: the picture does not shrink.
        val tallZoom = placement().zoom
        switchTo(MediaShape.Wide)
        assertThat(placement().zoom).isWithin(1e-4f).of(tallZoom)
        assertCoversTheFrame()
    }

    /** A shape chip, as `CropFrames` handles it: the framing re-shaped, then the shape shown. */
    private fun switchTo(next: MediaShape) {
        compose.runOnUiThread {
            state.reshape(next.ratio)
            shape = next
        }
        compose.waitForIdle()
    }

    private fun androidx.compose.ui.test.SemanticsNodeInteraction.centerNow(): Offset {
        val size = fetchSemanticsNode().size
        return Offset(size.width / 2f, size.height / 2f)
    }

    private companion object {
        const val TAG = "crop"
        const val PICTURE_RATIO = 1.5f

        /** One finger step, in pixels. */
        const val STEP = 4f

        /** Enough steps to pass the touch slop (8 dp) at [STEP]. */
        const val SLOP_STEPS = 6
        const val DRAG_STEPS = 10
        const val PINCH_STEPS = 12
        const val FAR_STEPS = 60

        /**
         * The fingers' distance apart, in pixels — wider than the platform's
         * minimum scaling span (27 mm, about 170 px at the test's mdpi), under
         * which a spread does not zoom.
         */
        const val SPAN = 220f

        /** How far inside the stage's edge a finger lands. */
        const val EDGE_ROOM = 15f
    }
}
