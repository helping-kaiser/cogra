// The surface's transient-confirmation host, as an ambient.
//
// android/CLAUDE.md: a completed action confirms through a Snackbar on
// the Scaffold's own `SnackbarHostState`. Most components get that state
// as a parameter, and should. The stance control cannot: it is a leaf
// inside a post card inside a feed, dropped in through a slot, and
// threading a host through every intermediate composable would put a
// snackbar in the API of components that have nothing to do with one —
// which is the case Compose documents a CompositionLocal for.
//
// The default is null rather than a spare host, because a host nobody
// renders would swallow confirmations silently. A surface that shows
// stance controls provides its Scaffold's host; a preview or a test that
// does not simply gets no snackbar.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarData
import androidx.compose.material3.SnackbarDefaults
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

val LocalSnackbarHostState = compositionLocalOf<SnackbarHostState?> { null }

/**
 * The app's snackbar host.
 *
 * `design/readme.md` §4: "Elevation is **tonal** … There are no drop shadows
 * in the product — a snackbar lifts off the page with `inverseSurface`, not a
 * shadow." Material's [Snackbar] already wears `inverseSurface`, the
 * extra-small corner and `bodyMedium` — but it also wears a 6dp *shadow* it
 * reads from its own tokens, and it exposes no elevation parameter. So the
 * drawing is a [Surface] of our own with `shadowElevation = 0.dp`, in the
 * content slot [SnackbarHost] provides for exactly this. Every colour, shape
 * and metric is still Material's or the master's; the shadow is the only
 * thing that changes.
 */
@Composable
fun CograSnackbarHost(
    hostState: SnackbarHostState,
    modifier: Modifier = Modifier,
    testTag: String? = null,
) {
    SnackbarHost(hostState, modifier) { data -> CograSnackbar(data, testTag) }
}

@Composable
fun CograSnackbar(data: SnackbarData, testTag: String? = null) {
    Surface(
        modifier = (if (testTag != null) Modifier.testTag(testTag) else Modifier)
            .padding(12.dp),
        shape = SnackbarDefaults.shape,
        color = SnackbarDefaults.color,
        contentColor = SnackbarDefaults.contentColor,
        // The whole point (design/readme.md §4).
        shadowElevation = 0.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = data.visuals.message,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f, fill = false),
            )
            data.visuals.actionLabel?.let { label ->
                TextButton(
                    onClick = { data.performAction() },
                    modifier = Modifier.testTag(
                        testTag?.let { "${it}_action" } ?: "snackbar_action",
                    ),
                ) {
                    Text(label, color = SnackbarDefaults.actionContentColor)
                }
            }
            if (data.visuals.withDismissAction) {
                IconButton(
                    onClick = { data.dismiss() },
                    modifier = Modifier.testTag(
                        testTag?.let { "${it}_dismiss" } ?: "snackbar_dismiss",
                    ),
                ) {
                    Icon(
                        Icons.Filled.Close,
                        contentDescription = null,
                        tint = SnackbarDefaults.dismissActionContentColor,
                    )
                }
            }
        }
    }
}
