package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getUnclippedBoundsInRoot
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

    /** A half-size window, so a nudge has room to move in any direction. */
    private fun centredState() = CropState(CropFraming(0.25f, 0.25f, 0.75f, 0.75f))

    @Test
    fun theCropIsCompletableWithoutAGesture() {
        val state = centredState()
        cropContent(state)

        fireCropAction("Nudge left")
        compose.waitForIdle()

        // The non-drag route actually moves the framing — this is the D17
        // requirement, not a decoration.
        assertThat(state.framing.left).isLessThan(0.25f)
    }

    @Test
    fun everyNudgeDirectionIsWired() {
        val state = centredState()
        cropContent(state)

        fireCropAction("Nudge right")
        compose.waitForIdle()
        assertThat(state.framing.left).isGreaterThan(0.25f)

        fireCropAction("Nudge down")
        compose.waitForIdle()
        assertThat(state.framing.top).isGreaterThan(0.25f)

        fireCropAction("Nudge up")
        fireCropAction("Nudge up")
        compose.waitForIdle()
        assertThat(state.framing.top).isLessThan(0.25f)
    }

    @Test
    fun theZoomAndResetActionsAreReachableWithoutSeeingAnything() {
        val state = centredState()
        cropContent(state)

        fireCropAction("Zoom in")
        compose.waitForIdle()
        val zoomedIn = state.framing.width
        assertThat(zoomedIn).isLessThan(0.5f)

        fireCropAction("Zoom out")
        compose.waitForIdle()
        assertThat(state.framing.width).isGreaterThan(zoomedIn)

        fireCropAction("Zoom in")
        fireCropAction("Nudge left")
        fireCropAction("Reset framing")
        compose.waitForIdle()
        // Reset goes back to the whole picture, which is what a shape
        // switch re-frames against.
        assertThat(state.framing).isEqualTo(CropFraming.Whole)
    }

    @Test
    fun theCropCarriesNoVisibleFramingChrome() {
        cropContent(centredState())

        // The board draws nothing under the crop but its caption, so the
        // non-gesture route lives entirely in the semantics tree.
        compose.onNodeWithTag("crop").assertIsDisplayed()
        compose.onNodeWithTag("crop_left").assertDoesNotExist()
        compose.onNodeWithTag("crop_zoom_in").assertDoesNotExist()
        compose.onNodeWithContentDescription("Nudge left").assertDoesNotExist()
    }

    @Test
    fun theFramingIsReadBackSoTheActionsAreNotFiredBlind() {
        val state = CropState(CropFraming.Whole)
        cropContent(state)

        crop().assert(
            SemanticsMatcher.expectValue(
                SemanticsProperties.StateDescription,
                "Keeping 100% of the picture, centred",
            ),
        )

        fireCropAction("Zoom in")
        compose.waitForIdle()

        // The number moved, which is the whole point: an action fired
        // blind must still be answerable.
        crop().assert(
            SemanticsMatcher.keyIsDefined(SemanticsProperties.StateDescription),
        )
        assertThat(state.framingDescription()).isNotEqualTo(
            "Keeping 100% of the picture, centred",
        )
    }

    @Test
    fun eachPictureCarriesItsOwnFramingAcrossTheFilmstrip() {
        val first = centredState()
        val second = centredState()
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
        assertThat(first.framing.left).isLessThan(0.25f)

        // The filmstrip moves to the next picture: the second state is
        // framable in its own right, and the first one's framing stays
        // where its own picture was left.
        showing = second
        compose.waitForIdle()

        fireCropAction("Nudge right")
        compose.waitForIdle()

        assertThat(second.framing.left).isGreaterThan(0.25f)
        assertThat(first.framing.left).isLessThan(0.25f)
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

    // ---- The crop stage's size, and the framing every later preview
    // draws (jakob 2026-09-01) ------------------------------------------

    @Test
    fun theCropViewportRunsToTheEdgesRatherThanSittingInTheGutter() {
        compose.setContent {
            Cogra2PreviewTheme {
                Column(
                    Modifier
                        .testTag("stage")
                        .padding(horizontal = GUTTER.dp),
                ) {
                    MediaCrop(
                        item = MediaItem(null, 1f),
                        shape = MediaShape.Tall,
                        state = rememberCropState(),
                        testTag = "crop",
                    )
                    Text(
                        "One shape for the whole post.",
                        Modifier.testTag("caption").fillMaxWidth(),
                    )
                }
            }
        }

        // The board runs the picture edge to edge — 390 of a 390 board —
        // while the caption under it stays in the gutter. "the area for
        // cropping was to small" is that gutter, on both sides.
        val stage = compose.onNodeWithTag("stage").getUnclippedBoundsInRoot()
        val viewport = compose.onNodeWithTag("crop").getUnclippedBoundsInRoot()
        val caption = compose.onNodeWithTag("caption").getUnclippedBoundsInRoot()

        assertThat((viewport.left - stage.left).value).isWithin(TOLERANCE).of(0f)
        assertThat((stage.right - viewport.right).value).isWithin(TOLERANCE).of(0f)
        assertThat((caption.left - stage.left).value).isWithin(TOLERANCE).of(GUTTER)
        // The gutter is real width won, not a shifted frame.
        assertThat((viewport.right - viewport.left).value)
            .isWithin(TOLERANCE)
            .of((caption.right - caption.left).value + GUTTER * 2)
    }

    @Test
    fun aFramedPictureIsPreviewedAsTheSectionTheAuthorKept() {
        // Given a crop rect, the thumbnail draws that section: the source
        // rectangle handed to the bitmap is the framing in pixels, so an
        // author who cropped does not meet the uncropped picture again on
        // a later stage and read it as their crop having been thrown away.
        val rect = CropTransformation.sourceRect(
            framing = CropFraming(0.25f, 0f, 0.75f, 0.5f),
            width = 400,
            height = 200,
        )

        assertThat(rect.left).isEqualTo(100)
        assertThat(rect.top).isEqualTo(0)
        assertThat(rect.right).isEqualTo(300)
        assertThat(rect.bottom).isEqualTo(100)
    }

    @Test
    fun anUnframedPictureIsPreviewedWhole() {
        val rect = CropTransformation.sourceRect(CropFraming.Whole, width = 400, height = 200)

        assertThat(rect.left).isEqualTo(0)
        assertThat(rect.top).isEqualTo(0)
        assertThat(rect.right).isEqualTo(400)
        assertThat(rect.bottom).isEqualTo(200)
    }

    @Test
    fun aFramingThatRoundsAwayToNothingStillKeepsAPixel() {
        // `Bitmap.createBitmap` throws on an empty rectangle, and rounding
        // a fraction against a small bitmap is exactly how one is made.
        val rect = CropTransformation.sourceRect(
            framing = CropFraming(0.999f, 0.999f, 1f, 1f),
            width = 10,
            height = 10,
        )

        assertThat(rect.width()).isAtLeast(1)
        assertThat(rect.height()).isAtLeast(1)
        assertThat(rect.right).isAtMost(10)
        assertThat(rect.bottom).isAtMost(10)
    }

    @Test
    fun twoFramingsOfOnePictureAreCachedApart() {
        // The transformed bitmap is what the preview shows; two framings
        // sharing a cache key would show one author's crop for another's.
        val left = CropTransformation(CropFraming(0f, 0f, 0.5f, 1f)).cacheKey
        val right = CropTransformation(CropFraming(0.5f, 0f, 1f, 1f)).cacheKey

        assertThat(left).isNotEqualTo(right)
    }

    private companion object {
        /** `Layout.ScreenGutter`, the padding the crop escapes. */
        const val GUTTER = 24f

        const val TOLERANCE = 0.5f
    }
}
