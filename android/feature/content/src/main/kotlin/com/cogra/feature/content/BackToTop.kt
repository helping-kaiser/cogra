// BACK TO TOP — the feed's way out of a long scroll (FeedScrolled.md;
// design/components/navigation/BackToTop.jsx; jakob 2026-09-14), and the bar's
// re-tap rungs of the feed's ladder (Feed.md:81-91).
//
// IT RIDES THE RETURNING BAND. The pill appears WITH the collapsing top — the
// same upward scroll that summons the band summons this — but only from three
// viewport-heights down or deeper, centred directly under the band. It takes no
// layout space (an overlay, never part of the bar's collapsing block, whose
// height decides when it collapses) and it slides out under the band, which is
// drawn above it, never over it.
//
// GOING UP NEVER REFRESHES. The pill and a re-tap of the bar's Feed slot from a
// scrolled root both take the list to the top, animated, and nothing else. Only
// a re-tap with the root already at its top refreshes — the feed's other
// refresh route beside the pull (Feed.md:87-91).

package com.cogra.feature.content

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.RootReselectEffect
import com.cogra.core.designsystem.v2.token.Space
import kotlinx.coroutines.launch

/** How deep, in viewport-heights, a summoned band brings the pill (FeedScrolled.md:3-5). */
internal const val BACK_TO_TOP_DEPTH = 3

/**
 * How far down the list stands, in pixels. A lazy list knows only the items
 * it has laid out, so the rows above are counted at the average height of
 * the ones on screen — close enough to tell three screens from two.
 */
internal fun LazyListState.estimatedDepth(): Float {
    val visible = layoutInfo.visibleItemsInfo
    if (visible.isEmpty()) return 0f
    val average = visible.sumOf { it.size }.toFloat() / visible.size
    return firstVisibleItemIndex * average + firstVisibleItemScrollOffset
}

/** Whether the list stands three viewport-heights down or deeper. */
internal fun LazyListState.isBackToTopDeep(): Boolean =
    estimatedDepth() >= BACK_TO_TOP_DEPTH * layoutInfo.viewportSize.height

/** Whether the list rests at its hard top. */
internal fun LazyListState.atHardTop(): Boolean = firstVisibleItemIndex == 0 && firstVisibleItemScrollOffset == 0

/**
 * The pill, over the top of the feed's list. [bandShown] is the collapsing
 * top's own state: the pill is decided as the band is summoned — deep enough
 * or not — and stays until the band leaves or the list is back at its hard
 * top, where there is nothing left to go up to.
 */
@Composable
internal fun FeedBackToTop(bandShown: Boolean, listState: LazyListState, modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    var summonedDeep by remember { mutableStateOf(false) }
    LaunchedEffect(bandShown, listState) { summonedDeep = bandShown && listState.isBackToTopDeep() }
    val atTop by remember(listState) { derivedStateOf { listState.atHardTop() } }
    AnimatedVisibility(
        visible = summonedDeep && !atTop,
        modifier = modifier,
        // In and out through the band's own edge: it leaves UNDER the band.
        enter = slideInVertically { height -> -height },
        exit = slideOutVertically { height -> -height },
    ) {
        BackToTopPill(onClick = { scope.launch { listState.animateScrollToItem(0) } })
    }
}

/**
 * PLAIN WORDS ON THE TONAL GROUND (`BackToTop.jsx`): it commits nothing, so it
 * is not `primary`; the lift is `surfaceContainerHighest`, the pill shape every
 * button wears, 32dp of ink inside the 48dp target.
 */
@Composable
private fun BackToTopPill(onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = MaterialTheme.colorScheme.surfaceContainerHighest,
        contentColor = MaterialTheme.colorScheme.onSurface,
        modifier = Modifier
            .padding(top = Space.x2)
            .testTag(BACK_TO_TOP_TAG),
    ) {
        Text(
            text = stringResource(R.string.content_back_to_top),
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier
                .defaultMinSize(minWidth = 64.dp, minHeight = 32.dp)
                .padding(horizontal = Space.x4, vertical = 6.dp),
        )
    }
}

/** The pill's tag: FeedScrolled is not a registered board yet. */
internal const val BACK_TO_TOP_TAG = "feed_back_to_top"

/**
 * THE BAR'S RE-TAP OVER THE FEED'S ROOT (Feed.md:81-91). [signal] counts the
 * shell's re-taps; each one this screen has not answered yet takes a scrolled
 * root to its top, animated and never refreshing (FeedScrolled.md:13), and
 * refreshes a root already at its top (Feed.md:87). The count already standing
 * when the feed is composed is not a tap to answer — a feed coming back from
 * another tab is not being re-tapped.
 */
@Composable
internal fun FeedReselectEffect(signal: Int, listState: LazyListState, onRefresh: () -> Unit) {
    RootReselectEffect(signal = signal, list = listState, onAtTop = onRefresh)
}
