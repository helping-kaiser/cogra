package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.media3.common.util.UnstableApi
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * NO READING SURFACE DRAWS THE DURATION PILL (jakob's ruling, 2026-09-22:
 * design/readme.md §13, "the composer's, and the detail has one reading" —
 * "a reading surface draws no pill at either scale... the one place a
 * reader meets a clip's length is the detail's transport").
 *
 * `VideoPlayer` is the one composable every reading surface's clip goes
 * through — `PinnedClip` and `MediaViewer` hand it `VideoControls.Full`,
 * `MediaGallery`'s card and comment tiles hand it `VideoControls.SoundOnly`
 * — so pinning both arms here covers the detail, the fullscreen viewer, the
 * feed card and a comment's clip at once, without reproducing each
 * caller's own layout.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in, so it
// propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class VideoPlayerDurationBadgeAbsenceTest {

    @get:Rule
    val compose = createComposeRule()

    private val clip = "https://media/clip.mp4"

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    @Test
    fun theFullTransportSurfaceDrawsNoDurationBadge() {
        compose.setContent { Cogra2PreviewTheme { Player(VideoControls.Full) } }
        compose.waitForIdle()

        compose.onNodeWithTag("media_thumb_duration_badge", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theSoundOnlyCardSurfaceDrawsNoDurationBadge() {
        compose.setContent { Cogra2PreviewTheme { Player(VideoControls.SoundOnly) } }
        compose.waitForIdle()

        compose.onNodeWithTag("media_thumb_duration_badge", useUnmergedTree = true).assertDoesNotExist()
    }

    /**
     * The transport's OWN readout is the one place a reader meets the
     * length — pinned here so a future refactor can't drop it while
     * passing the badge-absence checks above.
     */
    @Test
    fun theFullTransportSurfaceStillDrawsTheRealReadout() {
        compose.setContent { Cogra2PreviewTheme { Player(VideoControls.Full) } }
        compose.waitForIdle()

        compose.onNodeWithTag("video_elapsed", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("video_duration", useUnmergedTree = true).assertExists()
    }

    @Composable
    private fun Player(controls: VideoControls) {
        Box(modifier = Modifier.size(PROBE)) {
            VideoPlayer(
                url = clip,
                posterUrl = null,
                autoplay = false,
                durationMs = 42_000,
                controls = controls,
                modifier = Modifier.size(PROBE),
            )
        }
    }

    private companion object {
        val PROBE = 200.dp
    }
}
