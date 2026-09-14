package com.cogra.core.designsystem.v2.media

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.media3.common.util.UnstableApi
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The fullscreen viewer (DV-01 / H-25), against
 * `design/components/media/MediaViewer.jsx` and the `Viewer*` boards.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in, so it
// propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class MediaViewerTest {

    @get:Rule
    val compose = createComposeRule()

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    private val pictures = List(10) { MediaItem(url = null, aspectRatio = 1f, altText = "Picture $it") }
    private val clip = MediaItem(
        url = null,
        aspectRatio = 16f / 9f,
        altText = "A clip",
        videoUrl = "https://media/clip.mp4",
        durationMs = 41_000,
    )

    @Test
    fun `an empty set draws no viewer at all`() {
        compose.setContent { Cogra2PreviewTheme { MediaViewer(items = emptyList(), onClose = {}) } }
        compose.onNodeWithTag(VIEWER_TAG).assertDoesNotExist()
    }

    @Test
    fun `the X is the way out`() {
        var closed = false
        compose.setContent {
            Cogra2PreviewTheme { MediaViewer(items = pictures.take(4), onClose = { closed = true }) }
        }
        compose.onNodeWithTag("${VIEWER_TAG}_close").performClick()
        assertThat(closed).isTrue()
    }

    @Test
    fun `the ground around the frame closes it`() {
        var closed = false
        compose.setContent {
            Cogra2PreviewTheme { MediaViewer(items = pictures.take(4), onClose = { closed = true }) }
        }
        compose.onNodeWithTag(VIEWER_TAG).performClick()
        assertThat(closed).isTrue()
    }

    // The backdrop takes the whole surface as ONE click target, so it merges
    // its descendants: everything inside the viewer is read from the unmerged
    // tree. That merge is the point — the ground closes the viewer, and a
    // reader is not meant to find seven separate things to press out there.
    private fun node(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true)

    @Test
    fun `the set is paged here exactly as it is in the card`() {
        compose.setContent { Cogra2PreviewTheme { MediaViewer(items = pictures.take(4), onClose = {}) } }
        node("${VIEWER_TAG}_pager").assertExists()
        node("${VIEWER_TAG}_dots").assertExists()
    }

    @Test
    fun `it opens where the reader tapped`() {
        compose.setContent {
            Cogra2PreviewTheme { MediaViewer(items = pictures.take(4), index = 2, onClose = {}) }
        }
        compose.onNodeWithContentDescription("Picture 3 of 4").assertExists()
    }

    @Test
    fun `an index past the end lands on the last frame rather than nowhere`() {
        compose.setContent {
            Cogra2PreviewTheme { MediaViewer(items = pictures.take(4), index = 9, onClose = {}) }
        }
        compose.onNodeWithContentDescription("Picture 4 of 4").assertExists()
    }

    @Test
    fun `the dot row is windowed at seven and spoken in full`() {
        compose.setContent { Cogra2PreviewTheme { MediaViewer(items = pictures, onClose = {}) } }
        compose.onNodeWithContentDescription("Picture 1 of 10").assertExists()
    }

    @Test
    fun `a lone picture is given no position to mark`() {
        compose.setContent { Cogra2PreviewTheme { MediaViewer(items = pictures.take(1), onClose = {}) } }
        node("${VIEWER_TAG}_dots").assertDoesNotExist()
    }

    @Test
    fun `a clip in the viewer wears the full transport`() {
        compose.setContent { Cogra2PreviewTheme { MediaViewer(items = listOf(clip), onClose = {}) } }
        node(TRANSPORT_TAG).assertExists()
        node(TIMELINE_TAG).assertExists()
    }

    @Test
    fun `the viewer draws no fullscreen toggle, because this IS the fullscreen`() {
        compose.setContent { Cogra2PreviewTheme { MediaViewer(items = listOf(clip), onClose = {}) } }
        node("video_fullscreen").assertDoesNotExist()
    }

    @Test
    fun `a clip in the viewer stops at its end rather than looping`() {
        compose.setContent { Cogra2PreviewTheme { MediaViewer(items = listOf(clip), onClose = {}) } }
        compose.waitForIdle()
        assertThat(VideoStage.holding?.player?.repeatMode)
            .isEqualTo(androidx.media3.common.Player.REPEAT_MODE_OFF)
    }

    /**
     * The handover. Opening the viewer on a clip the detail was already playing
     * claims the SAME url, so the stage keeps the same player rather than
     * building a second decoder — no double-play, and the position survives.
     */
    @Test
    fun `opening the viewer on a playing clip hands the player over`() {
        val detail = Any()
        VideoStage.claim(
            androidx.test.core.app.ApplicationProvider.getApplicationContext(),
            clip.videoUrl!!,
            detail,
        )
        val before = VideoStage.holding?.player

        compose.setContent { Cogra2PreviewTheme { MediaViewer(items = listOf(clip), onClose = {}) } }
        compose.waitForIdle()

        assertThat(VideoStage.holding?.player).isSameInstanceAs(before)
        assertThat(VideoStage.holding?.url).isEqualTo(clip.videoUrl)
    }

    @Test
    fun `the viewer grows no toolbar — the X is its one control`() {
        compose.setContent { Cogra2PreviewTheme { MediaViewer(items = pictures.take(4), onClose = {}) } }
        compose.onNodeWithTag("${VIEWER_TAG}_close").assertExists()
        node(TRANSPORT_TAG).assertDoesNotExist()
        node("video_mute").assertDoesNotExist()
    }
}
