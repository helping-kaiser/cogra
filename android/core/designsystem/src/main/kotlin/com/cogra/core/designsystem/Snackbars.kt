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

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.compositionLocalOf

val LocalSnackbarHostState = compositionLocalOf<SnackbarHostState?> { null }
