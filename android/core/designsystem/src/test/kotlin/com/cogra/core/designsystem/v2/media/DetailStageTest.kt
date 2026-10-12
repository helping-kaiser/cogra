package com.cogra.core.designsystem.v2.media

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.lifecycle.Lifecycle
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * THE DETAIL CLIP IS ITS DETAIL'S ONE STAGE, on Android (PostDetailVideo.md:9,
 * :39-51; ruling 100). The real [DetailClip], the one player [VideoStage]
 * keeps, and the layers a detail raises over it ([CoveringLayersHost]) — one
 * test per behavior line, as the web's `detail-clip-stage.test.tsx` names
 * them. The rules alone are [DetailPlaybackTest]'s; the screen's own layers
 * (the comments sheet, the license, the share sheet, the pad's slot) are
 * `feature:content`'s `DetailClipTest`.
 *
 * A layer here is a bare announcement ([CoversSurface]), the same one the
 * screen's sheets and the stance control make: what is pinned is what the
 * clip does under it, not how a sheet is drawn.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class DetailStageTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private var suppressed = false
    private var sheet by mutableStateOf(false)
    private var dialog by mutableStateOf(false)
    private var pad by mutableStateOf(false)

    /** The sheet's own stage holds a clip of its own, which claims the one player. */
    private var threadClip by mutableStateOf(false)
    private var veiled by mutableStateOf(false)

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    /** :7 — the open starts the clip where the device allows autoplay. */
    @Test
    fun theOpenStartsTheClipWhereAutoplayIsAllowed() {
        showDetail()

        assertThat(player().playWhenReady).isTrue()
    }

    /** :9 — under suppressed autoplay the clip never starts on its own; the transport's play does. */
    @Test
    fun underSuppressionTheOpenStartsNothingAndTheTransportsPlayDoes() {
        suppressed = true
        showDetail()

        assertThat(player().playWhenReady).isFalse()

        pressPlayPause()

        assertThat(player().playWhenReady).isTrue()
    }

    /** :9 — the open is the only start: autoplay allowed again later starts nothing. */
    @Test
    fun theOpenIsTheOnlyStartAutoplayComingBackStartsNothing() {
        suppressed = true
        showDetail()

        suppressed = false
        raise { sheet = true }
        lower { sheet = false }

        assertThat(player().playWhenReady).isFalse()
    }

    /** A mid-play suppression flip never stops the clip (ruling 96). */
    @Test
    fun aMidPlaySuppressionFlipNeverStopsTheClip() {
        showDetail()

        suppressed = true
        compose.waitForIdle()

        assertThat(player().playWhenReady).isTrue()
    }

    /**
     * PostDetailVideoSensitive.md:17 with #149 — the unveil is the veiled
     * clip's open, and under suppression it starts nothing: the veil decides
     * whether a player exists, suppression whether the open starts it.
     */
    @Test
    fun underSuppressionTheUnveilStartsNothing() {
        suppressed = true
        veiled = true
        showDetail()
        assertThat(VideoStage.holding).isNull()

        compose.runOnIdle { veiled = false }
        compose.waitForIdle()

        assertThat(player().playWhenReady).isFalse()
    }

    /** #149 — an account that always unveils opens the clip by the same rule: allowed, it plays. */
    @Test
    fun anAlwaysUnveiledClipOpensByTheSameRule() {
        veiled = true
        showDetail(alwaysUnveil = true)

        assertThat(player().playWhenReady).isTrue()
    }

    /** :41/:43 — a sheet stops the clip where it is, and its dismissal resumes it there. */
    @Test
    fun aSheetStopsTheClipAndItsDismissalResumesItWhereItStopped() {
        showDetail()
        val at = seekTo(AT)

        raise { sheet = true }

        assertThat(player().playWhenReady).isFalse()
        assertThat(player().currentPosition).isEqualTo(at)

        lower { sheet = false }

        assertThat(player().playWhenReady).isTrue()
        assertThat(player().currentPosition).isEqualTo(at)
    }

    /** :41/:43 — a dialog over the post does the same. */
    @Test
    fun aDialogStopsTheClipAndItsDismissalResumesIt() {
        showDetail()

        raise { dialog = true }
        assertThat(player().playWhenReady).isFalse()
        lower { dialog = false }

        assertThat(player().playWhenReady).isTrue()
    }

    /** :43 — a dialog raised over the sheet keeps the clip stopped until the last layer lifts. */
    @Test
    fun aDialogOverTheSheetKeepsTheClipStoppedUntilTheLastLayerLifts() {
        showDetail()

        raise { sheet = true }
        raise { dialog = true }
        lower { dialog = false }
        assertThat(player().playWhenReady).isFalse()

        lower { sheet = false }

        assertThat(player().playWhenReady).isTrue()
    }

    /** :45 — a clip the reader had paused never resumes on its own on dismissal. */
    @Test
    fun aClipTheReaderPausedNeverResumesOnDismissal() {
        showDetail()
        readerPauses()
        assertThat(player().playWhenReady).isFalse()

        raise { sheet = true }
        lower { sheet = false }

        assertThat(player().playWhenReady).isFalse()
    }

    /** :47 — under suppression a clip the reader started stops under the sheet and never starts after it. */
    @Test
    fun underSuppressionTheSheetsDismissalStartsNothing() {
        suppressed = true
        showDetail()
        pressPlayPause()
        val at = seekTo(AT)

        raise { sheet = true }
        assertThat(player().playWhenReady).isFalse()
        lower { sheet = false }

        assertThat(player().playWhenReady).isFalse()
        // The reader's play starts it again, from the frame it stopped on.
        pressPlayPause()
        assertThat(player().playWhenReady).isTrue()
        assertThat(player().currentPosition).isEqualTo(at)
    }

    /** :47 — the GIVEN reads at dismissal: suppression arriving under the sheet resumes nothing. */
    @Test
    fun suppressionArrivingUnderTheSheetResumesNothing() {
        showDetail()

        raise { sheet = true }
        suppressed = true
        lower { sheet = false }

        assertThat(player().playWhenReady).isFalse()
    }

    /**
     * :41/:43 — the sheet's own clip takes the one player while it stands; the
     * dismissal claims the detail's clip back where it stopped and resumes it,
     * the transport with it.
     */
    @Test
    fun aClipTheSheetsStageTookIsClaimedBackWhereItStoppedAndResumed() {
        showDetail()
        val at = seekTo(AT)

        raise {
            sheet = true
            threadClip = true
        }
        assertThat(VideoStage.holding?.url).isEqualTo(THREAD)

        lower {
            sheet = false
            threadClip = false
        }

        assertThat(VideoStage.holding?.url).isEqualTo(CLIP)
        assertThat(VideoStage.holding?.owner).isNotNull()
        assertThat(player().currentPosition).isEqualTo(at)
        assertThat(player().playWhenReady).isTrue()
        compose.onNodeWithTag(TRANSPORT_TAG, useUnmergedTree = true).assertExists()
    }

    /**
     * Nothing plays under a sheet the reader left standing: the app going to
     * the background and coming back re-binds the player, and the bind under
     * the cover asserts "still" — then the dismissal resumes it (:41, :43).
     */
    @Test
    fun theAppsReturnUnderTheSheetPlaysNothingUntilTheDismissal() {
        showDetail()
        raise { sheet = true }

        compose.activityRule.scenario.moveToState(Lifecycle.State.CREATED)
        compose.runOnIdle { VideoStage.release() }
        compose.activityRule.scenario.moveToState(Lifecycle.State.RESUMED)
        compose.waitForIdle()

        assertThat(player().playWhenReady).isFalse()

        lower { sheet = false }

        assertThat(player().playWhenReady).isTrue()
    }

    /** :49/:51 — the pad pauses the playing clip where it is, and its closing resumes it there. */
    @Test
    fun thePadPausesTheClipAndItsClosingResumesIt() {
        showDetail()
        val at = seekTo(AT)

        raise { pad = true }
        assertThat(player().playWhenReady).isFalse()
        lower { pad = false }

        assertThat(player().playWhenReady).isTrue()
        assertThat(player().currentPosition).isEqualTo(at)
    }

    /** :51 'under suppressed autoplay included' — the pad resumes the clip it paused. */
    @Test
    fun thePadResumesTheClipItPausedUnderSuppressionToo() {
        suppressed = true
        showDetail()
        pressPlayPause()

        raise { pad = true }
        assertThat(player().playWhenReady).isFalse()
        lower { pad = false }

        assertThat(player().playWhenReady).isTrue()
    }

    /** :51 'GIVEN it paused the clip' — closing when it paused nothing starts nothing. */
    @Test
    fun thePadThatPausedNothingStartsNothing() {
        showDetail()
        readerPauses()

        raise { pad = true }
        lower { pad = false }

        assertThat(player().playWhenReady).isFalse()
    }

    private fun showDetail(alwaysUnveil: Boolean = false) {
        compose.setContent {
            Cogra2PreviewTheme {
                CompositionLocalProvider(
                    LocalAutoplaySuppression provides AutoplaySuppression { suppressed },
                    LocalAlwaysUnveil provides alwaysUnveil,
                ) {
                    CoveringLayersHost {
                        CoversSurface(open = sheet, kind = CoverKind.Suspend)
                        CoversSurface(open = dialog, kind = CoverKind.Suspend)
                        CoversSurface(open = pad, kind = CoverKind.Pause)
                        Column {
                            SensitiveVeil(veiled = veiled, onReveal = { veiled = false }) {
                                DetailClip(item = clipItem(CLIP))
                            }
                            // The sheet's thread, electing its own clip.
                            if (threadClip) {
                                VideoPlayer(url = THREAD, posterUrl = null, autoplay = true)
                            }
                        }
                    }
                }
            }
        }
        compose.waitForIdle()
    }

    private fun raise(change: () -> Unit) {
        compose.runOnIdle(change)
        compose.waitForIdle()
    }

    private fun lower(change: () -> Unit) = raise(change)

    private fun pressPlayPause() {
        compose.onNodeWithTag(PLAY_PAUSE_TAG, useUnmergedTree = true).performClick()
        compose.waitForIdle()
    }

    /**
     * The reader's pause — what the transport's press calls (`player.pause()`,
     * [VideoPlayer]'s `FullTransport`). Called on the player itself because the
     * press reads `isPlaying` to choose between pause and play, and a player
     * with nothing loaded under Robolectric never reports playing.
     */
    private fun readerPauses() {
        compose.runOnIdle { player().pause() }
        compose.waitForIdle()
    }

    private fun seekTo(ms: Long): Long = compose.runOnIdle {
        player().seekTo(ms)
        player().currentPosition
    }

    private fun player(): ExoPlayer = checkNotNull(VideoStage.holding?.player)

    private fun clipItem(url: String) =
        MediaItem(url = null, aspectRatio = 16f / 9f, videoUrl = url, durationMs = 41_000)

    private companion object {
        const val CLIP = "https://example.invalid/detail.mp4"
        const val THREAD = "https://example.invalid/thread.mp4"
        const val PLAY_PAUSE_TAG = "video_play_pause"
        const val AT = 6_000L
    }
}
