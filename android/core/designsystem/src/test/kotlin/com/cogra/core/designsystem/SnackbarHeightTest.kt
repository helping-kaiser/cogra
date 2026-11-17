package com.cogra.core.designsystem

import androidx.compose.material3.SnackbarData
import androidx.compose.material3.SnackbarVisuals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * One line of words is 44dp tall, with or without its action (`Snackbar.jsx`:
 * 12 + the body-medium line + 12). The action is a word whose 48dp target is
 * an overlay that adds no height (`cg-hit`, states.css) — a snackbar sized by
 * its action's hit box stood 72dp tall (jakob, round 3 A4: the unsave
 * snackbar "would fit ~3 lines").
 */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class SnackbarHeightTest {

    @get:Rule
    val compose = createComposeRule()

    private val node = DataNode("saved.snackbar")

    private fun show(visuals: SnackbarVisuals, onAction: () -> Unit = {}) {
        compose.setContent {
            Cogra2PreviewTheme {
                CograSnackbar(StaticSnackbar(visuals, onAction))
            }
        }
    }

    private fun heightOf(tag: String) = with(compose.onNodeWithTag(tag).fetchSemanticsNode()) {
        size.height / layoutInfo.density.density
    }

    @Test
    fun aOneLineSnackbarIs44Tall() {
        show(NodeSnackbarVisuals("Removed from Saved.", node))
        assertThat(heightOf(node.tag)).isWithin(HALF_DP).of(ONE_LINE.value)
    }

    @Test
    fun anActionAddsNoHeight() {
        show(NodeSnackbarVisuals("Removed from Saved.", node, actionLabel = "Undo"))
        assertThat(heightOf(node.tag)).isWithin(HALF_DP).of(ONE_LINE.value)
    }

    @Test
    fun theActionStillAnswersAt48() {
        var undone = false
        show(NodeSnackbarVisuals("Removed from Saved.", node, actionLabel = "Undo")) { undone = true }
        val action = compose.onNodeWithTag((node / "action").tag)
        val touch = action.fetchSemanticsNode().touchBoundsInRoot
        val density = action.fetchSemanticsNode().layoutInfo.density.density
        assertThat(touch.height / density).isAtLeast(TOUCH_MIN.value - HALF_DP)
        action.performClick()
        assertThat(undone).isTrue()
    }

    private class StaticSnackbar(override val visuals: SnackbarVisuals, val onAction: () -> Unit) : SnackbarData {
        override fun performAction() = onAction()

        override fun dismiss() = Unit
    }

    private companion object {
        val ONE_LINE = 44.dp
        val TOUCH_MIN = 48.dp
        const val HALF_DP = 0.5f
    }
}
