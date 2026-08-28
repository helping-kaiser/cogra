package com.cogra.core.designsystem.v2.token

import android.content.res.Configuration
import androidx.compose.ui.tooling.preview.Preview

/**
 * Both themes at once — the multi-preview annotation Android documents for
 * exactly this, so a component is drawn light and dark from one declaration
 * rather than two copy-pasted `@Preview`s that drift.
 *
 * Both themes are *designed* rather than derived by inversion
 * (design/readme.md §4), so every 2.0 component is reviewed in both. Wrap the
 * body in [Cogra2PreviewTheme] — it reads `isSystemInDarkTheme()`, which the
 * `uiMode` below drives.
 */
@Preview(name = "Light", showBackground = true)
@Preview(
    name = "Dark",
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
annotation class ThemePreviews
