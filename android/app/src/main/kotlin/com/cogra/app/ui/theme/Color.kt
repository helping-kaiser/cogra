package com.cogra.app.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * The palette of design.md §2.3, orange-led from the `#EF6C1A` seed. Values are
 * generated, never hand-picked — the repo-root `design-tokens.json` is the
 * contract both clients pin to (`make tokens`), and `ColorSchemeTest` fails if
 * these drift from it.
 *
 * Screens never name a colour; they read a role off `MaterialTheme.colorScheme`
 * or [CograTheme.colors].
 */

internal object LightTokens {
    val primary = Color(0xFF9F4100)
    val onPrimary = Color(0xFFFFFFFF)
    val primaryContainer = Color(0xFFEF6C1A)
    val onPrimaryContainer = Color(0xFF4F1D00)
    val inversePrimary = Color(0xFFFFB692)
    val secondary = Color(0xFF8E4D2B)
    val onSecondary = Color(0xFFFFFFFF)
    val secondaryContainer = Color(0xFFFEAA81)
    val onSecondaryContainer = Color(0xFF783C1C)
    val tertiary = Color(0xFF666000)
    val onTertiary = Color(0xFFFFFFFF)
    val tertiaryContainer = Color(0xFFB7AF26)
    val onTertiaryContainer = Color(0xFF454100)
    val background = Color(0xFFFFF8F6)
    val onBackground = Color(0xFF251913)
    val surface = Color(0xFFFFF8F6)
    val onSurface = Color(0xFF251913)
    val surfaceVariant = Color(0xFFFDDCCD)
    val onSurfaceVariant = Color(0xFF584237)
    val surfaceTint = Color(0xFF9F4100)
    val inverseSurface = Color(0xFF3B2D27)
    val inverseOnSurface = Color(0xFFFFEDE6)
    val error = Color(0xFFBA1A1A)
    val onError = Color(0xFFFFFFFF)
    val errorContainer = Color(0xFFFFDAD6)
    val onErrorContainer = Color(0xFF93000A)
    val outline = Color(0xFF8C7165)
    val outlineVariant = Color(0xFFE0C0B2)
    val scrim = Color(0xFF000000)
    val surfaceBright = Color(0xFFFFF8F6)
    val surfaceDim = Color(0xFFEDD5CB)
    val surfaceContainer = Color(0xFFFFEAE1)
    val surfaceContainerHigh = Color(0xFFFBE3D9)
    val surfaceContainerHighest = Color(0xFFF5DED4)
    val surfaceContainerLow = Color(0xFFFFF1EB)
    val surfaceContainerLowest = Color(0xFFFFFFFF)
    val success = Color(0xFF006C4F)
    val onSuccess = Color(0xFFFFFFFF)
    val successContainer = Color(0xFF98F5CE)
    val onSuccessContainer = Color(0xFF002116)
}

internal object DarkTokens {
    val primary = Color(0xFFFF8D50)
    val onPrimary = Color(0xFF341100)
    val primaryContainer = Color(0xFFEF6C1A)
    val onPrimaryContainer = Color(0xFF4F1D00)
    val inversePrimary = Color(0xFF9F4100)
    val secondary = Color(0xFFFFB692)
    val onSecondary = Color(0xFF542103)
    val secondaryContainer = Color(0xFF743918)
    val onSecondaryContainer = Color(0xFFF8A57B)
    val tertiary = Color(0xFFD3CB42)
    val onTertiary = Color(0xFF343200)
    val tertiaryContainer = Color(0xFFB7AF26)
    val onTertiaryContainer = Color(0xFF454100)
    val background = Color(0xFF151312)
    val onBackground = Color(0xFFE8E1DF)
    val surface = Color(0xFF151312)
    val onSurface = Color(0xFFE8E1DF)
    val surfaceVariant = Color(0xFF4B4644)
    val onSurfaceVariant = Color(0xFFCDC5C2)
    val surfaceTint = Color(0xFFFF8D50)
    val inverseSurface = Color(0xFFE8E1DF)
    val inverseOnSurface = Color(0xFF33302F)
    val error = Color(0xFFFFB4AB)
    val onError = Color(0xFF690005)
    val errorContainer = Color(0xFF93000A)
    val onErrorContainer = Color(0xFFFFDAD6)
    val outline = Color(0xFF968F8D)
    val outlineVariant = Color(0xFF4B4644)
    val scrim = Color(0xFF000000)
    val surfaceBright = Color(0xFF3C3837)
    val surfaceDim = Color(0xFF151312)
    val surfaceContainer = Color(0xFF221F1E)
    val surfaceContainerHigh = Color(0xFF2C2928)
    val surfaceContainerHighest = Color(0xFF373433)
    val surfaceContainerLow = Color(0xFF1E1B1A)
    val surfaceContainerLowest = Color(0xFF100E0D)
    val success = Color(0xFF7CD8B3)
    val onSuccess = Color(0xFF003828)
    val successContainer = Color(0xFF00513B)
    val onSuccessContainer = Color(0xFF98F5CE)
}
