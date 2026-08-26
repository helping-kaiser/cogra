package com.cogra.core.designsystem

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class TagParameterSlidersTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(
        relevance: Double = 0.1,
        confidence: Double = 1.0,
        onRelevanceChange: (Double) -> Unit = {},
        onConfidenceChange: (Double) -> Unit = {},
    ) {
        compose.setContent {
            TagParameterSliders(
                relevance = relevance,
                confidence = confidence,
                onRelevanceChange = onRelevanceChange,
                onConfidenceChange = onConfidenceChange,
                testTagPrefix = "tag",
            )
        }
    }

    @Test
    fun bothParametersRenderWithTheirValues() {
        render()
        compose.onNodeWithTag("tag_relevance").assertExists()
        compose.onNodeWithTag("tag_confidence").assertExists()
        compose.onNodeWithText("Relevance: 0.10").assertExists()
        compose.onNodeWithText("Confidence: 1.00").assertExists()
    }

    /** Relevance is bipolar: the centre is the mark that matters (F6). */
    @Test
    fun relevanceCarriesTheCentreZeroMark() {
        render()
        compose.onNodeWithTag("tag_relevance_scale").assertExists()
    }

    @Test
    fun relevanceReachesBelowZero() {
        var reported = Double.NaN
        compose.setContent {
            var value by remember { mutableStateOf(0.1) }
            TagParameterSliders(
                relevance = value,
                confidence = 1.0,
                onRelevanceChange = {
                    value = it
                    reported = it
                },
                onConfidenceChange = {},
                testTagPrefix = "tag",
            )
        }
        compose.onNodeWithTag("tag_relevance").performSemanticsAction(SemanticsActions.SetProgress) {
            it(-0.5f)
        }
        assertEquals(-0.5, reported, 1e-6)
        compose.onNodeWithText("Relevance: -0.50").assertExists()
    }

    /** Confidence is census-bounded to [0, 1] — the slider cannot leave it. */
    @Test
    fun confidenceRangeStopsAtZero() {
        var reported = Double.NaN
        compose.setContent {
            var value by remember { mutableStateOf(1.0) }
            TagParameterSliders(
                relevance = 0.1,
                confidence = value,
                onRelevanceChange = {},
                onConfidenceChange = {
                    value = it
                    reported = it
                },
                testTagPrefix = "tag",
            )
        }
        compose.onNodeWithTag("tag_confidence").performSemanticsAction(SemanticsActions.SetProgress) {
            it(-1f)
        }
        assertEquals(0.0, reported, 1e-6)
    }

    /** TalkBack reads the number, not a bare percentage. */
    @Test
    fun eachSliderAnnouncesItsReading() {
        render(relevance = 0.25, confidence = 0.5)
        compose.onNodeWithTag("tag_relevance").assert(hasStateDescription("0.25"))
        compose.onNodeWithTag("tag_confidence").assert(hasStateDescription("0.50"))
    }

    private fun hasStateDescription(value: String) = SemanticsMatcher.expectValue(
        SemanticsProperties.StateDescription,
        value,
    )
}
