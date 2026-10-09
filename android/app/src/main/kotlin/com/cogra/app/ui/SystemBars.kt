package com.cogra.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/*
 * THE SYSTEM-BAR LAW (jakob 2026-10-09, a standing ruling): the app never
 * colours or touches the system status bar — the clock, the battery, the
 * notifications. Not on a theme change, not on any surface, ever; every
 * surface to come inherits it from here.
 *
 * Targeting SDK 35+ makes the window edge-to-edge and the status bar
 * transparent, and `statusBarColor` no longer has any effect
 * (developer.android.com, "Behavior changes: Apps targeting Android 15",
 * edge-to-edge enforcement), so the bar shows whatever the app draws behind
 * it. Before this, the shell's own surface reached under the bar, and a
 * theme picked in Settings repainted it.
 *
 * So the two halves of the bar are handed to the system:
 * - its ICONS follow the system's own light or dark theme — what
 *   `enableEdgeToEdge()` does by default ("The colors of the system icons
 *   and the scrim are adjusted based on the system light or dark theme",
 *   developer.android.com, "Display content edge-to-edge in views"), and
 *   never the theme chosen in Settings, which the app paints only inside
 *   its own content;
 * - its GROUND is the window's background, which follows the system theme
 *   through `values/` and `values-night/` (`themes.xml`), because no app
 *   surface is ever laid out under the bar: [StatusBarClearance] pads the
 *   whole app below it and consumes the inset, so no screen re-pads it.
 *
 * Every separate window (dialogs, sheets, the media viewer) is outside this
 * box; what each does with the bar is in the system-bar audit, not here.
 */

/**
 * The app's root: lays [content] out below the status bar and leaves the
 * bar's own strip undrawn. [insets] is the status bar's; a test states one.
 */
@Composable
fun StatusBarClearance(
    modifier: Modifier = Modifier,
    insets: WindowInsets = WindowInsets.statusBars,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .windowInsetsPadding(insets),
    ) {
        content()
    }
}
