package com.cogra.core.designsystem.v2.media

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * When the poster stands in front of the video surface.
 *
 * This is the rule behind the reported flash: opening a post's detail
 * builds a second surface, whose freshly remembered `PresentationState`
 * starts by saying no frame has been rendered — and the cover came back
 * over a clip that had been playing a moment before.
 *
 * **These pin the rule, not the symptom.** Whether the rule is what
 * jakob is seeing is a question for the device; the trace answers it.
 */
class VideoPosterCoverTest {

    @Test
    fun aSurfaceWithNoFrameYetShowsThePoster() {
        assertThat(
            posterCovers(coverSurface = true, hasPlayer = true, alreadyRendered = false),
        ).isTrue()
    }

    @Test
    fun aFrameWhoseClipLeftTheStageShowsThePoster() {
        // Another clip took the stage; there is no player to draw.
        assertThat(
            posterCovers(coverSurface = false, hasPlayer = false, alreadyRendered = true),
        ).isTrue()
    }

    @Test
    fun aClipThatHasRenderedNeverShowsItsCoverAgain() {
        // The detail's case: a new surface says "no frame yet" about
        // itself, but the clip has a face of its own by now and the
        // cover has no job.
        assertThat(
            posterCovers(coverSurface = true, hasPlayer = true, alreadyRendered = true),
        ).isFalse()
    }

    @Test
    fun aReadySurfaceShowsTheVideo() {
        assertThat(
            posterCovers(coverSurface = false, hasPlayer = true, alreadyRendered = false),
        ).isFalse()
    }

    @Test
    fun everyPosterCarriesTheReasonItIsThere() {
        // The reason is what the device log prints, and "the cover
        // flashed" has more than one cause.
        assertThat(posterReason(coverSurface = false, hasPlayer = false, alreadyRendered = false))
            .contains("another clip holds the stage")
        assertThat(posterReason(coverSurface = true, hasPlayer = true, alreadyRendered = false))
            .contains("no frame rendered yet")
        assertThat(posterReason(coverSurface = false, hasPlayer = true, alreadyRendered = true))
            .isNull()
    }
}
