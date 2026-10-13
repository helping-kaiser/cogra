package com.cogra.core.designsystem.v2.media

import com.cogra.core.designsystem.v2.media.DetailPlayback.Command
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * THE DETAIL CLIP'S STAGE, AS RULES (PostDetailVideo.md:7/9, :39-51; the web's
 * `stage.ts` detail mode and `detail-clip-stage.test.tsx`). One test per
 * behavior line, on [DetailPlayback] alone; [DetailStageTest] runs the same
 * lines through the real [DetailClip] and the one player.
 */
class DetailPlaybackTest {

    private val playing = ClipNow(onStage = true, playing = true, positionMs = AT)
    private val still = ClipNow(onStage = true, playing = false, positionMs = AT)
    private val taken = ClipNow(onStage = false, playing = false, positionMs = null)
    private val swapped = ClipNow(onStage = false, playing = true, positionMs = AT)

    private val allowed = { false }
    private val suppressed = { true }

    /** :7 — the open starts the clip where the device allows autoplay. */
    @Test
    fun theOpenStartsTheClipWhereAutoplayIsAllowed() {
        assertThat(DetailPlayback.open(still, suppressed = false).bindPlays).isTrue()
    }

    /** :9 — under suppressed autoplay the open never starts the clip on its own. */
    @Test
    fun underSuppressionTheOpenStartsNothing() {
        assertThat(DetailPlayback.open(still, suppressed = true).bindPlays).isFalse()
    }

    /** :9 with :53 — a clip carried in from the card already playing is no start: it plays on. */
    @Test
    fun underSuppressionACarriedPlayingClipPlaysOn() {
        assertThat(DetailPlayback.open(playing, suppressed = true).bindPlays).isTrue()
    }

    /** :39/:41 — a sheet or a dialog rising stops the playing clip where it is. */
    @Test
    fun aSheetRisingStopsThePlayingClip() {
        val playback = DetailPlayback.open(still, suppressed = false)

        assertThat(playback.coverChanged(SurfaceCover.Suspended, playing, allowed)).isEqualTo(Command.Pause)
        assertThat(playback.bindPlays).isFalse()
    }

    /** :43 — its dismissal resumes the clip it stopped, where autoplay is allowed. */
    @Test
    fun theDismissalResumesWhatTheSheetStopped() {
        val playback = DetailPlayback.open(still, suppressed = false)
        playback.coverChanged(SurfaceCover.Suspended, playing, allowed)

        assertThat(playback.coverChanged(null, still, allowed)).isEqualTo(Command.Play)
        assertThat(playback.bindPlays).isTrue()
    }

    /** :45 — a clip the reader had paused never resumes on its own. */
    @Test
    fun aClipTheReaderPausedNeverResumesOnDismissal() {
        val playback = DetailPlayback.open(still, suppressed = false)

        assertThat(playback.coverChanged(SurfaceCover.Suspended, still, allowed)).isEqualTo(Command.None)
        assertThat(playback.coverChanged(null, still, allowed)).isEqualTo(Command.None)
    }

    /** :47 — under suppression the dismissal starts nothing, though the cover stopped a playing clip. */
    @Test
    fun underSuppressionTheDismissalStartsNothing() {
        val playback = DetailPlayback.open(still, suppressed = true)
        playback.coverChanged(SurfaceCover.Suspended, playing, suppressed)

        assertThat(playback.coverChanged(null, still, suppressed)).isEqualTo(Command.None)
        assertThat(playback.bindPlays).isFalse()
    }

    /** :47 — the GIVEN reads at dismissal: suppression arriving under the sheet resumes nothing. */
    @Test
    fun suppressionArrivingUnderTheSheetResumesNothing() {
        var nowSuppressed = false
        val playback = DetailPlayback.open(still, suppressed = false)
        playback.coverChanged(SurfaceCover.Suspended, playing) { nowSuppressed }

        nowSuppressed = true

        assertThat(playback.coverChanged(null, still) { nowSuppressed }).isEqualTo(Command.None)
    }

    /** :43 — a dialog over the sheet keeps the clip stopped until the last layer lifts. */
    @Test
    fun aLayerOverTheSheetChangesNothingUntilTheLastLifts() {
        val playback = DetailPlayback.open(still, suppressed = false)
        playback.coverChanged(SurfaceCover.Suspended, playing, allowed)

        // The second layer and its dropping both leave the post covered: the
        // registry's cover stays Suspended, so nothing reaches the rules.
        assertThat(playback.coverChanged(SurfaceCover.Suspended, still, allowed)).isEqualTo(Command.None)
        assertThat(playback.coverChanged(null, still, allowed)).isEqualTo(Command.Play)
    }

