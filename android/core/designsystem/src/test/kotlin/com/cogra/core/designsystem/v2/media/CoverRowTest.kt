package com.cogra.core.designsystem.v2.media

import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * NEW-2 (video-cover round, 2026-09-10; `ComposeCoverNoFrames.jsx:44`): the
 * row's caption names the reason once frame extraction is done and came back
 * with nothing, rather than offering four tiles for pictures that do not
 * exist.
 */
@RunWith(RobolectricTestRunner::class)
class CoverRowTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun namesTheReasonWhenExtractionFoundNoFrames() {
        compose.setContent {
            Cogra2PreviewTheme {
                CoverRow(
                    frames = emptyList(),
                    picked = CoverPick.OwnPicture,
                    onPickFrame = {},
                    onPickOwnPicture = {},
                    testTagPrefix = "test",
                )
            }
        }

        compose.onNodeWithTag("test_note").assertTextEquals(
            "This clip gave no frames — choose a picture of your own, or leave it without one.",
        )
    }

    @Test
    fun keepsTheDefaultCaptionWhenFramesExist() {
        compose.setContent {
            Cogra2PreviewTheme {
                CoverRow(
                    frames = listOf(null, null),
                    picked = CoverPick.Frame(0),
                    onPickFrame = {},
                    onPickOwnPicture = {},
                    testTagPrefix = "test",
                )
            }
        }

        compose.onNodeWithTag("test_note").assertTextEquals("A frame, or a picture of your own.")
    }
}
