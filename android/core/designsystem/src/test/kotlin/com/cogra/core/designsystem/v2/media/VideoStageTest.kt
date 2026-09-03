package com.cogra.core.designsystem.v2.media

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

    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()

    @After
    fun tearDown() = VideoStage.release()

    @Test
    fun theSameClipOnASecondSurfaceIsTheSamePlayer() {
        // What makes the detail continue rather than restart: the
        // position, the buffer and the rendered frame all belong to the
        // instance, so reusing it is the whole fix.
        val first = VideoStage.playerFor(context, "https://media/clip.mp4")
        val second = VideoStage.playerFor(context, "https://media/clip.mp4")

        assertThat(second).isSameInstanceAs(first)
    }

    @Test
    fun aDifferentClipTakesTheStageAndTheOldPlayerGoes() {
        val first = VideoStage.playerFor(context, "https://media/one.mp4")
        val second = VideoStage.playerFor(context, "https://media/two.mp4")

        assertThat(second).isNotSameInstanceAs(first)
        // Exactly one decoder is held: the stage is bounded at one.
        assertThat(VideoStage.playerFor(context, "https://media/two.mp4"))
            .isSameInstanceAs(second)
    }

    @Test
    fun theSurfaceThatArrivedLastIsTheOneThatShows() {
        // Both screens are briefly composed during a navigation. Two
        // surfaces binding one player fight over its video output,
        // which is what read as a flicker.
        val leaving = Any()
        val arriving = Any()

        VideoStage.takeOwnership(leaving)
        assertThat(VideoStage.owns(leaving)).isTrue()

        VideoStage.takeOwnership(arriving)
        assertThat(VideoStage.owns(arriving)).isTrue()
        assertThat(VideoStage.owns(leaving)).isFalse()
    }

    @Test
    fun aDepartingSurfaceCannotTakeTheStageFromItsReplacement() {
        // The leaving screen disposes *after* the arriving one claimed
        // the stage; surrendering then must be a no-op, or the new
        // screen loses the surface it just took.
        val leaving = Any()
        val arriving = Any()
        VideoStage.takeOwnership(leaving)
        VideoStage.takeOwnership(arriving)

        VideoStage.surrender(leaving)

        assertThat(VideoStage.owns(arriving)).isTrue()
    }

    @Test
    fun theOwnerSurrenderingLeavesNobodyBinding() {
        val only = Any()
        VideoStage.takeOwnership(only)

        VideoStage.surrender(only)

        assertThat(VideoStage.owns(only)).isFalse()
        assertThat(VideoStage.owner).isNull()
    }

    @Test
    fun surrenderingKeepsThePlayerForTheNextSurface() {
        // Parking, not releasing: the clip has to survive the gap
        // between one screen leaving and the next arriving.
        val token = Any()
        val player = VideoStage.playerFor(context, "https://media/clip.mp4")
        VideoStage.takeOwnership(token)

        VideoStage.surrender(token)

        assertThat(VideoStage.playerFor(context, "https://media/clip.mp4"))
            .isSameInstanceAs(player)
    }
}
