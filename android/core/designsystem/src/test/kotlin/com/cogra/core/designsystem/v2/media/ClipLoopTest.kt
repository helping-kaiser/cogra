package com.cogra.core.designsystem.v2.media

import android.content.Context
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.test.core.app.ApplicationProvider
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * THE CLIP-LOOP RULING (jakob 2026-09-14, via the design loop).
 *
 * A clip under the real transport — the detail's pinned clip, the fullscreen
 * viewer — STOPS at its end and the transport stands at its Play glyph; a feed
 * or comment clip keeps looping. Reels are the vertical scroller's grammar and
 * videos the player's, and this is the line between them.
 *
 * The repeat mode rides the SURFACE, not the stage: one player carries a
 * clip across both, so the assertion that matters is that moving between
 * surfaces moves the mode with it.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in, so it
// propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class ClipLoopTest {

    @get:Rule
    val compose = createComposeRule()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val clip = "https://media/clip.mp4"

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    @Test
    fun aCardsClipLoops() {
        compose.setContent { Cogra2PreviewTheme { Player(VideoControls.SoundOnly) } }
        compose.waitForIdle()

        assertThat(VideoStage.holding?.player?.repeatMode).isEqualTo(Player.REPEAT_MODE_ONE)
    }

    @Test
    fun aClipUnderTheFullTransportStopsAtItsEnd() {
        compose.setContent { Cogra2PreviewTheme { Player(VideoControls.Full) } }
        compose.waitForIdle()

        assertThat(VideoStage.holding?.player?.repeatMode).isEqualTo(Player.REPEAT_MODE_OFF)
    }

    /**
     * The way back. A reader who opened the detail and returned to the feed is
     * looking at a card again, and a card's clip is a moment — so the loop has
     * to come back with the surface, on the very same player.
     */
    @Test
    fun theLoopReturnsWithTheReadingSurface() {
        VideoStage.claim(context, clip, Any())
        val player = VideoStage.holding?.player
        player?.repeatMode = Player.REPEAT_MODE_OFF

        compose.setContent { Cogra2PreviewTheme { Player(VideoControls.SoundOnly) } }
        compose.waitForIdle()

        assertThat(VideoStage.holding?.player).isSameInstanceAs(player)
        assertThat(player?.repeatMode).isEqualTo(Player.REPEAT_MODE_ONE)
    }

    @androidx.compose.runtime.Composable
    private fun Player(controls: VideoControls) {
        Box(modifier = Modifier.size(PROBE)) {
            VideoPlayer(
                url = clip,
                posterUrl = null,
                autoplay = false,
                controls = controls,
                modifier = Modifier.size(PROBE),
            )
        }
    }

    private companion object {
        val PROBE = 200.dp
    }
}
