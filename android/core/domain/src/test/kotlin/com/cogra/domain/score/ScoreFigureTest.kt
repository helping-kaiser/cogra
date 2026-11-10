// The score as it is written (copy-voice, *The score drill-down*;
// FeedEntryMoved.md:5) and the add-up apportionment (FeedEntry.md:15; SR-G8).

package com.cogra.domain.score

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class ScoreFigureTest {

    @Test
    fun `a card keeps its plain figure, a negative its minus and a zero none`() {
        assertThat(cardFigure(15.2)).isEqualTo("15.20")
        assertThat(cardFigure(-0.5)).isEqualTo("−0.50")
        assertThat(cardFigure(0.0)).isEqualTo("0.00")
        assertThat(cardFigure(0.004)).isEqualTo("0.00")
    }

    @Test
    fun `a figure rounds half away from zero, alike either side of it`() {
        assertThat(cardFigure(0.125)).isEqualTo("0.13")
        assertThat(cardFigure(-0.125)).isEqualTo("−0.13")
    }

    @Test
    fun `the flag is signed, and the dash where no figure is computed — never 0_00`() {
        assertThat(flagFigure(15.2)).isEqualTo("+15.20")
        assertThat(flagFigure(-1.0)).isEqualTo("−1.00")
        assertThat(flagFigure(0.0)).isEqualTo("0.00")
        assertThat(flagFigure(null)).isEqualTo(SCORE_DASH)
        assertThat(SCORE_DASH).isEqualTo("—")
    }

    @Test
    fun `the drawn parts add up to the displayed total`() {
        // Each rounds to 0.33 alone, summing to 0.99 under a 1.00 flag.
        val parts = listOf(1.0 / 3, 1.0 / 3, 1.0 / 3)
        val cents = apportionCents(parts, 1.0)
        assertThat(cents.sum()).isEqualTo(100L)
        assertThat(cents).containsExactly(34L, 33L, 33L).inOrder()
    }

    @Test
    fun `the board's paths close on its figure`() {
        val cents = apportionCents(listOf(6.8, 4.2, 2.6, 1.1, 0.3, 0.2), 15.2)
        assertThat(cents).containsExactly(680L, 420L, 260L, 110L, 30L, 20L).inOrder()
    }

    @Test
    fun `negative paths apportion as well`() {
        val cents = apportionCents(listOf(2.005, -0.5049), 1.5001)
        assertThat(cents.sum()).isEqualTo(150L)
    }

    @Test
    fun `no parts apportion to nothing`() {
        assertThat(apportionCents(emptyList(), 0.0)).isEmpty()
    }
}
