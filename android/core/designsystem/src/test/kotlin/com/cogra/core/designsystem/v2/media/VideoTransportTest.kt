package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
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
    fun theBarIsHeldClearOfTheGestureZone() {
        compose.setContent { Transport() }

        val frame = compose.onNodeWithTag(TRANSPORT_TAG).getUnclippedBoundsInRoot()
        val timeline = compose.onNodeWithTag(TIMELINE_TAG).getUnclippedBoundsInRoot()
        // NOTHING TOUCHES THE BOTTOM EDGE: the system gesture strip lives
        // there, so a control on it is a swipe that closes the app.
        assertThat((frame.bottom - timeline.bottom).value).isAtLeast(GESTURE_ZONE.value)
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
        elapsedMs: Long = 0,
        durationMs: Long = 41_000,
        progress: Float = 0f,
        muted: Boolean = true,
        onTogglePlay: () -> Unit = {},
        onSeek: (Float) -> Unit = {},
        onSkip: (Long) -> Unit = {},
    ) {
        Cogra2PreviewTheme {
            VideoTransport(
                playing = playing,
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
        const val TOLERANCE = 1f
    }
}
