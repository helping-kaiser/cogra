// THE SEAL'S TAGS ROW FOLDS, MEASURED (`_shared.jsx:1930-1976` `sealTagsRow`,
// round 62; ComposeSeal.md:45-49, ComposeSealTagged.md:5): a readout chip is
// never cut, so the row reads its tags as chips only while they fit the value
// slot whole; one tag too long for it — a name up to 128 characters — folds
// the row to `1 tag` and the row is the door `Manage the 1 tag`. Both seals,
// one fold. Measured on a 360dp phone under NATIVE graphics, the only mode
// whose text metrics carry a width claim; the seal's card stands 24 + 16 in
// from each edge (`SealStep`'s page padding and the acts card's own).

package com.cogra.feature.content

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.height
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.feature.content.reply.ReplyTagsRow
import com.cogra.feature.content.wizard.SealSheet
import com.cogra.feature.content.wizard.TagsActRow
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
class SealTagsFoldTest {

    @get:Rule
    val compose = createComposeRule()

    private val opened = mutableListOf<String>()

    private fun showPost(names: List<String>) {
        compose.setContent {
            Cogra2PreviewTheme {
                Box(Modifier.requiredWidth(SCREEN.dp).padding(horizontal = INSET.dp)) {
                    TagsActRow(names) { sheet -> if (sheet == SealSheet.Tags) opened += "tags" }
                }
            }
        }
        compose.waitForIdle()
    }

    private fun showReply(names: List<String>) {
        compose.setContent {
            Cogra2PreviewTheme {
                Box(Modifier.requiredWidth(SCREEN.dp).padding(horizontal = INSET.dp)) {
                    ReplyTagsRow(names) { opened += "tags" }
                }
            }
        }
        compose.waitForIdle()
    }

    private fun exists(tag: String): Boolean =
        compose.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    /** A tag that fits: its chip, whole, inside the card; the row names no door. */
    private fun assertChips(prefix: String, names: List<String>) {
        names.forEach { name ->
            val chip = compose.onNodeWithTag("${prefix}_tag_$name", useUnmergedTree = true).getUnclippedBoundsInRoot()
            assertThat(chip.right.value).isAtMost(SCREEN - INSET)
            assertThat(chip.height.value).isAtMost(ONE_LINE_CHIP)
            val label = compose.onNodeWithText("#$name", useUnmergedTree = true).fetchSemanticsNode()
            assertThat(label.config[SemanticsProperties.Text].single().text).isEqualTo("#$name")
        }
    }

    /**
     * A tag too long for the slot: the row is the door, named for its count
     * (the door's name replaces what it names, so the drawn `1 tag` is not a
     * node of its own), and no chip stands on it.
     */
    private fun assertFolded(doorTag: String, count: Int) {
        assertThat(manageTagsLabel(count)).endsWith(tagsCountWords(count))
        compose.onNodeWithTag(doorTag).assertContentDescriptionEquals(manageTagsLabel(count))
        val row = compose.onNodeWithTag(doorTag).getUnclippedBoundsInRoot()
        assertThat(row.right.value).isAtMost(SCREEN - INSET)
        compose.onNodeWithTag(doorTag).performClick()
        assertThat(opened).containsExactly("tags")
    }

    /** The thirty-character tag: its whole chip where the slot holds it, else the fold. */
    private fun assertWholeOrFolded(prefix: String) {
        if (exists("${prefix}_tag_$THIRTY")) {
            assertChips(prefix, listOf(THIRTY))
        } else {
            assertFolded("${prefix}_tags", 1)
        }
    }

    // -- The post's seal --

    @Test
    fun thePostSealReadsAShortTagAsItsChip() {
        showPost(listOf("fieldnotes"))
        assertChips("wizard_seal", listOf("fieldnotes"))
        assertThat(exists("wizard_seal_tags")).isFalse()
    }

