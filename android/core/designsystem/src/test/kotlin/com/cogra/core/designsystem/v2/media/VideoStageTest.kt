package com.cogra.core.designsystem.v2.media

import android.content.Context
import android.net.Uri
import android.os.Looper
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.BaseDataSource
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * The stage that carries one clip between two screens.
 *
 * These are the mechanics behind the hand-test fault: opening a post's
 * detail used to build a second player at position zero, so the cover
 * flashed and playback restarted.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class VideoStageTest {

    private val context = ApplicationProvider.getApplicationContext<Context>()

    private val clip = "https://media/clip.mp4"
    private val other = "https://media/other.mp4"

    @After
    fun tearDown() {
        VideoStage.release()
        VideoStage.dataSources = null
    }

    @Test
    fun theSameClipOnASecondSurfaceIsTheSamePlayer() {
        // What makes the detail continue rather than restart: the
        // position, the buffer and the rendered frame all belong to the
        // instance, so reusing it is the whole fix.
        val feed = Any()
        val detail = Any()

        VideoStage.claim(context, clip, feed)
        val first = VideoStage.playerFor(feed, clip)
        VideoStage.claim(context, clip, detail)
        val second = VideoStage.playerFor(detail, clip)

        assertThat(second).isSameInstanceAs(first)
    }

    @Test
    fun theSurfaceThatArrivedLastIsTheOneThatShows() {
        // Both screens are briefly composed during a navigation. Two
        // surfaces binding one player fight over its video output,
        // which is what read as a flicker.
        val leaving = Any()
        val arriving = Any()

        VideoStage.claim(context, clip, leaving)
        VideoStage.claim(context, clip, arriving)

        assertThat(VideoStage.playerFor(arriving, clip)).isNotNull()
        assertThat(VideoStage.playerFor(leaving, clip)).isNull()
    }

    @Test
    fun aDepartingSurfaceCannotTakeTheStageFromItsReplacement() {
        // The leaving screen disposes *after* the arriving one claimed
        // the stage; surrendering then must be a no-op, or the new
        // screen loses the surface it just took.
        val leaving = Any()
        val arriving = Any()
        VideoStage.claim(context, clip, leaving)
        VideoStage.claim(context, clip, arriving)

        VideoStage.surrender(leaving)

        assertThat(VideoStage.playerFor(arriving, clip)).isNotNull()
    }

    @Test
    fun surrenderingKeepsThePlayerForTheNextSurface() {
        // Parking, not releasing: the clip has to survive the gap
        // between one screen leaving and the next arriving.
        val first = Any()
        val next = Any()
        VideoStage.claim(context, clip, first)
        val player = VideoStage.playerFor(first, clip)

        VideoStage.surrender(first)
        assertThat(VideoStage.playerFor(first, clip)).isNull()

        VideoStage.claim(context, clip, next)
        assertThat(VideoStage.playerFor(next, clip)).isSameInstanceAs(player)
    }

    @Test
    fun aSecondClipTakesTheStageAndTheFirstSurfaceStopsSeeingAPlayer() {
        // A feed can have two clips on screen at once. The one that
        // lost the stage must read null rather than go on driving a
        // player that now plays somebody else's clip.
        val one = Any()
        val two = Any()
        VideoStage.claim(context, clip, one)
        VideoStage.claim(context, other, two)

        assertThat(VideoStage.playerFor(one, clip)).isNull()
        assertThat(VideoStage.playerFor(two, other)).isNotNull()
    }

    @Test
    fun theStageHoldsOneDecoder() {
        val one = Any()
        val two = Any()
        VideoStage.claim(context, clip, one)
        VideoStage.claim(context, other, two)

        assertThat(VideoStage.holding?.url).isEqualTo(other)
        // Bounded at one: nothing of the first clip is still on stage.
        assertThat(VideoStage.holding?.owner).isSameInstanceAs(two)
        assertThat(VideoStage.holding?.player?.mediaItemCount).isEqualTo(1)
    }

    @Test
    fun aNewClipIsSwappedIntoTheSamePlayer() {
        // Building a player and releasing the last one was main-thread
        // work inside the frame that scrolled a clip into view; the next
        // clip goes into the player already there.
        VideoStage.claim(context, clip, Any())
        val first = VideoStage.holding?.player

        VideoStage.claim(context, other, Any())
        val second = VideoStage.holding?.player

        assertThat(second).isSameInstanceAs(first)
        assertThat(second?.currentMediaItem?.localConfiguration?.uri?.toString()).isEqualTo(other)
    }

    @Test
    fun aSwappedClipStartsAsAFreshPlayerWould() {
        // Still until its surface says to play, and looping — rather than
        // inheriting the last clip's "play" or its transport's stop.
        VideoStage.claim(context, clip, Any())
        VideoStage.holding?.player?.apply {
            playWhenReady = true
            repeatMode = Player.REPEAT_MODE_OFF
        }

        VideoStage.claim(context, other, Any())

        val player = VideoStage.holding?.player
        assertThat(player?.playWhenReady).isFalse()
        assertThat(player?.repeatMode).isEqualTo(Player.REPEAT_MODE_ONE)
        assertThat(player?.currentPosition).isEqualTo(0L)
    }

    @Test
    fun releasingEmptiesTheStage() {
        VideoStage.claim(context, clip, Any())
        VideoStage.release()
        assertThat(VideoStage.holding).isNull()
    }

    @Test
    fun aReleasedStageBuildsAFreshPlayerOnTheNextClaim() {
        // The backgrounded app gave its decoder back; coming back has to
        // build one rather than reach for the released instance.
        VideoStage.claim(context, clip, Any())
        val released = VideoStage.holding?.player
        VideoStage.release()

        VideoStage.claim(context, clip, Any())

        val rebuilt = VideoStage.holding?.player
        assertThat(rebuilt).isNotNull()
        assertThat(rebuilt).isNotSameInstanceAs(released)
    }

    @Test
    fun everyClipEarnsItsOwnFirstFrame() {
        // The cover stands until *this* clip has drawn: a swapped player
        // must not carry the last clip's face over to the next.
        VideoStage.claim(context, clip, Any())
        assertThat(VideoStage.rendered(clip)).isTrue()
        assertThat(VideoStage.hasRendered).isTrue()

        VideoStage.claim(context, other, Any())

        assertThat(VideoStage.hasRendered).isFalse()
    }

    @Test
    fun aSurfaceForAnotherClipCannotLiftTheCover() {
        // Every surface bound to the one player hears its frames; only a
        // surface for the clip on stage speaks for it.
        VideoStage.claim(context, clip, Any())

        assertThat(VideoStage.rendered(other)).isFalse()
        assertThat(VideoStage.hasRendered).isFalse()
    }

    @Test
    fun aFrameReportedBeforeTheSwapSettlesIsTheLastClips() {
        // A first-frame report of the previous clip can still be queued on
        // the main thread when the swap happens. Until the player's own
        // fence message arrives, no report counts; after it, the next one
        // is this clip's.
        VideoStage.claim(context, clip, Any())
        VideoStage.claim(context, other, Any())

        assertThat(VideoStage.rendered(other)).isFalse()
        assertThat(VideoStage.hasRendered).isFalse()

        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        var counted = false
        while (!counted && System.nanoTime() < deadline) {
            // The fence is posted from the playback thread; the paused
            // main looper runs it only when the test lets it.
            shadowOf(Looper.getMainLooper()).idle()
            counted = VideoStage.rendered(other)
            if (!counted) Thread.sleep(10)
        }
        assertThat(counted).isTrue()
        assertThat(VideoStage.hasRendered).isTrue()
    }

    @Test
    fun aClaimedClipIsReadThroughWhatTheAppInstalled() {
        // The app installs the disk cache here; a player built around it
        // would re-fetch every loop. The player opens its reader on its
        // own playback thread, so the test waits for it rather than
        // assuming it has happened by the time `claim` returns.
        val asked = CountDownLatch(1)
        VideoStage.dataSources = DataSource.Factory {
            asked.countDown()
            Offline()
        }

        VideoStage.claim(context, clip, Any())

        assertThat(asked.await(10, TimeUnit.SECONDS)).isTrue()
    }

    /** A reader with no network behind it — the test only asks whether it was used. */
    private class Offline : BaseDataSource(true) {
        override fun open(dataSpec: DataSpec): Long = throw IOException("offline")

        override fun read(buffer: ByteArray, offset: Int, length: Int): Int = C.RESULT_END_OF_INPUT

        override fun getUri(): Uri? = null

        override fun close() = Unit
    }
}
