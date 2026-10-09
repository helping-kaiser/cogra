// The system-bar law's root (ui/SystemBars.kt): nothing the app lays out
// reaches under the status bar, and no screen inside pads the bar again.
//
// HiltTestActivity rather than createComposeRule()'s bare ComponentActivity:
// testDebug's robolectric.properties runs the whole source set under
// HiltTestApplication, so the module's Compose host is the Hilt one.

package com.cogra.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertTopPositionInRootIsEqualTo
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import com.cogra.app.HiltTestActivity
import com.cogra.app.ui.theme.CograTheme
import com.cogra.domain.store.ThemeChoice
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
class StatusBarClearanceTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    private val bar = WindowInsets(top = 24.dp)

    private val choice = mutableStateOf(ThemeChoice.AUTO)

    private fun show() {
        compose.setContent {
            CograTheme(choice = choice.value) {
                StatusBarClearance(insets = bar) {
                    // A surface that wants the whole window, and a screen
                    // that pads the same bar again inside it.
                    Box(
                        Modifier
                            .fillMaxSize()
                            .background(MaterialTheme.colorScheme.surface)
                            .testTag("surface"),
                    ) {
                        Box(Modifier.windowInsetsPadding(bar)) {
                            Box(Modifier.size(1.dp).testTag("screen"))
                        }
                    }
                }
            }
        }
    }

    @Test
    fun `no app surface is laid out under the status bar, whatever the picked theme`() {
        show()
        // A theme picked in Settings repaints the app, never the strip.
        ThemeChoice.entries.forEach { picked ->
            choice.value = picked
            compose.waitForIdle()
            compose.onNodeWithTag("surface").assertTopPositionInRootIsEqualTo(24.dp)
        }
    }

    @Test
    fun `the bar is padded once, so no screen inside doubles it`() {
        show()
        compose.onNodeWithTag("screen").assertTopPositionInRootIsEqualTo(24.dp)
    }

    @Test
    fun `a Material scaffold inside reads the bar as already consumed`() {
        // The shell and most screens are M3 Scaffolds whose content insets
        // include the status bar; they must not pad it a second time.
        compose.setContent {
            CograTheme(choice = ThemeChoice.AUTO) {
                StatusBarClearance(insets = bar) {
                    Scaffold(contentWindowInsets = bar) { padding ->
                        Box(Modifier.padding(padding).size(1.dp).testTag("content"))
                    }
                }
            }
        }
        compose.onNodeWithTag("content").assertTopPositionInRootIsEqualTo(24.dp)
    }
}
