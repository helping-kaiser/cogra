package com.cogra.core.designsystem.v2.compose

import androidx.compose.ui.test.assertDoesNotExist
import androidx.compose.ui.test.assertExists
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * `UploadStatusLine` — strictly the seal's in-flight gate
 * (`design/components/compose/UploadNotice.prompt.md` lines 1, 11). Finding
 * 4 of jakob's round-four review, 2026-09-23: the compose wizard's own seal
 * step could reach an emptied media batch and still gate the guard only on
 * `mode == Media`, drawing "Uploading 0 of 0" — the component carries its
 * own guard now, so every caller gets it regardless of its own gate.
 */
@RunWith(RobolectricTestRunner::class)
class UploadNoticeTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun theLineNeverDrawsWithNothingToUpload() {
        compose.setContent {
            Cogra2PreviewTheme {
                UploadStatusLine(done = 0, total = 0, testTag = "line")
            }
        }

        compose.onNodeWithTag("line").assertDoesNotExist()
    }

    @Test
    fun theLineDrawsWhileSomethingIsStillOnItsWay() {
        compose.setContent {
            Cogra2PreviewTheme {
                UploadStatusLine(done = 2, total = 4, testTag = "line")
            }
        }

        compose.onNodeWithTag("line").assertExists()
    }
}
