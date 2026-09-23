package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.media3.common.util.UnstableApi
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.shadows.ShadowLog

/**
 * THE STAGE LAW in a real scrolling list (`design/readme.md`, "The
 * feed-video rulings — 2026-09-23"): galleries in a `LazyColumn` under one
 * [ScrollStageHost], scrolled the way a reader scrolls them.
 *
 * `StageElectionTest` pins the rule itself; these pin the wiring — that the
 * frames report where they stand, that the election follows the scroll with
 * the finger still down, and that the clip it names is the one holding
 * [VideoStage]'s player.
 *
 * **The geometry is exact on purpose.** The list is 300 units tall at a
 * density of 1, and every clip is a 200-unit square, so each scroll offset
 * below puts every clip at a visible fraction that can be read off the
 * numbers in the test — nowhere near the gate unless the case is about the
 * gate.
 *
 * **Who plays is read two ways.** [VideoStage.holding] says which clip holds
 * the one player and whether a surface owns it; the app's own trace says
 * which frames the election told to play, so a second frame composing a
 * player it then loses cannot hide behind the first.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class ScrollStageTest {

    @get:Rule
    val compose = createComposeRule()

    private lateinit var list: LazyListState

    @Before
    fun captureLogs() {
        ShadowLog.clear()
        ShadowLog.stream = null
    }

    @After
    fun tearDown() {
        VideoPreload.reset()
        VideoSound.reset()
    }

    /** (c) Two clips fully in view on an empty stage: the topmost, not the last to arrive. */
    @Test
    fun anEmptyStageGoesToTheTopmostQualifyingClip() {
        show(A, B, height = 400.dp)

        assertOnStage(A)
    }

    /** (a) A second clip qualifying beside the incumbent changes nothing. */
    @Test
    fun aSecondClipArrivingDoesNotTakeTheStage() {
        show(A, B, C)
        assertOnStage(A)

        // A stands at 150/200, B at 150/200: both past the gate.
        scrollTo(50f)

        assertOnStage(A)
    }

    /**
     * (b) The incumbent falls below the gate mid-gesture, and the next clip
     * takes the stage while the finger is still on the glass — nothing waits
     * for the scroll to settle.
     */
    @Test
    fun theStageChangesHandsMidScrollWithTheFingerDown() {
        show(A, B, C)
        assertOnStage(A)

        compose.onNodeWithTag(LIST).performTouchInput {
            down(center)
            // Well past the touch slop, in steps, the way a finger moves.
            repeat(DRAG_STEPS) { moveBy(Offset(0f, -DRAG_STEP)) }
        }
        compose.waitForIdle()

        // A is below half its height now; B is whole.
        assertThat(list.firstVisibleItemScrollOffset).isGreaterThan(SCROLLED_PAST_A)
        assertOnStage(B)

        compose.onNodeWithTag(LIST).performTouchInput { up() }
    }

    /** (a) Scrolling back up past the playing clip never ricochets to the one above. */
    @Test
    fun scrollingBackUpPastThePlayingClipKeepsItPlaying() {
        show(A, B, C)
        // A at 50/200, B whole: B takes the stage.
        scrollTo(150f)
        assertOnStage(B)

        // Back up: A at 150/200 again, B at 150/200 — both qualify, B keeps it.
        scrollTo(50f)

        assertOnStage(B)
    }

    /** (d) Nothing qualifies, nothing plays — and the parked player stays. */
    @Test
    fun nothingQualifyingMeansNothingPlaysUntilSomethingDoes() {
        show(A, GAP, B)
        assertOnStage(A)

        // A at 80/200, the gap, B at 70/200: nobody past the gate.
        scrollTo(120f)

        assertThat(playingFrames()).isEmpty()
        val parked = VideoStage.holding
        // The player is surrendered, never released: the next clip swaps
        // into the same instance.
        assertThat(parked).isNotNull()
        assertThat(parked?.owner).isNull()

        // B whole again: it takes the empty stage.
        scrollTo(250f)

        assertOnStage(B)
        assertThat(VideoStage.holding?.player).isSameInstanceAs(parked?.player)
    }

    /** (b) An incumbent that leaves the list in one jump hands the stage on at once. */
    @Test
    fun anIncumbentFlungOutOfTheListHandsTheStageToTheTopmostQualifyingClip() {
        show(A, B, C, D)
        assertOnStage(A)

        // A and B gone; C whole, D at 100/200.
        scrollTo(400f)

        assertOnStage(C)
    }

    /**
     * One stage per surface, whatever the clips belong to: two galleries in
     * one row — a post's and the comment under it — compete for the same one.
     */
    @Test
    fun clipsInsideOneRowCompeteForTheSurfacesOneStage() {
        compose.setContent {
            OneSurface(height = 400.dp) {
                list = rememberLazyListState()
                LazyColumn(state = list, modifier = Modifier.size(WIDTH, 400.dp).testTag(LIST)) {
                    item {
                        Column {
                            Clip(A)
                            Clip(B)
                        }
                    }
                }
            }
        }
        compose.waitForIdle()

        assertOnStage(A)
    }

    private fun show(vararg rows: String, height: Dp = 300.dp) {
        compose.setContent {
            OneSurface(height = height) {
                list = rememberLazyListState()
                LazyColumn(state = list, modifier = Modifier.size(WIDTH, height).testTag(LIST)) {
                    items(rows.toList()) { row ->
                        if (row == GAP) Spacer(Modifier.height(GAP_HEIGHT)) else Clip(row)
                    }
                }
            }
        }
        compose.waitForIdle()
    }

    /** One scroll surface at a density of 1, so a unit of scroll is a unit of layout. */
    @Composable
    private fun OneSurface(height: Dp, content: @Composable () -> Unit) {
        CompositionLocalProvider(LocalDensity provides Density(1f)) {
            Cogra2PreviewTheme {
                ScrollStageHost {
                    Column(Modifier.size(WIDTH, height)) { content() }
                }
            }
        }
    }

    @Composable
    private fun Clip(name: String) {
        MediaGallery(
            items = listOf(MediaItem(url = null, aspectRatio = 1f, videoUrl = url(name), durationMs = 5_000)),
            frameRatio = 1f,
            maxHeight = CLIP,
        )
    }

    private fun scrollTo(offset: Float) {
        compose.runOnIdle {
            val current = list.firstVisibleItemIndex * ROW + list.firstVisibleItemScrollOffset
            list.dispatchRawDelta(offset - current)
        }
        compose.waitForIdle()
    }

    private fun assertOnStage(name: String) {
        assertThat(playingFrames()).containsExactly(VideoTrace.clip(url(name)))
        val holding = VideoStage.holding
        assertThat(holding?.url).isEqualTo(url(name))
        assertThat(holding?.owner).isNotNull()
    }

    /** The frames whose latest autoplay decision was to play, by trace name. */
    private fun playingFrames(): Set<String> = ShadowLog.getLogsForTag(VideoTrace.TAG)
        .map { it.msg }
        .filter { it.startsWith("autoplay") }
        .map { line -> line.split(Regex("\\s+")).let { it[1] to it.last() } }
        .fold(mutableMapOf<String, String>()) { latest, (clip, verdict) -> latest.apply { put(clip, verdict) } }
        .filterValues { it == "play=true" }
        .keys

    private fun url(name: String) = "https://example.invalid/$name.mp4"

    private companion object {
        const val LIST = "stage_list"
        const val A = "clip-a"
        const val B = "clip-b"
        const val C = "clip-c"
        const val D = "clip-d"
        const val GAP = "gap"

        val WIDTH = 200.dp
        val CLIP = 200.dp
        val GAP_HEIGHT = 150.dp

        /** A clip row's height in scroll units — every row a clip in the scrolled cases. */
        const val ROW = 200

        const val DRAG_STEPS = 10
        const val DRAG_STEP = 15f

        /** Past this, A shows under half of itself. */
        const val SCROLLED_PAST_A = 100
    }
}
