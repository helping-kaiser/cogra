package com.cogra.core.designsystem.v2.media

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.media3.common.util.UnstableApi
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The detail's clip and the fullscreen viewer, handing one clip between them
 * (PostDetailVideo.md:57/59, ViewerVideo.md:5).
 *
 * The real [PinnedClip] under the real [MediaViewer]: one player carries the
 * clip into the viewer and back, so the viewer opens where the detail was, and
 * nothing of the clip is drawn — let alone played — behind it.
 *
 * **Each surface hears the lifecycle it hears in the app.** The detail's clip
 * sits in a navigation destination, whose lifecycle follows the activity's
 * from an observer the navigation host registered first ([destination]). The
 * viewer is a `Dialog`, a window of its own whose composition takes its
 * lifecycle owner from the view tree — the activity — rather than from the
 * destination around it.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in, so it
// propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class ViewerHandoverTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val clip = MediaItem(
        url = null,
        aspectRatio = 16f / 9f,
        altText = "A clip",
        videoUrl = "https://media/clip.mp4",
        durationMs = 41_000,
    )

    private var viewerUp by mutableStateOf(false)
    private val destination = FollowingOwner()

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    /**
     * NEVER IT PLAYS BEHIND THE VIEWER (PostDetailVideo.md:57) — including
     * after the app went to the background and came back with the viewer still
     * up, which rebuilds the player and has both surfaces claim it again.
     */
    @Test
    fun theViewerTakesTheClipAndNothingOfItStandsBehindIt() {
        showDetail()
        val player = VideoStage.holding?.player

        compose.runOnIdle { viewerUp = true }
        compose.waitForIdle()

        assertThat(VideoStage.holding?.player).isSameInstanceAs(player)
        assertTheViewerAloneShowsTheClip()

        compose.activityRule.scenario.moveToState(Lifecycle.State.CREATED)
        compose.runOnIdle { VideoStage.release() }
        compose.activityRule.scenario.moveToState(Lifecycle.State.RESUMED)
        compose.waitForIdle()

        assertTheViewerAloneShowsTheClip()
    }

    /**
     * WHEN THE VIEWER CLOSES GIVEN ITS CLIP WAS PLAYING -> the detail's clip
     * plays on from the position the viewer reached AND NEVER starts over
     * (PostDetailVideo.md:59): the same player, the same source, the same
     * moment, playing.
     */
    @Test
    fun closingAPlayingViewerHandsTheClipBackWhereItStands() {
        showDetail()
        val player = checkNotNull(VideoStage.holding?.player)
        val source = VideoStage.sourceOnStage

        compose.runOnIdle { viewerUp = true }
        compose.waitForIdle()
        val reached = compose.runOnIdle {
            player.seekTo(REACHED_MS)
            player.playWhenReady = true
            player.currentPosition
        }

        compose.runOnIdle { viewerUp = false }
        compose.waitForIdle()

        assertThat(reached).isGreaterThan(0L)
        assertThat(VideoStage.holding?.player).isSameInstanceAs(player)
        assertThat(VideoStage.sourceOnStage).isSameInstanceAs(source)
        assertThat(player.currentPosition).isEqualTo(reached)
        assertThat(player.playWhenReady).isTrue()
        compose.onNode(surfaceIn(PINNED), useUnmergedTree = true).assertExists()
        compose.onNode(transportIn(PINNED), useUnmergedTree = true).assertExists()
    }

    private fun showDetail() {
        compose.runOnUiThread { destination.follow(compose.activity.lifecycle) }
        compose.setContent {
            Cogra2PreviewTheme {
                CompositionLocalProvider(LocalLifecycleOwner provides destination) {
                    Column { PinnedClip(item = clip, onOpenViewer = { viewerUp = true }) }
                }
                if (viewerUp) MediaViewer(items = listOf(clip), onClose = { viewerUp = false })
            }
        }
        compose.waitForIdle()
    }

    private fun assertTheViewerAloneShowsTheClip() {
        compose.onNode(surfaceIn(VIEWER), useUnmergedTree = true).assertExists()
        compose.onNode(transportIn(VIEWER), useUnmergedTree = true).assertExists()
        compose.onNode(surfaceIn(PINNED), useUnmergedTree = true).assertDoesNotExist()
        compose.onNode(transportIn(PINNED), useUnmergedTree = true).assertDoesNotExist()
        assertThat(VideoStage.holding?.owner).isNotNull()
    }

    private fun surfaceIn(host: String): SemanticsMatcher =
        hasTestTag(SURFACE_TAG) and hasAnyAncestor(hasTestTag(host))

    private fun transportIn(host: String): SemanticsMatcher =
        hasTestTag(TRANSPORT_TAG) and hasAnyAncestor(hasTestTag(host))

    private companion object {
        const val PINNED = "${PINNED_CLIP_TAG}_video"
        const val VIEWER = "${VIEWER_TAG}_video"

        /** A moment past the clip's start, so starting over (back to zero) shows. */
        const val REACHED_MS = 4_000L
    }

    /**
     * A destination's lifecycle: it moves with the activity's, from an observer
     * registered before any surface on the screen registers its own — the way a
     * navigation host follows the lifecycle it is hosted in.
     */
    private class FollowingOwner : LifecycleOwner {
        // `createUnsafe` is the registry's own documented testing constructor:
        // it drops the main-thread assertions a real owner relies on.
        private val registry: LifecycleRegistry = LifecycleRegistry.createUnsafe(this)

        override val lifecycle: Lifecycle get() = registry

        fun follow(host: Lifecycle) {
            host.addObserver(LifecycleEventObserver { _, event -> registry.currentState = event.targetState })
        }
    }
}
