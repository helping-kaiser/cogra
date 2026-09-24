package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
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
 * THE VEIL OVER A CLIP, in a real scrolling list (jakob 2026-09-24, backlog
 * item 103; `design/readme.md`, "The feed-video rulings"): "the sensitive veil
 * covers its clip the same way" a sheet covers a surface.
 *
 * A veiled clip sits fully out of the stage rotation — no playback and no
 * sound disc. **The unveil is an eligibility change, not a re-election**
 * (jakob 2026-09-24, correcting a first build that decided the stage from
 * empty on unveil, as a sheet's dismissal does): the unveiled clip joins the
 * rotation exactly as a clip scrolling into view, so it plays only if it is
 * the topmost qualifying clip and no qualifying incumbent already holds the
 * stage. Preloading stays on. `StageElectionTest` pins the rule; these pin
 * both faces of the veil wiring it: the post's, which covers its clip in
 * place, and the comment's, which replaces its body.
 *
 * **The geometry is [ScrollStageTest]'s.** The list is 300 units tall at a
 * density of 1 and every clip is a 200-unit square: A shows whole and B half
 * at rest; at an offset of 50 both stand at 150/200, past the gate.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class VeiledStageTest {

    @get:Rule
    val compose = createComposeRule()

    private lateinit var list: LazyListState

    /** Which rows are veiled now, by name; absent is never veiled. */
    private val veiled = mutableStateMapOf<String, Boolean>()

    /** Whether the rows wear the comment's veil rather than the post's. */
    private var compact = false

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

    /** Whole on screen and alone, the veiled clip still plays nothing and draws no sound disc. */
    @Test
    fun aVeiledClipFullyInViewIsNeverElected() {
        show(A, veil = setOf(A))

        assertNobodyPlays()
        compose.onNodeWithTag(VIDEO_TAG, useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag(SOUND_DISC_TAG, useUnmergedTree = true).assertDoesNotExist()
    }

    /** The reveal re-elects: alone past the gate, the unveiled clip wins and plays, sound disc and all. */
    @Test
    fun revealingTheOnlyQualifyingClipPlaysIt() {
        show(A, veil = setOf(A))

        reveal(A)

        assertHolds(A)
        compose.onNodeWithTag(SOUND_DISC_TAG, useUnmergedTree = true).assertExists()
    }

    /**
     * A veiled clip above a qualifying one does not keep the stage from it:
     * out of the rotation, it is not the topmost qualifying clip.
     */
    @Test
    fun aVeiledClipAboveHandsTheStageToTheQualifyingClipBelow() {
        show(A, B, veil = setOf(A))

        scrollTo(HALF_OF_EACH)

        assertHolds(B)
    }

    /**
     * NOT A SUSPENSION LIFT: unlike a sheet's dismissal, the unveil never
     * decides the stage from empty — A joins the rotation exactly as a clip
     * scrolling into view, so it does not displace B, which holds the stage
     * and still qualifies.
     */
    @Test
    fun unveilingATopmostClipDoesNotDisplaceTheQualifyingIncumbent() {
        show(A, B, veil = setOf(A))
        scrollTo(HALF_OF_EACH)
        assertHolds(B)

        reveal(A)

        assertHolds(B)
        assertThat(playingFrames()).containsExactly(trace(B))
        assertThat(claimsOf(A)).isEqualTo(0)
    }

    /** Unveiled below the topmost qualifying clip, it does not win, and the clip above plays on. */
    @Test
    fun unveilingAClipBelowTheTopmostQualifyingOneLeavesTheStageWhereItIs() {
        show(A, B, veil = setOf(B))
        scrollTo(HALF_OF_EACH)
        assertHolds(A)

        reveal(B)

        assertHolds(A)
        assertThat(claimsOf(B)).isEqualTo(0)
    }

    /** A veil falling over the playing clip takes it out of the rotation: it surrenders. */
    @Test
    fun aPlayingClipTheVeilFallsOverSurrendersTheStage() {
        show(A)
        assertHolds(A)

        veil(A)

        assertNobodyPlays()
        assertThat(playingFrames()).isEmpty()
    }

    /**
     * The post's veil keeps its body in one slot, so the unveiled clip is the
     * same frame it was: its one verdict under the veil, then its one on the
     * reveal — not a second frame starting over.
     */
    @Test
    fun theUnveiledClipIsTheSameFrameItWasUnderTheVeil() {
        show(A, veil = setOf(A))

        reveal(A)

        val verdicts = traces().filter { it.startsWith("autoplay ${trace(A)} ") }.map { it.split(Regex("\\s+")).last() }
        assertThat(verdicts).containsExactly("play=false", "play=true").inOrder()
        assertThat(claimsOf(A)).isEqualTo(1)
    }

    /**
     * THE COMMENT'S VEIL REPLACES ITS BODY, so its clip is not on the stage at
     * all while veiled — and joins it for the first time on the reveal, as an
     * ordinary place: NOT a suspension lift, so it does not displace B, which
     * already holds the stage and still qualifies.
     */
    @Test
    fun theCommentsVeilRevealJoinsTheRotationWithoutDisplacingTheIncumbent() {
        show(A, B, veil = setOf(A), compact = true, height = TALL)
        assertHolds(B)
        compose.onNodeWithTag(VIDEO_TAG, useUnmergedTree = true).assertExists()

        reveal(A)

        assertHolds(B)
        assertThat(playingFrames()).containsExactly(trace(B))
        assertThat(claimsOf(A)).isEqualTo(0)
    }

    /**
     * PRELOADING STAYS ON: invisible, it leaks nothing the veil hides, and it
     * makes the unveil instant. The list's clips reach the preload manager
     * whether or not a veil covers one of them.
     */
    @Test
    fun aVeiledClipIsStillPreloaded() {
        show(A, B, veil = setOf(A), preload = true)

        assertNobodyPlays()
        assertThat(VideoPreload.ranks).containsExactly(url(A), 0, url(B), 1)
    }

    private fun show(
        vararg rows: String,
        veil: Set<String> = emptySet(),
        compact: Boolean = false,
        preload: Boolean = false,
        height: Dp = HEIGHT,
    ) {
        veil.forEach { veiled[it] = true }
        this.compact = compact
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(1f)) {
                Cogra2PreviewTheme {
                    list = rememberLazyListState()
                    if (preload) PreloadClips(clips = rows.map(::url), focus = { 0 })
                    ScrollStageHost(list) {
                        LazyColumn(state = list, modifier = Modifier.size(WIDTH, height)) {
                            items(rows.toList(), key = { it }) { row ->
                                ScrollStageRow(row) { VeiledClip(row, compact) }
                            }
                        }
                    }
                }
            }
        }
        compose.waitForIdle()
    }

    @Composable
    private fun VeiledClip(name: String, compact: Boolean) {
        val covered = veiled[name] == true
        val onReveal = { veiled[name] = false }
        val clip: @Composable () -> Unit = {
            MediaGallery(items = listOf(clipItem(name)), frameRatio = 1f, maxHeight = CLIP)
        }
        if (compact) {
            SensitiveVeilCompact(veiled = covered, onReveal = onReveal, testTag = "veil_$name", content = clip)
        } else {
            SensitiveVeil(veiled = covered, onReveal = onReveal, testTag = "veil_$name", content = clip)
        }
    }

    /**
     * Through the veil's own reveal, the way a reader lifts it: the post's
     * Show button, or the comment's whole block.
     */
    private fun reveal(name: String) {
        compose.onNodeWithTag(if (compact) "veil_$name" else "veil_${name}_reveal").performClick()
        compose.waitForIdle()
    }

    /** A veil falling over a clip that stood unveiled — a node's sensitive state changing under the reader. */
    private fun veil(name: String) {
        compose.runOnIdle { veiled[name] = true }
        compose.waitForIdle()
    }

    private fun scrollTo(offset: Float) {
        compose.runOnIdle {
            val current = list.firstVisibleItemIndex * ROW + list.firstVisibleItemScrollOffset
            list.dispatchRawDelta(offset - current)
        }
        compose.waitForIdle()
    }

    private fun assertHolds(name: String) {
        val holding = VideoStage.holding
        assertThat(holding?.url).isEqualTo(url(name))
        assertThat(holding?.owner).isNotNull()
    }

    private fun assertNobodyPlays() {
        assertThat(VideoStage.holding?.owner).isNull()
    }

    private fun clipItem(name: String) =
        MediaItem(url = null, aspectRatio = 1f, videoUrl = url(name), durationMs = 5_000)

    private fun traces(): List<String> = ShadowLog.getLogsForTag(VideoTrace.TAG).map { it.msg }

    /** The frames whose latest autoplay decision was to play, by trace name. */
    private fun playingFrames(): Set<String> = traces()
        .filter { it.startsWith("autoplay") }
        .map { line -> line.split(Regex("\\s+")).let { it[1] to it.last() } }
        .fold(mutableMapOf<String, String>()) { latest, (clip, verdict) -> latest.apply { put(clip, verdict) } }
        .filterValues { it == "play=true" }
        .keys

    /** How many times a surface showing [name] claimed the one player. */
    private fun claimsOf(name: String): Int =
        traces().count { it.startsWith("handover ${trace(name)} ") && "claimed" in it }

    private fun trace(name: String) = VideoTrace.clip(url(name))

    private fun url(name: String) = "https://example.invalid/$name.mp4"

    private companion object {
        const val A = "a"
        const val B = "b"

        const val VIDEO_TAG = "gallery_video"
        const val SOUND_DISC_TAG = "video_mute"

        val WIDTH = 200.dp
        val HEIGHT = 300.dp
        val CLIP = 200.dp

        /** Two whole clips at once. */
        val TALL = 400.dp

        /** A clip row's height in scroll units. */
        const val ROW = 200

        /** Both clips at 150/200 — past the gate. */
        const val HALF_OF_EACH = 50f
    }
}
