// The bar at large text (jakob 2026-11-23): above 1.3× the words under the
// glyphs DROP and the glyphs stand alone — the bar never grows, a word never
// wraps and is never cut, and every slot keeps its spoken name. At 1.3× and
// below the bar is the one it always was.
//
// The text size is the reader's own setting, so each case sets it the way
// the device does — `@Config(fontScale)` writes `Configuration.fontScale`,
// which Compose carries as `LocalDensity.current.fontScale`. Every bar the
// shell draws is the one composable with three faces (the member's, a
// guest's, an applicant's locked centre slot), and each case draws all
// three beside a REFERENCE bar held at 1.0×, the height every face must keep.

package com.cogra.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.height
import com.cogra.app.HiltTestActivity
import com.cogra.app.ui.theme.CograTheme
import com.cogra.core.designsystem.DataNode
import com.google.common.truth.Truth.assertThat
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@HiltAndroidTest
class CograBottomBarTextSizeTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    @Test
    @Config(fontScale = 1.0f)
    fun atTheDefaultSizeEverySlotWearsItsWord() = checkBars(fontScale = 1.0f, wordsShown = true)

    @Test
    @Config(fontScale = 1.3f)
    fun atOnePointThreeTheWordsStillStand() = checkBars(fontScale = 1.3f, wordsShown = true)

    @Test
    @Config(fontScale = 1.31f)
    fun justAboveOnePointThreeTheWordsDrop() = checkBars(fontScale = 1.31f, wordsShown = false)

    @Test
    @Config(fontScale = 2.0f)
    fun atTwiceTheSizeTheWordsDropAndTheBarKeepsItsHeight() =
        checkBars(fontScale = 2.0f, wordsShown = false)

    private fun checkBars(fontScale: Float, wordsShown: Boolean) {
        compose.setContent {
            CograTheme {
                Column {
                    // The reference: the same bar with the reader's size
                    // pinned to 1.0×, the height the ruling holds every face to.
                    val density = LocalDensity.current
                    CompositionLocalProvider(LocalDensity provides Density(density.density, 1f)) {
                        Bar(REFERENCE, locked = false)
                    }
                    FACES.forEach { (face, locked) -> Bar(face, locked) }
                }
            }
        }
        compose.waitForIdle()

        assertThat(compose.activity.resources.configuration.fontScale).isEqualTo(fontScale)
        val referenceHeight = height(REFERENCE)

        FACES.forEach { (face, _) ->
            assertThat(height(face)).isEqualTo(referenceHeight)
            DESTINATIONS.forEach { (slotNode, slot) ->
                val tag = "$face.bottomBar.$slotNode"
                // The word is the slot's only text: present at ≤ 1.3×, gone above.
                val words = compose.onAllNodes(
                    hasAnyAncestor(hasTestTag(tag)) and SemanticsMatcher.keyIsDefined(SemanticsProperties.Text),
                    useUnmergedTree = true,
                ).fetchSemanticsNodes()
                assertThat(words).hasSize(if (wordsShown) 1 else 0)
                // The slot keeps its spoken name either way.
                assertThat(spokenName(tag)).contains(compose.activity.getString(slot.label))
            }
            // The selection still shows, and is still announced.
            compose.onNodeWithTag("$face.bottomBar.feedSlot").assertIsSelected()
            compose.onNodeWithTag("$face.bottomBar.profileSlot").assertIsNotSelected()
            assertThat(spokenName("$face.bottomBar.composeSlot"))
                .contains(compose.activity.getString(NavSlot.Compose.label))
        }
    }

    @Composable
    private fun Bar(face: String, locked: Boolean) {
        CograBottomBar(
            feedSelected = true,
            profileSelected = false,
            onFeed = {},
            onCompose = {},
            onProfile = {},
            composeLocked = locked,
            node = DataNode(face) / "bottomBar",
        )
    }

    /** The bar's height in dp (Truth takes the plain float, not the inline `Dp`). */
    private fun height(face: String): Float =
        compose.onNodeWithTag("$face.bottomBar").getUnclippedBoundsInRoot().height.value

    /** What TalkBack reads for the slot: its merged text and descriptions. */
    private fun spokenName(tag: String): List<String> {
        val config = compose.onNodeWithTag(tag).fetchSemanticsNode().config
        val text = config.getOrNull(SemanticsProperties.Text).orEmpty().map { it.text }
        val described = config.getOrNull(SemanticsProperties.ContentDescription).orEmpty()
        return text + described
    }

    private companion object {
        const val REFERENCE = "reference"

        /**
         * The bar's faces: the member's and a guest's are the same drawing
         * (a guest's profile slot answers the join prompt, CograNavGraph),
         * the applicant's centre slot is locked.
         */
        val FACES = listOf("member" to false, "guest" to false, "applicant" to true)

        val DESTINATIONS = listOf(
            "feedSlot" to NavSlot.Feed,
            "searchSlot" to NavSlot.Search,
            "walletSlot" to NavSlot.Wallet,
            "profileSlot" to NavSlot.Profile,
        )
    }
}
