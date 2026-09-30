package com.cogra.core.designsystem.v2.token

import androidx.compose.material3.ColorScheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import com.google.common.truth.Truth.assertThat
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Test
import java.io.File
import java.util.Locale

/**
 * The preview palette is a second reader of the `design/tokens.json` contract,
 * not a second opinion about the colour. `:app`'s `ColorSchemeTest` pins the
 * shipped theme to that file; this pins the preview theme to it, so a
 * regenerated palette cannot leave the two drawing different pictures.
 *
 * If this fails after `make tokens`, the fix is to copy the new values across
 * — never to relax the assertion.
 */
class PreviewThemeTokensTest {

    /** The colors.css half of the contract: context `tokens` is light, `dark` is dark. */
    private val colors: JsonObject =
        Json.parseToJsonElement(File("../../../design/tokens.json").readText()).jsonObject
            .getValue("files").jsonObject.getValue("colors.css").jsonObject

    /**
     * The contract's hex for an M3 role in [theme] (`light` or `dark`). The
     * contract names roles as kebab-case custom properties and writes hex in
     * lowercase; [hex] formats uppercase, so the contract value is uppercased.
     */
    private fun token(theme: String, role: String): String {
        val context = if (theme == "light") "tokens" else theme
        val property = "--" + role.replace(Regex("[A-Z]")) { "-" + it.value.lowercase(Locale.ROOT) }
        return colors.getValue(context).jsonObject.getValue(property).jsonObject
            .getValue("resolved").jsonPrimitive.content.uppercase(Locale.ROOT)
    }

    private fun Color.hex(): String {
        val argb = toArgb()
        return String.format(
            Locale.ROOT,
            "#%02X%02X%02X",
            (argb shr 16) and 0xFF,
            (argb shr 8) and 0xFF,
            argb and 0xFF,
        )
    }

    /**
     * Every role the preview scheme sets. `success` is absent by design: it is
     * a CoGra role outside Material's set, it has no `ColorScheme` slot, and
     * no 2.0 component uses it yet.
     */
    private val roles: Map<String, (ColorScheme) -> Color> = mapOf(
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

    @Test
    fun previewLightMatchesTheCommittedTokens() {
        for ((role, read) in roles) {
            assertThat(read(PreviewLightColors).hex()).isEqualTo(token("light", role))
        }
    }

    @Test
    fun previewDarkMatchesTheCommittedTokens() {
        for ((role, read) in roles) {
            assertThat(read(PreviewDarkColors).hex()).isEqualTo(token("dark", role))
        }
    }
}
