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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
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

    private fun crop() = compose.onNodeWithTag("crop")

    /**
     * Fires one of the crop's custom accessibility actions by its label —
     * the route an assistive technology takes, and now the only non-gesture
     * route there is.
     */
    private fun fireCropAction(label: String) {
        val actions = crop().fetchSemanticsNode().config[SemanticsActions.CustomActions]
        val action = actions.firstOrNull { it.label == label }
        assertThat(action).isNotNull()
        compose.runOnUiThread { action!!.action() }
    }

    @Test
    fun theCropIsCompletableWithoutAGesture() {
        val state = CropState(2f, Offset.Zero)
        cropContent(state)

        fireCropAction("Nudge left")
        compose.waitForIdle()

        // The non-drag route actually moves the framing — this is the D17
        // requirement, not a decoration.
        assertThat(state.offset.x).isGreaterThan(0f)
    }

    @Test
    fun everyNudgeDirectionIsWired() {
        val state = CropState(2f, Offset.Zero)
        cropContent(state)

        fireCropAction("Nudge right")
        compose.waitForIdle()
        assertThat(state.offset.x).isLessThan(0f)

        fireCropAction("Nudge up")
        compose.waitForIdle()
        assertThat(state.offset.y).isGreaterThan(0f)

        fireCropAction("Nudge down")
        fireCropAction("Nudge down")
        compose.waitForIdle()
        assertThat(state.offset.y).isLessThan(0f)
    }

    @Test
    fun theZoomAndResetActionsAreReachableWithoutSeeingAnything() {
        val state = CropState(CropState.MIN_SCALE, Offset.Zero)
        cropContent(state)

        fireCropAction("Zoom in")
        compose.waitForIdle()
        assertThat(state.scale).isGreaterThan(CropState.MIN_SCALE)

        fireCropAction("Zoom out")
        compose.waitForIdle()
        assertThat(state.scale).isWithin(0.001f).of(CropState.MIN_SCALE)

        fireCropAction("Zoom in")
        fireCropAction("Nudge left")
        fireCropAction("Reset framing")
        compose.waitForIdle()
        assertThat(state.scale).isEqualTo(CropState.MIN_SCALE)
        assertThat(state.offset).isEqualTo(Offset.Zero)
    }

    @Test
    fun theCropCarriesNoVisibleFramingChrome() {
        cropContent(CropState(CropState.MIN_SCALE, Offset.Zero))

        // The board draws nothing under the crop but its caption, so the
        // non-gesture route lives entirely in the semantics tree.
        compose.onNodeWithTag("crop").assertIsDisplayed()
        compose.onNodeWithTag("crop_left").assertDoesNotExist()
        compose.onNodeWithTag("crop_zoom_in").assertDoesNotExist()
        compose.onNodeWithContentDescription("Nudge left").assertDoesNotExist()
    }

    @Test
    fun theFramingIsReadBackSoTheActionsAreNotFiredBlind() {
        val state = CropState(CropState.MIN_SCALE, Offset.Zero)
        cropContent(state)

        crop().assert(
            SemanticsMatcher.expectValue(
                SemanticsProperties.StateDescription,
                "Zoom 100%, centred",
            ),
        )

        fireCropAction("Zoom in")
        compose.waitForIdle()

        crop().assert(
            SemanticsMatcher.expectValue(
                SemanticsProperties.StateDescription,
                "Zoom 125%, centred",
            ),
        )
    }

    @Test
    fun aSecondPictureIsFramableInAFrameTheFirstAlreadyMeasured() {
        val first = CropState(2f, Offset.Zero)
        val second = CropState(2f, Offset.Zero)
        var showing by mutableStateOf(first)
        compose.setContent {
            Cogra2PreviewTheme {
                MediaCrop(
                    item = MediaItem(null, 1.5f, "a picture"),
                    shape = MediaShape.Square,
                    state = showing,
                    modifier = Modifier.width(300.dp),
                    testTag = "crop",
                )
            }
        }

        fireCropAction("Nudge left")
        compose.waitForIdle()
        assertThat(first.offset.x).isGreaterThan(0f)

        // The filmstrip moves to the next picture: the frame's measured
        // size has not changed, so nothing re-measures — and the fresh
        // state has to be told the viewport anyway, or every picture after
        // the first is dead to nudges and drags alike.
        showing = second
        compose.waitForIdle()

        fireCropAction("Nudge left")
        compose.waitForIdle()

        assertThat(second.offset.x).isGreaterThan(0f)
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

    // -- The gallery pager (FeedGallery, 2026-08-31) --

    private fun gallery(count: Int) {
        compose.setContent {
            Cogra2PreviewTheme {
                MediaGallery(
                    items = List(count) { MediaItem(null, 1f, "Picture ${it + 1}") },
                    testTag = "g",
                )
            }
        }
    }

    @Test
    fun aSetOfPicturesPagesAndSaysWhereItIs() {
        gallery(4)

        // Dots below, never a "1/4" pill: the position is stated in words
        // for a screen reader and drawn as dots for everyone else.
        compose.onNodeWithTag("g_dots").assertIsDisplayed()
        compose.onNodeWithContentDescription("Picture 1 of 4").assertIsDisplayed()
    }

    @Test
    fun aLonePictureHasNoPagerFurniture() {
        gallery(1)

        compose.onNodeWithTag("g").assertIsDisplayed()
        compose.onNodeWithTag("g_dots").assertDoesNotExist()
    }

    @Test
    fun theWholeSetIsDescribedOnceRatherThanPerPage() {
        gallery(2)

        // One description for the set — the gallery is one tap target
        // opening the post, not two pictures to hunt through.
        compose.onNodeWithContentDescription("2 pictures: Picture 1. Picture 2")
            .assertIsDisplayed()
    }

    @Test
    fun anUndescribedSetStillStatesHowMuchIsThere() {
        compose.setContent {
            Cogra2PreviewTheme {
                MediaGallery(items = List(3) { MediaItem(null, 1f) }, testTag = "g")
            }
        }

        compose.onNodeWithContentDescription("3 pictures").assertIsDisplayed()
    }
}
