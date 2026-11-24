// A TAG IN WRAPPING TEXT IS ONE UNIT (jakob 2026-11-23; round 63's
// `nameInText`): the edit's withdrawn line (`_shared.jsx` `WithdrawnLine`) and
// the tag pad's title (`TagPadCompose.jsx`, `SheetTitle` `cut`) never run a
// long tag over several lines — the tag moves whole to a line of its own and
// is cut past it — and `Undo` keeps its room. Measured on a 360dp phone under
// NATIVE graphics, the only mode whose text metrics carry a width claim.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.height
import androidx.compose.ui.unit.width
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.feature.content.edit.WithdrawnLine
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h800dp")
class TagSentencesTest {

    @get:Rule
    val compose = createComposeRule()

    private fun assertWithdrawnHolds(name: String) {
        compose.setContent {
            Cogra2PreviewTheme {
                Box(Modifier.requiredWidth(SCREEN.dp)) {
                    WithdrawnLine(name = "#$name", onUndo = {}, testTag = "withdrawn")
                }
            }
        }
        compose.waitForIdle()
        val line = compose.onNodeWithTag("withdrawn", useUnmergedTree = true)
        line.assertTextEqualsWhole("Withdrawn: #$name")
        val words = line.getUnclippedBoundsInRoot()
        assertThat(words.right.value).isAtMost(SCREEN)
        assertThat(words.height.value).isAtMost(TWO_SMALL_LINES)
        val undo = compose.onNodeWithTag("withdrawn_undo", useUnmergedTree = true).getUnclippedBoundsInRoot()
        assertThat(undo.width.value).isGreaterThan(0f)
        assertThat(undo.right.value).isAtMost(SCREEN)
    }

    private fun SemanticsNodeInteraction.assertTextEqualsWhole(text: String) {
        val said = fetchSemanticsNode().config[SemanticsProperties.Text]
        assertThat(said.joinToString("") { it.text }).isEqualTo(text)
    }

    @Test
    fun aThirtyCharacterWithdrawnTagStaysBesideUndo() = assertWithdrawnHolds(THIRTY)

    @Test
    fun aLongHyphenatedWithdrawnTagTakesOneLineAtMostAndUndoStays() = assertWithdrawnHolds(LONG_HYPHENATED)

    @Test
    fun aLongUnbrokenWithdrawnTagTakesOneLineAtMostAndUndoStays() = assertWithdrawnHolds(LONG_UNBROKEN)

    /** The tag pad's title is the tag alone: one line, cut where it outgrows it, named whole. */
    private fun assertPadTitleHolds(name: String) {
        compose.setContent {
            Cogra2PreviewTheme {
                TagPairSheet(row = TagRow(name), testTagPrefix = "wizard", onDone = { _, _ -> }, onDismiss = {})
            }
        }
        compose.waitForIdle()
        val title = compose.onNodeWithText("#$name", useUnmergedTree = true)
        val bounds = title.getUnclippedBoundsInRoot()
        assertThat(bounds.right.value).isAtMost(SCREEN)
        assertThat(bounds.height.value).isAtMost(ONE_TITLE_LINE)
    }

    @Test
    fun aThirtyCharacterPadTitleStandsOnOneLine() = assertPadTitleHolds(THIRTY)

    @Test
    fun aLongHyphenatedPadTitleStandsOnOneLine() = assertPadTitleHolds(LONG_HYPHENATED)

    @Test
    fun aLongUnbrokenPadTitleStandsOnOneLine() = assertPadTitleHolds(LONG_UNBROKEN)

    private companion object {
        const val SCREEN = 360f

        /** Two body-small lines (16 each) and slack. */
        const val TWO_SMALL_LINES = 36f

        /** One title-medium line (24) and slack. */
        const val ONE_TITLE_LINE = 28f

        /** Thirty characters, hyphenated. */
        const val THIRTY = "salt-maps-of-the-coast-road-26"

        /** 129 characters in hyphenated runs. */
        val LONG_HYPHENATED = "coast-".repeat(22).take(129)

        /** 129 characters, one unbroken run. */
        val LONG_UNBROKEN = "w".repeat(129)
    }
}
