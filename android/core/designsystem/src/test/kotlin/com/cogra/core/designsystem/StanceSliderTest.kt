package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import com.cogra.core.designsystem.v2.atom.HOUSE_SLIDER_THUMB
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
    fun theLabelCarriesTheSignedValueOnlyInGeekMode() {
        // StanceSlider.jsx: the value in the label is the geek reading (`cg-exact`).
        compose.setContent {
            CompositionLocalProvider(LocalShowExactValues provides true) {
                StanceSlider(label = "Directed", value = 0.1, onChange = {}, testTag = "slider")
            }
        }
        compose.onNodeWithText("Directed +0.10").assertExists()
    }

    @Test
    fun theDefaultReadingIsTheQuestionAloneAndTheSliderStillAnnouncesItsValue() {
        compose.setContent {
            StanceSlider(label = "Directed", value = 0.1, onChange = {}, testTag = "slider")
        }
        compose.onNodeWithText("Directed").assertExists()
        compose.onNodeWithTag("slider")
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "+0.10"))
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
        compose.onNodeWithTag("slider")
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "+0.50"))
    }

    @Test
    fun theTrackReportsOnlyHundredths() {
        // The track is a continuous Float: 0.437f is 0.43700000643… as a
        // Double. The pick is a hundredth (the value domain, jakob 2026-10-20).
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
            it(0.437f)
        }
        assertEquals(0.44, reported, 0.0)
        compose.onNodeWithTag("slider").performSemanticsAction(SemanticsActions.SetProgress) {
            it(-0.004f)
        }
        assertEquals(0.0, reported, 0.0)
        assertEquals(Double.POSITIVE_INFINITY, 1.0 / reported, 0.0)
    }

    @Test
    fun bothFamilySlidersDrawTheHouseDot() {
        // StanceSlider.jsx: a range input in `primary` — the house slider's
        // 16dp dot (CropViewport.jsx `CropZoom`), never Material's 4dp handle.
        compose.setContent {
            Column {
                StanceSlider(label = "Directed", value = 0.1, onChange = {}, testTag = "stance")
                LabeledSlider(label = "Relevance", value = 0.5, onChange = {}, testTag = "labeled")
            }
        }
        for (tag in listOf("stance_thumb", "labeled_thumb")) {
            val size = compose.onNodeWithTag(tag, useUnmergedTree = true).fetchSemanticsNode().size
            with(compose.density) {
                assertEquals(HOUSE_SLIDER_THUMB.toPx(), size.width.toFloat(), 1f)
                assertEquals(HOUSE_SLIDER_THUMB.toPx(), size.height.toFloat(), 1f)
            }
        }
    }
}
