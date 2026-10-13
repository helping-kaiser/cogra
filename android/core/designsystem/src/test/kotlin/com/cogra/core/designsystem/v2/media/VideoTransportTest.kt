package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.click
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The control ladder's second rung (DV-03).
 *
 * The Full arm used to be a play/pause and a duration badge with no way to
 * move the clip at all; what a detail surface owes the reader is the drawn
 * transport — the skips, the timeline as a real slider, elapsed and total, and
 * the sound moved into the bar.
 */
@RunWith(RobolectricTestRunner::class)
class VideoTransportTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun theTimelineIsASliderAndReportsWhereTheClipIs() {
        compose.setContent { Transport(progress = 0.34f) }

        val timeline = compose.onNodeWithTag(TIMELINE_TAG)
        timeline.assertContentDescriptionEquals("Seek")
        // A SLIDER, NOT A PROGRESS BAR: it reports where the clip is AND it is
        // how the reader moves it, so it carries the range info and the seek
        // action rather than a filled track.
        timeline.assert(
            SemanticsMatcher.expectValue(
                SemanticsProperties.ProgressBarRangeInfo,
                ProgressBarRangeInfo(0.34f, 0f..1f, 0),
            ),
        )
        timeline.assert(SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress))
    }

    @Test
    fun theTimelineSeeks() {
        var seeked: Float? = null
        compose.setContent { Transport(onSeek = { seeked = it }) }

        compose.onNodeWithTag(TIMELINE_TAG)
            .performSemanticsAction(SemanticsActions.SetProgress) { set -> set(0.5f) }

        assertThat(seeked).isNotNull()
        assertThat(seeked!!).isWithin(0.001f).of(0.5f)
    }

    @Test
    fun theSkipsStepTenSecondsEachWay() {
        val steps = mutableListOf<Long>()
        compose.setContent { Transport(onSkip = { steps += it }) }

        compose.onNodeWithTag("video_rewind").performClick()
        compose.onNodeWithTag("video_forward").performClick()

        assertThat(steps).containsExactly(-VideoStage.SKIP_MS, VideoStage.SKIP_MS).inOrder()
    }

    @Test
    fun theSkipsSayWhatTheyDo() {
        compose.setContent { Transport() }

        compose.onNodeWithTag("video_rewind").assertContentDescriptionEquals("Back ten seconds")
        compose.onNodeWithTag("video_forward").assertContentDescriptionEquals("Forward ten seconds")
    }

    @Test
    fun thePlayPauseSaysWhatThePressWillDo() {
        var playing by mutableStateOf(false)
        compose.setContent { Transport(playing = playing, onTogglePlay = { playing = !playing }) }

        compose.onNodeWithTag("video_play_pause").assertContentDescriptionEquals("Play")
        compose.onNodeWithTag("video_play_pause").performClick()
        compose.onNodeWithTag("video_play_pause").assertContentDescriptionEquals("Pause")
    }

    /**
     * AND AT THE END IT IS A REPLAY (jakob 2026-09-15, hand test).
     *
     * A clip under this transport stops rather than looping, so the stopped
     * state is two different offers wearing one glyph: "resume where you
     * paused" and "start this again from nothing". The end gets its own.
     */
    @Test
    fun theEndedClipOffersToPlayItAgain() {
        compose.setContent { Transport(playing = false, ended = true) }

        compose.onNodeWithTag("video_play_pause").assertContentDescriptionEquals("Replay")
    }

    /**
     * AND IT IS DRAWN AS ITS OWN GLYPH, not the Play arrow wearing a
     * different name — `centreGlyph()` is what `CentreCluster` hands the
     * button, pulled out so the selection is checkable without a compose
     * tree at the drawn size (`design/components/media/VideoControls.jsx:210-211`
     * — 34dp glyph in a 64dp box, same as play/pause; `PLAY_GLYPH`/
     * `PLAY_DIAMETER` in this file).
     */
    @Test
    fun theCentreGlyphIsReplayOnceTheClipHasEnded() {
        assertThat(centreGlyph(playing = false, ended = true)).isEqualTo(Icons.Filled.Replay)
    }

    @Test
    fun theCentreGlyphIsPauseWhilePlayingEvenPastTheEnd() {
        // Playing and ended cannot both be true from a real player, but the
        // selection still has to resolve one way — pause wins, since a clip
        // that is audibly running is not a clip at rest.
        assertThat(centreGlyph(playing = true, ended = true)).isEqualTo(Icons.Filled.Pause)
    }

    @Test
    fun theCentreGlyphIsPlayAtRestBeforeTheFirstPress() {
        assertThat(centreGlyph(playing = false, ended = false)).isEqualTo(Icons.Filled.PlayArrow)
    }

    @Test
    fun theSoundRidesTheBarRatherThanKeepingItsDisc() {
        compose.setContent { Transport() }

        val bar = compose.onNodeWithTag("video_duration").getUnclippedBoundsInRoot()
        val mute = compose.onNodeWithTag("video_mute").getUnclippedBoundsInRoot()
        // Beside the total, at the bar's own height — not a disc standing in
        // the frame's corner on its own.
        assertThat(mute.left.value).isGreaterThan(bar.left.value)
        val muteMiddle = (mute.top.value + mute.bottom.value) / 2
        val barMiddle = (bar.top.value + bar.bottom.value) / 2
        assertThat(kotlin.math.abs(muteMiddle - barMiddle)).isLessThan(TOLERANCE)
    }

    @Test
    fun theBarsInkIsHeldClearOfTheGestureZone() {
        compose.setContent { Transport() }

        val frame = compose.onNodeWithTag(TRANSPORT_TAG).getUnclippedBoundsInRoot()
        val ink = compose.onNodeWithTag(TIMELINE_INK_TAG, useUnmergedTree = true).getUnclippedBoundsInRoot()
        // NOTHING DRAWN TOUCHES THE BOTTOM EDGE: the system gesture strip
        // lives there, so a control drawn on it reads as a swipe that closes
        // the app. The timeline's TARGET reaches into the strip (ruling 101,
        // below); its ink never does.
        assertThat((frame.bottom - ink.bottom).value).isAtLeast(GESTURE_ZONE.value)
    }

    /**
     * NO TARGET ON THE BAR FALLS BELOW 48dp (jakob's ruling 101 —
     * design/readme.md §13, "The clip detail rulings"): sound and fullscreen
     * stand 20dp apart, their 28dp discs' centres 48dp apart, so their 48dp
     * targets meet and never overlap. The transport is SHARED, so the viewer
     * carries it too (see `MediaViewerTest`).
     */
    @Test
    fun soundAndFullscreenTargetsMeetWithoutOverlap() {
        compose.setContent { Transport(onFullscreen = {}) }

        val sound = compose.onNodeWithTag("video_mute").getUnclippedBoundsInRoot()
        val fullscreen = compose.onNodeWithTag("video_fullscreen").getUnclippedBoundsInRoot()
        val soundCentre = (sound.left + sound.right).value / 2
        val fullscreenCentre = (fullscreen.left + fullscreen.right).value / 2
        // Centres 48 apart: 28dp discs 20dp apart.
        assertThat(fullscreenCentre - soundCentre).isWithin(TOLERANCE).of(BAR_TARGET.value)
        // The drawn discs stay 28 and stand the board's 20 apart; each wears
        // a 48 target centred on it, so the two targets meet edge on edge.
        assertThat((sound.right - sound.left).value).isWithin(TOLERANCE).of(28f)
        assertThat((fullscreen.left - sound.right).value).isWithin(TOLERANCE).of(PAIR_GAP.value)
        assertThat(PAIR_GAP.value).isEqualTo(20f)
    }

    /**
     * The timeline's 48dp target hangs DOWN from its top through the bar's
     * lower half and the gesture-zone inset to the frame's bottom edge, so the
     * clip's own tap above it stays whole; the ink does not move (ruling 101,
     * `VideoControls.jsx:109-113`).
     */
    @Test
    fun theTimelineTargetGrowsDownAndTheClipTapStaysWhole() {
        compose.setContent { Transport() }

        val frame = compose.onNodeWithTag(TRANSPORT_TAG).getUnclippedBoundsInRoot()
        val bar = compose.onNodeWithTag(BAR_TAG).getUnclippedBoundsInRoot()
        val target = compose.onNodeWithTag(TIMELINE_TARGET_TAG).getUnclippedBoundsInRoot()
        val ink = compose.onNodeWithTag(TIMELINE_INK_TAG, useUnmergedTree = true).getUnclippedBoundsInRoot()
        // 48 tall, reaching the frame's bottom edge.
        assertThat((target.bottom - target.top).value).isWithin(TOLERANCE).of(BAR_TARGET.value)
        assertThat(target.bottom.value).isWithin(TOLERANCE).of(frame.bottom.value)
        // Nothing of it above the bar's row: from the 16dp timeline's top
        // down, so the clip's tap above the bar stays the clip's.
        assertThat(target.top.value).isAtLeast(bar.top.value)
        // The ink stands in the middle of the 48dp row, where it was drawn.
        val rowMiddle = bar.top.value + BAR_TARGET.value / 2
        assertThat((ink.top + ink.bottom).value / 2).isWithin(TOLERANCE).of(rowMiddle)
    }

    /** A press on the grown target, below the ink, is a press on the slider. */
    @Test
    fun aPressBelowTheTimelinesInkSeeks() {
        var seeked: Float? = null
        compose.setContent { Transport(onSeek = { seeked = it }) }

        compose.onNodeWithTag(TIMELINE_TARGET_TAG).performTouchInput {
            click(Offset(width / 2f, height - 2f))
        }

        assertThat(seeked).isNotNull()
        assertThat(seeked!!).isWithin(SEEK_TOLERANCE).of(0.5f)
    }

    /**
     * AND OF THE DEVICE'S OWN BARS, where the transport reaches the screen's
     * edges (jakob 2026-09-15, hand test: the timeline sat in the strip the
     * app-switcher swipe owns).
     *
     * The board's [GESTURE_ZONE] is an allowance for the gesture strip and
     * knows nothing about a navigation bar; the device's inset knows nothing
     * about the board. The bar clears both.
     */
    @Test
    fun theBarAlsoClearsWhateverTheDeviceSaysItsBarsTake() {
        compose.setContent { Transport(chromeInsets = PaddingValues(bottom = NAV_BAR)) }

        val frame = compose.onNodeWithTag(TRANSPORT_TAG).getUnclippedBoundsInRoot()
        val ink = compose.onNodeWithTag(TIMELINE_INK_TAG, useUnmergedTree = true).getUnclippedBoundsInRoot()
        assertThat((frame.bottom - ink.bottom).value)
            .isAtLeast(GESTURE_ZONE.value + NAV_BAR.value)
        // The timeline's grown target reaches the board's strip (ruling 101)
        // and stops at the device's bar: the device's strip is never a target.
        val target = compose.onNodeWithTag(TIMELINE_TARGET_TAG).getUnclippedBoundsInRoot()
        assertThat((frame.bottom - target.bottom).value).isAtLeast(NAV_BAR.value - TOLERANCE)
    }

    @Test
    fun theClockReadsTheBoardsOwnTimes() {
        compose.setContent { Transport(elapsedMs = 14_000, durationMs = 41_000) }

        compose.onNodeWithTag("video_elapsed").assertTextEquals("0:14")
        compose.onNodeWithTag("video_duration").assertTextEquals("0:41")
    }

    @Composable
    private fun Transport(
        playing: Boolean = false,
        ended: Boolean = false,
        elapsedMs: Long = 0,
        durationMs: Long = 41_000,
        progress: Float = 0f,
        muted: Boolean = true,
        onTogglePlay: () -> Unit = {},
        onSeek: (Float) -> Unit = {},
        onSkip: (Long) -> Unit = {},
        chromeInsets: PaddingValues = PaddingValues(0.dp),
        onFullscreen: (() -> Unit)? = null,
    ) {
        Cogra2PreviewTheme {
            VideoTransport(
                playing = playing,
                onFullscreen = onFullscreen,
                ended = ended,
                chromeInsets = chromeInsets,
                elapsedMs = elapsedMs,
                durationMs = durationMs,
                progress = progress,
                muted = muted,
                onTogglePlay = onTogglePlay,
                onSeek = onSeek,
                onSkip = onSkip,
                onToggleMute = {},
                modifier = Modifier.size(FRAME),
            )
        }
    }

    private companion object {
        val FRAME = 320.dp

        /** A phone's navigation bar, as a test can state it. */
        val NAV_BAR = 48.dp
        const val TOLERANCE = 1f

        /** A tap's landing on a slider is a pixel or two off the arithmetic centre. */
        const val SEEK_TOLERANCE = 0.05f
    }
}
