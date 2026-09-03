package com.cogra.core.designsystem.v2.media

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * When the poster stands in front of the video surface.
 *
 * This is the decision behind the reported glitch: one player moving
 * between the feed's frame and the detail's lands a frame on a surface
 * that has not yet been told how big the video is, and the poster is
 * what hides that frame.
 */
class VideoPosterCoverTest {

    @Test
    fun aSurfaceWithNoFrameYetShowsThePoster() {
        assertThat(
            posterCovers(coverSurface = true, hasPlayer = true, videoSizeKnown = true),
        ).isTrue()
    }

    @Test
    fun aFrameWhoseClipLeftTheStageShowsThePoster() {
        // Another clip took the stage; there is no player to draw.
        assertThat(
            posterCovers(coverSurface = false, hasPlayer = false, videoSizeKnown = true),
        ).isTrue()
    }

    @Test
    fun aSurfaceThatDoesNotYetKnowTheVideoSizeShowsThePoster() {
        // androidx/media#3238: `videoSizeDp` is filled in from an
        // effect, so the composition right after a player moves to a new
        // surface measures at full parent size. A frame landing then is
        // the wrong-sized first frame — the poster hides it.
        assertThat(
            posterCovers(coverSurface = false, hasPlayer = true, videoSizeKnown = false),
        ).isTrue()
    }

    @Test
    fun aReadySurfaceAtAKnownSizeShowsTheVideo() {
        // The only combination that reveals the surface: something to
        // draw, and the geometry to draw it in.
        assertThat(
            posterCovers(coverSurface = false, hasPlayer = true, videoSizeKnown = true),
        ).isFalse()
    }
}
