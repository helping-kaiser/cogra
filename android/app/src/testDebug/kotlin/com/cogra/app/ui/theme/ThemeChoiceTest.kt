// Settings.md "Theme": Light and Dark are absolute, Auto follows the
// device; the choice repaints the app the moment it changes.

package com.cogra.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.app.HiltTestActivity
import com.cogra.domain.store.ThemeChoice
import com.cogra.domain.testing.FakeDevicePreferences
import com.google.common.truth.Truth.assertThat
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
class ThemeChoiceTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    @Test
    fun `auto_follows_the_device_setting`() {
        assertThat(paintsDark(ThemeChoice.AUTO, systemDark = true)).isTrue()
        assertThat(paintsDark(ThemeChoice.AUTO, systemDark = false)).isFalse()
        assertThat(paintsDark(ThemeChoice.LIGHT, systemDark = true)).isFalse()
        assertThat(paintsDark(ThemeChoice.DARK, systemDark = false)).isTrue()
    }

    @Test
    fun aChangedChoiceRepaintsAtOnce() {
        val device = FakeDevicePreferences()
        var surface = Color.Unspecified
        compose.setContent {
            val theme by device.theme.collectAsStateWithLifecycle()
            CograTheme(choice = theme) { surface = MaterialTheme.colorScheme.surface }
        }
        device.theme.value = ThemeChoice.LIGHT
        compose.waitForIdle()
        assertThat(surface).isEqualTo(LightColors.surface)
        device.theme.value = ThemeChoice.DARK
        compose.waitForIdle()
        assertThat(surface).isEqualTo(DarkColors.surface)
    }
}
