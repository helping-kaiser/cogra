// The system-bar appearance law (SystemBarOwner.kt): the status bar's icons
// follow the theme the APP paints, a surface under the bar declares a ground
// while it is up, and the app theme's reading returns when the declaration's
// scope ends. Robolectric exposes the window's insets controller, which is what
// the platform reads the icon colour from.

package com.cogra.core.designsystem

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.core.view.WindowCompat
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SystemBarOwnerTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private var app by mutableStateOf(BarGround.AppLight)
    private var declared by mutableStateOf<BarGround?>(null)

    private fun show() {
        compose.setContent {
            SystemBarOwner(appGround = app) {
                declared?.let { DeclareBarGround(it) }
            }
        }
        compose.waitForIdle()
    }

    private fun settle(change: () -> Unit) {
        change()
        compose.waitForIdle()
    }

    /** The platform's flag names the GROUND: true means a light ground, so DARK icons. */
    private fun statusIconsAreDark(): Boolean {
        val window = compose.activity.window
        return WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars
    }

    private fun navigationIconsAreDark(): Boolean {
        val window = compose.activity.window
        return WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightNavigationBars
    }

    @Test
    fun `a light themed app wears dark status icons`() {
        app = BarGround.AppLight
        show()
        assertThat(statusIconsAreDark()).isTrue()
        assertThat(navigationIconsAreDark()).isTrue()
    }

    @Test
    fun `a dark themed app wears light status icons`() {
        app = BarGround.AppDark
        show()
        assertThat(statusIconsAreDark()).isFalse()
        assertThat(navigationIconsAreDark()).isFalse()
    }

    @Test
    fun `a change of the app theme re-asserts the icons`() {
        show()
        settle { app = BarGround.AppDark }
        assertThat(statusIconsAreDark()).isFalse()
        settle { app = BarGround.AppLight }
        assertThat(statusIconsAreDark()).isTrue()
    }

    @Test
    fun `the reel stream sets light icons and exit restores the themes`() {
        show()
        assertThat(statusIconsAreDark()).isTrue()

        settle { declared = BarGround.ForcedDark }
        assertThat(statusIconsAreDark()).isFalse()

        settle { declared = null }
        assertThat(statusIconsAreDark()).isTrue()
    }

    @Test
    fun `the reel stream leaves the navigation bar on the app theme`() {
        show()
        settle { declared = BarGround.ForcedDark }
        assertThat(navigationIconsAreDark()).isTrue()
    }

    @Test
    fun `exit from the reel under a dark app keeps light icons`() {
        app = BarGround.AppDark
        show()
        settle { declared = BarGround.ForcedDark }
        assertThat(statusIconsAreDark()).isFalse()
        settle { declared = null }
        assertThat(statusIconsAreDark()).isFalse()
    }

    @Test
    fun `the top-most declaration wins and the one beneath returns when it leaves`() {
        var inner by mutableStateOf(true)
        compose.setContent {
            SystemBarOwner(appGround = BarGround.AppLight) {
                DeclareBarGround(BarGround.AppLight)
                if (inner) DeclareBarGround(BarGround.ForcedDark)
            }
        }
        compose.waitForIdle()
        assertThat(statusIconsAreDark()).isFalse()
        settle { inner = false }
        assertThat(statusIconsAreDark()).isTrue()
    }
}
