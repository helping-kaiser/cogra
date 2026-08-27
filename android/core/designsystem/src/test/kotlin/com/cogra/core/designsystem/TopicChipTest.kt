package com.cogra.core.designsystem

import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class TopicChipTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(
        values: TagChipValues? = null,
        onClick: () -> Unit = {},
        onRemove: (() -> Unit)? = null,
    ) {
        compose.setContent {
            TopicChip(
                name = "rust",
                onClick = onClick,
                onRemove = onRemove,
                testTag = "chip",
                values = values,
            )
        }
    }

    @Test
    fun aPlainChipCarriesOnlyItsName() {
        render()
        compose.onNodeWithTag("chip").assertTextEquals("#rust")
    }

    /** Compact and signed — relevance is bipolar, so the sign is data (F8). */
    @Test
    fun revealedValuesRenderCompactlyAndSigned() {
        render(TagChipValues(relevance = 0.4, confidence = 0.9))
        compose.onNodeWithTag("chip").assertTextContains("+0.40 · 0.90")
    }

    @Test
    fun aNegativeRelevanceKeepsItsSign() {
        render(TagChipValues(relevance = -0.25, confidence = 1.0))
        compose.onNodeWithTag("chip").assertTextContains("-0.25 · 1.00")
    }

    /** The compact reading is an abbreviation; assistive tech gets the words. */
    @Test
    fun revealedValuesNameBothParametersForScreenReaders() {
        render(TagChipValues(relevance = 0.4, confidence = 0.9))
        compose.onNodeWithTag("chip")
            .assertContentDescriptionEquals("#rust, relevance +0.40, confidence 0.90")
    }

    @Test
    fun aRevealedChipStillOpensItsTopic() {
        var clicked = false
        render(TagChipValues(relevance = 0.4, confidence = 0.9), onClick = { clicked = true })
        compose.onNodeWithTag("chip").performClick()
        assertThat(clicked).isTrue()
    }

    /**
     * The removable form is a row around the chip, so the values (and the
     * description that spells them out) must land on the chip itself —
     * the half that is the tap target.
     */
    @Test
    fun aRemovableChipCarriesTheValuesOnItsOwnTapTarget() {
        render(TagChipValues(relevance = 0.4, confidence = 0.9), onRemove = {})
        compose.onNodeWithTag("chip_open")
            .assertContentDescriptionEquals("#rust, relevance +0.40, confidence 0.90")
        compose.onNodeWithTag("chip_remove").assertExists()
    }
}
