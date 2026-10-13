// The ground -> bar-appearance map (SystemBarGroundMap.kt), the single
// future-change point of the system-bar law, stated as a table.

package com.cogra.core.designsystem

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class SystemBarGroundMapTest {

    @Test
    fun `a light ground wears dark icons and a dark ground light ones`() {
        assertThat(barAppearanceFor(BarGround.AppLight, BarGround.AppLight))
            .isEqualTo(BarAppearance(lightStatusIcons = false, lightNavigationIcons = false))
        assertThat(barAppearanceFor(BarGround.AppDark, BarGround.AppDark))
            .isEqualTo(BarAppearance(lightStatusIcons = true, lightNavigationIcons = true))
    }

    @Test
    fun `the forced dark ground lights the status icons but leaves the navigation bar to the app`() {
        assertThat(barAppearanceFor(BarGround.ForcedDark, BarGround.AppLight))
            .isEqualTo(BarAppearance(lightStatusIcons = true, lightNavigationIcons = false))
        assertThat(barAppearanceFor(BarGround.ForcedDark, BarGround.AppDark))
            .isEqualTo(BarAppearance(lightStatusIcons = true, lightNavigationIcons = true))
    }
}
