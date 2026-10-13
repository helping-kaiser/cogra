package com.cogra.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/*
 * THE SYSTEM-BAR LAW (PR-56, seam 169; it replaces the 2026-10-09 ruling that
 * kept the bar the system's): the app is edge to edge and the status bar is
 * transparent, so the strip IS the app's own ground — no second colour to
 * maintain — and nothing the app lays out collides with it.
 *
 * - Edge to edge comes from `enableEdgeToEdge()` alone (developer.android.com,
 *   "Display content edge-to-edge in views"); the Material theme XML carries no
 *   `statusBarColor`, `windowLightStatusBar` or contrast attribute, because
 *   theme XML fights the API. Targeting SDK 35+ makes the window edge-to-edge
 *   and `statusBarColor` has no effect there anyway.
 * - The ground under the bar is [StatusBarClearance]'s: it paints the theme's
 *   `background` over the whole window and pads its content below the bar's
 *   inset, consuming it, so no screen re-pads it.
 * - The ICONS follow the theme the APP paints, never the system's: a light
 *   ground wears dark icons, a dark ground light ones, re-asserted on every
 *   app-theme change (core:designsystem `SystemBarOwner`, the one owner,
 *   mounted at the theme root in `MainActivity`).
 * - TOP-MOST SURFACE: a surface that paints a dark ground of its own under the
 *   bar (the reel stream) declares `BarGround.ForcedDark`
 *   while it is up; the app theme's reading returns when it leaves. It neither
 *   paints nor hides the bar, and immersive mode stays unused.
 * - The navigation bar rides the same call and stays app-themed.
 *
 * Every separate window (dialogs, sheets, the media viewer) is outside this
 * box. The media viewer, which draws edge to edge, stops its black below the
 * bar and its window leaves the strip undimmed, with the app window's icon
 * reading (core:designsystem `MediaViewer`, q-fx1a).
 */

/**
 * The app's root: paints the theme's ground over the whole window, so the
 * status bar's strip shows it, and lays [content] out below the bar.
 * [insets] is the status bar's; a test states one.
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
            .background(MaterialTheme.colorScheme.background)
            .windowInsetsPadding(insets),
    ) {
        content()
    }
}
