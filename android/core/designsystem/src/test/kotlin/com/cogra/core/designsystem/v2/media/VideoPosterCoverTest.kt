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
            posterCovers(
                coverSurface = true,
                hasPlayer = true,
                alreadyRendered = false,
                clipOnStage = true,
            ),
        ).isTrue()
    }

    @Test
    fun aFrameWhoseClipLeftTheStageShowsThePoster() {
        // Another clip took the stage; there is no frame of this one
        // anywhere to show, so the cover is all there is.
        assertThat(
            posterCovers(
                coverSurface = false,
                hasPlayer = false,
                alreadyRendered = true,
                clipOnStage = false,
            ),
        ).isTrue()
    }

    @Test
    fun aSurfaceMidHandoverOnTheSameClipShowsNothing() {
        // The reported flash: during the crossfade the arriving surface
        // holds the token and is drawing this very clip, so the leaving
        // one draws nothing and lets it through. Its own
        // `PresentationState` says "no frame" about itself either way,
        // which must not bring the cover back.
        for (coverSurface in listOf(false, true)) {
            assertThat(
                posterCovers(
                    coverSurface = coverSurface,
                    hasPlayer = false,
                    alreadyRendered = true,
                    clipOnStage = true,
                ),
            ).isFalse()
        }
    }

    @Test
    fun aSurfaceMidHandoverOnAClipThatNeverDrewShowsThePoster() {
        // Same handover, but nothing has rendered yet: there is no frame
        // to let through, so the cover is still the honest stand-in.
        assertThat(
            posterCovers(
                coverSurface = true,
                hasPlayer = false,
                alreadyRendered = false,
                clipOnStage = true,
            ),
        ).isTrue()
    }

    @Test
    fun aClipThatHasRenderedNeverShowsItsCoverAgain() {
        // The detail's case: a new surface says "no frame yet" about
        // itself, but the clip has a face of its own by now and the
        // cover has no job.
        assertThat(
            posterCovers(
                coverSurface = true,
                hasPlayer = true,
                alreadyRendered = true,
                clipOnStage = true,
            ),
        ).isFalse()
    }

    @Test
    fun aReadySurfaceShowsTheVideo() {
        assertThat(
            posterCovers(
                coverSurface = false,
                hasPlayer = true,
                alreadyRendered = false,
                clipOnStage = true,
            ),
        ).isFalse()
    }

    @Test
    fun everyPosterCarriesTheReasonItIsThere() {
        // The reason is what the device log prints, and "the cover
        // flashed" has more than one cause.
        assertThat(
            posterReason(
                coverSurface = false,
                hasPlayer = false,
                alreadyRendered = false,
                clipOnStage = false,
            ),
        ).contains("no clip on stage")
        assertThat(
            posterReason(
                coverSurface = true,
                hasPlayer = true,
                alreadyRendered = false,
                clipOnStage = true,
            ),
        ).contains("no frame rendered yet")
        assertThat(
            posterReason(
                coverSurface = false,
                hasPlayer = true,
                alreadyRendered = true,
                clipOnStage = true,
            ),
        ).isNull()
        assertThat(
            posterReason(
                coverSurface = true,
                hasPlayer = false,
                alreadyRendered = true,
                clipOnStage = true,
            ),
        ).isNull()
    }
}
