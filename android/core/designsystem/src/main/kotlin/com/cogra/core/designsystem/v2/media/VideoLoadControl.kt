package com.cogra.core.designsystem.v2.media

import androidx.media3.common.Timeline
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.LoadControl
import androidx.media3.exoplayer.analytics.PlayerId
import androidx.media3.exoplayer.source.MediaSource.MediaPeriodId
import androidx.media3.exoplayer.source.TrackGroupArray
import androidx.media3.exoplayer.trackselection.ExoTrackSelection
import androidx.media3.exoplayer.upstream.Allocator

/**
 * How far ahead the stage's player reads, and when it stops reading.
 *
 * **Seconds, not most of a minute.** `DefaultLoadControl` buffers 50 s
 * ahead for a stream — sized for a programme, and for a card clip that
 * loops it is the whole file fetched again for every loop the buffer
 * reaches. The sizes here are the ones Media3's own short-form demo
 * gives its feed player (`ViewPagerMediaAdapter`: 5 s min, 20 s max,
 * 500 ms to start, the default 2 s after a rebuffer). At the feed's
 * highest measured bitrate, 9.7 Mbps, 20 s ahead is about 24 MB in
 * memory; at the median 2.8 Mbps, about 7 MB. The size threshold stays
 * the default: at these durations it never binds first.
 *
 * **A paused player stops reading** ([PausedStopsLoading]).
 */
@UnstableApi
internal object VideoLoadControl {

    const val MIN_BUFFER_MS = 5_000
    const val MAX_BUFFER_MS = 20_000
    const val BUFFER_FOR_PLAYBACK_MS = 500
    const val BUFFER_FOR_PLAYBACK_AFTER_REBUFFER_MS =
        DefaultLoadControl.DEFAULT_BUFFER_FOR_PLAYBACK_AFTER_REBUFFER_MS

    /** A fresh load control for one player — Media3 builds one per player too. */
    fun create(): LoadControl = PausedStopsLoading(
        delegate = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                MIN_BUFFER_MS,
                MAX_BUFFER_MS,
                BUFFER_FOR_PLAYBACK_MS,
                BUFFER_FOR_PLAYBACK_AFTER_REBUFFER_MS,
            )
            .build(),
        pausedBufferUs = BUFFER_FOR_PLAYBACK_MS * 1_000L,
    )
}

/**
 * A player that is not playing keeps what it needs to start, and no more.
 *
 * ExoPlayer goes on loading while paused — nothing in `DefaultLoadControl`
 * asks whether playback wants to proceed — so a clip that was paused, or
 * parked by a surface that scrolled away (`VideoStage.surrender` pauses
 * it), filled its whole buffer anyway. Media3 hands every load decision
 * the player's `playWhenReady` in `LoadControl.Parameters` for exactly
 * this kind of rule, and the player asks again on every work cycle, so
 * the moment the clip resumes, loading resumes with it.
 *
 * The floor is the start threshold rather than zero: a clip resumed from
 * a pause starts from what it holds, instead of waiting on the network.
 *
 * Everything else is [delegate]'s. It is asked first on every call, so
 * its own start-and-stop bookkeeping stays exactly what it would have
 * been; this only ever turns a "continue" into a "stop".
 */
@UnstableApi
internal class PausedStopsLoading(
    private val delegate: LoadControl,
    private val pausedBufferUs: Long,
) : LoadControl {

    override fun shouldContinueLoading(parameters: LoadControl.Parameters): Boolean {
        val delegateWants = delegate.shouldContinueLoading(parameters)
        return delegateWants && (parameters.playWhenReady || parameters.bufferedDurationUs < pausedBufferUs)
    }

    override fun onPrepared(playerId: PlayerId) = delegate.onPrepared(playerId)

    override fun onTracksSelected(
        parameters: LoadControl.Parameters,
        trackGroups: TrackGroupArray,
        trackSelections: Array<out ExoTrackSelection?>,
    ) = delegate.onTracksSelected(parameters, trackGroups, trackSelections)

    override fun onStopped(playerId: PlayerId) = delegate.onStopped(playerId)

    override fun onReleased(playerId: PlayerId) = delegate.onReleased(playerId)

    override fun getAllocator(playerId: PlayerId): Allocator = delegate.getAllocator(playerId)

    override fun getBackBufferDurationUs(playerId: PlayerId): Long = delegate.getBackBufferDurationUs(playerId)

    override fun retainBackBufferFromKeyframe(playerId: PlayerId): Boolean =
        delegate.retainBackBufferFromKeyframe(playerId)

    override fun shouldStartPlayback(parameters: LoadControl.Parameters): Boolean =
        delegate.shouldStartPlayback(parameters)

    override fun shouldContinuePreloading(
        playerId: PlayerId,
        timeline: Timeline,
        mediaPeriodId: MediaPeriodId,
        bufferedDurationUs: Long,
    ): Boolean = delegate.shouldContinuePreloading(playerId, timeline, mediaPeriodId, bufferedDurationUs)
}
