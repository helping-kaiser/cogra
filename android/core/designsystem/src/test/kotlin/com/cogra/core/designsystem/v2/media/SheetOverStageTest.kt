package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.Density
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
 * A SHEET RAISED OVER A SCROLL SURFACE, each with a stage of its own, and
 * the one player [VideoStage] keeps for the whole app between them.
 *
 * The feed and the comment thread over it are two [ScrollStageHost]s. Each
 * elects its own clip ([StageElection]), and visibility is measured in the
 * frame's own window, so a feed clip under the raised sheet still qualifies
 * by geometry alone. Left to that, the two elections would know nothing of
 * each other and the player would go to whichever claimed last.
 *
 * **A sheet over a surface suspends that surface's stage** (jakob 2026-09-24,
 * `design/readme.md`, "The feed-video rulings"). The feed's host is told the
 * sheet is up, holds nobody, and its clip surrenders; the sheet's stage then
 * decides by the law. When the sheet drops, the feed's stage is decided
 * afresh and its clip claims the player anew.
 *
 * The sheet here is an overlay in the same window rather than a
 * `ModalBottomSheet`: what is pinned is how two hosts' claims on one player
 * are ordered, which is the same whichever window the second host stands in
 * (`FeedSheetStageTest` runs the real screens).
 *
 * **The geometry is [ScrollStageTest]'s.** The feed list is 300 units tall at
 * a density of 1 and every clip is a 200-unit square: A shows whole and B
 * half at rest; at an offset of 50 both stand at 150/200, past the gate; at
 * 150, A is down to 50/200 and B is whole.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class SheetOverStageTest {

    @get:Rule
    val compose = createComposeRule()

    private lateinit var feed: LazyListState

    private var sheetOpen by mutableStateOf(false)

    private var sheetClips = listOf(SHEET_S)

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

    /**
     * The sheet's clip plays by the law: the feed's stage holds nobody while
     * the sheet is up, so the sheet's is the only election naming a clip.
     */
    @Test
    fun aRaisedSheetSuspendsTheFeedsStageAndItsOwnStageDecidesWhatPlays() {
        showFeedUnderSheet()
        assertHolds(FEED_A)

        openSheet()

        assertHolds(SHEET_S)
        assertThat(playingFrames()).containsExactly(trace(SHEET_S))
    }

    /**
     * The suspension is the sheet's being there, not its having a clip: a
     * thread with nothing to play still stops the clip under it — surrendered
     * and paused, the one player parked on it rather than released.
     */
    @Test
    fun aSheetWithNothingToPlayStillStopsTheClipUnderIt() {
        showFeedUnderSheet()
        val player = VideoStage.holding?.player

        openSheet(clips = emptyList())

        assertThat(playingFrames()).isEmpty()
        val parked = VideoStage.holding
        assertThat(parked?.url).isEqualTo(url(FEED_A))
        assertThat(parked?.owner).isNull()
        assertThat(parked?.player).isSameInstanceAs(player)
        assertThat(parked?.player?.playWhenReady).isFalse()
    }

    /**
     * The feed's list moving under the sheet re-reports every place, and the
     * suspended stage still holds nobody: no clip under the sheet claims.
     */
    @Test
    fun theFeedStaysSuspendedWhileItsListMovesUnderTheSheet() {
        showFeedUnderSheet()
        openSheet()

        // A and B both at 150/200 — past the gate by geometry alone.
        scrollFeedTo(HALF_OF_EACH)

        assertHolds(SHEET_S)
        assertThat(playingFrames()).containsExactly(trace(SHEET_S))
        assertThat(claimsOf(FEED_A)).isEqualTo(1)
        assertThat(claimsOf(FEED_B)).isEqualTo(0)
    }

    /**
     * Dropping the sheet lifts the suspension, and the feed's stage is decided
     * at once: A, still the topmost qualifying clip, claims the parked player
     * anew.
     */
    @Test
    fun droppingTheSheetHandsTheFeedsStageBackAtOnce() {
        showFeedUnderSheet()
        val player = VideoStage.holding?.player
        openSheet()

        closeSheet()

        assertHolds(FEED_A)
        assertThat(playingFrames()).containsExactly(trace(FEED_A))
        assertThat(claimsOf(FEED_A)).isEqualTo(2)
        assertThat(VideoStage.holding?.player).isSameInstanceAs(player)
    }

    /**
     * The stage the sheet drops back to is an EMPTY one: the clip that played
     * before the sheet stopped and is no incumbent, so the law's topmost
     * qualifying clip takes it — here A, over B which had held it.
     */
    @Test
    fun theStageAfterTheSheetIsDecidedFromEmptyNotByTheOldIncumbent() {
        showFeedUnderSheet()
        // B takes the stage below A, and keeps it scrolling back while both qualify.
        scrollFeedTo(PAST_A)
        scrollFeedTo(HALF_OF_EACH)
        assertHolds(FEED_B)

        openSheet()
        closeSheet()

        assertHolds(FEED_A)
    }

    /**
     * The detail's pinned clip is not a stage at all — it composes its player
     * unconditionally — so no suspension reaches it, and a sheet's clip takes
     * the player from it by claiming last. When the sheet closes the pinned
     * clip is not handed it back, and the transport, which is drawn from a
     * player, is gone with it.
     *
     * PINNED AS IT STANDS, NOT AS RULED: the stage law speaks of a scroll
     * surface's stage, and what the pinned clip does under a sheet — and how it
     * comes back — is flagged to design rather than invented here.
     */
    @Test
    fun aPinnedClipUnderTheSheetLosesThePlayerAndIsNotHandedItBack() {
        compose.setContent {
            Surfaces {
                PinnedClip(item = clipItem(PINNED_P), maxHeight = CLIP)
            }
        }
        compose.waitForIdle()
        assertHolds(PINNED_P)
        compose.onNodeWithTag(TRANSPORT_TAG, useUnmergedTree = true).assertExists()

        openSheet()

        assertHolds(SHEET_S)

        closeSheet()

        assertThat(VideoStage.holding?.url).isEqualTo(url(SHEET_S))
        assertThat(VideoStage.holding?.owner).isNull()
        compose.onNodeWithTag(TRANSPORT_TAG, useUnmergedTree = true).assertDoesNotExist()
    }

    private fun showFeedUnderSheet() {
        compose.setContent {
            Surfaces {
                feed = rememberLazyListState()
                // The surface that raises the sheet is the one that knows it is up.
                ScrollStageHost(feed, suspended = sheetOpen) {
                    LazyColumn(state = feed, modifier = Modifier.size(WIDTH, HEIGHT)) {
                        items(listOf(FEED_A, FEED_B), key = { it }) { row -> ScrollStageRow(row) { Clip(row) } }
                    }
                }
            }
        }
        compose.waitForIdle()
    }

    /**
     * The base surface, and over it — while [sheetOpen] — a sheet that is a
     * scroll surface of its own with its own stage and [sheetClips] on it.
     */
    @Composable
    private fun Surfaces(base: @Composable () -> Unit) {
        CompositionLocalProvider(LocalDensity provides Density(1f)) {
            Cogra2PreviewTheme {
                Box(Modifier.size(WIDTH, HEIGHT)) {
                    base()
                    if (sheetOpen) {
                        val thread = rememberLazyListState()
                        ScrollStageHost(thread) {
                            LazyColumn(state = thread, modifier = Modifier.size(WIDTH, HEIGHT)) {
                                items(sheetClips, key = { it }) { row -> ScrollStageRow(row) { Clip(row) } }
                            }
                        }
                    }
                }
            }
        }
    }

    @Composable
    private fun Clip(name: String) {
        MediaGallery(items = listOf(clipItem(name)), frameRatio = 1f, maxHeight = CLIP)
    }

    private fun clipItem(name: String) =
        MediaItem(url = null, aspectRatio = 1f, videoUrl = url(name), durationMs = 5_000)

    private fun openSheet(clips: List<String> = listOf(SHEET_S)) {
        sheetClips = clips
        sheetOpen = true
        compose.waitForIdle()
    }

    private fun closeSheet() {
        sheetOpen = false
        compose.waitForIdle()
    }

    private fun scrollFeedTo(offset: Float) {
        compose.runOnIdle {
            val current = feed.firstVisibleItemIndex * ROW + feed.firstVisibleItemScrollOffset
            feed.dispatchRawDelta(offset - current)
        }
        compose.waitForIdle()
    }

    private fun assertHolds(name: String) {
        val holding = VideoStage.holding
        assertThat(holding?.url).isEqualTo(url(name))
        assertThat(holding?.owner).isNotNull()
    }

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
        const val FEED_A = "feed-a"
        const val FEED_B = "feed-b"
        const val SHEET_S = "sheet-s"
        const val PINNED_P = "pinned-p"

        val WIDTH = 200.dp
        val HEIGHT = 300.dp
        val CLIP = 200.dp

        /** A clip row's height in scroll units. */
        const val ROW = 200

        /** Both feed clips at 150/200 — past the gate. */
        const val HALF_OF_EACH = 50f

        /** A at 50/200, B whole. */
        const val PAST_A = 150f
    }
}
