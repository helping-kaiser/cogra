package com.cogra.feature.content.wizard

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import com.cogra.core.designsystem.v2.atom.SheetCeilingSliver
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * THE SENSITIVE SHEET'S REASON GROWS (jakob's ruling, the sheets-and-video
 * round, 2026-09-22 — design/readme.md §13: "the sensitive sheet's **Why?**
 * becomes a growing one-line field"; `design/components/forms/TextField.prompt.md`
 * defines `rows` as the minimum).
 *
 * Structural assertions only — `captureToImage()` hangs under Robolectric
 * 4.16.1 with Compose BOM 2025.10.01.
 */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class SensitiveReasonGrowthTest {

    @get:Rule
    val compose = createComposeRule()

    private val enormous = List(200) { "a reason nobody could read in one line, number $it" }
        .joinToString("\n")

    private fun sheet(initial: String): MutableState<String> {
        val reason = mutableStateOf(initial)
        compose.setContent {
            Cogra2PreviewTheme {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
                    SensitiveSheet(
                        marked = true,
                        reason = reason.value,
                        onMarkedChange = {},
                        onReasonChange = { reason.value = it },
                        onDone = {},
                        onHelp = {},
                    )
                }
            }
        }
        return reason
    }

    private fun heightOf(tag: String): Float =
        compose.onNodeWithTag(tag).getUnclippedBoundsInRoot().let { (it.bottom - it.top).value }

    /**
     * It opens as the ONE line the board draws, and takes another the moment
     * the reason needs one. The second line is what pins the minimum: a box
     * that opened at two or three would swallow it and never move.
     */
    @Test
    fun theReasonOpensAtOneLineAndTakesALineAtATime() {
        val reason = sheet("")
        val opened = heightOf("wizard_sensitive_reason")

        compose.runOnUiThread { reason.value = "one\ntwo" }
        compose.waitForIdle()
        val two = heightOf("wizard_sensitive_reason")

        compose.runOnUiThread { reason.value = "one\ntwo\nthree\nfour" }
        compose.waitForIdle()
        val four = heightOf("wizard_sensitive_reason")

        assertThat(two).isGreaterThan(opened)
        assertThat(four).isGreaterThan(two)
    }

    // Past the room the sheet has, the sheet stops at the ceiling and the box
    // stops with it — Done stays on the screen.
    @Test
    fun theSheetStopsAtTheCeilingAndDoneStaysInReach() {
        sheet(enormous)

        val root = compose.onRoot().getUnclippedBoundsInRoot()
        val sheet = compose.onNodeWithTag("wizard_sensitive_sheet").getUnclippedBoundsInRoot()

        assertThat((sheet.top - root.top).value).isAtLeast(SheetCeilingSliver.value)
        compose.onNodeWithTag("wizard_sensitive_done").assertIsDisplayed()
    }
}
