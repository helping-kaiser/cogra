package com.cogra.core.designsystem.v2.media

import android.graphics.Bitmap
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createAndroidComposeRule
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
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements

/**
 * Stops the cropper's decode worker from ever running.
 *
 * It decodes on `Dispatchers.Default`, whose threads sit outside
 * Robolectric's sandbox classloader, so the framework classes the decoder
 * reaches for (`javax.microedition.khronos.egl`) are simply absent and it
 * dies with a `NoClassDefFoundError` no `try`/`catch` in the library
 * covers. The pictures in these tests arrive through the worker's own
 * completion callback instead, delivered by hand.
 *
 * Named by string rather than by class because the worker is `internal`
 * to the cropper.
 */
@Implements(className = "com.canhub.cropper.BitmapLoadingWorkerJob", isInAndroidSdk = false)
class ShadowBitmapLoadingWorkerJob {
    @Implementation
    fun start() = Unit
}

/**
 * The crop viewport driven through the **real** `CropImageView`.
 *
 * These two bugs were both invisible to a state-level test, which is why
 * they reached a hand test: the framing arithmetic was right the whole
 * time, and what was wrong was the wiring between one reused view and the
 * several framings it serves. So every assertion here reads the view —
 * the window it is actually showing — rather than the state's own idea of
 * it, and the pictures arrive through the library's own decode-completion
 * callback rather than being handed to the state directly.
 *
 * Both repros are jakob's, from the live test on 2026-09-01.
 */
