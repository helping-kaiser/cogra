package com.cogra.core.designsystem

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.unit.dp
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class CollapsingTopTest {

    @get:Rule
    val compose = createComposeRule()

    @OptIn(ExperimentalMaterial3Api::class)
    private fun renderTop() {
        compose.setContent {
            val top = rememberCollapsingTop()
            Column(
                Modifier
                    .fillMaxSize()
                    .collapsingTop(top),
            ) {
                // A real bar, as on every screen: it sets the finite
                // height-offset limit the enterAlways state consumes
                // against — without it the bar state would swallow all
                // downward scroll and the list would never move.
                TopAppBar(title = {}, scrollBehavior = top.scrollBehavior)
                AnimatedVisibility(visible = top.showTop) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("top_region"),
                    )
                }
                LazyColumn(
                    Modifier
                        .fillMaxSize()
                        .testTag("list"),
                ) {
                    items(50) {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(80.dp),
                        )
                    }
                }
            }
        }
    }

    /** A held drag: per-frame deltas clear the jitter bar, no fling. */
    private fun dragUpBy(px: Float) {
        compose.onNodeWithTag("list").performTouchInput {
            down(center)
            moveBy(Offset(0f, px))
            advanceEventTime(250)
            up()
        }
    }

    @Test
    fun theTopReturnsOnlyAfterAThirdOfAScreenUpward() {
        renderTop()
        compose.onNodeWithTag("top_region").assertExists()
        compose.onNodeWithTag("list").performTouchInput { swipeUp() }
        compose.onNodeWithTag("top_region").assertDoesNotExist()

        // A short correction toward a post's top summons nothing.
        dragUpBy(30f)
        compose.onNodeWithTag("top_region").assertDoesNotExist()

        // The tally accumulates across gestures; a third of the window
        // (Robolectric: 470px tall, so ~157px) crosses the gate.
        dragUpBy(80f)
        dragUpBy(80f)
        dragUpBy(80f)
        compose.onNodeWithTag("top_region").assertExists()
    }

    @Test
    fun reachingTheTopRevealsWithoutTheTally() {
        renderTop()
        // A short hop down from the top hides the region…
        compose.onNodeWithTag("list").performTouchInput {
            down(center)
            moveBy(Offset(0f, -60f))
            advanceEventTime(250)
            up()
        }
        compose.onNodeWithTag("top_region").assertDoesNotExist()
        // …and scrolling back to the top reveals it even though the
        // run (~90px) stays far below the third-of-a-screen gate: the
        // list stops consuming at its boundary, and that leftover is
        // the signal.
        dragUpBy(100f)
        compose.onNodeWithTag("top_region").assertExists()
    }

    /**
     * The same top, with a pull-to-refresh box in the chain — the
     * arrangement every read surface has. [gateOutside] puts the gate
     * above the box, the box between the gate and the list.
     */
    @OptIn(ExperimentalMaterial3Api::class)
    private fun renderTopWithRefreshBox(gateOutside: Boolean) {
        compose.setContent {
            val top = rememberCollapsingTop()
            Column(
                Modifier
                    .fillMaxSize()
                    .then(if (gateOutside) Modifier.collapsingTop(top) else Modifier),
            ) {
                TopAppBar(title = {}, scrollBehavior = top.scrollBehavior)
                AnimatedVisibility(visible = top.showTop) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("top_region"),
                    )
                }
                PullToRefreshBox(isRefreshing = false, onRefresh = {}) {
                    Box(
                        Modifier
                            .fillMaxSize()
                            .then(if (gateOutside) Modifier else Modifier.collapsingTop(top)),
                    ) {
                        LazyColumn(
                            Modifier
                                .fillMaxSize()
                                .testTag("list"),
                        ) {
                            items(50) {
                                Box(
                                    Modifier
                                        .fillMaxWidth()
                                        .height(80.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Where a screen has both, the gate belongs INSIDE the
    // pull-to-refresh box: the refresh gesture consumes the leftover
    // in its own post-scroll, so a gate above the box never sees it.
    @Test
    fun theGateReadsTheAtTopSignalFromInsideARefreshBox() {
        renderTopWithRefreshBox(gateOutside = false)
        compose.onNodeWithTag("list").performTouchInput {
            down(center)
            moveBy(Offset(0f, -60f))
            advanceEventTime(250)
            up()
        }
        compose.onNodeWithTag("top_region").assertDoesNotExist()
        dragUpBy(100f)
        compose.onNodeWithTag("top_region").assertExists()
    }

    // The failure that rule prevents: the top stays gone at the top of
    // the content, while the same drags feed the refresh gesture — a
    // re-read that reads as fired mid-scroll.
    @Test
    fun aRefreshBoxBelowTheGateSwallowsTheAtTopSignal() {
        renderTopWithRefreshBox(gateOutside = true)
        compose.onNodeWithTag("list").performTouchInput {
            down(center)
            moveBy(Offset(0f, -60f))
            advanceEventTime(250)
            up()
        }
        compose.onNodeWithTag("top_region").assertDoesNotExist()
        dragUpBy(100f)
        compose.onNodeWithTag("top_region").assertDoesNotExist()
    }

    // The shared banner slot rides the same gate the screens wire by
    // hand elsewhere: content shows with the top and leaves with it.
    @OptIn(ExperimentalMaterial3Api::class)
    @Test
    fun theBannerSlotHostsContentAndFollowsTheGate() {
        compose.setContent {
            val top = rememberCollapsingTop()
            Column(
                Modifier
                    .fillMaxSize()
                    .collapsingTop(top),
            ) {
                TopAppBar(title = {}, scrollBehavior = top.scrollBehavior)
                CollapsingTopBanner(top) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("banner"),
                    )
                }
                LazyColumn(
                    Modifier
                        .fillMaxSize()
                        .testTag("list"),
                ) {
                    items(50) {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(80.dp),
                        )
                    }
                }
            }
        }
        compose.onNodeWithTag("banner").assertExists()
        compose.onNodeWithTag("list").performTouchInput { swipeUp() }
        compose.onNodeWithTag("banner").assertDoesNotExist()
    }

    @Test
    fun aDownwardScrollResetsTheTally() {
        renderTop()
        compose.onNodeWithTag("list").performTouchInput { swipeUp() }
        compose.onNodeWithTag("top_region").assertDoesNotExist()

        dragUpBy(60f)
        dragUpBy(60f)
        // Partway to the gate — but a downward move starts over.
        compose.onNodeWithTag("list").performTouchInput {
            down(center)
            moveBy(Offset(0f, -30f))
            advanceEventTime(250)
            up()
        }
        dragUpBy(60f)
        compose.onNodeWithTag("top_region").assertDoesNotExist()
    }
}
