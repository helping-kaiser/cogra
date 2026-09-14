package com.cogra.core.designsystem.v2.compose

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The describe sheet's two shapes (CW-15/CW-16, 2026-09-08 UI audit) and the
 * counter's permanent reason line (CW-18) — every value cited against
 * `design/components/compose/DescribeSheet.jsx` and `PickedRow.jsx`.
 */
@RunWith(RobolectricTestRunner::class)
class DescribeComponentsTest {

    @get:Rule
    val compose = createComposeRule()

    // ---- DescribeSheet --------------------------------------------------

    @Test
    fun theSheetIsTitledForAPictureByDefault() {
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeSheet(
                    item = MediaItem(null, 1f),
                    value = "",
                    onValueChange = {},
                    onDone = {},
                    testTag = "sheet",
                )
            }
        }

        compose.onNodeWithText("Describe this picture").assertExists()
        compose.onNodeWithText("What's in the picture").assertExists()
        compose.onNodeWithTag("sheet_play_disc").assertDoesNotExist()
    }

    @Test
    fun theSheetBecomesTheVideoShapeWhenAsked() {
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeSheet(
                    item = MediaItem(null, 1f),
                    value = "",
                    onValueChange = {},
                    onDone = {},
                    video = true,
                    testTag = "sheet",
                )
            }
        }

        compose.onNodeWithText("Describe the video").assertExists()
        compose.onNodeWithText("What's in the video").assertExists()
        compose.onNodeWithTag("sheet_play_disc").assertExists()
    }

    @Test
    fun theReasonRidesUnderTheTitleOnBothShapes() {
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeSheet(
                    item = MediaItem(null, 1f),
                    value = "",
                    onValueChange = {},
                    onDone = {},
                    video = true,
                    testTag = "sheet",
                )
            }
        }

        // Permanent, not an extended trailing line behind the field.
        compose.onNodeWithText("Read aloud to people who can't see it.").assertExists()
    }

    // ---- DescribeCounter --------------------------------------------------

    @Test
    fun theCounterCarriesThePermanentReasonUnderTheRow() {
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeCounter(described = 0, total = 1, onDescribe = {}, testTag = "counter")
            }
        }

        compose.onNodeWithText("Read aloud to people who can't see it.").assertExists()
    }

    @Test
    fun theCounterReadsTheVideoSubjectWhenAsked() {
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeCounter(
                    described = 0,
                    total = 1,
                    onDescribe = {},
                    subject = DescribeSubject.Video,
                    testTag = "counter",
                )
            }
        }

        compose.onNodeWithTag("counter").assertExists()
        compose.onNodeWithText("Read aloud to people who can't see it.").assertExists()
    }
}
