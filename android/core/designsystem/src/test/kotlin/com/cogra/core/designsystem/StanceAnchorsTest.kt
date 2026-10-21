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

    // -- Faces follow the value (jakob 2026-10-21, seam 243; `bundleReadout`) --

    @Test
    fun exactlyZeroShrugsAndSpeaksTheLabelItsContextGives() {
        assertThat(bundleReadout(StancePoint.Origin).emoji).isEqualTo("🤷")
        // The master's default is the walk-back's word; a pick, or a standing
        // an empty sign left there, passes `EMPTY_PICK_LABEL`.
        assertThat(bundleReadout(StancePoint.Origin)).isEqualTo(ZERO_BUNDLE_READOUT)
        assertThat(bundleReadout(StancePoint.Origin).label).isEqualTo(R.string.stance_standing_zero)
        assertThat(bundleReadout(StancePoint.Origin, EMPTY_PICK_LABEL).label).isEqualTo(R.string.stance_says_nothing)
        assertThat(bundleReadout(StancePoint.Origin, EMPTY_PICK_LABEL).emoji).isEqualTo("🤷")
    }

    @Test
    fun negativeZeroIsStillExactZero() {
        // A fold that arrives as -0.0 on either axis is the same pair; it must
        // not slip past the rule on a sign bit.
        assertThat(bundleReadout(StancePoint(-0.0, 0.0)).emoji).isEqualTo("🤷")
        assertThat(bundleReadout(StancePoint(0.0, -0.0)).emoji).isEqualTo("🤷")
        assertThat(bundleReadout(StancePoint(-0.0, -0.0)).emoji).isEqualTo("🤷")
        assertThat(bundleReadout(StancePoint(-0.0, 0.4)).emoji).isEqualTo(UNREACHABLE_EMOJI)
    }

    @Test
    fun exactlyOneZeroThinksAndNamesItsStateNeverATableFace() {
        // The table would say 🙂 for both of these — the bug the rule stops.
        assertThat(nearestStanceAnchor(StancePoint(0.0, 0.15)).emoji).isEqualTo("🙂")
        assertThat(nearestStanceAnchor(StancePoint(0.10, 0.0)).emoji).isEqualTo("🙂")
        // The four heads, by the sign of the number that stands.
        val cases = mapOf(
            StancePoint(0.0, 0.15) to R.string.stance_unreachable_interested,
            StancePoint(0.0, -0.6) to R.string.stance_unreachable_rather_not,
            StancePoint(0.10, 0.0) to R.string.stance_unreachable_for,
            StancePoint(-0.9, 0.0) to R.string.stance_unreachable_against,
        )
        for ((pair, head) in cases) {
            val face = bundleReadout(pair, EMPTY_PICK_LABEL)
            assertThat(face.emoji).isEqualTo("🤔")
            assertThat(face.label).isEqualTo(head)
        }
    }

    @Test
    fun theTableReadsOnlyAPairWithBothNumbersNonZero() {
        assertThat(bundleReadout(StancePoint(0.55, 0.20)).emoji).isEqualTo("😊")
        assertThat(bundleReadout(StancePoint(0.01, 0.01)).emoji).isEqualTo("🙂")
        // Every anchor of the table reads as itself through the choke point.
        for (anchor in STANCE_ANCHORS) {
            assertThat(bundleReadout(anchor.at)).isEqualTo(anchor)
        }
    }

    @Test
    fun theChokePointIsTheMasters() {
        // The parity is with the RULE, never with the bare table: the master's
        // own checker once computed faces from `nearestAnchor` and was wrong.
        val master = java.io.File("../../../design/components/stance/StanceReadout.jsx").readText()
        assertThat(master).contains("if (dZero && iZero) return { emoji: ZERO_BUNDLE_EMOJI, label: zeroLabel };")
        val oneZero = "if (dZero || iZero) return { emoji: UNREACHABLE_EMOJI, label: unreachableHead(pair) };"
        assertThat(master).contains(oneZero)
        assertThat(master).contains("export const EMPTY_PICK_LABEL = \"Says nothing\";")
        assertThat(master).contains("export const SEVERED_LABEL = \"Walked back\";")
    }

    @Test
    fun theZeroReadoutIsNotOneOfTheTwentyAnchors() {
        // The table maps a felt value onto a face; this is the absence
        // of one, so it does not belong in it.
        assertThat(STANCE_ANCHORS).doesNotContain(ZERO_BUNDLE_READOUT)
        assertThat(STANCE_ANCHORS.map { it.emoji }).doesNotContain("🤷")
    }
}
