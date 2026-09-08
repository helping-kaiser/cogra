package com.cogra.core.designsystem.v2.media

import android.content.Context
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.media3.common.util.UnstableApi
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * What a surface does when the app leaves the screen and comes back.
 *
 * The stage gives the decoder back on `ON_STOP` and builds a new player
 * on `ON_START`, so a surface that is still composed has to survive the
 * gap between them. Media3 binds a player to its view from `AndroidView`'s
 * update callback, which runs on a layout pass — and a returning app that
 * only recomposes never runs one. A surface torn down while the stage is
 * empty therefore comes back unbound: the player plays to nobody, no
 * frame is ever rendered, and the card sits blank.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class VideoSurfaceReturnTest {

    @get:Rule
    val compose = createComposeRule()

    private val context = ApplicationProvider.getApplicationContext<Context>()

    private val clip = "https://media/clip.mp4"

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    /**
     * The surface stays while the stage stands empty.
     *
     * This is the background: the screen stops, the process-scoped
     * observer releases the decoder, and nobody else has taken the clip.
     */
    @Test
    fun theSurfaceOutlivesAnEmptyStage() {
        val screen = FakeLifecycleOwner()
        compose.setContent {
            CompositionLocalProvider(LocalLifecycleOwner provides screen) {
                Clip()
            }
        }
        compose.runOnIdle { screen.registry.currentState = Lifecycle.State.RESUMED }
        compose.onNodeWithTag(SURFACE_TAG).assertExists()

        compose.runOnIdle {
            screen.registry.currentState = Lifecycle.State.CREATED
            VideoStage.release()
        }

        compose.onNodeWithTag(SURFACE_TAG).assertExists()
    }

    /** And it is bound to the player the returning app builds. */
    @Test
    fun theSurfaceIsStillThereWhenTheClipComesBack() {
        val screen = FakeLifecycleOwner()
        compose.setContent {
            CompositionLocalProvider(LocalLifecycleOwner provides screen) {
                Clip()
            }
        }
        compose.runOnIdle { screen.registry.currentState = Lifecycle.State.RESUMED }
        compose.runOnIdle {
            screen.registry.currentState = Lifecycle.State.CREATED
            VideoStage.release()
        }

        compose.runOnIdle { screen.registry.currentState = Lifecycle.State.RESUMED }

        compose.onNodeWithTag(SURFACE_TAG).assertExists()
        assertThat(VideoStage.holding?.url).isEqualTo(clip)
    }

    /**
     * A surface is given up to the *surface* that took the clip, and to
     * nothing else — the navigation crossfade, where the leaving screen
     * must not go on showing the frozen frame its `SurfaceView` still
     * holds beside the arriving one drawing the live clip.
     */
    @Test
    fun theSurfaceIsGivenUpToWhicheverSurfaceTookTheClip() {
        val screen = FakeLifecycleOwner()
        compose.setContent {
            CompositionLocalProvider(LocalLifecycleOwner provides screen) {
                Clip()
            }
        }
        compose.runOnIdle { screen.registry.currentState = Lifecycle.State.RESUMED }
        compose.onNodeWithTag(SURFACE_TAG).assertExists()

        compose.runOnIdle { VideoStage.claim(context, clip, Any()) }

        compose.onNodeWithTag(SURFACE_TAG).assertDoesNotExist()
    }

    /**
     * The cover stands until *this clip* has drawn a frame.
     *
     * Media3's per-surface presentation state is not that answer: it is
     * remembered across a player being swapped, so it goes on reporting
     * the frame the released player drew. The stage is what knows.
     */
    @Test
    fun theCoverStandsUntilTheClipOnStageHasDrawnAFrame() {
        val screen = FakeLifecycleOwner()
        compose.setContent {
            CompositionLocalProvider(LocalLifecycleOwner provides screen) {
                Clip()
            }
        }
        compose.runOnIdle { screen.registry.currentState = Lifecycle.State.RESUMED }
        compose.runOnIdle { VideoStage.rendered() }
        compose.onNodeWithTag(POSTER_TAG).assertDoesNotExist()

        compose.runOnIdle {
            screen.registry.currentState = Lifecycle.State.CREATED
            VideoStage.release()
        }
        compose.runOnIdle { screen.registry.currentState = Lifecycle.State.RESUMED }

        compose.onNodeWithTag(POSTER_TAG).assertIsDisplayed()
    }

    @Composable
    private fun Clip() {
        VideoPlayer(
            url = clip,
            posterUrl = null,
            autoplay = true,
            modifier = Modifier.size(FRAME),
        )
    }

    private companion object {
        val FRAME = 200.dp
    }

    private class FakeLifecycleOwner : LifecycleOwner {
        // `createUnsafe` is the registry's own documented testing
        // constructor: it drops the main-thread assertions a real owner
        // relies on.
        val registry: LifecycleRegistry = LifecycleRegistry.createUnsafe(this)

        override val lifecycle: Lifecycle get() = registry
    }
}
