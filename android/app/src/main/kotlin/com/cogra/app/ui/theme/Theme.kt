package com.cogra.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = CograPrimary,
    secondary = CograSecondary,
    error = CograError,
)
private val DarkColors = darkColorScheme(
    primary = CograPrimaryDark,
    secondary = CograSecondaryDark,
)

/**
 * The app theme. Screens consume the color and typography tokens only
 * through `MaterialTheme`, so the eventual design pass is a token edit
 * rather than a screen-by-screen rewrite.
 */
@Composable
fun CograTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = CograTypography,
        content = content,
    )
}
