// Pins the type system to design.md §3: one variable family for everything,
// and Material 3's fifteen roles otherwise unmodified. The scale is the part
// worth guarding — a hand-tuned size here is a deviation the doc says must be
// raised, not taken as a per-screen liberty.

package com.cogra.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontListFontFamily
import androidx.compose.ui.text.font.ResourceFont
import com.cogra.app.R
import com.google.common.truth.Truth.assertThat
import com.google.common.truth.Truth.assertWithMessage
import org.junit.Test

/** Material 3's fifteen roles, paired with how to read one off a [Typography]. */
private val ROLES: Map<String, (Typography) -> TextStyle> = mapOf(
    "displayLarge" to { it.displayLarge },
    "displayMedium" to { it.displayMedium },
    "displaySmall" to { it.displaySmall },
    "headlineLarge" to { it.headlineLarge },
    "headlineMedium" to { it.headlineMedium },
    "headlineSmall" to { it.headlineSmall },
    "titleLarge" to { it.titleLarge },
    "titleMedium" to { it.titleMedium },
    "titleSmall" to { it.titleSmall },
    "bodyLarge" to { it.bodyLarge },
    "bodyMedium" to { it.bodyMedium },
    "bodySmall" to { it.bodySmall },
    "labelLarge" to { it.labelLarge },
    "labelMedium" to { it.labelMedium },
    "labelSmall" to { it.labelSmall },
)

class TypographyTest {

    private val baseline = Typography()

    @Test
    fun `every role is set in Figtree`() {
        for ((role, read) in ROLES) {
            assertWithMessage(role).that(read(CograTypography).fontFamily).isEqualTo(FigtreeFamily)
        }
    }

    @Test
    fun `the M3 scale is otherwise unmodified`() {
        for ((role, read) in ROLES) {
            assertWithMessage(role)
                .that(read(CograTypography))
                .isEqualTo(read(baseline).copy(fontFamily = FigtreeFamily))
        }
    }

    @Test
    fun `one variable resource carries every declared weight`() {
        val fonts = (FigtreeFamily as FontListFontFamily).fonts.map { it as ResourceFont }

        assertThat(fonts.map { it.resId }.toSet()).containsExactly(R.font.figtree)
        assertThat(fonts.map { it.weight.weight }).containsExactly(400, 500, 600, 700)

        for (font in fonts) {
            val axis = font.variationSettings.settings.single()
            assertWithMessage("weight %s", font.weight.weight).that(axis.axisName).isEqualTo("wght")
            assertWithMessage("weight %s", font.weight.weight)
                .that(axis.toVariationValue(null))
                .isEqualTo(font.weight.weight.toFloat())
        }
    }
}
