package com.cogra.core.designsystem

import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.io.File

/**
 * The one-axis table is a cross-client contract, so it is pinned to its
 * MASTER rather than trusted to review: `StanceReadout.jsx` holds
 * `VALENCE_SIX`, both clients read it, and a band edited there and not
 * here — or the reverse — fails.
 *
 * EVERY BAND EDGE IS PINNED BY VALUE, not by a round trip through the
 * same comparison the code makes. The edges are where the two ruled
 * tie-breaks live, they are the only values a nearest-distance
 * implementation would answer differently for, and they are what web's
 * `valence.test.ts` pins to the same numbers.
 */
class ValenceBandsTest {

    private val master = File("../../../design/components/stance/StanceReadout.jsx").readText()

    /** The master's own rows: `{ emoji: "😠", to: -0.725, toInclusive: false },`. */
    private fun masterBands(): List<Triple<String, Double, Boolean>> {
        val table = Regex("export const VALENCE_SIX = \\[([\\s\\S]*?)]\\.map").find(master)
        assertThat(table).isNotNull()
        return Regex(
            "\\{\\s*emoji:\\s*\"(\\S+)\",\\s*to:\\s*(-?[\\d.]+|DIMENSION_MAX)," +
                "\\s*toInclusive:\\s*(true|false)\\s*}",
        ).findAll(table!!.groupValues[1]).map { row ->
            val (emoji, to, inclusive) = row.destructured
            // The last row's edge is the master's own `DIMENSION_MAX`.
            Triple(emoji, if (to == "DIMENSION_MAX") 1.0 else to.toDouble(), inclusive == "true")
        }.toList()
    }

    @Test
    fun theTableCarriesTheMastersSixBandsVerbatim() {
        val documented = masterBands()
        assertThat(documented).hasSize(6)
        assertThat(VALENCE_SIX.map { Triple(it.emoji, it.to, it.toInclusive) })
            .containsExactlyElementsIn(documented)
            .inOrder()
    }

    @Test
    fun glyphWordAndPositionComeOutOfTheTwenty() {
        for (band in VALENCE_SIX) {
            val anchor = STANCE_ANCHORS.first { it.emoji == band.emoji }
            assertThat(band.label).isEqualTo(anchor.label)
            assertThat(band.pDirected).isEqualTo(anchor.at.directed)
        }
    }

    @Test
    fun theSixAreThePureValenceSpine() {
        assertThat(VALENCE_SIX.map { it.pDirected })
            .containsExactly(-0.90, -0.55, -0.15, 0.15, 0.55, 0.90)
            .inOrder()
    }

    @Test
    fun theBandsCoverTheClosedAxisMonotonically() {
        val edges = VALENCE_SIX.map { it.to }
        assertThat(edges).isInOrder()
        assertThat(edges.last()).isEqualTo(1.0)
    }

    @Test
    fun exactlyZeroReadsTheGentlePositiveFace() {
        assertThat(nearestValenceAnchor(0.0).emoji).isEqualTo("🙂")
        // A drag that never moved horizontally produces negative zero,
        // and it is the same pick.
        assertThat(nearestValenceAnchor(-0.0).emoji).isEqualTo("🙂")
    }

    @Test
    fun everyBandEdgeGoesToTheMilderFace() {
        // Negative side: the row stops short of its edge, so the edge
        // belongs to the band above it.
        assertThat(nearestValenceAnchor(-0.725).emoji).isEqualTo("🙁")
        assertThat(nearestValenceAnchor(-0.35).emoji).isEqualTo("😕")
        // Positive side: the row keeps its edge, which is again the band
        // nearer zero.
        assertThat(nearestValenceAnchor(0.35).emoji).isEqualTo("🙂")
        assertThat(nearestValenceAnchor(0.725).emoji).isEqualTo("😊")
    }

    @Test
    fun justInsideEachEdgeReadsTheBandThatOwnsTheInterval() {
        assertThat(nearestValenceAnchor(-0.7250001).emoji).isEqualTo("😠")
        assertThat(nearestValenceAnchor(-0.7249999).emoji).isEqualTo("🙁")
        assertThat(nearestValenceAnchor(-0.3500001).emoji).isEqualTo("🙁")
        assertThat(nearestValenceAnchor(-0.3499999).emoji).isEqualTo("😕")
        assertThat(nearestValenceAnchor(-0.0000001).emoji).isEqualTo("😕")
        assertThat(nearestValenceAnchor(0.0000001).emoji).isEqualTo("🙂")
        assertThat(nearestValenceAnchor(0.3499999).emoji).isEqualTo("🙂")
        assertThat(nearestValenceAnchor(0.3500001).emoji).isEqualTo("😊")
        assertThat(nearestValenceAnchor(0.7249999).emoji).isEqualTo("😊")
        assertThat(nearestValenceAnchor(0.7250001).emoji).isEqualTo("😍")
    }

    @Test
    fun eachBandReadsItsOwnAnchorAsItself() {
        for (band in VALENCE_SIX) {
            assertThat(nearestValenceAnchor(band.pDirected).emoji).isEqualTo(band.emoji)
        }
    }

    @Test
    fun bothPolesAndTheTapDefaultRead() {
        assertThat(nearestValenceAnchor(-1.0).emoji).isEqualTo("😠")
        assertThat(nearestValenceAnchor(1.0).emoji).isEqualTo("😍")
        assertThat(nearestValenceAnchor(0.1).emoji).isEqualTo("🙂")
    }

    @Test
    fun outOfRangeIsClampedInRatherThanRefused() {
        assertThat(nearestValenceAnchor(-4.0).emoji).isEqualTo("😠")
        assertThat(nearestValenceAnchor(4.0).emoji).isEqualTo("😍")
        // NaN names no point on the axis, so it folds to the origin's
        // face — the same normalisation web's `clampDimension` makes.
        assertThat(nearestValenceAnchor(Double.NaN).emoji).isEqualTo("🙂")
    }

    @Test
    fun everyHundredthOfTheAxisFallsInsideABand() {
        for (step in -100..100) {
            assertThat(VALENCE_SIX).contains(nearestValenceAnchor(step / 100.0))
        }
    }

    @Test
    fun theOneNumberIsWrittenTheWayThePairWritesItsHalf() {
        assertThat(valenceExact(0.1)).isEqualTo("+0.10")
        assertThat(valenceExact(-0.9)).isEqualTo("-0.90")
        assertThat(valenceExact(0.0)).isEqualTo("+0.00")
    }
}
