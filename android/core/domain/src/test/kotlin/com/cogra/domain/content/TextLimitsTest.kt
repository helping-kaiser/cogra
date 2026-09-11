// The unit is the whole test. A cap measured in UTF-16 code units would
// refuse a title the server takes, which is the one way a mirrored cap
// can be worse than none.

package com.cogra.domain.content

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class TextLimitsTest {

    @Test
    fun `a title at the cap is allowed and one past it is not`() {
        assertThat(isTitleTooLong("x".repeat(MAX_TITLE_CHARS))).isFalse()
        assertThat(isTitleTooLong("x".repeat(MAX_TITLE_CHARS + 1))).isTrue()
    }

    @Test
    fun `the count is scalar values, so an astral title fits its own hundred`() {
        val astral = "🧂".repeat(MAX_TITLE_CHARS)
        assertThat(astral.length).isEqualTo(2 * MAX_TITLE_CHARS)
        assertThat(isTitleTooLong(astral)).isFalse()
        assertThat(isTitleTooLong(astral + "🧂")).isTrue()
    }

    @Test
    fun `surrounding whitespace is not part of the length`() {
        assertThat(isTitleTooLong("  " + "x".repeat(MAX_TITLE_CHARS) + "  ")).isFalse()
    }
}
