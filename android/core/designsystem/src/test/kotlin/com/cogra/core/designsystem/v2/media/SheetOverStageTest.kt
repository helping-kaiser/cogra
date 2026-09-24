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
 * and keeps the feed's stage. The two elections know nothing of each other;
 * what reconciles them is [VideoStage]'s claim.
 *
 * **These pin what happens today, before any law covers it.** The sheet here
 * is an overlay in the same window rather than a `ModalBottomSheet`: what is
 * being pinned is the ordering of two hosts' claims on one player, which is
 * the same whichever window the second host stands in.
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
     * (a) A clip in the sheet plays — because its player composes after the
     * feed's and the last claim wins, not because anything decided it should.
     * The feed's election still names its own clip: two stages, each sure it
     * is the one playing.
     */
    @Test
    fun aSheetClipTakesTheOnePlayerFromTheFeedClipByClaimingLast() {
        showFeedUnderSheet()
        assertHolds(FEED_A)

        openSheet()

        assertHolds(SHEET_S)
        assertThat(playingFrames()).containsExactly(trace(FEED_A), trace(SHEET_S))
    }

    /**
     * (c) The two domains do not steal the player back and forth. The feed
     * frame claims from an effect keyed on its clip and its token, and
     * re-claims only a stage left UNOWNED on its own clip — so a stage owned
     * by the sheet's clip gives it nothing to re-fire on, however the feed's
     * list moves underneath.
     */
    @Test
    fun theFeedDoesNotClaimThePlayerBackWhileTheSheetIsOpen() {
        showFeedUnderSheet()
        openSheet()

        // The list moves under the sheet; A stays past the gate and elected.
        scrollFeedTo(HALF_OF_EACH)

        assertHolds(SHEET_S)
        assertThat(claimsOf(FEED_A)).isEqualTo(1)
        assertThat(claimsOf(SHEET_S)).isEqualTo(1)
    }

    /**
     * (b) The sheet closes and the feed's clip does not come back. Its claim
     * effect ran when it took the stage and has nothing to run on again: the
     * stage is parked on the sheet's clip, owned by nobody, and the "unowned"
     * re-claim answers only a stage parked on the frame's OWN clip. The feed
     * still elects A, so A sits on its cover.
     */
    @Test
    fun afterTheSheetClosesTheFeedClipKeepsItsStageButNotThePlayer() {
        showFeedUnderSheet()
        openSheet()

        closeSheet()

        assertThat(playingFrames()).containsExactly(trace(FEED_A))
        val parked = VideoStage.holding
        assertThat(parked?.url).isEqualTo(url(SHEET_S))
        assertThat(parked?.owner).isNull()
        assertThat(claimsOf(FEED_A)).isEqualTo(1)
        assertThat(lastPoster(FEED_A)).endsWith("no clip on stage")
    }

    /**
     * (b) …and incumbency keeps every other feed clip off the stage for as
     * long as the frozen one qualifies. Only when A falls below the gate is
     * the feed's stage re-decided, and B, newly elected, claims fresh.
     */
    @Test
    fun incumbencyKeepsTheFeedDeadUntilTheFrozenClipLeavesTheGate() {
        showFeedUnderSheet()
        openSheet()
        closeSheet()

        // A and B both at 150/200: A keeps the feed's stage, frozen.
        scrollFeedTo(HALF_OF_EACH)

        assertThat(playingFrames()).containsExactly(trace(FEED_A))
        assertThat(VideoStage.holding?.url).isEqualTo(url(SHEET_S))
        assertThat(VideoStage.holding?.owner).isNull()

        // A down to 50/200: the stage goes to B, which claims.
        scrollFeedTo(PAST_A)

        assertHolds(FEED_B)
    }

    /**
     * The detail's pinned clip is not a stage at all — it composes its player
     * unconditionally — and a sheet's clip takes the player from it the same
     * way. When the sheet closes the pinned clip is not handed it back, and
     * the transport, which is drawn from a player, is gone with it.
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
                ScrollStageHost(feed) {
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
     * scroll surface of its own with its own stage and one clip on it, whole.
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
                                items(listOf(SHEET_S), key = { it }) { row -> ScrollStageRow(row) { Clip(row) } }
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

    private fun openSheet() {
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

    private fun lastPoster(name: String): String? = traces().lastOrNull { it.startsWith("poster") && trace(name) in it }

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
