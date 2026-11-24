// A TAG IS ONE LINE AT MOST (jakob 2026-11-23; round 62): the shared atoms
// that draw a tag's name in a list place. The chronicle aside (`ContentRow.jsx`
// `ASIDE_FLEX.text`) ends in "…" while the verb keeps its room; the filter
// chip's `cut` (`Chip.jsx:103-106,132-135`) keeps the pill inside its row. The
// node always speaks the whole tag. Measured on a 360dp phone under NATIVE
// graphics, the only mode whose text metrics carry a width claim.

package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.height
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.NameInText
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
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
class TagOneLineAtomsTest {

    @get:Rule
    val compose = createComposeRule()

    private fun bounds(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true).getUnclippedBoundsInRoot()

    private fun layout(tag: String): TextLayoutResult {
        val results = mutableListOf<TextLayoutResult>()
        val node = compose.onNodeWithTag(tag, useUnmergedTree = true).fetchSemanticsNode()
        node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(results)
        return results.single()
    }

    private fun spoken(tag: String): String =
        compose.onNodeWithTag(tag, useUnmergedTree = true).fetchSemanticsNode().config[SemanticsProperties.Text]
            .joinToString("") { it.text }

    // -- The chronicle aside (`ContentRow.jsx:76-86,210,290-291`) --

    private fun showChronicle(aside: String) {
        compose.setContent {
            Cogra2PreviewTheme {
                Box(Modifier.requiredWidth(SCREEN)) {
                    ContentRow(
                        title = "Tagged a post",
                        titleAside = aside,
                        disc = ContentRowDisc.Letter("#"),
                        testTag = "row",
                        trailing = "2h",
                        node = DataNode("row"),
                    )
                }
            }
        }
        compose.waitForIdle()
    }

    /** [cut] null: whichever the row's width gives — the verb, disc and age come first. */
    private fun assertAsideHolds(name: String, cut: Boolean?) {
        showChronicle("#$name")
        val verb = layout("row.title")
        // The verb keeps its whole room: one line, never cut.
        assertThat(verb.lineCount).isEqualTo(1)
        assertThat(verb.isLineEllipsized(0)).isFalse()
        val aside = layout("row.aside")
        assertThat(aside.lineCount).isEqualTo(1)
        if (cut != null) assertThat(aside.isLineEllipsized(0)).isEqualTo(cut)
        assertThat(bounds("row.title").right.value).isAtMost(bounds("row.aside").left.value)
        assertThat(bounds("row.aside").right.value).isAtMost(bounds("row.trailing").left.value)
        assertThat(bounds("row.trailing").right.value).isAtMost(SCREEN.value)
        assertThat(spoken("row.aside")).isEqualTo("#$name")
    }

    @Test
    fun aShortTagAsideStandsWholeBesideItsVerb() = assertAsideHolds("saltmaps", cut = false)

    /** Thirty characters do not fit beside `Tagged a post`, its disc and its age at 360: one line either way. */
    @Test
    fun aThirtyCharacterTagAsideStaysOnOneLineBesideItsVerb() = assertAsideHolds(THIRTY, cut = null)

    @Test
    fun aLongHyphenatedTagAsideIsCutAndTheVerbKeepsItsRoom() = assertAsideHolds(LONG_HYPHENATED, cut = true)

    @Test
    fun aLongUnbrokenTagAsideIsCutAndTheVerbKeepsItsRoom() = assertAsideHolds(LONG_UNBROKEN, cut = true)

    /** An aside on a tag (`on #…`) is words with no handle: it is the part cut too. */
    @Test
    fun anOpinionOnALongTagCutsTheAsideAndKeepsTheVerb() {
        showChronicle("on #$LONG_UNBROKEN")
        assertThat(layout("row.title").isLineEllipsized(0)).isFalse()
        assertThat(layout("row.aside").isLineEllipsized(0)).isTrue()
        assertThat(spoken("row.aside")).isEqualTo("on #$LONG_UNBROKEN")
    }

    // -- The filter chip's `cut` (`Chip.jsx:103-106,132-135`) --

    private fun assertCutChipHolds(name: String, cut: Boolean) {
        compose.setContent {
            Cogra2PreviewTheme {
                Box(Modifier.requiredWidth(SCREEN)) {
                    CograChip(label = "#$name", onClick = {}, cut = true, testTag = "chip")
                }
            }
        }
        compose.waitForIdle()
        val chip = bounds("chip")
        assertThat(chip.left.value).isAtLeast(0f)
        assertThat(chip.right.value).isAtMost(SCREEN.value)
        // The node is the 48dp target (`hitTarget`); the pill inside it never grows past it.
        assertThat(chip.height.value).isAtMost(TAP_TARGET.value)
        assertThat(bounds("chip_label").height.value).isAtMost(ONE_LABEL_LINE.value)
        val label = layout("chip_label")
        assertThat(label.lineCount).isEqualTo(1)
        assertThat(label.isLineEllipsized(0)).isEqualTo(cut)
        assertThat(spoken("chip_label")).isEqualTo("#$name")
    }

    @Test
    fun aThirtyCharacterTagChipStandsWhole() = assertCutChipHolds(THIRTY, cut = false)

    @Test
    fun aLongHyphenatedTagChipIsCutInsideItsRow() = assertCutChipHolds(LONG_HYPHENATED, cut = true)

    @Test
    fun aLongUnbrokenTagChipIsCutInsideItsRow() = assertCutChipHolds(LONG_UNBROKEN, cut = true)

    // -- A tag in wrapping text (`nameInText`, round 63) --

    /** `Withdrawn: #…`: the tag moves whole to the next line, cut past it — two lines, never more. */
    @Test
    fun aLongTagInASentenceTakesOneLineOfItsOwnAtMost() {
        compose.setContent {
            Cogra2PreviewTheme {
                Box(Modifier.requiredWidth(SCREEN)) {
                    NameInText("Withdrawn: #$LONG_UNBROKEN", Modifier.testTag("sentence"))
                }
            }
        }
        compose.waitForIdle()
        val sentence = bounds("sentence")
        assertThat(sentence.right.value).isAtMost(SCREEN.value)
        assertThat(sentence.height.value).isAtMost(TWO_LINES.value)
        assertThat(spoken("sentence")).isEqualTo("Withdrawn: #$LONG_UNBROKEN")
    }

    private companion object {
        val SCREEN: Dp = 360.dp

        /** The filter chip's tap target: 32 drawn, answering at 48. */
        val TAP_TARGET: Dp = 48.dp

        /** One label-large line (20) and slack — never a second. */
        val ONE_LABEL_LINE: Dp = 24.dp

        /** Two lines of the body's type, and a little slack. */
        val TWO_LINES: Dp = 48.dp

        /** Thirty characters, hyphenated, short enough to fit a phone's row whole. */
        const val THIRTY = "salt-maps-of-the-coast-road-26"

        /** 129 characters in hyphenated runs. */
        val LONG_HYPHENATED = "coast-".repeat(22).take(129)

        /** 129 characters, one unbroken run. */
        val LONG_UNBROKEN = "w".repeat(129)
    }
}
