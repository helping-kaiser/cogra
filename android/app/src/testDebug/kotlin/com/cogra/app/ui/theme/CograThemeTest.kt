// What CograTheme actually hands a screen. ColorSchemeTest pins the token
// values; this pins the wiring — that both themes reach composition intact and
// that the extended roles ride along with them.
//
// It is also the guard on design.md §2.5: dynamic colour is off, so the scheme a
// screen sees is the brand palette and never a wallpaper-derived one. Switching
// on dynamicLightColorScheme would fail these assertions on API 31+.
//
// HiltTestActivity rather than createComposeRule()'s bare ComponentActivity:
// testDebug's robolectric.properties runs the whole source set under
// HiltTestApplication, so the module's Compose host is the Hilt one.

package com.cogra.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import com.cogra.app.HiltTestActivity
import com.google.common.truth.Truth.assertThat
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
class CograThemeTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    private fun colorsUnder(darkTheme: Boolean): Pair<Color, Color> {
        var primary = Color.Unspecified
        var success = Color.Unspecified
        compose.setContent {
            CograTheme(darkTheme = darkTheme) {
                primary = MaterialTheme.colorScheme.primary
                success = CograTheme.colors.success
            }
        }
        compose.waitForIdle()
        return primary to success
    }

    @Test
    fun `light theme supplies the brand palette and the extended roles`() {
        val (primary, success) = colorsUnder(darkTheme = false)
        assertThat(primary).isEqualTo(LightTokens.primary)
        assertThat(success).isEqualTo(LightTokens.success)
    }

    @Test
    fun `dark theme supplies the brand palette and the extended roles`() {
        val (primary, success) = colorsUnder(darkTheme = true)
        assertThat(primary).isEqualTo(DarkTokens.primary)
        assertThat(success).isEqualTo(DarkTokens.success)
    }
}
