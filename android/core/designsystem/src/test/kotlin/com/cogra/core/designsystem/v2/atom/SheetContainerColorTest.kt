package com.cogra.core.designsystem.v2.atom

import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * THE STACKED RUNG (design/readme.md:2364): "A sheet over a sheet dims what
 * it covers and takes the next rung. `BottomSheet`'s `stacked` lifts the
 * upper sheet a layer... its surface moves to `surfaceContainerHighest` —
 * elevation is tonal, and two surfaces at one rung claim one elevation."
 *
 * Plain JUnit — [sheetContainerColor] takes no composition, so the rung it
 * picks is pinned directly against a real [androidx.compose.material3.ColorScheme],
 * the same way `fieldCountReading` pins the late counter's arithmetic.
 */
class SheetContainerColorTest {

    private val colors = lightColorScheme()
    private val default = Color(0xFF123456) // a fallback distinguishable from any real role

    @Test
    fun aStackedSheetTakesTheNextTonalRung() {
        assertThat(sheetContainerColor(stacked = true, colors = colors, default = default))
            .isEqualTo(colors.surfaceContainerHighest)
    }

    @Test
    fun anUnstackedSheetKeepsWhateverItAlreadyDraws() {
        assertThat(sheetContainerColor(stacked = false, colors = colors, default = default))
            .isEqualTo(default)
    }
}
