package com.cogra.core.designsystem.v2.media

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * When the poster stands in front of the video surface.
 *
 * Two rules, and the transition is where they meet. A cover stands in
 * for a frame that does not exist yet — so a clip that has drawn one
 * never wears its cover again, on any surface. And a surface that lost
 * the ownership token during a navigation has not lost the clip: the
 * arriving surface is drawing it, and a cover there lands on top of a
 * clip in motion.
 */
class VideoPosterCoverTest {

    @Test
    fun aSurfaceWithNoFrameYetShowsThePoster() {
        assertThat(
            posterCovers(alreadyRendered = false, clipOnStage = true),
        ).isTrue()
    }

    @Test
    fun aFrameWhoseClipLeftTheStageShowsThePoster() {
        // Another clip took the stage; there is no frame of this one
        // anywhere to show, so the cover is all there is.
        assertThat(
            posterCovers(alreadyRendered = true, clipOnStage = false),
        ).isTrue()
    }

    @Test
    fun aSurfaceMidHandoverOnTheSameClipShowsNothing() {
        // The reported flash: during the crossfade the arriving surface
        // holds the token and is drawing this very clip, so the leaving
        // one draws nothing and lets it through.
        assertThat(
            posterCovers(alreadyRendered = true, clipOnStage = true),
        ).isFalse()
    }

    @Test
    fun aSurfaceMidHandoverOnAClipThatNeverDrewShowsThePoster() {
        // Same handover, but nothing has rendered yet: there is no frame
        // to let through, so the cover is still the honest stand-in.
        assertThat(
            posterCovers(alreadyRendered = false, clipOnStage = true),
        ).isTrue()
    }

    @Test
    fun aClipThatHasRenderedNeverShowsItsCoverAgain() {
        // The detail's case: a new surface says "no frame yet" about
        // itself, but the clip has a face of its own by now and the
        // cover has no job.
        assertThat(
            posterCovers(alreadyRendered = true, clipOnStage = true),
        ).isFalse()
    }

    @Test
    fun aClipTheStageHasNotDrawnWearsItsCoverWhateverTheSurfaceThinks() {
        // The returning app: the stage released its player and built a
        // new one, so nothing of this clip has been drawn. The surface's
        // own state is remembered across that swap and still reports the
        // released player's frame — which is why it is not asked.
        assertThat(
            posterCovers(alreadyRendered = false, clipOnStage = true),
        ).isTrue()
    }

    @Test
    fun everyPosterCarriesTheReasonItIsThere() {
        // The reason is what the device log prints, and "the cover
        // flashed" has more than one cause.
        assertThat(
            posterReason(alreadyRendered = false, clipOnStage = false),
        ).contains("no clip on stage")
        assertThat(
            posterReason(alreadyRendered = false, clipOnStage = true),
        ).contains("no frame rendered yet")
        assertThat(
            posterReason(alreadyRendered = true, clipOnStage = true),
        ).isNull()
    }
}