    @Test
    fun thePostSealReadsTheBoardsTwoTagsAsChips() {
        showPost(listOf("fieldnotes", "coastroad"))
        assertChips("wizard_seal", listOf("fieldnotes", "coastroad"))
    }

    /** Thirty characters: whichever reading the slot gives, no chip is cut or runs past the card. */
    @Test
    fun thePostSealNeverCutsAThirtyCharacterTag() {
        showPost(listOf(THIRTY))
        assertWholeOrFolded("wizard_seal")
    }

    @Test
    fun thePostSealFoldsALongHyphenatedTagToItsCount() {
        showPost(listOf(LONG_HYPHENATED))
        assertThat(exists("wizard_seal_tag_$LONG_HYPHENATED")).isFalse()
        assertFolded("wizard_seal_tags", 1)
    }

    @Test
    fun thePostSealFoldsALongUnbrokenTagToItsCount() {
        showPost(listOf(LONG_UNBROKEN))
        assertThat(exists("wizard_seal_tag_$LONG_UNBROKEN")).isFalse()
        assertFolded("wizard_seal_tags", 1)
    }

    @Test
    fun thePostSealFoldsAShortTagBesideALongOne() {
        showPost(listOf("fieldnotes", LONG_UNBROKEN))
        assertFolded("wizard_seal_tags", 2)
    }

    @Test
    fun thePostSealCountsPastTwo() {
        showPost(listOf("fieldnotes", "coastroad", "saltmaps"))
        assertFolded("wizard_seal_tags", 3)
    }

    // -- The reply's seal --

    @Test
    fun theReplySealReadsAShortTagAsItsChipAndStaysTheDoor() {
        showReply(listOf("glovebox"))
        assertChips("reply_seal", listOf("glovebox"))
        compose.onNodeWithTag("reply_seal_tags").performClick()
        assertThat(opened).containsExactly("tags")
    }

    @Test
    fun theReplySealFoldsALongHyphenatedTagToItsCount() {
        showReply(listOf(LONG_HYPHENATED))
        assertThat(exists("reply_seal_tag_$LONG_HYPHENATED")).isFalse()
        assertFolded("reply_seal_tags", 1)
    }

    @Test
    fun theReplySealFoldsALongUnbrokenTagToItsCount() {
        showReply(listOf(LONG_UNBROKEN))
        assertThat(exists("reply_seal_tag_$LONG_UNBROKEN")).isFalse()
        assertFolded("reply_seal_tags", 1)
    }

    @Test
    fun theReplySealNeverCutsAThirtyCharacterTag() {
        showReply(listOf(THIRTY))
        assertWholeOrFolded("reply_seal")
    }

    // -- The fit itself (`sealTagsFit`), on counted widths --

    @Test
    fun theFitHoldsAtMostTwoChipsAndOnlyWhole() {
        val tenEach: (String) -> Int = { it.length * 10 }
        assertThat(sealTagsFit(listOf("ab", "cd"), slot = 66, gap = 6, chipWidth = tenEach)).isTrue()
        assertThat(sealTagsFit(listOf("ab", "cd"), slot = 65, gap = 6, chipWidth = tenEach)).isFalse()
        assertThat(sealTagsFit(listOf("a", "b", "c"), slot = 1000, gap = 6, chipWidth = tenEach)).isFalse()
        assertThat(sealTagsFit(emptyList(), slot = 1000, gap = 6, chipWidth = tenEach)).isFalse()
    }

    private companion object {
        const val SCREEN = 360f

        /** The seal's page padding (24) and the acts card's own (16). */
        const val INSET = 40f

        /** A readout chip: 24 true, one label-small line. */
        const val ONE_LINE_CHIP = 26f

        /** Thirty characters, hyphenated. */
        const val THIRTY = "salt-maps-of-the-coast-road-26"

        /** 129 characters in hyphenated runs. */
        val LONG_HYPHENATED = "coast-".repeat(22).take(129)

        /** 129 characters, one unbroken run. */
        val LONG_UNBROKEN = "w".repeat(129)
    }
}
