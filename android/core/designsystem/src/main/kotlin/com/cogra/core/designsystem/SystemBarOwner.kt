package com.cogra.core.designsystem

import android.content.Context
import android.content.ContextWrapper
import android.graphics.Color
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/*
 * THE SYSTEM-BAR APPEARANCE LAW (PR-56, seams 169 + 171): the status bar is
 * transparent and the surface under it paints its own ground, so what keeps the
 * clock and battery legible is the ICON colour — keyed to the theme the APP is
 * painting, never the system's. An app set to Light on a dark phone would
 * otherwise draw white icons on white.
 *
 * ONE OWNER. This file holds the only call that touches the window's bar
 * appearance, from the one effect in [SystemBarOwner] at the theme root. A
 * surface never touches the window: it DECLARES a [BarGround]
 * ([DeclareBarGround]), the owner takes the top-most declaration (or the app
 * theme's ground when there is none), and `SystemBarGroundMap.kt` maps that
 * ground to icons. Leaving the declaration's scope is the whole of "restoring".
 * `SystemBarOwnershipTest` pins the single call site.
 *
 * The mechanism is the one Android's own sample app (Now in Android,
 * `MainActivity`) ships: `enableEdgeToEdge(statusBarStyle, navigationBarStyle)`
 * with `SystemBarStyle.auto(...) { dark }`, called again whenever the style
 * changes (developer.android.com, "Display content edge-to-edge in views";
 * `SystemBarStyle` reference). `enableEdgeToEdge` is also what makes the bars
 * transparent, so appearance is not fought from theme XML. The reel stream
 * neither paints nor hides the bar; immersive stays unused.
 */

/** A declared ground; compared by identity so two surfaces can declare the same one. */
private class Declaration(val ground: BarGround)

private class Declarations {
    val stack = mutableStateListOf<Declaration>()
}

private val LocalDeclarations = compositionLocalOf<Declarations?> { null }

/**
 * Installs the window's edge-to-edge before the first frame, under the system's
 * theme; [SystemBarOwner] asserts the app theme's appearance the moment it
 * composes. Called once, from the activity's `onCreate`.
 */
fun ComponentActivity.installEdgeToEdge() {
    enableEdgeToEdge()
}

/**
 * The theme root's owner of the system bars' appearance. [appGround] is the
 * theme the app is painting — [BarGround.AppLight] or [BarGround.AppDark], the
 * reader's pick, not the system's. Re-asserted on every change of it and of the
 * surfaces' declarations.
 */
@Composable
fun SystemBarOwner(appGround: BarGround, content: @Composable () -> Unit) {
    val declarations = remember { Declarations() }
    val activity = LocalContext.current.componentActivity()
    val appearance = barAppearanceFor(
        top = declarations.stack.lastOrNull()?.ground ?: appGround,
        app = appGround,
    )
    if (activity != null) {
        DisposableEffect(activity, appearance) {
            activity.enableEdgeToEdge(
                statusBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) {
                    appearance.lightStatusIcons
                },
                navigationBarStyle = SystemBarStyle.auto(NAV_LIGHT_SCRIM, NAV_DARK_SCRIM) {
                    appearance.lightNavigationIcons
                },
            )
            onDispose {}
        }
    }
    CompositionLocalProvider(LocalDeclarations provides declarations, content = content)
}

/**
 * Declares the ground this surface paints under the status bar, for as long as
 * it is in the composition; the top-most declaration wins and the app theme's
 * ground returns when it leaves. It declares — it paints and hides nothing. A
 * no-op outside a [SystemBarOwner].
 */
@Composable
fun DeclareBarGround(ground: BarGround) {
    val declarations = LocalDeclarations.current
    DisposableEffect(declarations, ground) {
        val declaration = Declaration(ground)
        declarations?.stack?.add(declaration)
        onDispose { declarations?.stack?.remove(declaration) }
    }
}

private fun Context.componentActivity(): ComponentActivity? {
    var context = this
    while (context is ContextWrapper) {
        if (context is ComponentActivity) return context
        context = context.baseContext
    }
    return null
}

// The 3-button navigation bar's scrim, the values `enableEdgeToEdge()` itself
// defaults to (androidx.activity `EdgeToEdge`) — stated here because they are
// private there and a styled call must name both.
private val NAV_LIGHT_SCRIM = Color.argb(0xe6, 0xFF, 0xFF, 0xFF)
private val NAV_DARK_SCRIM = Color.argb(0x80, 0x1b, 0x1b, 0x1b)
