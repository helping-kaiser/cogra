package com.cogra.core.designsystem

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The anchor table is a cross-client contract (design.md §8.4), so it is
 * pinned here value by value rather than trusted to review.
 */
class StanceAnchorsTest {

    @Test
    fun theTableIsTheTwentyAnchorsOfTheDoc() {
        val expected = listOf(
            0.15 to 0.15, 0.55 to 0.20, 0.90 to 0.25, 0.20 to 0.60,
            0.60 to 0.65, 0.25 to 0.95, 0.95 to 0.90, -0.15 to 0.15,
            -0.55 to 0.25, -0.90 to 0.30, -0.45 to 0.75, -0.90 to 0.90,
            0.20 to -0.20, 0.70 to -0.30, 0.30 to -0.80, 0.90 to -0.85,
            -0.20 to -0.20, -0.60 to -0.45, -0.35 to -0.85, -0.90 to -0.90,
        )
        assertThat(STANCE_ANCHORS.map { it.at.directed to it.at.interest })
            .containsExactlyElementsIn(expected)
            .inOrder()
    }

    @Test
    fun everyAnchorHasItsOwnFaceAndWords() {
        assertThat(STANCE_ANCHORS.map { it.emoji }.toSet()).hasSize(STANCE_ANCHORS.size)
        assertThat(STANCE_ANCHORS.map { it.label }.toSet()).hasSize(STANCE_ANCHORS.size)
    }

    @Test
    fun everyAnchorReadsAsItself() {
        for (anchor in STANCE_ANCHORS) {
            assertThat(nearestStanceAnchor(anchor.at)).isEqualTo(anchor)
        }
    }

    @Test
    fun theTapDefaultReadsAsTheModestPositive() {
        // A plain tap commits (+0.1, +0.1), which sits nearest 🙂 "Nice".
        assertThat(nearestStanceAnchor(StancePoint(0.1, 0.1)).emoji).isEqualTo("🙂")
    }

    @Test
    fun theOriginStillReadsAsSomething() {
        // The field is continuous and every point has a readout — the
        // origin is where the four inner anchors crowd, and the tie goes
        // to the first of them.
        assertThat(nearestStanceAnchor(StancePoint.Origin).emoji).isEqualTo("🙂")
    }

    @Test
    fun theCornersReadAsTheExtremes() {
        assertThat(nearestStanceAnchor(StancePoint(1.0, 1.0)).emoji).isEqualTo("🔥")
        assertThat(nearestStanceAnchor(StancePoint(-1.0, -1.0)).emoji).isEqualTo("💀")
        assertThat(nearestStanceAnchor(StancePoint(-1.0, 1.0)).emoji).isEqualTo("🤬")
        assertThat(nearestStanceAnchor(StancePoint(1.0, -1.0)).emoji).isEqualTo("🤐")
    }

    @Test
    fun aPointBetweenAnchorsTakesTheCloserOne() {
        // Just past the midpoint between 🙂 (+0.15,+0.15) and 😊
        // (+0.55,+0.20) on the valence axis.
        assertThat(nearestStanceAnchor(StancePoint(0.30, 0.17)).emoji).isEqualTo("🙂")
        assertThat(nearestStanceAnchor(StancePoint(0.40, 0.17)).emoji).isEqualTo("😊")
    }

    @Test
    fun aTieTakesTheEarlierAnchor() {
        // Exactly equidistant from 🙂 (+0.15,+0.15) and 😕 (-0.15,+0.15),
        // which sit at indices 0 and 7: the earlier one wins, so the
        // readout is a function of the table's order, not of iteration.
        assertThat(nearestStanceAnchor(StancePoint(0.0, 0.15)).emoji).isEqualTo("🙂")
    }

    // -- The zero bundle (design.md §8.4) --

    @Test
    fun theTableWouldCallTheZeroBundleNice() {
        // The bug this rule exists to stop, stated as arithmetic: the
        // origin's nearest anchor really is 🙂, so a standing read
        // through the table lies about severance.
        assertThat(nearestStanceAnchor(StancePoint.Origin).emoji).isEqualTo("🙂")
    }

    @Test
    fun aStandingAtZeroShrugsInstead() {
        assertThat(standingReadout(StancePoint.Origin).emoji).isEqualTo("🤷")
        assertThat(standingReadout(StancePoint.Origin)).isEqualTo(ZERO_BUNDLE_READOUT)
    }

    @Test
    fun negativeZeroIsStillTheZeroBundle() {
        // A fold that arrives as -0.0 on either axis is the same bundle;
        // it must not slip past the rule on a sign bit.
        assertThat(standingReadout(StancePoint(-0.0, 0.0)).emoji).isEqualTo("🤷")
        assertThat(standingReadout(StancePoint(0.0, -0.0)).emoji).isEqualTo("🤷")
        assertThat(standingReadout(StancePoint(-0.0, -0.0)).emoji).isEqualTo("🤷")
    }

    @Test
    fun aNonZeroStandingStillReadsThroughTheTable() {
        // The rule is narrow: only exact zero leaves the table.
        assertThat(standingReadout(StancePoint(0.55, 0.20)).emoji).isEqualTo("😊")
        assertThat(standingReadout(StancePoint(0.0, 0.15)).emoji).isEqualTo("🙂")
        assertThat(standingReadout(StancePoint(0.01, 0.0)).emoji).isEqualTo("🙂")
    }

    @Test
    fun theZeroReadoutIsNotOneOfTheTwentyAnchors() {
        // The table maps a felt value onto a face; this is the absence
        // of one, so it does not belong in it.
        assertThat(STANCE_ANCHORS).doesNotContain(ZERO_BUNDLE_READOUT)
        assertThat(STANCE_ANCHORS.map { it.emoji }).doesNotContain("🤷")
    }
}
