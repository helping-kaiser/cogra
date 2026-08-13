package com.cogra.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

internal val LightColors = lightColorScheme(
    primary = LightTokens.primary,
    onPrimary = LightTokens.onPrimary,
    primaryContainer = LightTokens.primaryContainer,
    onPrimaryContainer = LightTokens.onPrimaryContainer,
    inversePrimary = LightTokens.inversePrimary,
    secondary = LightTokens.secondary,
    onSecondary = LightTokens.onSecondary,
    secondaryContainer = LightTokens.secondaryContainer,
    onSecondaryContainer = LightTokens.onSecondaryContainer,
    tertiary = LightTokens.tertiary,
    onTertiary = LightTokens.onTertiary,
    tertiaryContainer = LightTokens.tertiaryContainer,
    onTertiaryContainer = LightTokens.onTertiaryContainer,
    background = LightTokens.background,
    onBackground = LightTokens.onBackground,
    surface = LightTokens.surface,
    onSurface = LightTokens.onSurface,
    surfaceVariant = LightTokens.surfaceVariant,
    onSurfaceVariant = LightTokens.onSurfaceVariant,
    surfaceTint = LightTokens.surfaceTint,
    inverseSurface = LightTokens.inverseSurface,
    inverseOnSurface = LightTokens.inverseOnSurface,
    error = LightTokens.error,
    onError = LightTokens.onError,
    errorContainer = LightTokens.errorContainer,
    onErrorContainer = LightTokens.onErrorContainer,
    outline = LightTokens.outline,
    outlineVariant = LightTokens.outlineVariant,
    scrim = LightTokens.scrim,
    surfaceBright = LightTokens.surfaceBright,
    surfaceDim = LightTokens.surfaceDim,
    surfaceContainer = LightTokens.surfaceContainer,
    surfaceContainerHigh = LightTokens.surfaceContainerHigh,
    surfaceContainerHighest = LightTokens.surfaceContainerHighest,
    surfaceContainerLow = LightTokens.surfaceContainerLow,
    surfaceContainerLowest = LightTokens.surfaceContainerLowest,
)

internal val DarkColors = darkColorScheme(
    primary = DarkTokens.primary,
    onPrimary = DarkTokens.onPrimary,
    primaryContainer = DarkTokens.primaryContainer,
    onPrimaryContainer = DarkTokens.onPrimaryContainer,
    inversePrimary = DarkTokens.inversePrimary,
    secondary = DarkTokens.secondary,
    onSecondary = DarkTokens.onSecondary,
    secondaryContainer = DarkTokens.secondaryContainer,
    onSecondaryContainer = DarkTokens.onSecondaryContainer,
    tertiary = DarkTokens.tertiary,
    onTertiary = DarkTokens.onTertiary,
    tertiaryContainer = DarkTokens.tertiaryContainer,
    onTertiaryContainer = DarkTokens.onTertiaryContainer,
    background = DarkTokens.background,
    onBackground = DarkTokens.onBackground,
    surface = DarkTokens.surface,
    onSurface = DarkTokens.onSurface,
    surfaceVariant = DarkTokens.surfaceVariant,
    onSurfaceVariant = DarkTokens.onSurfaceVariant,
    surfaceTint = DarkTokens.surfaceTint,
    inverseSurface = DarkTokens.inverseSurface,
    inverseOnSurface = DarkTokens.inverseOnSurface,
    error = DarkTokens.error,
    onError = DarkTokens.onError,
    errorContainer = DarkTokens.errorContainer,
    onErrorContainer = DarkTokens.onErrorContainer,
    outline = DarkTokens.outline,
    outlineVariant = DarkTokens.outlineVariant,
    scrim = DarkTokens.scrim,
    surfaceBright = DarkTokens.surfaceBright,
    surfaceDim = DarkTokens.surfaceDim,
    surfaceContainer = DarkTokens.surfaceContainer,
    surfaceContainerHigh = DarkTokens.surfaceContainerHigh,
    surfaceContainerHighest = DarkTokens.surfaceContainerHighest,
    surfaceContainerLow = DarkTokens.surfaceContainerLow,
    surfaceContainerLowest = DarkTokens.surfaceContainerLowest,
)

/**
 * The roles design.md §2.3 adds beyond Material's own set. `ColorScheme` has no
 * slot for them, so they ride the CompositionLocal pattern Android documents for
 * extending Material — not a `ColorScheme` extension property, which would have
 * to read `isSystemInDarkTheme()` at the call site and so disagree with any
 * caller that passes [CograTheme]'s `darkTheme` explicitly, as previews and
 * Robolectric tests do.
 */
@Immutable
internal data class CograColors(
    val success: Color,
    val onSuccess: Color,
    val successContainer: Color,
    val onSuccessContainer: Color,
)

internal val LightExtendedColors = CograColors(
    success = LightTokens.success,
    onSuccess = LightTokens.onSuccess,
    successContainer = LightTokens.successContainer,
    onSuccessContainer = LightTokens.onSuccessContainer,
)

internal val DarkExtendedColors = CograColors(
    success = DarkTokens.success,
    onSuccess = DarkTokens.onSuccess,
    successContainer = DarkTokens.successContainer,
    onSuccessContainer = DarkTokens.onSuccessContainer,
)

private val LocalCograColors = staticCompositionLocalOf { LightExtendedColors }

/**
 * The app theme. Screens consume colour and typography only through
 * [MaterialTheme] and [CograTheme], so a palette change is a token edit rather
 * than a screen-by-screen rewrite.
 *
 * Material You dynamic colour is deliberately absent (design.md §2.5): the brand
 * hue carries identity a wallpaper-derived palette would erase, and the
 * wallpaper source exists on only one of the two clients.
 */
@Composable
fun CograTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(
        LocalCograColors provides if (darkTheme) DarkExtendedColors else LightExtendedColors,
    ) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkColors else LightColors,
            typography = CograTypography,
            content = content,
        )
    }
}

/** Accessor for the roles Material does not carry — `CograTheme.colors.success`. */
object CograTheme {
    internal val colors: CograColors
        @Composable get() = LocalCograColors.current
}
