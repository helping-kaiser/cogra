// THE TWO-LINE RULE as the master's `nameFitSize` states it
// (ProfileHeader.jsx; Profile.md:105; TagPage.md:9-11), the cases web's
// `profile-header.test.tsx` pins, and the fitter laid out for real.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.GraphicsMode

/** The longest a tag's name may be, without a hyphen (TagPage.jsx `LONG_NAME`, 128 characters). */
private const val LONG_NAME = "salt_maps_of_the_coast_road_and_the_third_headland_light_and_" +
    "the_third_headland_light_and_the_third_headland_light_and_the_third"

// Line counts need real glyph metrics: the legacy graphics measure every
// string at zero width, so nothing ever wraps (PostBodyTest's note).
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class NameFitTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun keepsTheRolesOwnSizeWhereTheNameHoldsTwoLinesThere() {
        assertThat(nameFitSize { _, _ -> 2 }).isEqualTo(NameFit(22, 28))
        assertThat(nameFitSize { _, _ -> 1 }).isEqualTo(NameFit(22, 28))
    }

    @Test
    fun takesTheLargestSizeThatHoldsTwoLinesOnItsRoundedLeading() {
        val asked = mutableListOf<Pair<Int, Int>>()
        val fit = nameFitSize { size, lineHeight ->
            asked += size to lineHeight
            if (size > 17) 3 else 2
        }
        assertThat(fit).isEqualTo(NameFit(17, 22))
        // From 22 down in steps of 1, each on round(size × 28 / 22).
        assertThat(asked).containsExactly(22 to 28, 21 to 27, 20 to 25, 19 to 24, 18 to 23, 17 to 22).inOrder()
    }

    @Test
    fun hasNoFloorAboveTheLastWholeSizeForTheProfileHead() {
        assertThat(nameFitSize { size, _ -> if (size > 3) 3 else 2 }).isEqualTo(NameFit(3, 4))
        assertThat(nameFitSize { _, _ -> 3 }).isEqualTo(NameFit(1, 1))
    }

    @Test
    fun stopsAtTheFloorItIsGivenOnTheFloorsLeadingWithoutAskingBelowIt() {
        val asked = mutableListOf<Int>()
        val fit = nameFitSize(floor = 12) { size, _ ->
            asked += size
            3
        }
        assertThat(fit).isEqualTo(NameFit(12, 15))
        assertThat(asked.min()).isEqualTo(13)
        assertThat(nameFitSize(floor = 12) { size, _ -> if (size > 14) 3 else 2 }).isEqualTo(NameFit(14, 18))
    }

    @Test
    fun aNameThatFitsStandsAtTheRolesSize() {
        compose.setContent {
            MaterialTheme {
                FittedName("#saltmaps", MaterialTheme.typography.titleLarge, Modifier.width(360.dp), floor = 12)
            }
        }
        assertThat(fitOf()).isEqualTo(NameFit(22, 28))
    }

    @Test
    fun aLongNameShrinksToTheLargestSizeThatHoldsItOnTwoLines() {
        val name = "#" + LONG_NAME.take(85)
        var lines: (NameFit) -> Int = { 0 }
        compose.setContent {
            MaterialTheme {
                val style = MaterialTheme.typography.titleLarge
                val measurer = rememberTextMeasurer()
                FittedName(name, style, Modifier.width(360.dp).padding(horizontal = 16.dp), floor = 12)
                val width = with(LocalDensity.current) { 328.dp.roundToPx() }
                lines = { fit ->
                    measurer.measure(name, style.at(fit), constraints = Constraints(maxWidth = width)).lineCount
                }
            }
        }
        val fit = fitOf()
        assertThat(fit.size).isLessThan(22)
        assertThat(fit.size).isGreaterThan(12)
        assertThat(lines(fit)).isAtMost(2)
        // One size up no longer holds two lines: the fit is the largest.
        assertThat(lines(NameFit(fit.size + 1, nameLeading(fit.size + 1)))).isGreaterThan(2)
    }

    @Test
    fun aNameThatHoldsTwoLinesAtNoSizeDownToTheFloorStandsAtTheFloorOnTheLinesItNeeds() {
        compose.setContent {
            MaterialTheme {
                FittedName("#$LONG_NAME", MaterialTheme.typography.titleLarge, Modifier.width(200.dp), floor = 12)
            }
        }
        assertThat(fitOf()).isEqualTo(NameFit(12, 15))
    }

    private fun fitOf(): NameFit {
        val node = compose.onNode(SemanticsMatcher.keyIsDefined(NameFitSize)).fetchSemanticsNode()
        return checkNotNull(node.config.getOrNull(NameFitSize))
    }
}
