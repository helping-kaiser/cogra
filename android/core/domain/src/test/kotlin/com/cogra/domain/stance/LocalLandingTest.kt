package com.cogra.domain.stance

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The one piece of the graph's arithmetic the client runs (design.md
 * §8.3): where a pick lands the bundle, folded locally so the landing
 * line can move with the thumb instead of a round trip behind it.
 *
 * It is display only — the record still carries the picked pair
 * verbatim — but "display only" is not "approximately", so the rules are
 * pinned exactly: sum the RAW history, clip once at the end, and never
 * fold onto a number that has already been clipped.
 */
class LocalLandingTest {

    @Test
    fun aPickAddsToTheRawHistory() {
        val landing = localLanding(StancePair(0.3, -0.2), StancePair(0.4, 0.5))

        assertThat(landing.net).isEqualTo(StancePair(0.7, 0.3))
        assertThat(landing.pick).isEqualTo(StancePair(0.4, 0.5))
    }

    @Test
    fun theSumClipsAtTheEdgesOfTheValueSpace() {
        assertThat(localLanding(StancePair(0.8, -0.8), StancePair(0.9, -0.9)).net)
            .isEqualTo(StancePair(1.0, -1.0))
    }

    @Test
    fun aHistoryPastTheClipStillCarriesItsWholeWeight() {
        // The reason the raw sums are served at all. A bundle folding to
        // +1.00 whose history sums to +6.00 does not drop to +0.50 when
        // a −0.5 joins it; it lands at +5.50, which still reads +1.00.
        val landing = localLanding(StancePair(6.0, 4.0), StancePair(-0.5, -0.5))

        assertThat(landing.net).isEqualTo(StancePair(1.0, 1.0))
        assertThat(landing.severance).isFalse()
    }

    @Test
    fun foldingTheClippedNumberInsteadWouldGetItWrong() {
        // Stated as the contrast it exists to prevent: the same pick
        // against the CLIPPED standing lands somewhere else entirely.
        val fromRaw = localLanding(StancePair(6.0, 4.0), StancePair(-0.5, -0.5)).net
        val fromClipped = localLanding(StancePair(1.0, 1.0), StancePair(-0.5, -0.5)).net

        assertThat(fromRaw).isNotEqualTo(fromClipped)
        assertThat(fromClipped).isEqualTo(StancePair(0.5, 0.5))
    }

    @Test
    fun aPickThatCancelsTheHistoryIsSeverance() {
        val landing = localLanding(StancePair(0.8, 0.8), StancePair(-0.8, -0.8))

        assertThat(landing.net).isEqualTo(StancePair.Origin)
        assertThat(landing.severance).isTrue()
        assertThat(landing.inertDirected).isTrue()
        assertThat(landing.inertInterest).isTrue()
    }

    @Test
    fun oneAxisAtZeroIsInertOnThatAxisAlone() {
        val landing = localLanding(StancePair(0.5, 0.5), StancePair(-0.5, 0.2))

        assertThat(landing.inertDirected).isTrue()
        assertThat(landing.inertInterest).isFalse()
        assertThat(landing.severance).isFalse()
    }

    @Test
    fun anAxisThatCancelsIsNeverReportedAsNegativeZero() {
        // -0.0 is a real Double: it prints as "-0.00" and reads as a
        // broken control, and it must not slip past an exact zero test.
        val landing = localLanding(StancePair(-0.0, -0.0), StancePair(-0.0, -0.0))

        // 1/x separates the two zeros; equality alone cannot.
        assertThat(1.0 / landing.net.pDirected).isPositiveInfinity()
        assertThat(1.0 / landing.net.pInterest).isPositiveInfinity()
        assertThat(landing.severance).isTrue()
    }

    @Test
    fun anEmptyHistoryLandsExactlyOnThePick() {
        val landing = localLanding(StancePair.Origin, StancePair.TapDefault)

        assertThat(landing.net).isEqualTo(StancePair(0.1, 0.1))
    }
}
