// THE FILTER SHEET'S `One tag` CHIP STAYS INSIDE THE SHEET (`Chip.jsx` `cut`,
// round 62; jakob 2026-11-23, a tag is one line at most): a held tag too long
// for the sheet's row ends in "…" on one line and the pill never runs past the
// sheet's 24dp gutter; the chip still speaks the whole tag. Measured on a 360dp
// phone under NATIVE graphics, the only mode whose text metrics carry a width
// claim.

package com.cogra.feature.feedfilter

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.height
import com.cogra.core.designsystem.DataNode
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedTopic
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h4000dp")
class FeedFilterTagCutTest {

    @get:Rule
    val compose = createComposeRule()

    private fun assertTopicChipHolds(name: String, cut: Boolean) {
        compose.setContent {
            FeedFilterSheet(
                staged = FeedFilter.DEFAULT,
                onStage = {},
                onReset = {},
                onDone = {},
                onDismiss = {},
                node = DataNode("feed.filterSheet"),
                topics = listOf(FeedTopic("t1", name)),
            )
        }
        compose.waitForIdle()
        val chipTag = "feed.filterSheet.topic.tag:$name"
        compose.onNodeWithTag(chipTag, useUnmergedTree = true).performScrollTo()
        val chip = compose.onNodeWithTag(chipTag, useUnmergedTree = true).getUnclippedBoundsInRoot()
        assertThat(chip.left.value).isAtLeast(GUTTER)
        assertThat(chip.right.value).isAtMost(SCREEN - GUTTER)
        // The node is the 48dp target (`hitTarget`); the label inside stays one line.
        assertThat(chip.height.value).isAtMost(TAP_TARGET)
        val labelBounds = compose.onNodeWithTag("${chipTag}_label", useUnmergedTree = true).getUnclippedBoundsInRoot()
        assertThat(labelBounds.height.value).isAtMost(ONE_LABEL_LINE)
        val label = compose.onNodeWithTag("${chipTag}_label", useUnmergedTree = true).fetchSemanticsNode()
        val results = mutableListOf<TextLayoutResult>()
        label.config[SemanticsActions.GetTextLayoutResult].action?.invoke(results)
        assertThat(results.single().lineCount).isEqualTo(1)
        assertThat(results.single().isLineEllipsized(0)).isEqualTo(cut)
        assertThat(label.config[SemanticsProperties.Text].single().text).isEqualTo("#$name")
    }

    @Test
    fun aThirtyCharacterTagChipStandsWhole() = assertTopicChipHolds(THIRTY, cut = false)

    @Test
    fun aLongHyphenatedTagChipIsCutInsideTheSheet() = assertTopicChipHolds(LONG_HYPHENATED, cut = true)

    @Test
    fun aLongUnbrokenTagChipIsCutInsideTheSheet() = assertTopicChipHolds(LONG_UNBROKEN, cut = true)

    private companion object {
        const val SCREEN = 360f

        /** `FilterSection`'s side padding. */
        const val GUTTER = 24f

        /** The chip's tap target: 32 drawn, answering at 48. */
        const val TAP_TARGET = 48f

        /** One label-large line (20) and slack — never a second. */
        const val ONE_LABEL_LINE = 24f

        /** Thirty characters, hyphenated, short enough to fit a phone's row whole. */
        const val THIRTY = "salt-maps-of-the-coast-road-26"

        /** 129 characters in hyphenated runs. */
        val LONG_HYPHENATED = "coast-".repeat(22).take(129)

        /** 129 characters, one unbroken run. */
        val LONG_UNBROKEN = "w".repeat(129)
    }
}
