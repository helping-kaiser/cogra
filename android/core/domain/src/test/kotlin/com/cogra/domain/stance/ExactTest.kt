package com.cogra.domain.stance

import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.math.BigDecimal

// Exact decimal netting against the reference (crates/common/src/l1/exact.rs).
class ExactTest {

    @Test
    fun theKnownDirtyPatternNetsToZeroInEveryOrder() {
        assertThat(0.1 + 0.2 - 0.3).isNotEqualTo(0.0)
        for (order in listOf(listOf(0.1, 0.2, -0.3), listOf(0.2, -0.3, 0.1), listOf(-0.3, 0.1, 0.2))) {
            assertThat(netsToZero(order)).isTrue()
        }
    }

    @Test
    fun aWalkBackFloatingPointCallsShortOfZeroNets() {
        assertThat(1.1 - 1.0 - 0.1).isNotEqualTo(0.0)
        assertThat(netsToZero(listOf(1.1, -1.0, -0.1))).isTrue()
    }

    @Test
    fun aWalkBackThatNetsOnlyInFloatingPointIsRefused() {
        val remainder = -(2.3 - 1.0 - 1.0)
        assertThat(2.3 - 1.0 - 1.0 + remainder).isEqualTo(0.0)
        assertThat(netsToZero(listOf(2.3, -1.0, -1.0, remainder))).isFalse()
    }

    @Test
    fun aDoubleDenotesItsShortestDecimal() {
        assertThat(decimalOf(0.1)).isEqualTo(BigDecimal("0.1"))
        assertThat(decimalOf(-0.37)).isEqualTo(BigDecimal("-0.37"))
        assertThat(decimalOf(-0.0).signum()).isEqualTo(0)
        assertThat(decimalOf(0.30000000000000004)).isEqualTo(BigDecimal("0.30000000000000004"))
        val legacy = 0.00047147125005719825
        assertThat(decimalOf(legacy)).isEqualTo(BigDecimal("0.00047147125005719825"))
        assertThat(netsToZero(listOf(legacy, 0.1, -legacy, -0.1))).isTrue()
        assertThat(netsToZero(listOf(legacy, -0.0004714712500572))).isFalse()
    }
}
