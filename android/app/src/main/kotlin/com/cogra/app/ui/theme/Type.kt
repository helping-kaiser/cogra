package com.cogra.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import com.cogra.app.R

/**
 * One variable file carries every weight (design.md §3): each entry points at
 * the same resource and moves the `wght` axis, so no static cuts ship. Variable
 * fonts need API 26, which is the app's `minSdk`, and they cannot be delivered
 * through downloadable fonts — hence the bundled `res/font/figtree.ttf`.
 *
 * `variationSettings` is still opt-in in this Compose version; the opt-in is
 * what Android's own variable-font guidance shows, and there is no stable
 * alternative that reaches the `wght` axis.
 */
@OptIn(ExperimentalTextApi::class)
private fun figtree(weight: FontWeight) = Font(
    R.font.figtree,
    weight = weight,
    variationSettings = FontVariation.Settings(FontVariation.weight(weight.weight)),
)

/**
 * 400 and 500 are what the M3 scale itself asks for; 600 and 700 carry
 * emphasis and the wordmark, and declaring them keeps the platform from
 * synthesising a fake bold.
 */
internal val FigtreeFamily = FontFamily(
    figtree(FontWeight.Normal),
    figtree(FontWeight.Medium),
    figtree(FontWeight.SemiBold),
    figtree(FontWeight.Bold),
)

private val Baseline = Typography()

/**
 * Material 3's fifteen roles with the family swapped and nothing else touched
 * (design.md §3). Each role copies the baseline rather than restating its size,
 * so a deviation from the M3 scale cannot arrive by transcription error.
 */
internal val CograTypography = Typography(
    displayLarge = Baseline.displayLarge.copy(fontFamily = FigtreeFamily),
    displayMedium = Baseline.displayMedium.copy(fontFamily = FigtreeFamily),
    displaySmall = Baseline.displaySmall.copy(fontFamily = FigtreeFamily),
    headlineLarge = Baseline.headlineLarge.copy(fontFamily = FigtreeFamily),
    headlineMedium = Baseline.headlineMedium.copy(fontFamily = FigtreeFamily),
    headlineSmall = Baseline.headlineSmall.copy(fontFamily = FigtreeFamily),
    titleLarge = Baseline.titleLarge.copy(fontFamily = FigtreeFamily),
    titleMedium = Baseline.titleMedium.copy(fontFamily = FigtreeFamily),
    titleSmall = Baseline.titleSmall.copy(fontFamily = FigtreeFamily),
    bodyLarge = Baseline.bodyLarge.copy(fontFamily = FigtreeFamily),
    bodyMedium = Baseline.bodyMedium.copy(fontFamily = FigtreeFamily),
    bodySmall = Baseline.bodySmall.copy(fontFamily = FigtreeFamily),
    labelLarge = Baseline.labelLarge.copy(fontFamily = FigtreeFamily),
    labelMedium = Baseline.labelMedium.copy(fontFamily = FigtreeFamily),
    labelSmall = Baseline.labelSmall.copy(fontFamily = FigtreeFamily),
)
