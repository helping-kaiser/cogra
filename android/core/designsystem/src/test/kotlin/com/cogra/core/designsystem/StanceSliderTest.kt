package com.cogra.core.designsystem

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsActions
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
class StanceSliderTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun labelCarriesTheTwoDecimalValue() {
        compose.setContent {
            StanceSlider(label = "Directed", value = 0.1, onChange = {}, testTag = "slider")
        }
        compose.onNodeWithText("Directed: 0.10").assertExists()
    }

    @Test
    fun draggingReportsTheNewValueAsDouble() {
        var reported = Double.NaN
        compose.setContent {
            var value by remember { mutableStateOf(0.1) }
            StanceSlider(
                label = "Directed",
                value = value,
                onChange = {
                    value = it
                    reported = it
                },
                testTag = "slider",
            )
        }
        compose.onNodeWithTag("slider").performSemanticsAction(SemanticsActions.SetProgress) {
            it(0.5f)
        }
        assertEquals(0.5, reported, 1e-6)
        compose.onNodeWithText("Directed: 0.50").assertExists()
    }
}
