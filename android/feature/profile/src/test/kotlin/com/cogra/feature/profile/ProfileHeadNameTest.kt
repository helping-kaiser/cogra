// THE PROFILE HEAD'S NAME, compiled from its sidecar lines (Profile.md:103-105,
// ProfileOther.md:113-115; `ProfileHeader.jsx` `nameFitSize`): shown whole on at
// most two lines, shrunk to the largest whole size that holds two, with no
// smallest size, the handle line keeping its own. Its own class:
// ProfileScreensTest is already large, and these need real glyph metrics
// (NATIVE) where that class runs on the legacy graphics.

package com.cogra.feature.profile

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.NameFit
import com.cogra.core.designsystem.NameFitSize
import com.cogra.core.designsystem.at
import com.cogra.core.designsystem.nameLeading
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** The board's `fifty` sample: the 50-character name in four words (ProfileOther.jsx). */
private const val FIFTY = "Maximiliana Wilhelmina Featherstonehaugh Okonkwoli"

/** The board's `one-word` sample: 50 characters, no break point. */
private const val ONE_WORD = "MaximilianaWilhelminaFeatherstonehaughOkonkwoLiang"

/** The board's `widest` sample: 50 × W without a space, the widest legal name. */
private val WIDEST = "W".repeat(50)

/** The name column at 360: the 16 gutters, the 80 avatar and the 16 gap leave 232. */
private val COLUMN = 232.dp

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h800dp")
class ProfileHeadNameTest {

    @get:Rule
    val compose = createComposeRule()

    private val identity = DataNode("profile") / "identity"

    /** Counts [text]'s lines at a fit in the name column — the same measurer the fitter uses. */
    private var lines: (String, NameFit) -> Int = { _, _ -> 0 }

    private fun render(name: String, width: () -> Dp = { 360.dp }) {
        compose.setContent {
            val measurer = rememberTextMeasurer()
            val column = with(LocalDensity.current) { COLUMN.roundToPx() }
            val style = MaterialTheme.typography.titleLarge
            lines = { text, fit ->
                measurer.measure(text, style.at(fit), constraints = Constraints(maxWidth = column)).lineCount
            }
            Box(Modifier.requiredWidth(width())) {
                ProfileHeader(
                    profile = testProfile(id = "u1", handle = "ada", displayName = name),
                    showHandle = true,
                    node = identity,
                    actions = {},
                )
            }
        }
    }

    private val name get() = compose.onNodeWithTag((identity / "name").tag, useUnmergedTree = true)

    private fun fit(): NameFit = checkNotNull(name.fetchSemanticsNode().config.getOrNull(NameFitSize))

    private fun SemanticsNodeInteraction.layout(): TextLayoutResult {
        val results = mutableListOf<TextLayoutResult>()
        val action = checkNotNull(fetchSemanticsNode().config.getOrNull(SemanticsActions.GetTextLayoutResult))
        action.action?.invoke(results)
        return results.single()
    }

    @Test
    fun aShortNameStandsAtTheRolesSizeOnOneLine() {
        render("Ada L")
        assertThat(fit()).isEqualTo(NameFit(22, 28))
        assertThat(name.layout().lineCount).isEqualTo(1)
    }

    @Test
    fun aNameTooLongForTwoLinesAt22StandsOnTwoLinesAtTheLargestSizeThatHoldsThem() {
        render(FIFTY)
        assertThat(lines(FIFTY, NameFit(22, 28))).isGreaterThan(2)
        val fit = fit()
        assertThat(fit.size).isLessThan(22)
        assertThat(name.layout().lineCount).isEqualTo(2)
        assertThat(name.layout().layoutInput.style.fontSize).isEqualTo(fit.size.sp)
        assertThat(name.layout().layoutInput.style.lineHeight).isEqualTo(nameLeading(fit.size).sp)
        // One size up no longer holds two lines: the fit is the largest.
        assertThat(lines(FIFTY, NameFit(fit.size + 1, nameLeading(fit.size + 1)))).isGreaterThan(2)
    }

    @Test
    fun aLongNameWithNoBreakPointBreaksInsideTheWordOnTwoLines() {
        render(ONE_WORD)
        assertThat(fit().size).isLessThan(22)
        assertThat(name.layout().lineCount).isEqualTo(2)
        name.assertTextEquals(ONE_WORD)
    }

    @Test
    fun theWidestNameStillStandsOnTwoLinesForTheHeadHasNoSmallestSize() {
        render(WIDEST)
        assertThat(fit().size).isLessThan(12)
        assertThat(name.layout().lineCount).isEqualTo(2)
    }

    @Test
    fun theHandleLineKeepsItsOwnSizeUnderAShrunkName() {
        render(WIDEST)
        val handle = compose.onNodeWithTag((identity / "handle").tag, useUnmergedTree = true)
        handle.assertTextEquals("@ada")
        assertThat(handle.layout().layoutInput.style.fontSize).isEqualTo(12.sp)
        assertThat(handle.layout().lineCount).isEqualTo(1)
    }

    @Test
    fun aWiderHeadRefitsTheName() {
        var width by mutableStateOf(360.dp)
        render(FIFTY) { width }
        assertThat(fit().size).isLessThan(22)
        width = 1200.dp
        compose.waitForIdle()
        assertThat(fit()).isEqualTo(NameFit(22, 28))
        width = 360.dp
        compose.waitForIdle()
        assertThat(fit().size).isLessThan(22)
    }

    @Test
    fun theNameIsAHeadingSpokenOnce() {
        render(FIFTY)
        assertThat(name.fetchSemanticsNode().config.contains(SemanticsProperties.Heading)).isTrue()
        name.assertTextEquals(FIFTY)
        compose.onAllNodesWithText(FIFTY).assertCountEquals(1)
        compose.onAllNodes(hasText(FIFTY), useUnmergedTree = true).assertCountEquals(1)
    }
}
