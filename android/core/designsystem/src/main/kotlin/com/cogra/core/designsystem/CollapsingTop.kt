package com.cogra.core.designsystem

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.TopAppBarScrollBehavior
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * The screen's collapsing top (design.md §6): the bar (and any banner
 * riding [showTop]) leaves with the flow scrolling down, and returns
 * only after about a third of a screen of accumulated upward scroll —
 * a short correction toward a post's top summons nothing. Any downward
 * scroll resets the tally.
 *
 * Reaching the top reveals regardless of the tally: upward scroll the
 * list could not consume means it sits at its boundary, and a reader
 * at the top always gets the header.
 *
 * M3's `enterAlways` re-enters on the first upward pixel, so the gate
 * holds the bar's `canScroll` closed until the tally crosses the
 * threshold; hiding stays fully stock. The gate observes and never
 * consumes — the reader's scroll reaches the list untouched.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Stable
class CollapsingTop internal constructor(
    val scrollBehavior: TopAppBarScrollBehavior,
    internal val gate: NestedScrollConnection,
    private val showTopState: State<Boolean>,
) {
    /** Whether a banner riding the top region is visible. */
    val showTop: Boolean get() = showTopState.value
}

/**
 * Wires a [CollapsingTop] onto the screen's scroll chain. The gate
 * sits outside the bar's own connection: `enterAlways` consumes every
 * vertical delta while the bar moves, so an inner observer would go
 * blind exactly when the direction matters.
 */
@OptIn(ExperimentalMaterial3Api::class)
fun Modifier.collapsingTop(top: CollapsingTop): Modifier =
    nestedScroll(top.gate).nestedScroll(top.scrollBehavior.nestedScrollConnection)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun rememberCollapsingTop(): CollapsingTop {
    val threshold = LocalWindowInfo.current.containerSize.height / REVEAL_FRACTION
    val showTop = remember { mutableStateOf(true) }
    val barMayMove = remember { mutableStateOf(true) }
    val gate = remember(threshold) {
        object : NestedScrollConnection {
            var upRun = 0f
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                val dy = available.y
                if (dy < -SCROLL_JITTER) {
                    upRun = 0f
                    barMayMove.value = true
                    showTop.value = false
                } else if (dy > SCROLL_JITTER) {
                    upRun += dy
                    if (upRun >= threshold) {
                        barMayMove.value = true
                        showTop.value = true
                    } else if (!showTop.value) {
                        barMayMove.value = false
                    }
                }
                return Offset.Zero
            }

            override fun onPostScroll(
                consumed: Offset,
                available: Offset,
                source: NestedScrollSource,
            ): Offset {
                // Unconsumed upward scroll: the list is at its top.
                if (available.y > SCROLL_JITTER) {
                    barMayMove.value = true
                    showTop.value = true
                }
                return Offset.Zero
            }
        }
    }
    val scrollBehavior = TopAppBarDefaults.enterAlwaysScrollBehavior(
        canScroll = { barMayMove.value },
    )
    return remember(scrollBehavior, gate) { CollapsingTop(scrollBehavior, gate, showTop) }
}

/**
 * The banner strip under the top app bar: hosts whatever card rides
 * the collapsing top. Painted `surface` across the full width like the
 * bar above it, so the collapsing region reads as one opaque plane
 * (design.md §6) — content scrolling under is cut by one straight
 * edge instead of showing through the card's margins and corners.
 */
@Composable
fun CollapsingTopBanner(
    top: CollapsingTop,
    horizontalPadding: Dp = 16.dp,
    content: @Composable () -> Unit,
) {
    AnimatedVisibility(visible = top.showTop) {
        Box(
            Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .padding(horizontal = horizontalPadding),
        ) {
            content()
        }
    }
}

/** Reveal after this fraction of the window height, scrolled upward. */
private const val REVEAL_FRACTION = 3f

/** Deltas below this are touch jitter, not a direction. */
private const val SCROLL_JITTER = 4f
