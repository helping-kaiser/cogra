package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.MediaShape
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The stateful media components, branch by branch. Assertions bind to test
 * tags rather than to display copy wherever the copy is incidental; the two
 * removal wordings are the exception, because *being different* is the
 * requirement under test.
 */
@RunWith(RobolectricTestRunner::class)
class MediaComponentsTest {

    @get:Rule
    val compose = createComposeRule()

    // ---- The sensitive veil -------------------------------------------

    /**
     * A post body — media, text and description — rather than a bare line.
     * The veil never grows what it covers (revealing must move nothing), so
     * its chrome is sized for the body region it is documented to wrap.
     */
    private fun body(text: String): @Composable () -> Unit = {
        Column(Modifier.size(300.dp)) { Text(text) }
    }

    @Test
    fun aVeiledBodyOffersARevealAndTheContentIsNotReadable() {
        compose.setContent {
            Cogra2PreviewTheme {
                SensitiveVeil(veiled = true, onReveal = {}, testTag = "veil") {
                    body("the secret body")()
                }
            }
        }

        compose.onNodeWithTag("veil_reveal").assertIsDisplayed()
        // The subtree's semantics are replaced by the veil's own, so the
        // body is not merely blurred — it is out of the tree.
        compose.onNodeWithText("the secret body").assertDoesNotExist()
    }

    @Test
    fun revealingPutsTheBodyBackAndRetiresTheVeil() {
        compose.setContent {
            Cogra2PreviewTheme {
                var veiled by remember { mutableStateOf(true) }
                SensitiveVeil(
                    veiled = veiled,
                    onReveal = { veiled = false },
                    testTag = "veil",
                ) { body("the secret body")() }
            }
        }

        compose.onNodeWithTag("veil_reveal").performClick()

        compose.onNodeWithText("the secret body").assertIsDisplayed()
        compose.onNodeWithTag("veil_reveal").assertDoesNotExist()
    }

    @Test
    fun anUnveiledBodyIsJustTheBody() {
        compose.setContent {
            Cogra2PreviewTheme {
                SensitiveVeil(veiled = false, onReveal = {}, testTag = "veil") {
                    Text("the plain body")
                }
            }
        }

        compose.onNodeWithText("the plain body").assertIsDisplayed()
        compose.onNodeWithTag("veil_reveal").assertDoesNotExist()
    }

    @Test
    fun theAuthorsStatedReasonIsShownOnTheVeil() {
        compose.setContent {
            Cogra2PreviewTheme {
                SensitiveVeil(
                    veiled = true,
                    onReveal = {},
                    reason = "Shows an injury",
                ) { body("body")() }
            }
        }

        compose.onNodeWithText("Shows an injury").assertIsDisplayed()
    }

    // ---- Removal ------------------------------------------------------

    @Test
    fun theTwoRemovalReasonsDoNotReadAlike() {
        compose.setContent {
            Cogra2PreviewTheme {
                Column {
                    RemovedPlaceholder(RemovalReason.Author, testTag = "author")
                    RemovedPlaceholder(RemovalReason.Platform, testTag = "platform")
                }
            }
        }

        // The requirement is that a verdict cannot hide behind an author's
        // own decision, so each headline is asserted in full.
        compose.onNodeWithText("Removed by its author").assertIsDisplayed()
        compose.onNodeWithText("Removed under the platform's rules").assertIsDisplayed()
    }

    // ---- The crop -----------------------------------------------------

    private fun cropContent(state: CropState, shape: MediaShape = MediaShape.Square) {
        compose.setContent {
            Cogra2PreviewTheme {
                MediaCrop(
                    item = MediaItem(null, 1.5f, "a picture"),
                    shape = shape,
                    state = state,
                    modifier = Modifier.width(300.dp),
                    testTag = "crop",
                )
            }
        }
    }

    @Test
    fun theCropIsCompletableWithoutAGesture() {
        val state = CropState(2f, androidx.compose.ui.geometry.Offset.Zero)
        cropContent(state)

        compose.onNodeWithTag("crop_left").performClick()
        compose.waitForIdle()

        // The visible non-drag route actually moves the framing — this is
        // the D17 requirement, not a decoration.
        assertThat(state.offset.x).isGreaterThan(0f)
    }

    @Test
    fun everyNudgeDirectionIsWired() {
        val state = CropState(2f, androidx.compose.ui.geometry.Offset.Zero)
        cropContent(state)

        compose.onNodeWithTag("crop_right").performClick()
        compose.waitForIdle()
        assertThat(state.offset.x).isLessThan(0f)

        compose.onNodeWithTag("crop_up").performClick()
        compose.waitForIdle()
        assertThat(state.offset.y).isGreaterThan(0f)

        compose.onNodeWithTag("crop_down").performClick()
        compose.onNodeWithTag("crop_down").performClick()
        compose.waitForIdle()
        assertThat(state.offset.y).isLessThan(0f)
    }

    @Test
    fun theZoomControlsMoveTheScaleAndDisableAtTheirBounds() {
        val state = CropState(CropState.MIN_SCALE, androidx.compose.ui.geometry.Offset.Zero)
        cropContent(state)

        // Fully zoomed out, only one direction is available.
        compose.onNodeWithTag("crop_zoom_out").assertIsNotEnabled()
        compose.onNodeWithTag("crop_zoom_in").assertIsEnabled()

        compose.onNodeWithTag("crop_zoom_in").performClick()
        compose.waitForIdle()

        assertThat(state.scale).isGreaterThan(CropState.MIN_SCALE)
        compose.onNodeWithTag("crop_zoom_out").assertIsEnabled()
    }

    @Test
    fun theFramingControlsCanBeRetiredWithoutBreakingTheCrop() {
        compose.setContent {
            Cogra2PreviewTheme {
                MediaCrop(
                    item = MediaItem(null, 1.5f, "a picture"),
                    shape = MediaShape.Tall,
                    state = rememberCropState(),
                    showFramingControls = false,
                    modifier = Modifier.width(300.dp),
                    testTag = "crop",
                )
            }
        }

        compose.onNodeWithTag("crop").assertIsDisplayed()
        compose.onNodeWithTag("crop_left").assertDoesNotExist()
    }

    @Test
    fun theShapeChipsReportTheChoice() {
        var chosen: MediaShape? = null
        compose.setContent {
            Cogra2PreviewTheme {
                CropShapeChips(selected = MediaShape.Tall, onSelect = { chosen = it })
            }
        }

        compose.onNodeWithTag("crop_shape_wide").performClick()

        assertThat(chosen).isEqualTo(MediaShape.Wide)
    }
}