    /** :49 — the pad pauses the playing clip where it is. */
    @Test
    fun thePadPausesThePlayingClip() {
        val playback = DetailPlayback.open(still, suppressed = false)

        assertThat(playback.coverChanged(SurfaceCover.Paused, playing, allowed)).isEqualTo(Command.Pause)
    }

    /** :51 — the pad's closing resumes the clip it paused, under suppressed autoplay included. */
    @Test
    fun thePadsClosingResumesUnderSuppressionToo() {
        val playback = DetailPlayback.open(still, suppressed = true)
        playback.coverChanged(SurfaceCover.Paused, playing, suppressed)

        assertThat(playback.coverChanged(null, still, suppressed)).isEqualTo(Command.Play)
    }

    /** :51 'GIVEN it paused the clip' — a pad that paused nothing starts nothing. */
    @Test
    fun aPadThatPausedNothingStartsNothing() {
        val playback = DetailPlayback.open(still, suppressed = false)
        playback.coverChanged(SurfaceCover.Paused, still, allowed)

        assertThat(playback.coverChanged(null, still, allowed)).isEqualTo(Command.None)
    }

    /** :51 over :47 — a dialog raised from the pad (severance) makes the lifting a dialog's. */
    @Test
    fun aDialogOverThePadMakesTheLiftingADialogs() {
        val playback = DetailPlayback.open(still, suppressed = true)
        playback.coverChanged(SurfaceCover.Paused, playing, suppressed)
        playback.coverChanged(SurfaceCover.Suspended, still, suppressed)
        playback.coverChanged(SurfaceCover.Paused, still, suppressed)

        assertThat(playback.coverChanged(null, still, suppressed)).isEqualTo(Command.None)
    }

    /**
     * :43 — the sheet's own clip took the one player: the dismissal claims the
     * detail's clip back where it stopped, and resumes it.
     */
    @Test
    fun aClipTakenUnderTheSheetIsClaimedBackWhereItStoppedAndResumed() {
        val playback = DetailPlayback.open(still, suppressed = false)
        playback.coverChanged(SurfaceCover.Suspended, playing, allowed)

        assertThat(playback.coverChanged(null, taken, allowed)).isEqualTo(Command.Reclaim(atMs = AT, play = true))
        assertThat(playback.consumeOwnClaim()).isTrue()
        assertThat(playback.consumeOwnClaim()).isFalse()
    }

    /**
     * :41/:43, the other order: the sheet's own stage took the player in the
     * frame the sheet rose, before the cover reached the detail. The swap says
     * the clip was playing and where it stood, so it is owed its resume there.
     */
    @Test
    fun aClipTakenBeforeTheCoverReachedItIsStillOwedItsResume() {
        val playback = DetailPlayback.open(still, suppressed = false)
        playback.coverChanged(SurfaceCover.Suspended, swapped, allowed)

        assertThat(playback.coverChanged(null, taken, allowed)).isEqualTo(Command.Reclaim(atMs = AT, play = true))
    }

    /** :45 — taken and not owed a resume, it is still claimed back, standing where it was. */
    @Test
    fun aPausedClipTakenUnderTheSheetIsClaimedBackStill() {
        val playback = DetailPlayback.open(still, suppressed = false)
        playback.coverChanged(SurfaceCover.Suspended, still, allowed)

        assertThat(playback.coverChanged(null, taken, allowed)).isEqualTo(Command.Reclaim(atMs = AT, play = false))
    }

    /**
     * Under a cover a re-binding surface asserts "still" — the app's return or
     * the composer's, with the sheet still standing — and the open's own answer
     * again once the last layer lifted, so nothing else a bind asserts moves.
     */
    @Test
    fun aBindUnderACoverAssertsStillAndTheOpensAnswerAfterIt() {
        val playback = DetailPlayback.open(still, suppressed = false)
        playback.coverChanged(SurfaceCover.Suspended, still, allowed)
        assertThat(playback.bindPlays).isFalse()

        playback.coverChanged(null, still, allowed)

        assertThat(playback.bindPlays).isTrue()
    }

    private companion object {
        const val AT = 6_000L
    }
}
