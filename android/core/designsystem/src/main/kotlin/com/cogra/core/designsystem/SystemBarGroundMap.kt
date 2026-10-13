package com.cogra.core.designsystem

/**
 * THE ONE PLACE A GROUND BECOMES A SYSTEM-BAR APPEARANCE. Every later change to
 * what the bars look like (the reel going immersive, a different keying, a
 * tinted strip) is an edit to [barAppearanceFor] and nowhere else: surfaces only
 * declare a [BarGround], and the single owner ([SystemBarOwner]) applies what
 * this maps it to.
 */
enum class BarGround {
    /** The app paints its light theme under the bar. */
    AppLight,

    /** The app paints its dark theme under the bar. */
    AppDark,

    /** A surface that paints a dark ground of its own whatever the app theme is (the reel stream). */
    ForcedDark,
}

/**
 * What the bars wear. "Light" icons are the pale ones a dark ground needs — the
 * opposite of the platform's `isAppearanceLight…` flag, which names the
 * ground, not the icon.
 */
data class BarAppearance(val lightStatusIcons: Boolean, val lightNavigationIcons: Boolean)

/**
 * [top] is the ground of the surface under the status bar; [app] is the app
 * theme's. The navigation bar stays app-themed under every top surface.
 */
fun barAppearanceFor(top: BarGround, app: BarGround): BarAppearance = BarAppearance(
    lightStatusIcons = top.hasDarkGround(),
    lightNavigationIcons = app.hasDarkGround(),
)

private fun BarGround.hasDarkGround(): Boolean = this != BarGround.AppLight
