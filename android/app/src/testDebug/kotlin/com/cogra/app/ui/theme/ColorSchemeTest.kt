// Pins the theme to `design-tokens.json` (repo root) — the cross-platform
// colour contract generated from design.md §2.2 (`make tokens`), the same
// arrangement core:crypto has with client-crypto-vectors.json. Values are never
// transcribed into test code; drift on either side fails here.
//
// The contrast pass is the check design.md §2.1 promises ("verified at
// generation time") — a palette edit that breaks WCAG AA cannot ship.

package com.cogra.app.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.ui.graphics.Color
import com.google.common.truth.Truth.assertThat
import com.google.common.truth.Truth.assertWithMessage
import java.io.File
import java.util.Locale
import kotlin.math.pow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Test

private val tokens: JsonObject by lazy {
    Json.parseToJsonElement(File("../../design-tokens.json").readText()).jsonObject
}

private fun theme(name: String): JsonObject = tokens.getValue(name).jsonObject

private fun Color.hex(): String =
    String.format(
        Locale.ROOT,
        "#%02X%02X%02X",
        (red * 255f).toInt(),
        (green * 255f).toInt(),
        (blue * 255f).toInt(),
    )

/** WCAG 2.1 relative luminance over the sRGB channels. */
private fun Color.luminance(): Double {
    fun channel(v: Float): Double {
        val c = v.toDouble()
        return if (c <= 0.03928) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
    }
    return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
}

private fun contrast(a: Color, b: Color): Double {
    val hi = maxOf(a.luminance(), b.luminance())
    val lo = minOf(a.luminance(), b.luminance())
    return (hi + 0.05) / (lo + 0.05)
}

/** Every Material role, paired with how to read it off a [ColorScheme]. */
private val M3_ROLES: Map<String, (ColorScheme) -> Color> = mapOf(
    "primary" to { it.primary },
    "onPrimary" to { it.onPrimary },
    "primaryContainer" to { it.primaryContainer },
    "onPrimaryContainer" to { it.onPrimaryContainer },
    "inversePrimary" to { it.inversePrimary },
    "secondary" to { it.secondary },
    "onSecondary" to { it.onSecondary },
    "secondaryContainer" to { it.secondaryContainer },
    "onSecondaryContainer" to { it.onSecondaryContainer },
    "tertiary" to { it.tertiary },
    "onTertiary" to { it.onTertiary },
    "tertiaryContainer" to { it.tertiaryContainer },
    "onTertiaryContainer" to { it.onTertiaryContainer },
    "background" to { it.background },
    "onBackground" to { it.onBackground },
    "surface" to { it.surface },
    "onSurface" to { it.onSurface },
    "surfaceVariant" to { it.surfaceVariant },
    "onSurfaceVariant" to { it.onSurfaceVariant },
    "surfaceTint" to { it.surfaceTint },
    "inverseSurface" to { it.inverseSurface },
    "inverseOnSurface" to { it.inverseOnSurface },
    "error" to { it.error },
    "onError" to { it.onError },
    "errorContainer" to { it.errorContainer },
    "onErrorContainer" to { it.onErrorContainer },
    "outline" to { it.outline },
    "outlineVariant" to { it.outlineVariant },
    "scrim" to { it.scrim },
    "surfaceBright" to { it.surfaceBright },
    "surfaceDim" to { it.surfaceDim },
    "surfaceContainer" to { it.surfaceContainer },
    "surfaceContainerHigh" to { it.surfaceContainerHigh },
    "surfaceContainerHighest" to { it.surfaceContainerHighest },
    "surfaceContainerLow" to { it.surfaceContainerLow },
    "surfaceContainerLowest" to { it.surfaceContainerLowest },
)

private val EXTENDED_ROLES: Map<String, (CograColors) -> Color> = mapOf(
    "success" to { it.success },
    "onSuccess" to { it.onSuccess },
    "successContainer" to { it.successContainer },
    "onSuccessContainer" to { it.onSuccessContainer },
)

/** The `on`-pairs design.md §2.1 guarantees at WCAG AA. */
private val ON_PAIRS = listOf(
    "onPrimary" to "primary",
    "onPrimaryContainer" to "primaryContainer",
    "onSecondary" to "secondary",
    "onSecondaryContainer" to "secondaryContainer",
    "onTertiary" to "tertiary",
    "onTertiaryContainer" to "tertiaryContainer",
    "onError" to "error",
    "onErrorContainer" to "errorContainer",
    "onSurface" to "surface",
    "onSurfaceVariant" to "surfaceVariant",
    "inverseOnSurface" to "inverseSurface",
    "onSuccess" to "success",
    "onSuccessContainer" to "successContainer",
)

class ColorSchemeTest {

    @Test
    fun `light scheme matches the committed tokens`() {
        val expected = theme("light")
        for ((role, read) in M3_ROLES) {
            assertThat(read(LightColors).hex()).isEqualTo(expected.getValue(role).jsonPrimitive.content)
        }
    }

    @Test
    fun `dark scheme matches the committed tokens`() {
        val expected = theme("dark")
        for ((role, read) in M3_ROLES) {
            assertThat(read(DarkColors).hex()).isEqualTo(expected.getValue(role).jsonPrimitive.content)
        }
    }

    @Test
    fun `extended roles match the committed tokens`() {
        for ((themeName, colors) in listOf("light" to LightExtendedColors, "dark" to DarkExtendedColors)) {
            val expected = theme(themeName)
            for ((role, read) in EXTENDED_ROLES) {
                assertThat(read(colors).hex()).isEqualTo(expected.getValue(role).jsonPrimitive.content)
            }
        }
    }

    @Test
    fun `every on-pair clears WCAG AA in both themes`() {
        for (themeName in listOf("light", "dark")) {
            val roles = theme(themeName)
            for ((on, background) in ON_PAIRS) {
                val ratio = contrast(
                    Color(roles.getValue(on).jsonPrimitive.content.removePrefix("#").toLong(16) or 0xFF000000),
                    Color(roles.getValue(background).jsonPrimitive.content.removePrefix("#").toLong(16) or 0xFF000000),
                )
                assertWithMessage("%s: %s on %s", themeName, on, background)
                    .that(ratio)
                    .isAtLeast(4.5)
            }
        }
    }

    @Test
    fun `the seed is the brand orange and dark primary is not the rejected tone`() {
        // §2.1: Material places dark primary at tone 80, where orange reads as
        // peach; this palette takes tone 70 instead.
        assertThat(tokens.getValue("seed").jsonPrimitive.content).isEqualTo("#EF6C1A")
        assertThat(DarkColors.primary.hex()).isEqualTo("#FF8D50")
        assertThat(LightColors.primaryContainer.hex()).isEqualTo("#EF6C1A")
    }
}
