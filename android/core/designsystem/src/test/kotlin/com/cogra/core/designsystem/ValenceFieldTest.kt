package com.cogra.core.designsystem

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionContains
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performSemanticsAction
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import kotlin.math.abs

/**
 * The one-axis field: the travel rule it shares with the square, and the
 * announcement that makes its drag reachable without a drag.
 */
@RunWith(RobolectricTestRunner::class)
class ValenceFieldTest {

    @get:Rule
    val compose = createComposeRule()

    /** An extent of 100px: one unit of value is 100px of travel. */
    private val extent = 100f

    @Test
    fun oneExtentOfTravelIsOneUnitOfValue() {
        assertThat(valenceFrom(0.0, extent, extent)).isEqualTo(1.0)
        assertThat(valenceFrom(0.0, -extent, extent)).isEqualTo(-1.0)
        assertThat(valenceFrom(0.0, extent / 2, extent)).isEqualTo(0.5)
    }

    @Test
    fun aSecondDragAdjustsThePickAlreadyStanding() {
        assertThat(valenceFrom(-0.5, extent / 2, extent)).isEqualTo(0.0)
    }

    @Test
    fun theValueIsClampedOnTheSumSoAnOffCentreBaseStillReachesTheEnd() {
        assertThat(valenceFrom(0.9, extent * 10, extent)).isEqualTo(1.0)
        assertThat(valenceFrom(-0.9, -extent * 10, extent)).isEqualTo(-1.0)
    }

    @Test
    fun anUnmeasuredFieldKeepsTheBaseRatherThanDividingByZero() {
        assertThat(valenceFrom(0.4, 999f, 0f)).isEqualTo(0.4)
    }

    @Test
    fun theKnobNeverLeavesTheDrawnField() {
        for (value in listOf(-4.0, -1.0, -0.5, 0.0, 0.5, 1.0, 4.0)) {
            assertThat(abs(valenceKnobOffset(value, extent))).isAtMost(extent)
        }
    }

    @Test
    fun theFieldNamesItsAxisAndSaysWhereTheKnobSits() {
        compose.setContent { ValenceField(value = 0.1, onValueChange = {}) }
        compose.onNodeWithTag("valence_field")
            .assertContentDescriptionContains("For or against")
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "+0.10"))
    }

    @Test
    fun theFieldIsSettableWithoutADrag() {
        val picked = mutableListOf<Double>()
        compose.setContent {
            var value by remember { mutableDoubleStateOf(0.1) }
            ValenceField(
                value = value,
                onValueChange = {
                    value = it
                    picked += it
                },
            )
        }
        compose.onNodeWithTag("valence_field").assert(
            SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress),
        )
        compose.onNodeWithTag("valence_field").performSemanticsAction(SemanticsActions.SetProgress) {
            it(-0.6f)
        }
        assertThat(picked.single()).isWithin(1e-6).of(-0.6)
        compose.onNodeWithTag("valence_field")
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "-0.60"))
    }
}
