package com.cogra.core.designsystem

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The hundredths grid (jakob 2026-10-20): release lands a pick on the nearest
 * hundredth. The vector table is the web's (`model.test.ts`, "the hundredths
 * grid"), so a drag the two apps carry to the same float lands on the same
 * hundredth.
 */
class HundredthsTest {

    private val vectors = listOf(
        0.004 to 0.0,
        -0.004 to 0.0,
        0.005 to 0.01,
        -0.005 to -0.01,
        0.125 to 0.13,
        -0.125 to -0.13,
        (0.1 + 0.2) to 0.3,
        0.994 to 0.99,
        0.1f.toDouble() to 0.1,
        1.7 to 1.0,
        -3.0 to -1.0,
    )

    @Test
    fun theVectorsLandWhereTheWebLandsThem() {
        for ((raw, grid) in vectors) {
            assertThat(hundredth(raw)).isEqualTo(grid)
        }
    }

    @Test
    fun aPickNearZeroLandsOnExactlyPositiveZero() {
        // Truth compares doubles by `equals`, which tells −0 from +0.
        assertThat(hundredth(-0.0)).isEqualTo(0.0)
        assertThat(hundredth(-0.0049)).isEqualTo(0.0)
        assertThat(hundredth(0.0049)).isEqualTo(0.0)
    }

    @Test
    fun nanFoldsToTheOrigin() {
        assertThat(hundredth(Double.NaN)).isEqualTo(0.0)
    }

    @Test
    fun aValueAlreadyOnTheGridStaysExactlyWhereItIs() {
        for (k in -100..100) {
            assertThat(hundredth(k / 100.0)).isEqualTo(k / 100.0 + 0.0)
        }
    }

    @Test
    fun theGridPrintsExactlyTheHundredthItLandsOn() {
        // A drag that stops 0.37 of a hundredth past every grid point.
        for (k in -100..100) {
            assertThat(twoPlaces(hundredth(k / 100.0 + 0.0037))).isEqualTo(twoPlaces(k / 100.0))
        }
    }

    @Test
    fun aRangedPickLandsOnTheGridInsideItsReach() {
        // A tag's relevance a drag carried to 0.004 lands on its +0.01 floor,
        // never on the withdrawal at 0.
        val landed = PairRanges.Tag.snap(PairPoint(0.004, 0.4371))
        assertThat(landed).isEqualTo(PairPoint(PairRanges.TAG_RELEVANCE_FLOOR, 0.44))
        assertThat(PairRanges.Signed.snap(PairPoint(-0.0042, 0.0031))).isEqualTo(PairPoint(0.0, 0.0))
    }
}
