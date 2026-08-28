package com.cogra.core.designsystem

import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ReferenceChipTest {

    @get:Rule
    val compose = createComposeRule()

    private fun renderReference(
        label: String = "On tail latency",
        supporting: String? = null,
        values: ReferenceChipValues? = null,
        onClick: (() -> Unit)? = {},
        onRemove: (() -> Unit)? = null,
    ) {
        compose.setContent {
            ReferenceChip(
                label = label,
                onClick = onClick,
                supporting = supporting,
                onRemove = onRemove,
                testTag = "reference",
                values = values,
            )
        }
    }

    @Test
    fun aPlainReferenceChipCarriesOnlyItsLabel() {
        renderReference()
        compose.onNodeWithTag("reference").assertTextContains("On tail latency")
    }

    @Test
    fun aQuotedChipNamesItsAuthorBesideTheTitle() {
        renderReference(supporting = "@ada")
        compose.onNodeWithTag("reference").assertTextContains("@ada")
    }

    /** Both citation parameters are bipolar, so both signs are data (D1). */
    @Test
    fun revealedReferenceValuesRenderCompactlyAndSigned() {
        renderReference(values = ReferenceChipValues(relevance = 0.4, support = 0.9))
        compose.onNodeWithTag("reference").assertTextContains("+0.40 · +0.90")
    }

    /** Support is the axis that can refute, so a negative reading must survive. */
    @Test
    fun aRefutingReferenceKeepsItsNegativeSupport() {
        renderReference(values = ReferenceChipValues(relevance = 0.5, support = -0.75))
        compose.onNodeWithTag("reference").assertTextContains("+0.50 · -0.75")
    }

    /** The compact reading is an abbreviation; assistive tech gets the words. */
    @Test
    fun revealedReferenceValuesNameBothParametersForScreenReaders() {
        renderReference(
            supporting = "@ada",
            values = ReferenceChipValues(relevance = 0.4, support = 0.9),
        )
        compose.onNodeWithTag("reference")
            .assertContentDescriptionEquals("On tail latency, @ada, relevance +0.40, support +0.90")
    }

    @Test
    fun aReferenceChipOpensItsTargetOnTap() {
        var opened = false
        renderReference(onClick = { opened = true })
        compose.onNodeWithTag("reference").performClick()
        assertThat(opened).isTrue()
    }

    /**
     * A citation this build cannot route to still stands as a
     * substrate fact — the chip stays readable and stops being
     * actionable, rather than vanishing (D16).
     */
    @Test
    fun anUnroutableReferenceRendersInertRatherThanAbsent() {
        renderReference(label = "Referenced node", onClick = null)
        compose.onNodeWithTag("reference").assertTextContains("Referenced node")
        compose.onNodeWithTag("reference").assertIsNotEnabled()
    }

    @Test
    fun aRoutableReferenceIsEnabled() {
        renderReference()
        compose.onNodeWithTag("reference").assertIsEnabled()
    }

    /** The remove button is its own tap target beside the chip, addressable alone. */
    @Test
    fun aRemovableReferenceCarriesASeparateRemoveTarget() {
        var removed = false
        renderReference(onRemove = { removed = true })
        compose.onNodeWithTag("reference_remove").performClick()
        assertThat(removed).isTrue()
    }

    @Test
    fun aRemovableReferenceStillOpensItsTarget() {
        var opened = false
        renderReference(onClick = { opened = true }, onRemove = {})
        compose.onNodeWithTag("reference_open").performClick()
        assertThat(opened).isTrue()
    }
}
