package com.cogra.app.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Brand color tokens — a minimal seed so the app carries its own identity
 * rather than Material's default purple. Screens never name these directly;
 * they read [androidx.compose.material3.MaterialTheme.colorScheme] (wired in
 * [CograTheme]), so retuning the brand is an edit here, not a screen sweep.
 * The full palette arrives with the design pass.
 */
internal val CograPrimary = Color(0xFF3B5BDB)
internal val CograPrimaryDark = Color(0xFFAEC0FF)
internal val CograSecondary = Color(0xFF5C6B8A)
internal val CograSecondaryDark = Color(0xFFC3CCE0)
internal val CograError = Color(0xFFBA1A1A)
