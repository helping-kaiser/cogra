package com.cogra.core.designsystem

import androidx.compose.ui.geometry.Offset
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.io.File

/**
 * The ranged pair field's geometry (`StancePad.jsx`'s `padPairFrom` /
 * `padPercentOf` with `ranges`), with the ranges and pole words read out of
 * the masters and boards rather than transcribed.
 */
class PairFieldTest {

    private val readout = File("../../../design/components/stance/StanceReadout.jsx").readText()
    private val tagBoard = File("../../../design/designs/canonical/screens/TagPadCompose.jsx").readText()
    private val refBoard = File("../../../design/designs/canonical/screens/RefPair.jsx").readText()

    private val half = 100f

    @Test
    fun theTagFloorAndRangesAreTheMasters() {
        assertThat(readout).contains("export const TAG_RELEVANCE_FLOOR = ${PairRanges.TAG_RELEVANCE_FLOOR};")
        assertThat(readout).contains("pDirected: { min: TAG_RELEVANCE_FLOOR, max: DIMENSION_MAX }")
        assertThat(readout).contains("pInterest: { min: 0, max: DIMENSION_MAX }")
        assertThat(PairRanges.Tag.directed).isEqualTo(PairRange(0.01, 1.0))
        assertThat(PairRanges.Tag.interest).isEqualTo(PairRange(0.0, 1.0))
    }

    @Test
    fun theAxesWordsAreTheBoards() {
        fun board(text: String, axes: PairAxes) {
            for ((key, word) in listOf(
                "directed" to axes.directed,
                "interest" to axes.interest,
                "left" to axes.left,
                "right" to axes.right,
                "bottom" to axes.bottom,
                "top" to axes.top,
            )) {
                assertThat(text).contains("  $key: \"$word\",")
            }
        }
        board(tagBoard, PairAxes.Tag)
        board(refBoard, PairAxes.Citation)
    }

    @Test
    fun aTagDragNeverGoesBelowTheRelevanceFloor() {
        val picked = pairFrom(PairPoint(0.1, 1.0), Offset(-10_000f, 0f), half, PairRanges.Tag)
        assertThat(picked.directed).isEqualTo(0.01)
    }

    @Test
    fun theReleaseLandsOnTheGridAndNeverBelowTheRelevanceFloor() {
        // Relevance to 0.0137 and confidence to 0.4371 under the thumb.
        val perX = (1.0 - PairRanges.TAG_RELEVANCE_FLOOR) / (2 * half)
        val travel = Offset(((0.0137 - 0.1) / perX).toFloat(), (-(0.4371 - 0.0) * 2 * half).toFloat())
        val parked = pairReleased(PairPoint(0.1, 0.0), travel, half, PairRanges.Tag)
        assertThat(parked).isEqualTo(PairPoint(PairRanges.TAG_RELEVANCE_FLOOR, 0.44))
    }

    @Test
    fun aSignedReleaseLandsANearZeroAxisOnPositiveZero() {
        val parked = pairReleased(PairPoint(0.0, 0.0), Offset(-0.004f * half, -0.0031f * half), half, PairRanges.Signed)
        assertThat(parked).isEqualTo(PairPoint(0.0, 0.0))
    }

    @Test
    fun aTagsConfidenceRunsFromZeroToOne() {
        assertThat(pairFrom(PairPoint(0.5, 0.5), Offset(0f, 10_000f), half, PairRanges.Tag).interest).isEqualTo(0.0)
        assertThat(pairFrom(PairPoint(0.5, 0.5), Offset(0f, -10_000f), half, PairRanges.Tag).interest).isEqualTo(1.0)
    }

    @Test
    fun oneFullTravelIsTheWholeRange() {
        // Signed: 2*half pixels cross the whole [-1, 1] span.
        val signed = pairFrom(PairPoint(-1.0, -1.0), Offset(2 * half, -2 * half), half, PairRanges.Signed)
        assertThat(signed).isEqualTo(PairPoint(1.0, 1.0))
        // Tag confidence: the same travel crosses [0, 1].
        val tag = pairFrom(PairPoint(0.5, 0.0), Offset(0f, -half), half, PairRanges.Tag)
        assertThat(tag.interest).isWithin(1e-9).of(0.5)
    }

    @Test
    fun screenDownIsLessInterest() {
        val picked = pairFrom(PairPoint(0.0, 0.0), Offset(0f, half / 2), half, PairRanges.Signed)
        assertThat(picked.interest).isWithin(1e-9).of(-0.5)
    }

    @Test
    fun anUnmeasuredFieldKeepsTheBaseClamped() {
        assertThat(pairFrom(PairPoint(-0.5, 0.5), Offset(99f, 99f), 0f, PairRanges.Tag)).isEqualTo(PairPoint(0.01, 0.5))
    }

    @Test
    fun theKnobSitsAtItsFractionOfTheTravelBox() {
        val side = 200f
        val inset = 10f
        val centre = pairKnobAt(PairPoint(0.0, 0.0), side, inset, PairRanges.Signed)
        assertThat(centre).isEqualTo(Offset(100f, 100f))
        val corner = pairKnobAt(PairPoint(1.0, 1.0), side, inset, PairRanges.Signed)
        assertThat(corner).isEqualTo(Offset(190f, 10f))
        // A tag's floor is the field's left edge, its full confidence the top.
        val floor = pairKnobAt(PairPoint(0.01, 1.0), side, inset, PairRanges.Tag)
        assertThat(floor).isEqualTo(Offset(10f, 10f))
    }

    @Test
    fun onlyARangeThatCrossesZeroDrawsADeadLine() {
        assertThat(PairRanges.Signed.directed.zeroFraction).isEqualTo(0.5)
        assertThat(PairRanges.Tag.directed.zeroFraction).isNull()
        assertThat(PairRanges.Tag.interest.zeroFraction).isNull()
    }
}
