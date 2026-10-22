// GEEK MODE — "One markup, two paintings" (design/readme.md §13, *Geek
// mode*). Every master draws the glyph AND the number; the number sits in a
// `cg-exact` span that paints only while the reader has turned on Settings'
// `Show exact values` (Settings.md:31-33 — a switch in the Reading group,
// kept on this device, off by default). Nothing spoken depends on the mode:
// every hidden number keeps its screen-reader twin, so an accessible name is
// the same in both paintings.
//
// The Compose twin of the screen root's `data-geek="on"` is this
// CompositionLocal: the activity provides the device preference once, and a
// readout asks it whether to paint its pair. The house precedent for a
// reading preference that every surface honours without threading it
// through is `LocalAlwaysUnveil`.

package com.cogra.core.designsystem

import androidx.compose.runtime.compositionLocalOf

/**
 * Whether the reader asked for exact values (`data-geek="on"`). False by
 * default — glyph-first is the product's default reading — so a preview, a
 * test or a host that provides nothing paints faces alone.
 */
val LocalShowExactValues = compositionLocalOf { false }
