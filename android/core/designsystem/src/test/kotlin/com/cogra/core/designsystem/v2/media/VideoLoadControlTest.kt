package com.cogra.core.designsystem.v2.media

import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.LoadControl
import androidx.media3.exoplayer.analytics.PlayerId
import androidx.media3.exoplayer.source.MediaSource.MediaPeriodId
import androidx.media3.exoplayer.source.SinglePeriodTimeline
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * How far the stage's player reads ahead, and that a paused one stops.
 *
 * The measured fault: the 50 s default buffered a looping card clip
 * several loops ahead, and a parked (paused) player went on doing it.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class VideoLoadControlTest {

    private val player = PlayerId("stage")
    private val timeline = SinglePeriodTimeline(
        60_000_000L,
        true,
        false,
        false,
        null,
        MediaItem.fromUri("https://media/clip.mp4"),
    )
    private val period = MediaPeriodId(timeline.getUidOfPeriod(0))

    private val control = VideoLoadControl.create()

    @Before
    fun prepare() = control.onPrepared(player)

    @After
    fun release() = control.onReleased(player)

    @Test
    fun aPlayingClipReadsAheadToTwentySecondsAndNoFurther() {
        assertThat(control.shouldContinueLoading(at(bufferedMs = 1_000, playing = true))).isTrue()
        assertThat(control.shouldContinueLoading(at(bufferedMs = 19_000, playing = true))).isTrue()
        assertThat(control.shouldContinueLoading(at(bufferedMs = 20_000, playing = true))).isFalse()
    }

    @Test
    fun aFullBufferWaitsUntilItDrainsBelowFiveSeconds() {
        // The gap between the two is what keeps the loader from waking
        // for every frame played.
        assertThat(control.shouldContinueLoading(at(bufferedMs = 20_000, playing = true))).isFalse()
        assertThat(control.shouldContinueLoading(at(bufferedMs = 10_000, playing = true))).isFalse()
        assertThat(control.shouldContinueLoading(at(bufferedMs = 4_000, playing = true))).isTrue()
    }

    @Test
    fun aPausedClipStopsReadingOnceItCanStart() {
        assertThat(control.shouldContinueLoading(at(bufferedMs = 1_000, playing = false))).isFalse()
    }

    @Test
    fun aPausedClipStillReadsWhatItNeedsToStart() {
        assertThat(control.shouldContinueLoading(at(bufferedMs = 200, playing = false))).isTrue()
    }

    @Test
    fun resumingResumesReading() {
        assertThat(control.shouldContinueLoading(at(bufferedMs = 1_000, playing = false))).isFalse()
        assertThat(control.shouldContinueLoading(at(bufferedMs = 1_000, playing = true))).isTrue()
    }

    @Test
    fun aClipStartsOnHalfASecond() {
        assertThat(control.shouldStartPlayback(at(bufferedMs = 500, playing = true))).isTrue()
        assertThat(control.shouldStartPlayback(at(bufferedMs = 400, playing = true))).isFalse()
    }

    @Test
    fun aPreloadReadsPastTheHalfSecondFloor() {
        // Media3 asks about every preload with `playWhenReady = false`. Read
        // as a pause, the preload manager's three seconds would stop at half
        // of one.
        control.onPrepared(PlayerId.PRELOAD)

        assertThat(control.shouldContinueLoading(at(bufferedMs = 2_000, playing = false, id = PlayerId.PRELOAD)))
            .isTrue()
    }

    @Test
    fun aParkedClipDoesNotHoldThePreloadsBack() {
        // The parked player is stopped here while the delegate still counts
        // it as loading; a preload is answered by its bytes, not by that.
        control.onPrepared(PlayerId.PRELOAD)
        assertThat(control.shouldContinueLoading(at(bufferedMs = 3_000, playing = false))).isFalse()

        assertThat(control.shouldContinueLoading(at(bufferedMs = 1_000, playing = false, id = PlayerId.PRELOAD)))
            .isTrue()
    }

    @Test
    fun thePreloadsStopAtTheirOwnShareOfMemory() {
        control.onPrepared(PlayerId.PRELOAD)
        val allocator = control.getAllocator(PlayerId.PRELOAD)
        val segments = VideoLoadControl.PRELOAD_BUFFER_BYTES / allocator.individualAllocationLength

        repeat(segments - 1) { allocator.allocate() }
        assertThat(control.shouldContinueLoading(at(bufferedMs = 1_000, playing = false, id = PlayerId.PRELOAD)))
            .isTrue()

        allocator.allocate()
        assertThat(control.shouldContinueLoading(at(bufferedMs = 1_000, playing = false, id = PlayerId.PRELOAD)))
            .isFalse()
    }

    private fun at(bufferedMs: Long, playing: Boolean, id: PlayerId = player) = LoadControl.Parameters(
        id,
        timeline,
        period,
        0L,
        bufferedMs * 1_000L,
        1f,
        playing,
        false,
        C.TIME_UNSET,
        C.TIME_UNSET,
    )
}
