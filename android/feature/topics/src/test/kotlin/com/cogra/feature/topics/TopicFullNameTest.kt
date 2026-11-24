// THE TAG'S FULL NAME (TagPage.md:5-17, rounds 63 and 66) compiled from its
// sidecar: the whole name under a header that cut it, shrunk to hold two lines,
// never below 12, hidden from assistive technology; no heading where the name
// fits. Its own class: TopicScreenTest is already large, and these need real
// glyph metrics (NATIVE) where that class runs on the legacy graphics.

package com.cogra.feature.topics

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.NameFit
import com.cogra.core.designsystem.NameFitSize
import com.cogra.domain.testing.testHashtag
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** The longest a tag's name may be (TagPage.jsx `LONG_NAME`, 128 characters, no hyphen). */
private const val LONG_NAME = "salt_maps_of_the_coast_road_and_the_third_headland_light_and_" +
    "the_third_headland_light_and_the_third_headland_light_and_the_third"

/** The board's `middle` sample: the long name cut to 85 characters at its word `light`. */
private val MIDDLE_NAME = LONG_NAME.take(85)

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h800dp")
class TopicFullNameTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(name: String, state: TopicUiState = loaded(name), width: () -> Dp? = { null }) {
        compose.setContent {
            val drawn = width()
            Box(if (drawn == null) Modifier else Modifier.requiredWidth(drawn)) {
                TopicScreen(name = name, state = state, onRefresh = {}, onBack = {})
            }
        }
    }

    private fun loaded(name: String) = TopicUiState(loading = false, hashtag = testHashtag(name))

    private val heading get() = compose.onAllNodesWithTag("tagPage.name", useUnmergedTree = true)

    /** The heading's drawn text: the node under `tagPage.name` that carries the fit. */
    private val headingText get() = compose.onNode(
        SemanticsMatcher.keyIsDefined(NameFitSize).and(hasAnyAncestor(hasTestTag("tagPage.name"))),
        useUnmergedTree = true,
    )

    private fun fit(): NameFit = checkNotNull(headingText.fetchSemanticsNode().config.getOrNull(NameFitSize))

    @Test
    fun aNameThatFitsTheHeadersLineIsNeverPrintedTwice() {
        render("saltmaps")
        heading.assertCountEquals(0)
    }

    @Test
    fun aNameTooLongForTheHeaderStandsWholeUnderItAndTheHeaderStillSpeaksItWhole() {
        render(LONG_NAME)
        heading.assertCountEquals(1)
        headingText.assertTextEquals("#$LONG_NAME")
        compose.onNodeWithTag("tagPage.header.title", useUnmergedTree = true).assertTextEquals("#$LONG_NAME")
    }

    @Test
    fun theHeadingIsHiddenFromAssistiveTechnology() {
        render(LONG_NAME)
        val config = headingText.fetchSemanticsNode().config
        assertThat(config.contains(SemanticsProperties.HideFromAccessibility)).isTrue()
    }

    @Test
    fun theHeadingStandsAboveTheTopicsRow() {
        render(LONG_NAME)
        val name = heading[0].fetchSemanticsNode().boundsInRoot
        val row = compose.onNodeWithTag("tagPage.actionRow", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        val header = compose.onNodeWithTag("tagPage.header", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        assertThat(name.top).isAtLeast(header.bottom)
        assertThat(row.top).isAtLeast(name.bottom)
    }

    @Test
    fun aMiddleNameShrinksToASizeBetweenTheFloorAndTheRoleThatHoldsTwoLines() {
        render(MIDDLE_NAME)
        val fit = fit()
        assertThat(fit.size).isLessThan(22)
        assertThat(fit.size).isGreaterThan(12)
    }

    @Test
    fun aNameThatHoldsTwoLinesAtNoSizeDownTo12StandsAt12On15() {
        render(LONG_NAME)
        assertThat(fit()).isEqualTo(NameFit(12, 15))
    }

    @Test
    fun theFailedAndNotFoundPagesPrintNoHeading() {
        var state by mutableStateOf(TopicUiState(loading = false, transportFailed = true))
        compose.setContent { TopicScreen(name = LONG_NAME, state = state, onRefresh = {}, onBack = {}) }
        heading.assertCountEquals(0)
        state = TopicUiState(loading = false, notFound = true)
        compose.waitForIdle()
        heading.assertCountEquals(0)
        state = TopicUiState(loading = true)
        compose.waitForIdle()
        heading.assertCountEquals(0)
    }

    @Test
    fun theHeadingFollowsTheLineAWiderScreenFitsTheNameAndANarrowerCutsItAgain() {
        val name = "salt_maps_of_the_coast_road"
        var width by mutableStateOf<Dp?>(2000.dp)
        render(name) { width }
        heading.assertCountEquals(0)
        width = 200.dp
        compose.waitForIdle()
        heading.assertCountEquals(1)
        width = 2000.dp
        compose.waitForIdle()
        heading.assertCountEquals(0)
    }
}
