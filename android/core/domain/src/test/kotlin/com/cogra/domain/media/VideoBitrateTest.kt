package com.cogra.domain.media

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The rate a clip is encoded at, pinned as arithmetic.
 *
 * The numbers matter more than usual here: left to the encoder's own
 * default this produced roughly 8.7 Mbps, and a six-minute clip that
 * should have been under a hundred megabytes arrived at four hundred.
 */
class VideoBitrateTest {

    private val postCap = 100L * 1024 * 1024
    private val commentCap = 50L * 1024 * 1024

    @Test
    fun anEverydayClipGetsTheStandardRate() {
        // Thirty seconds has room to spare at either cap, so nothing is
        // given up: this is the rate the services the ruling names use.
        assertThat(VideoBitrate.forClip(30_000, postCap))
            .isEqualTo(VideoBitrate.STANDARD_VIDEO_BPS)
        assertThat(VideoBitrate.forClip(30_000, commentCap))
            .isEqualTo(VideoBitrate.STANDARD_VIDEO_BPS)
    }

    @Test
    fun aLongClipIsScaledDownToFitRatherThanRefused() {
        // The clip from the hand test: 6:28.
        val rate = VideoBitrate.forClip(388_000, postCap)

        assertThat(rate).isLessThan(VideoBitrate.STANDARD_VIDEO_BPS)
        assertThat(rate).isGreaterThan(VideoBitrate.FLOOR_VIDEO_BPS)
        // …and what it plans to produce actually fits, with the
        // container's own overhead still to come out of the headroom.
        val plannedBytes = (rate + VideoBitrate.AUDIO_BPS).toLong() * 388 / 8
        assertThat(plannedBytes).isLessThan(postCap)
    }

    @Test
    fun theRateStopsAtTheFloorAndLetsTheCapRefuse() {
        // The same clip at a comment's cap needs less than the floor, so
        // it holds at the floor: mush is a worse answer than "too long".
        val rate = VideoBitrate.forClip(388_000, commentCap)
        assertThat(rate).isEqualTo(VideoBitrate.FLOOR_VIDEO_BPS)

        // And it is honest about the consequence — this will not fit,
        // which is what the cap check after the transcode then says.
        val plannedBytes = (rate + VideoBitrate.AUDIO_BPS).toLong() * 388 / 8
        assertThat(plannedBytes).isGreaterThan(commentCap)
    }

    @Test
    fun aClipOfUnknownLengthIsNotDegradedOnSuspicion() {
        // Guessing low for something that may be five seconds long would
        // cost quality for nothing; the cap check catches it either way.
        assertThat(VideoBitrate.forClip(0, postCap))
            .isEqualTo(VideoBitrate.STANDARD_VIDEO_BPS)
        assertThat(VideoBitrate.forClip(-1, postCap))
            .isEqualTo(VideoBitrate.STANDARD_VIDEO_BPS)
    }

    @Test
    fun theRateFallsAsTheClipGrows() {
        // Monotonic: a longer clip never gets a more generous rate.
        val rates = listOf(60_000, 120_000, 240_000, 480_000, 960_000)
            .map { VideoBitrate.forClip(it, postCap) }
        assertThat(rates).isInOrder(compareByDescending { it })
    }

    @Test
    fun theHeadroomLeavesRoomForTheContainer() {
        // A clip sized exactly to the cap plans for less than the cap,
        // so muxer overhead and a VBR overshoot have somewhere to go.
        val seconds = 200
        val rate = VideoBitrate.forClip(seconds * 1_000, postCap)
        val plannedBytes = (rate + VideoBitrate.AUDIO_BPS).toLong() * seconds / 8
        assertThat(plannedBytes.toDouble()).isLessThan(postCap * 0.93)
    }
}
