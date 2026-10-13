package com.cogra.core.designsystem.v2.media

import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.test.assertTopPositionInRootIsEqualTo
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.media3.common.util.UnstableApi
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.shadows.ShadowDialog
import kotlin.math.roundToInt

/**
 * The viewer under the system-bar law (`app/ui/SystemBars.kt`; jakob
 * 2026-10-09, q-fx1a): the status bar's strip is not the viewer's. Its black
 * stops below the bar and reaches every other edge — the 2026-09-15 "black
 * reaches the edges" ruling stands for the bottom, gesture area included, and
 * the sides — and its window neither dims the strip nor gives the bar icons a
 * reading of its own.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class MediaViewerStatusBarTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    private val pictures = List(3) { MediaItem(url = null, aspectRatio = 1f, altText = "Picture $it") }

    private fun open() {
        compose.setContent {
            Cogra2PreviewTheme {
                MediaViewer(
                    items = pictures,
                    onClose = {},
                    insets = WindowInsets(top = STATUS_BAR, bottom = NAV_BAR),
                    statusBar = WindowInsets(top = STATUS_BAR),
                )
            }
        }
        compose.waitForIdle()
    }

    private fun SemanticsNode.root(): SemanticsNode = parent?.root() ?: this

    @Test
    fun `the black stops below the status bar and reaches every other edge`() {
        open()
        val viewer = compose.onNodeWithTag(VIEWER_TAG).fetchSemanticsNode()
        val window = viewer.root().size
        val bar = with(compose.density) { STATUS_BAR.toPx() }.roundToInt()

        compose.onNodeWithTag(VIEWER_TAG).assertTopPositionInRootIsEqualTo(STATUS_BAR)
        assertThat(viewer.boundsInRoot.left).isEqualTo(0f)
        assertThat(viewer.boundsInRoot.right.roundToInt()).isEqualTo(window.width)
        // The bottom edge — the navigation bar and its gesture area — stays black.
        assertThat(viewer.boundsInRoot.bottom.roundToInt()).isEqualTo(window.height)
        assertThat(viewer.size.height).isEqualTo(window.height - bar)
    }

    @Test
    fun `the X still sits its gap below the bar, not a second bar below it`() {
        open()
        compose.onNodeWithTag("${VIEWER_TAG}_close").assertTopPositionInRootIsEqualTo(STATUS_BAR + CHROME_GAP)
    }

    @Test
    fun `the viewer's window does not dim the strip`() {
        open()
        val attributes = ShadowDialog.getLatestDialog().window!!.attributes
        assertThat(attributes.flags and WindowManager.LayoutParams.FLAG_DIM_BEHIND).isEqualTo(0)
        assertThat(attributes.dimAmount).isEqualTo(0f)
    }

    @Test
    fun `the bar icons keep the app's reading while the viewer is open`() {
        val app = compose.activity.window
        compose.runOnUiThread {
            WindowCompat.getInsetsController(app, app.decorView).isAppearanceLightStatusBars = true
        }
        open()
        val viewer = ShadowDialog.getLatestDialog().window!!
        assertThat(WindowCompat.getInsetsController(viewer, viewer.decorView).isAppearanceLightStatusBars).isTrue()
    }

    private companion object {
        /** A phone's own bars, as a test can state them. */
        val STATUS_BAR = 24.dp
        val NAV_BAR = 48.dp

        /** `padding: "8px"` around the X (`MediaViewer.jsx:175`). */
        val CHROME_GAP = 8.dp
    }
}
