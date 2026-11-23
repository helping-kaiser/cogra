// A TAG IS ONE LINE (jakob 2026-11-23; `TopicRemovable.jsx`, round 63): a
// staged tag's pill never grows past its row and never wraps its name; a name
// too long for the row is the part cut, ending in "…", while the × keeps its
// room. The accessible names keep the whole tag. Measured on a 360dp phone
// under NATIVE graphics, the only mode whose text metrics carry a width claim.
//
// The composer and the post and comment edits stage tags through the same
// section (`TopicEntry`, `staged = true`); the reply wizard keeps the entry's
// chip (`staged = false`) and is measured beside them.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.height
import androidx.compose.ui.unit.width
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
class TagChipOneLineTest {

    @get:Rule
    val compose = createComposeRule()

    private fun show(name: String, staged: Boolean) {
        compose.setContent {
            Cogra2PreviewTheme {
                Box(Modifier.fillMaxWidth()) {
                    TopicEntry(
                        section = TagSectionState(tags = listOf(TagRow(name))),
                        testTagPrefix = PREFIX,
                        onRemoveTag = {},
                        onTuneTag = {},
                        onDoneTuningTag = {},
                        onTagRelevanceChange = { _, _ -> },
                        onTagConfidenceChange = { _, _ -> },
                        staged = staged,
                        onOpenPicker = {},
                    )
                }
            }
        }
        compose.waitForIdle()
    }

    private fun bounds(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true).getUnclippedBoundsInRoot()

    private fun layout(tag: String): TextLayoutResult {
        val results = mutableListOf<TextLayoutResult>()
        val node = compose.onNodeWithTag(tag, useUnmergedTree = true).fetchSemanticsNode()
        node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(results)
        return results.single()
    }

    private fun spoken(tag: String): List<String> =
        compose.onNodeWithTag(tag, useUnmergedTree = true).fetchSemanticsNode().config
            .getOrNull(SemanticsProperties.ContentDescription).orEmpty()

    /** The composer's pill: on the screen, one line high, its × inside it, the name cut and named whole. */
    private fun assertStagedPillHolds(name: String, cut: Boolean) {
        show(name, staged = true)
        val chip = bounds("${PREFIX}_tag_$name")
        val cross = bounds("${PREFIX}_tag_${name}_remove")
        assertThat(chip.left.value).isAtLeast(0f)
        assertThat(chip.right.value).isAtMost(SCREEN.value)
        assertThat(chip.height.value).isAtMost(ONE_LINE_PILL.value)
        assertThat(cross.width.value).isGreaterThan(0f)
        assertThat(cross.right.value).isAtMost(chip.right.value)
        val text = layout("${PREFIX}_tag_${name}_open")
        assertThat(text.lineCount).isEqualTo(1)
        assertThat(text.isLineEllipsized(0)).isEqualTo(cut)
        assertThat(spoken("${PREFIX}_tag_${name}_open")).containsExactly("#$name — set how it relates")
        assertThat(spoken("${PREFIX}_tag_${name}_remove")).containsExactly("Remove #$name")
    }

    @Test
    fun aThirtyCharacterTagDrawsWholeOnOneLine() = assertStagedPillHolds(THIRTY, cut = false)

    @Test
    fun aLongHyphenatedTagIsCutOnOneLineAndKeepsItsCross() = assertStagedPillHolds(LONG_HYPHENATED, cut = true)

    @Test
    fun aLongUnbrokenTagIsCutOnOneLineAndKeepsItsCross() = assertStagedPillHolds(LONG_UNBROKEN, cut = true)

    /** The reply wizard's chip (`staged = false`), measured for the census: on the screen, its × kept. */
    private fun assertReplyChipHolds(name: String) {
        show(name, staged = false)
        val chip = bounds("${PREFIX}_tag_$name")
        val cross = bounds("${PREFIX}_tag_${name}_remove")
        assertThat(chip.right.value).isAtMost(SCREEN.value)
        assertThat(cross.width.value).isGreaterThan(0f)
        assertThat(cross.right.value).isAtMost(SCREEN.value)
    }

    @Test
    fun theReplyWizardsLongTagChipStaysOnScreenWithItsCross() = assertReplyChipHolds(LONG_UNBROKEN)

    private companion object {
        const val PREFIX = "tags"
        val SCREEN: Dp = 360.dp

        /** `TopicRemovable`: at least 32 tall, `4 12`, one label-large line — never a second. */
        val ONE_LINE_PILL: Dp = 34.dp

        /** Thirty characters, hyphenated, short enough to fit a phone's row whole. */
        const val THIRTY = "salt-maps-of-the-coast-road-26"

        /** 129 characters in hyphenated runs. */
        val LONG_HYPHENATED = "coast-".repeat(22).take(129)

        /** 129 characters, one unbroken run. */
        val LONG_UNBROKEN = "w".repeat(129)
    }
}
