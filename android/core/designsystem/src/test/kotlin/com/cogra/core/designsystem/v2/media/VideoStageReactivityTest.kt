package com.cogra.core.designsystem.v2.media

import android.content.Context
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.media3.common.util.UnstableApi
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * What the stage does to the *surfaces* watching it.
 *
 * `VideoStageTest` pins the stage's own bookkeeping. These pin the two
 * things a reader actually sees: a cover that comes away by itself when
 * the first frame lands, and a decoder that is handed back when the app
 * stops being on screen. Both are questions about reactivity and
 * lifecycle rather than about state, so both are asked through a
 * composition.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class VideoStageReactivityTest {

    @get:Rule
    val compose = createComposeRule()

    private val context = ApplicationProvider.getApplicationContext<Context>()

    private val clip = "https://media/clip.mp4"

    @After
    fun tearDown() {
        VideoStage.release()
        // The seam the sticky mute needs: it is process-wide and the
        // convention plugin runs suites in parallel forks, so a test that
        // unmutes would otherwise leave every later test in its fork
        // hearing sound.
        VideoSound.reset()
    }

    /**
     * The poster rule, read the way the surface reads it.
     *
     * `hasRendered` is consulted while composing, so the first frame
     * landing has to invalidate the composable on its own. It used to be
     * a plain field: the value changed and nothing asked again, and the
     * cover came away only because some *other* observed value happened
     * to change in the same window.
     */
    @Test
    fun theCoverComesAwayWhenTheClipRendersItsFirstFrame() {
        VideoStage.claim(context, clip, Any())

        compose.setContent { PosterProbe(clip) }
        compose.onNodeWithTag("poster").assertIsDisplayed()

        compose.runOnIdle { VideoStage.rendered() }

        compose.onNodeWithTag("poster").assertDoesNotExist()
    }

    /** And a clip that has drawn a frame never wears its cover again. */
    @Test
    fun aClipThatHasRenderedOpensWithoutACover() {
        VideoStage.claim(context, clip, Any())
        VideoStage.rendered()

        compose.setContent { PosterProbe(clip) }

        compose.onNodeWithTag("poster").assertDoesNotExist()
    }

    /**
     * The decoder goes back when the app leaves the screen.
     *
     * Driven through a real `Lifecycle` rather than by calling `onStop`
     * by hand, because what is being pinned is the wiring: the observer
     * has to answer the event the process owner actually dispatches.
     */
    @Test
    fun stoppingTheProcessGivesTheDecoderBack() {
        VideoStage.claim(context, clip, Any())
        assertThat(VideoStage.holding).isNotNull()

        val owner = FakeLifecycleOwner()
        owner.registry.addObserver(VideoStageLifecycle)
        owner.registry.currentState = Lifecycle.State.RESUMED

        owner.registry.currentState = Lifecycle.State.CREATED

        assertThat(VideoStage.holding).isNull()
        // And the next clip earns its own face: a stage that kept
        // `hasRendered` would open the returning surface with no cover
        // over a player that no longer exists.
        assertThat(VideoStage.hasRendered).isFalse()
    }

    /** Starting again does not, so a foregrounded app keeps its clip. */
    @Test
    fun aStartedProcessKeepsWhatItHas() {
        val owner = FakeLifecycleOwner()
        owner.registry.addObserver(VideoStageLifecycle)
        owner.registry.currentState = Lifecycle.State.RESUMED

        VideoStage.claim(context, clip, Any())

        assertThat(VideoStage.holding).isNotNull()
    }

    /** The shared answer starts quiet, and the seam puts it back. */
    @Test
    fun theSharedMuteStartsQuietAndIsPutBackByTheSeam() {
        assertThat(VideoSound.muted.value).isTrue()

        VideoSound.toggle()
        assertThat(VideoSound.muted.value).isFalse()

        VideoSound.reset()
        assertThat(VideoSound.muted.value).isTrue()
    }

    /**
     * The poster gate, exactly as `VideoPlayer` asks it of a surface that
     * has not drawn anything yet.
     */
    @Composable
    private fun PosterProbe(url: String) {
        val reason = posterReason(
            coverSurface = true,
            hasPlayer = true,
            alreadyRendered = VideoStage.hasRendered,
            clipOnStage = VideoStage.holding?.url == url,
        )
        // Sized, so "displayed" is a question with an answer: a bare box
        // measures 0x0 and is never displayed whether it is there or not.
        if (reason != null) Box(Modifier.size(POSTER).testTag("poster"))
    }

    private companion object {
        val POSTER = 64.dp
    }

    private class FakeLifecycleOwner : LifecycleOwner {
        // `createUnsafe` is the registry's own documented testing
        // constructor: it drops the main-thread assertions a real owner
        // relies on.
        val registry: LifecycleRegistry = LifecycleRegistry.createUnsafe(this)

        override val lifecycle: Lifecycle get() = registry
    }
}
