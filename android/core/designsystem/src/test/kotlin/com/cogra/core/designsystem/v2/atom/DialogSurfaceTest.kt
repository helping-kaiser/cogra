package com.cogra.core.designsystem.v2.atom

import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.Dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** The house dialog shell against its master (`DialogSurface`, core/JoinPrompt.jsx). */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class DialogSurfaceTest {

    @get:Rule
    val compose = createComposeRule()

    private var scrim = 0

    private fun show(node: DataNode? = null) {
        compose.setContent {
            Cogra2PreviewTheme {
                DialogSurface(
                    title = "Remove this post?",
                    paragraphs = listOf("First.", "Second."),
                    onScrimPress = { scrim++ },
                    testTag = "dialog",
                    node = node,
                    extra = { Text("Line", modifier = Modifier.testTag("line")) },
                    actions = {
                        CograButton("Remove", {}, kind = ButtonKind.Text, testTag = "remove")
                        CograButton("Keep it", {}, testTag = "keep")
                    },
                )
            }
        }
    }

    private fun widthOf(tag: String): Dp = with(compose.density) {
        compose.onNodeWithTag(tag).fetchSemanticsNode().boundsInRoot.width.toDp()
    }

    /** `min(100vw − 2 × --dialog-inset, --dialog-max-width)`: 320 at 411. */
    @Test
    fun theSurfaceStandsAtTheHouseWidth() {
        show()
        assertThat(widthOf("dialog").value).isWithin(0.5f).of(320f)
    }

    @Test
    fun theBodyStandsSixteenUnderTheTitleAndTheExtraAboveThePair() {
        show()
        val first = compose.onNodeWithText("First.").fetchSemanticsNode().boundsInRoot
        val second = compose.onNodeWithText("Second.").fetchSemanticsNode().boundsInRoot
        val line = compose.onNodeWithTag("line").fetchSemanticsNode().boundsInRoot
        val keep = compose.onNodeWithTag("keep").fetchSemanticsNode().boundsInRoot
        val remove = compose.onNodeWithTag("remove").fetchSemanticsNode().boundsInRoot
        with(compose.density) {
            assertThat((second.top - first.bottom).toDp().value).isWithin(0.5f).of(16f)
            assertThat(line.bottom).isAtMost(keep.top)
        }
        // The pair is end-aligned, the filled answer in the right-hand slot.
        assertThat(keep.left).isAtLeast(remove.right)
    }

    @Test
    fun aRegisteredDialogWearsItsNodeAndItsParts() {
        show(DataNode("postDetail.dialog"))
        compose.onNodeWithTag("postDetail.dialog").assertExists()
        compose.onNodeWithTag("postDetail.dialog.title").assertExists()
        compose.onNodeWithTag("postDetail.dialog.body").assertExists()
        compose.onNodeWithTag("dialog").assertDoesNotExist()
    }
}