@RunWith(RobolectricTestRunner::class)
@Config(
    shadows = [ShadowBitmapLoadingWorkerJob::class],
    instrumentedPackages = ["com.canhub.cropper"],
)
class CropViewBindingTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    // ---- Driving the real view ----------------------------------------

    /**
     * Delivers the library's own decode completion — the entry point its
     * background worker calls once the bitmap has landed.
     *
     * Reached reflectively because both the callback and its result type
     * are `internal` to the cropper. The alternative is a real decode on
     * a background dispatcher against a `ContentResolver`, which would
     * make every crop test a race; this drives the identical code path,
     * `setBitmap` and then the uri-complete listener, with no timing in
     * it at all.
     */
    private fun CropImageView.completeDecode(url: String, size: Int) {
        val resultType = Class.forName("com.canhub.cropper.BitmapLoadingWorkerJob\$Result")
        val result = resultType.getConstructor(
            Uri::class.java,
            Bitmap::class.java,
            Int::class.javaPrimitiveType,
            Int::class.javaPrimitiveType,
            Boolean::class.javaPrimitiveType,
            Boolean::class.javaPrimitiveType,
            Exception::class.java,
        ).newInstance(
            Uri.parse(url),
            Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888),
            1,
            0,
            false,
            false,
            null,
        )
        CropImageView::class.java
            .getMethod("onSetImageUriAsyncComplete\$cropper_release", resultType)
            .invoke(this, result)
    }

    private fun View.findCropView(): CropImageView? = when {
        this is CropImageView -> this
        this is ViewGroup -> (0 until childCount).firstNotNullOfOrNull {
            getChildAt(it).findCropView()
        }
        else -> null
    }

    private fun cropView(): CropImageView = requireNotNull(
        compose.activity.window.decorView.findCropView(),
    ) { "the crop stage is not showing a CropImageView" }

    private fun decode(url: String) {
        compose.runOnUiThread { cropView().completeDecode(url, PICTURE) }
        compose.waitForIdle()
    }

    /**
     * Moves the window on the view itself, the way a drag settles: the
     * library re-initialises its overlay from the rect and reports the
     * change through the same listener a gesture would.
     */
    private fun moveWindowTo(window: CropFraming) {
        compose.runOnUiThread {
            val view = cropView()
            view.cropRect = CropWindowMath.rectOf(window, requireNotNull(view.wholeImageRect))
        }
        compose.waitForIdle()
    }

    /** The window the view is showing, as fractions of its picture. */
    private fun shownFraming(): CropFraming {
        val view = cropView()
        return CropWindowMath.framingOf(
            requireNotNull(view.cropRect) { "the view is showing no window" },
            requireNotNull(view.wholeImageRect) { "the view has no picture" },
        )
    }

    // ---- Bug one: the framing must come back on the view ---------------

    /**
     * "when i have cropped an image (e.g. zoom in alot and choose a part
     * to the very right) … but when pressing back (returning to the crop
     * section) the cropping is back to default (at least visually)."
     *
     * The state was never the problem — the previews downstream were
     * right. What failed was putting the window back on the view, so the
     * assertion is on the view's own window after the return.
     */
    @Test
    fun aFramingMadeOnTheRightIsBackOnTheViewAfterLeavingTheStage() {
        var onStage by mutableStateOf(true)
        var remembered = CropFraming.Whole
        lateinit var state: CropState

        compose.setContent {
            Cogra2PreviewTheme {
                if (onStage) {
                    // What the wizard does on re-entry: a new holder,
                    // opened at the framing it kept for this picture.
                    val entered = remember(onStage) { CropState(remembered) }
                    state = entered
                    MediaCrop(
                        item = MediaItem(PICTURE_ONE, 1f, "a picture"),
                        shape = MediaShape.Square,
                        state = entered,
                        modifier = Modifier.width(STAGE),
                        bleed = 0.dp,
                        testTag = "crop",
                    )
                }
            }
        }
        compose.waitForIdle()

        decode(PICTURE_ONE)
        moveWindowTo(HARD_RIGHT)

        // The author is framing the far right of the picture.
        assertThat(shownFraming().left).isGreaterThan(HALF)
        remembered = state.framing

        // On to the details stage and back: a fresh composition, a fresh
        // view, and the framing handed back the way the wizard hands it.
        onStage = false
        compose.waitForIdle()
        onStage = true
        compose.waitForIdle()
        decode(PICTURE_ONE)

        val shown = shownFraming()
        assertThat(shown.left).isWithin(TOLERANCE).of(remembered.left)
        assertThat(shown.top).isWithin(TOLERANCE).of(remembered.top)
        assertThat(shown.width).isWithin(TOLERANCE).of(remembered.width)
        // The failure this pins is a *centred* default window, so being
        // on the right half is the part that actually regressed.
        assertThat(shown.left).isGreaterThan(HALF)
    }

    /**
     * The same return, seen from the state: it must not drift either,
     * because the state is what the previews and the upload read.
     */
    @Test
    fun theFramingKeptAcrossTheStageMatchesWhatTheViewShows() {
        var onStage by mutableStateOf(true)
        var remembered = CropFraming.Whole
        lateinit var state: CropState

        compose.setContent {
            Cogra2PreviewTheme {
                if (onStage) {
                    val entered = remember(onStage) { CropState(remembered) }
                    state = entered
                    MediaCrop(
                        item = MediaItem(PICTURE_ONE, 1f, "a picture"),
                        shape = MediaShape.Square,
                        state = entered,
                        modifier = Modifier.width(STAGE),
                        bleed = 0.dp,
                        testTag = "crop",
                    )
                }
            }
        }
        compose.waitForIdle()
        decode(PICTURE_ONE)
        moveWindowTo(HARD_RIGHT)
        remembered = state.framing

        onStage = false
        compose.waitForIdle()
        onStage = true
        compose.waitForIdle()
        decode(PICTURE_ONE)

        assertThat(state.framing.left).isWithin(TOLERANCE).of(remembered.left)
        assertThat(state.framing.width).isWithin(TOLERANCE).of(remembered.width)
    }

    // ---- Bug two: one picture's framing is not the other's -------------

    /**
     * "cropping two images (galery post) influences the other image …
     * the preview of image 1 visibly changes every time i move image 2
     * crop."
     *
     * The window events fired *during* the switch are the dangerous ones:
     * the view goes on showing picture one's bitmap until picture two has
     * decoded, so anything reported in between describes a picture
     * neither framing should record.
     */
    @Test
    fun framingTheSecondPictureNeverWritesTheFirstsEntry() {
        val first = CropState(CropFraming.Whole)
        val second = CropState(CropFraming.Whole)
        var showing by mutableStateOf(0)

        compose.setContent {
            Cogra2PreviewTheme {
                MediaCrop(
                    item = MediaItem(
                        if (showing == 0) PICTURE_ONE else PICTURE_TWO,
                        1f,
                        "a picture",
                    ),
                    shape = MediaShape.Square,
                    state = if (showing == 0) first else second,
                    modifier = Modifier.width(STAGE),
                    bleed = 0.dp,
                    testTag = "crop",
                )
            }
        }
        compose.waitForIdle()

        decode(PICTURE_ONE)
        moveWindowTo(HARD_RIGHT)
        val settled = first.framing
        assertThat(settled.left).isGreaterThan(HALF)

        // The filmstrip moves on. Asking for the next picture blanks the
        // view outright, so there is nothing to measure until picture
        // two lands — and what lands with it is the library's own
        // default window, which is not picture one's either.
        showing = 1
        compose.waitForIdle()
        assertThat(first.framing).isEqualTo(settled)

        decode(PICTURE_TWO)
        assertThat(first.framing).isEqualTo(settled)
        repeat(MOVES) { step ->
            val edge = STEP * step
            moveWindowTo(CropFraming(edge, edge, edge + THIRD, edge + THIRD))
            assertThat(first.framing).isEqualTo(settled)
        }

        // Picture two really was framed: the isolation is not just a
        // listener that stopped reporting anything at all.
        assertThat(second.framing.left).isWithin(TOLERANCE).of(STEP * (MOVES - 1))
        assertThat(second.framing.left).isLessThan(HALF)
    }

    /**
     * The first picture's window is also still on the view when the
     * filmstrip comes back to it — the shared view has to be pointed at
     * the earlier picture again, not left on the one it last decoded.
     */
    @Test
    fun comingBackToTheFirstPictureShowsItsOwnFramingAgain() {
        val first = CropState(CropFraming.Whole)
        val second = CropState(CropFraming.Whole)
        var showing by mutableStateOf(0)

        compose.setContent {
            Cogra2PreviewTheme {
                MediaCrop(
                    item = MediaItem(
                        if (showing == 0) PICTURE_ONE else PICTURE_TWO,
                        1f,
                        "a picture",
                    ),
                    shape = MediaShape.Square,
                    state = if (showing == 0) first else second,
                    modifier = Modifier.width(STAGE),
                    bleed = 0.dp,
                    testTag = "crop",
                )
            }
        }
        compose.waitForIdle()

        decode(PICTURE_ONE)
        moveWindowTo(HARD_RIGHT)
        val settled = first.framing

        showing = 1
        compose.waitForIdle()
        decode(PICTURE_TWO)
        moveWindowTo(CropFraming(0f, 0f, THIRD, THIRD))

        showing = 0
        compose.waitForIdle()
        decode(PICTURE_ONE)

        val shown = shownFraming()
        assertThat(shown.left).isWithin(TOLERANCE).of(settled.left)
        assertThat(shown.width).isWithin(TOLERANCE).of(settled.width)
    }

    private companion object {
        const val PICTURE_ONE = "content://cogra.test/picture-one"
        const val PICTURE_TWO = "content://cogra.test/picture-two"

        /** A square picture, so a square window stays square. */
        const val PICTURE = 400

        val STAGE = 300.dp

        /** Zoomed well in, hard against the right edge. */
        val HARD_RIGHT = CropFraming(0.62f, 0.10f, 0.96f, 0.44f)

        const val HALF = 0.5f
        const val THIRD = 0.3f
        const val STEP = 0.05f
        const val MOVES = 3

        /**
         * The window makes two trips through integer pixels — into the
         * picture's own and back out — so exactness is not on offer;
         * three parts in a hundred is far tighter than the bug being
         * pinned, which put the window in the middle of the picture.
         */
        const val TOLERANCE = 0.03f
    }
}
