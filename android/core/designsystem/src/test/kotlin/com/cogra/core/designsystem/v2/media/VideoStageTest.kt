package com.cogra.core.designsystem.v2.media

import android.content.Context
import androidx.media3.common.util.UnstableApi
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

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
    fun tearDown() = VideoStage.release()

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
        // lost the stage must read null rather than go on holding a
        // player that has since been released.
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
    }

    @Test
    fun releasingEmptiesTheStage() {
        VideoStage.claim(context, clip, Any())
        VideoStage.release()
        assertThat(VideoStage.holding).isNull()
    }
}
