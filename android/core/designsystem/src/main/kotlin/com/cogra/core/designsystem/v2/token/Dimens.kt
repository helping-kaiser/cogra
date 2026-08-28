package com.cogra.core.designsystem.v2.token

import androidx.compose.ui.unit.dp

/**
 * The 4dp base grid and the layout constants the clients actually use
 * (`design/tokens/spacing.css`, design.md §4).
 *
 * These are the values the canvas boards are drawn on, read off
 * `design/designs/canonical/Compose*.dc.html` rather than guessed: the
 * wizard header's 48dp band, its 12dp side padding, the 24dp screen
 * gutter every wizard body uses, and the 48dp thumbnail every picked-media
 * row is built from.
 *
 * Radii are deliberately absent: the five rungs of `design/tokens/shape.css`
 * (4 / 8 / 12 / 16 / 28) are Material 3's own `Shapes()` defaults, so a 2.0
 * component reads `MaterialTheme.shapes` and no second scale exists to drift
 * from it. The pill is `CircleShape`.
 */
object Space {
    val x1 = 4.dp
    val x2 = 8.dp
    val x3 = 12.dp
    val x4 = 16.dp
    val x5 = 20.dp
    val x6 = 24.dp
    val x8 = 32.dp
    val x10 = 40.dp
    val x12 = 48.dp
}

/**
 * Layout constants, each one traceable to a board or to `spacing.css`.
 *
 * [TouchTargetMin] is the floor design/readme.md §10 sets for every control
 * and is enforced by hit area rather than by drawn height — a chip draws 32dp
 * and taps 48dp.
 */
object Layout {
    /** The screen gutter every wizard body uses: `padding: … 24px`. */
    val ScreenGutter = Space.x6

    /** The small top app bar's band, and the wizard header's height. */
    val TopBarHeight = 48.dp

    /** The wizard header's own side padding — narrower than the gutter. */
    val TopBarPadding = Space.x3

    /** The short navigation bar. */
    val BottomBarHeight = 64.dp

    /** design/readme.md §10 — never below this, the stance control included. */
    val TouchTargetMin = 48.dp

    /** A filled or outlined pill's true height (design/readme.md §13). */
    val ButtonHeight = 40.dp

    /** A pill's side padding at the default size. */
    val ButtonPadding = Space.x6

    /** Every pill, at every size, clears this (design/readme.md §13). */
    val ButtonMinWidth = 64.dp

    /** A header pill renders compact (design/readme.md §13). */
    val ButtonHeightCompact = 32.dp

    /** The compact pill's side padding, read off the canvas's `Next`. */
    val ButtonPaddingCompact = Space.x4

    /** A chip's drawn height; it still taps at [TouchTargetMin]. */
    val ChipHeight = 32.dp

    /** A text field's drawn minimum, read off `ComposeDetails`. */
    val FieldHeight = 44.dp

    /** The square thumbnail the picked tray, the filmstrip and details share. */
    val ThumbSize = 48.dp
}
