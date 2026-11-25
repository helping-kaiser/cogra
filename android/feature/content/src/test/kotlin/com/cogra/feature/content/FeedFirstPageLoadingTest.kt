// The feed's first page, not yet in (design/readme.md "Loading";
// EmptyState.prompt.md): nothing under 200ms, then `Loading…` where the
// cards will stand, never a spinner and never the empty line meanwhile; a
// retried read times its own wait; the pull's spinner answers a pull alone.

package com.cogra.feature.content

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class FeedFirstPageLoadingTest {

    @get:Rule
    val compose = createComposeRule()

    private var state by mutableStateOf(FeedUiState())
    private var refreshed = 0

    private fun render(initial: FeedUiState, onRefresh: () -> Unit = { refreshed++ }) {
        state = initial
        compose.mainClock.autoAdvance = false
        compose.setContent {
            FeedScreen(
                state = state,
                onRefresh = onRefresh,
                onLoadMore = {},
                onOpenPost = {},
                onOpenActor = {},
                onOpenTopic = {},
            )
        }
    }

    /** Exactly [ms] of virtual time, never rounded up to a whole frame. */
    private fun upTo(ms: Long) {
        compose.mainClock.advanceTimeBy(ms, ignoreFrameDuration = true)
    }

    private fun frame() {
        compose.mainClock.advanceTimeByFrame()
    }

    /** Up to [ms] since the read's frame, the last frame drawn at exactly [ms]. */
    private fun drawnAt(ms: Long) {
        upTo(ms - FRAME_MS)
        frame()
    }

    private fun theWaitEnds() {
        upTo(1)
        frame()
    }

    private fun hand(next: FeedUiState) {
        state = next
        Snapshot.sendApplyNotifications()
        frame()
    }

    private fun count(tag: String) = compose.onAllNodesWithTag(tag, useUnmergedTree = true)

    /** A spinner: an indeterminate progress indicator, as M3 draws one. */
    private fun spinners() =
        compose.onAllNodes(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate), useUnmergedTree = true)

    /** Neither the empty line nor the every-kind-off one stands while the page is read. */
    private fun noEmptyLine() {
        count("feed_empty").assertCountEquals(0)
        count("feed.nothing").assertCountEquals(0)
    }

    private fun loadingReads() {
        compose.onNodeWithTag(LOADING, useUnmergedTree = true).assertTextEquals("Loading…")
    }

    @Test
    fun aFirstPageWaits200msBeforeLoadingAndNeverSpins() {
        render(FeedUiState(loading = true))
        drawnAt(SLOW_MS - 1)
        count(LOADING).assertCountEquals(0)
        noEmptyLine()
        spinners().assertCountEquals(0)
        theWaitEnds()
        loadingReads()
        noEmptyLine()
        spinners().assertCountEquals(0)
    }

    @Test
    fun aFirstPageAnsweredInTimeNeverShowsLoading() {
        render(FeedUiState(loading = true))
        drawnAt(SLOW_MS / 2)
        hand(FeedUiState(loading = false, posts = listOf(testPost("p1"))))
        drawnAt(SLOW_MS)
        count(LOADING).assertCountEquals(0)
        spinners().assertCountEquals(0)
        count("feed.card:p1").assertCountEquals(1)
    }

    @Test
    fun theLoadingLineGoesWhenThePageArrives() {
        render(FeedUiState(loading = true))
        drawnAt(SLOW_MS - 1)
        theWaitEnds()
        loadingReads()
        hand(FeedUiState(loading = false, posts = listOf(testPost("p1"))))
        count(LOADING).assertCountEquals(0)
        count("feed.card:p1").assertCountEquals(1)
    }

    @Test
    fun aRetriedFirstPageTimesItsOwnWait() {
        render(FeedUiState(loading = false, transportFault = TransportFault.REFRESH))
        frame()
        count("feed_transport_error").assertCountEquals(1)
        compose.onNodeWithTag("feed_retry").performClick()
        assertThat(refreshed).isEqualTo(1)
        // The view model asks again: `loading` goes up, the old fault still held.
        upTo(SLOW_MS - 50)
        hand(state.copy(loading = true))
        count("feed_transport_error").assertCountEquals(0)
        // The with-content line and its Retry never stand over a page not yet in.
        count("feed_transport_banner").assertCountEquals(0)
        count("feed_retry").assertCountEquals(0)
        drawnAt(SLOW_MS / 2)
        count(LOADING).assertCountEquals(0)
        noEmptyLine()
        drawnAt(SLOW_MS / 2 + FRAME_MS)
        loadingReads()
        spinners().assertCountEquals(0)
        count("feed_transport_banner").assertCountEquals(0)
        count("feed_retry").assertCountEquals(0)

        // The retry fails again: the no-cards fault is back as it was.
        hand(state.copy(loading = false))
        count("feed_transport_error").assertCountEquals(1)
        count("feed_retry").assertCountEquals(1)
        count("feed_transport_banner").assertCountEquals(0)
        count(LOADING).assertCountEquals(0)
    }

    @Test
    fun aPullStillAnswersWithItsOwnSpinner() {
        render(FeedUiState(loading = false, posts = listOf(testPost("p1"))), onRefresh = {
            refreshed++
            state = state.copy(loading = true)
        })
        compose.mainClock.autoAdvance = true
        compose.onNodeWithTag("feed_list").performTouchInput { swipeDown() }
        compose.waitForIdle()
        assertThat(refreshed).isEqualTo(1)
        assertThat(spinners().fetchSemanticsNodes()).isNotEmpty()
        // A page on screen keeps its cards; the ladder is the first page's alone.
        count(LOADING).assertCountEquals(0)
    }

    private companion object {
        const val FRAME_MS = 16L
        const val SLOW_MS = 200L
        const val LOADING = "feed_first_page_loading"
    }
}
