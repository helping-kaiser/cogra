package com.cogra.core.designsystem

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ReferenceParameterSlidersTest {

    @get:Rule
    val compose = createComposeRule()

    private fun renderReferenceSliders(relevance: Double = 0.1, support: Double = 0.1) {
        compose.setContent {
            ReferenceParameterSliders(
                relevance = relevance,
                support = support,
                onRelevanceChange = {},
                onSupportChange = {},
                testTagPrefix = "reference_params",
            )
        }
    }

    @Test
    fun bothCitationParametersRenderWithTheirValues() {
        renderReferenceSliders(relevance = 0.4, support = -0.2)
        compose.onNodeWithText("Relevance: 0.40").assertExists()
        compose.onNodeWithText("Support: -0.20").assertExists()
    }

    /**
     * Unlike a tag's confidence, support is bipolar — so it carries the
     * same centre-zero scale relevance does (D1).
     */
    @Test
    fun bothCitationParametersCarryTheCentreZeroMark() {
        renderReferenceSliders()
        compose.onNodeWithTag("reference_params_relevance_scale").assertExists()
        compose.onNodeWithTag("reference_params_support_scale").assertExists()
    }

    @Test
    fun supportReachesBelowZeroWhereATagsConfidenceCannot() {
        renderReferenceSliders(support = -1.0)
        compose.onNodeWithText("Support: -1.00").assertExists()
    }

    /** TalkBack reads the number, not a bare percentage. */
    @Test
    fun eachCitationSliderAnnouncesItsReading() {
        renderReferenceSliders(relevance = 0.4, support = 0.9)
        compose.onNodeWithTag("reference_params_relevance").assert(hasStateDescription("0.40"))
        compose.onNodeWithTag("reference_params_support").assert(hasStateDescription("0.90"))
    }

    private fun hasStateDescription(value: String) = SemanticsMatcher.expectValue(
        SemanticsProperties.StateDescription,
        value,
    )
}
