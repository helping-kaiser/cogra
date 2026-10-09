package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.height
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The segmented filter's visible geometry against `SegmentedFilter.jsx`
 * (32px border-box, Settings' Theme pill measured on the drawn board at
 * 342×32): the drawn height at the default font size, and words that are
 * never clipped under a larger one.
 */
@RunWith(RobolectricTestRunner::class)
class SegmentedFilterTest {

    @get:Rule
    val compose = createComposeRule()

    private val picker = DataNode("settings") / "theme" / "picker"

    private fun show(fontScale: Float) {
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale)) {
                Cogra2PreviewTheme {
                    SegmentedFilter(
                        options = listOf(
                            SegmentedOption("light", "Light", "lightOption"),
                            SegmentedOption("dark", "Dark", "darkOption"),
                            SegmentedOption("auto", "Auto", "autoOption"),
                        ),
                        selected = "auto",
                        onSelect = {},
                        block = true,
                        node = picker,
                        modifier = Modifier.width(342.dp),
                    )
                }
            }
        }
    }

    @Test
    fun thePillStandsAtTheDrawn32AtTheDefaultFontSize() {
        show(fontScale = 1f)
        compose.onNodeWithTag(picker.tag).assertHeightIsEqualTo(32.dp)
        compose.onNodeWithTag((picker / "autoOption").tag).assertHeightIsEqualTo(32.dp)
    }

    @Test
    fun underTheLargestFontSizeThePillGrowsRatherThanClipItsWords() {
        show(fontScale = 2f)
        val pill = compose.onNodeWithTag(picker.tag).getUnclippedBoundsInRoot().height
        val label = compose.onNodeWithText("Light").getUnclippedBoundsInRoot().height
        assertThat(pill).isGreaterThan(32.dp)
        assertThat(label).isAtMost(pill)
    }
}
