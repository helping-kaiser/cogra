// The bar's re-tap over a tab's root: the last two rungs of the ladder
// (design/readme.md §13 "The bottom bar's re-tap ladder"), which every
// scrolling tab root climbs the same way.

package com.cogra.core.designsystem

import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue

/**
 * Answers the bar's re-taps over a tab's root. [signal] counts the shell's
 * re-taps; each one this root has not answered yet takes a scrolled [list]
 * to its top, animated — travel over a list the reader still owns, never a
 * reload — and, with the list already at its top, hands over to [onAtTop]:
 * the feed refreshes there, and Explore, the wallet and the profile do
 * nothing, having nothing the reader is waiting on.
 *
 * The count already standing when the root is composed is not a tap to
 * answer: a root coming back from another tab is not being re-tapped.
 */
@Composable
fun RootReselectEffect(signal: Int, list: LazyListState, onAtTop: () -> Unit = {}) {
    var answered by rememberSaveable { mutableIntStateOf(signal) }
    LaunchedEffect(signal) {
        if (signal == answered) return@LaunchedEffect
        answered = signal
        if (list.firstVisibleItemIndex == 0 && list.firstVisibleItemScrollOffset == 0) {
            onAtTop()
        } else {
            list.animateScrollToItem(0)
        }
    }
}
