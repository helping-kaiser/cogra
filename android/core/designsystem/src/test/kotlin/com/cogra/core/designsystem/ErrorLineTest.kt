package com.cogra.core.designsystem

import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ErrorLineTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun rendersTheResourceUnderTheTag() {
        compose.setContent {
            ErrorLine(text = R.string.password_show, testTag = "line")
        }
        compose.onNodeWithTag("line").assertExists()
    }

    @Test
    fun announcesAsAPoliteLiveRegion() {
        compose.setContent {
            ErrorLine(text = R.string.password_show, testTag = "line")
        }
        compose.onNodeWithTag("line").assert(
            SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite),
        )
    }
}
