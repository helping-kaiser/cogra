package com.cogra.core.designsystem.v2.media

import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The centred play disc (`MediaDisc`), the anatomy Android's `MediaThumb` was
 * missing entirely before this test's own change
 * (`design/components/compose/MediaThumb.jsx:28-32,86,135-153,151`).
 *
 * **The math.** 26% of the tile's short edge, clamped to [20dp, 56dp]
 * (`MediaThumb.jsx:86`) — no floor of its own past that clamp, unlike
 * [DurationBadgeMinTile]. The glyph inside is 57% of the disc
 * (`MediaThumb.jsx:151`).
 *
 * **The gating.** A frame must be playable: `item.isVideo`, a resolved
 * `item.url` (never the sourceless neutral tile, `MediaThumb.jsx:87-90`),
 * not failed, and never mid-upload (never over the ring).
 *
 * `useUnmergedTree = true`: `MediaThumb`'s outer Box merges its descendants
 * into one semantics node, so the disc's own testTag only survives in the
 * unmerged tree — the same reason [MediaThumbCoverMarkTest] needs it.
 *
 * Colour is not pixel-verified here for the same reason
 * [MediaThumbBadgeThemeRoleTest] documents: `captureToImage()` never
 * completes under Robolectric in this repo. A diff review confirms
 * `MediaDisc` reads `inverseSurface`/`inverseOnSurface`.
 */
@RunWith(RobolectricTestRunner::class)
class MediaThumbPlayDiscTest {

    @get:Rule
    val compose = createComposeRule()

    private val playableClip = MediaItem(
        url = "clip-poster.jpg",
        aspectRatio = 1f,
        altText = "A clip",
        videoUrl = "clip.mp4",
    )

    private val neutralClip = MediaItem(
        url = null,
        aspectRatio = 1f,
        altText = "A clip",
        videoUrl = "clip.mp4",
    )

    private val plainPicture = MediaItem(url = "picture.jpg", aspectRatio = 1f, altText = "A picture")

    @Test
    fun theDiscExistsOnAPlayableClip() {
        compose.setContent { Cogra2PreviewTheme { MediaThumb(playableClip, size = 96.dp) } }
        compose.onNodeWithTag("media_thumb_play_disc", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theDiscIsAbsentOnAPlainPictureWithNoVideo() {
        compose.setContent { Cogra2PreviewTheme { MediaThumb(plainPicture, size = 96.dp) } }
        compose.onNodeWithTag("media_thumb_play_disc", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theDiscIsAbsentOnTheSourcelessNeutralTile() {
        // No frame yet — extraction gave nothing (video-cover round,
        // 2026-09-10). A control drawn on nothing reads as chrome
        // (MediaThumb.jsx:87-90); the clip's videoUrl alone is not enough.
        compose.setContent { Cogra2PreviewTheme { MediaThumb(neutralClip, size = 96.dp) } }
        compose.onNodeWithTag("media_thumb_play_disc", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theDiscNeverRidesOverTheUploadRing() {
        compose.setContent {
            Cogra2PreviewTheme { MediaThumb(playableClip, size = 96.dp, uploading = true) }
        }
        compose.onNodeWithTag("media_thumb_play_disc", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theDiscIsAbsentOnceTheUploadHasFailed() {
        compose.setContent {
            Cogra2PreviewTheme { MediaThumb(playableClip, size = 96.dp, badge = ThumbBadge.Failed) }
        }
        compose.onNodeWithTag("media_thumb_play_disc", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theDiscIsOmittedOnTheUnmeasuredFillWidthTile() {
        // `size = null` triggers the fillMaxWidth().aspectRatio(1f) branch,
        // where no edge is known at composition time — the same precedent
        // `MediaThumbCoverMarkTest.theMarkIsOmittedOnTheUnmeasuredFillWidthTile`
        // sets. The pick grid's own candidate tiles (`BodyStep.kt`, size =
        // null) carry the duration pill's own play glyph already, so the
        // centred disc is scoped to the composer's measured single-clip
        // preview.
        compose.setContent { Cogra2PreviewTheme { MediaThumb(playableClip, size = null) } }
        compose.onNodeWithTag("media_thumb_play_disc", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theDiscFloorsAt20dpBelowTheClampsLowEnd() {
        // min(50, 50) * 0.26 = 13dp, under the 20dp floor.
        compose.setContent { Cogra2PreviewTheme { MediaThumb(playableClip, size = 50.dp) } }
        compose.onNodeWithTag("media_thumb_play_disc", useUnmergedTree = true)
            .assertWidthIsEqualTo(20.dp)
            .assertHeightIsEqualTo(20.dp)
        compose.onNodeWithTag("media_thumb_play_glyph", useUnmergedTree = true)
            .assertWidthIsEqualTo(20.dp * 0.57f)
            .assertHeightIsEqualTo(20.dp * 0.57f)
    }

    @Test
    fun theDiscComputesThePlain26PercentMathOnAMidSizeTile() {
        // min(150, 150) * 0.26 = 39dp, inside the clamp.
        compose.setContent { Cogra2PreviewTheme { MediaThumb(playableClip, size = 150.dp) } }
        compose.onNodeWithTag("media_thumb_play_disc", useUnmergedTree = true)
            .assertWidthIsEqualTo(150.dp * 0.26f)
            .assertHeightIsEqualTo(150.dp * 0.26f)
        compose.onNodeWithTag("media_thumb_play_glyph", useUnmergedTree = true)
            .assertWidthIsEqualTo((150.dp * 0.26f) * 0.57f)
            .assertHeightIsEqualTo((150.dp * 0.26f) * 0.57f)
    }

    @Test
    fun theDiscCeilingsAt56dpAboveTheClampsHighEnd() {
        // min(300, 300) * 0.26 = 78dp, over the 56dp ceiling.
        compose.setContent { Cogra2PreviewTheme { MediaThumb(playableClip, size = 300.dp) } }
        compose.onNodeWithTag("media_thumb_play_disc", useUnmergedTree = true)
            .assertWidthIsEqualTo(56.dp)
            .assertHeightIsEqualTo(56.dp)
        compose.onNodeWithTag("media_thumb_play_glyph", useUnmergedTree = true)
            .assertWidthIsEqualTo(56.dp * 0.57f)
            .assertHeightIsEqualTo(56.dp * 0.57f)
    }
}
