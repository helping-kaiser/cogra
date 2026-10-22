package com.cogra.core.designsystem

import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Test
import java.util.Locale

/** The system's one number format (design/readme.md §3, *Numbers*). */
class TwoPlacesTest {

    private val original = Locale.getDefault()

    @After
    fun restoreLocale() = Locale.setDefault(original)

    @Test
    fun theNegativeArmIsTheMinusSignNotAHyphen() {
        assertThat(twoPlaces(-0.4)).isEqualTo("−0.40")
        assertThat(twoPlaces(0.4)).isEqualTo("+0.40")
        assertThat(twoPlacesUnsigned(-0.2)).isEqualTo("−0.20")
        assertThat(twoPlaces(-0.4)).doesNotContain("-")
    }

    @Test
    fun aValueThatRoundsToZeroCarriesThePlus() {
        assertThat(twoPlaces(-0.004)).isEqualTo("+0.00")
    }

    @Test
    fun theDecimalsAreAPointWhateverTheDevicesLocale() {
        Locale.setDefault(Locale.GERMANY)
        assertThat(twoPlaces(-0.4)).isEqualTo("−0.40")
        assertThat(twoPlacesUnsigned(0.9)).isEqualTo("0.90")
    }
}
