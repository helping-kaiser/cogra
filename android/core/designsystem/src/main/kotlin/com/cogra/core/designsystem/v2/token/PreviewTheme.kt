package com.cogra.core.designsystem.v2.token

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * A theme for `@Preview` and for this module's own Robolectric tests — **not**
 * for production screens, which keep using `:app`'s `CograTheme`.
 *
 * Why it exists: the app theme lives in `:app`, and `:app` depends on this
 * module rather than the other way round, so nothing here can wrap itself in
 * `CograTheme`. Without a local theme, every 2.0 preview would render on
 * Material's stock purple baseline and the canvas-versus-Compose comparison
 * this layer exists to make reviewable would be worthless.
 *
 * Why duplicating the palette is safe: these values are not a second opinion
 * about the colour, they are a second *reader* of the one contract. The
 * repo-root `design-tokens.json` is that contract, `:app`'s `ColorSchemeTest`
 * pins the app theme to it, and `PreviewThemeTokensTest` in this module pins
 * these to the same file. A drift fails a test rather than reaching a screen.
 *
 * The right end state is the theme moving down into this module, which is the
 * structure Android's own architecture guidance uses. That is a migration of
 * shipped code, so it belongs in its own pass rather than in the 2.0 build.
 *
 * Typography is deliberately *not* reproduced: Figtree is bundled in `:app`'s
 * resources, so a preview here renders the M3 scale in the platform family.
 * Sizes, weights and spacing are the scale's own and therefore truthful; only
 * the face differs from a device.
 */
@Composable
fun Cogra2PreviewTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) PreviewDarkColors else PreviewLightColors,
        content = content,
    )
}

internal val PreviewLightColors = lightColorScheme(
    primary = Color(0xFF9F4100),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFEF6C1A),
    onPrimaryContainer = Color(0xFF4F1D00),
    inversePrimary = Color(0xFFFFB692),
    secondary = Color(0xFF8E4D2B),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFFEAA81),
    onSecondaryContainer = Color(0xFF783C1C),
    tertiary = Color(0xFF666000),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFB7AF26),
    onTertiaryContainer = Color(0xFF454100),
    background = Color(0xFFFFF8F6),
    onBackground = Color(0xFF251913),
    surface = Color(0xFFFFF8F6),
    onSurface = Color(0xFF251913),
    surfaceVariant = Color(0xFFFDDCCD),
    onSurfaceVariant = Color(0xFF584237),
    surfaceTint = Color(0xFF9F4100),
    inverseSurface = Color(0xFF3B2D27),
    inverseOnSurface = Color(0xFFFFEDE6),
    error = Color(0xFFA5004A),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFFD9DF),
    onErrorContainer = Color(0xFF8F003F),
    outline = Color(0xFF8C7165),
    outlineVariant = Color(0xFFE0C0B2),
    scrim = Color(0xFF000000),
    surfaceBright = Color(0xFFFFF8F6),
    surfaceDim = Color(0xFFEDD5CB),
    surfaceContainer = Color(0xFFFFEAE1),
    surfaceContainerHigh = Color(0xFFFBE3D9),
    surfaceContainerHighest = Color(0xFFF5DED4),
    surfaceContainerLow = Color(0xFFFFF1EB),
    surfaceContainerLowest = Color(0xFFFFFFFF),
)

internal val PreviewDarkColors = darkColorScheme(
    primary = Color(0xFFFF8D50),
    onPrimary = Color(0xFF341100),
    primaryContainer = Color(0xFFEF6C1A),
    onPrimaryContainer = Color(0xFF4F1D00),
    inversePrimary = Color(0xFF9F4100),
    secondary = Color(0xFFFFB692),
    onSecondary = Color(0xFF542103),
    secondaryContainer = Color(0xFF743918),
    onSecondaryContainer = Color(0xFFF8A57B),
    tertiary = Color(0xFFD3CB42),
    onTertiary = Color(0xFF343200),
    tertiaryContainer = Color(0xFFB7AF26),
    onTertiaryContainer = Color(0xFF454100),
    background = Color(0xFF151312),
    onBackground = Color(0xFFE8E1DF),
    surface = Color(0xFF151312),
    onSurface = Color(0xFFE8E1DF),
    surfaceVariant = Color(0xFF4B4644),
    onSurfaceVariant = Color(0xFFCDC5C2),
    surfaceTint = Color(0xFFFF8D50),
    inverseSurface = Color(0xFFE8E1DF),
    inverseOnSurface = Color(0xFF33302F),
    error = Color(0xFFFF6B95),
    onError = Color(0xFF66002B),
    errorContainer = Color(0xFF8F003F),
    onErrorContainer = Color(0xFFFFD9DF),
    outline = Color(0xFF968F8D),
    outlineVariant = Color(0xFF4B4644),
    scrim = Color(0xFF000000),
    surfaceBright = Color(0xFF3C3837),
    surfaceDim = Color(0xFF151312),
    surfaceContainer = Color(0xFF221F1E),
    surfaceContainerHigh = Color(0xFF2C2928),
    surfaceContainerHighest = Color(0xFF373433),
    surfaceContainerLow = Color(0xFF1E1B1A),
    surfaceContainerLowest = Color(0xFF100E0D),
)
