// A RECENT QUERY IS ONE LINE (`_shared.jsx` `RecentRow`, round 62; jakob
// 2026-11-23, a tag is one line at most): a query too long for the row — a
// 128-character tag among them — ends in "…", the row keeps its one line and
// the node speaks the query whole. Measured on a 360dp phone under NATIVE
// graphics, the only mode whose text metrics carry a width claim.

package com.cogra.feature.explore

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h800dp")
class ExploreRecentOneLineTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val doors = ExploreDoors(
        onOpenPost = {},
        onOpenComment = { _, _ -> },
        onOpenPerson = {},
        onOpenTopic = {},
        onOpenYourTopics = {},
    )

    private fun assertRecentHolds(name: String, cut: Boolean) {
        val query = "#$name"
        compose.setContent {
            ExploreScreen(
                state = ExploreUiState(resolved = true, reader = "me", recents = listOf(query)),
                doors = doors,
                actions = ExploreActions(),
                bell = null,
                onChats = {},
                now = Instant.parse("2026-11-24T12:00:00Z"),
            )
        }
        compose.waitForIdle()
        val node = compose.onNodeWithTag(QUERY, useUnmergedTree = true).fetchSemanticsNode()
        val results = mutableListOf<TextLayoutResult>()
        node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(results)
        val text = results.single()
        assertThat(text.lineCount).isEqualTo(1)
        assertThat(text.isLineEllipsized(0)).isEqualTo(cut)
        assertThat(node.config[SemanticsProperties.Text].single().text).isEqualTo(query)
        val bounds = compose.onNodeWithTag(QUERY, useUnmergedTree = true).getUnclippedBoundsInRoot()
        assertThat(bounds.right.value).isAtMost(SCREEN)
        // The glyph keeps its 18dp beside the words.
        val glyph = compose.onNodeWithTag(GLYPH, useUnmergedTree = true).getUnclippedBoundsInRoot()
        assertThat((glyph.right - glyph.left).value).isWithin(0.5f).of(18.dp.value)
        assertThat(glyph.right.value).isAtMost(bounds.left.value)
    }

    @Test
    fun aThirtyCharacterTagReadsWholeOnOneLine() = assertRecentHolds(THIRTY, cut = false)

    @Test
    fun aLongHyphenatedTagIsCutOnOneLine() = assertRecentHolds(LONG_HYPHENATED, cut = true)

    @Test
    fun aLongUnbrokenTagIsCutOnOneLine() = assertRecentHolds(LONG_UNBROKEN, cut = true)

    private companion object {
        const val QUERY = "explore.recent.query"
        const val GLYPH = "explore.recent.glyph"
        const val SCREEN = 360f

        /** Thirty characters, hyphenated, short enough to fit a phone's row whole. */
        const val THIRTY = "salt-maps-of-the-coast-road-26"

        /** 129 characters in hyphenated runs. */
        val LONG_HYPHENATED = "coast-".repeat(22).take(129)

        /** 129 characters, one unbroken run. */
        val LONG_UNBROKEN = "w".repeat(129)
    }
}
