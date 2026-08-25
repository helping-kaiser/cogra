package com.cogra.core.designsystem

import androidx.compose.ui.geometry.Offset
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The invariant design.md §8.3 states: the drawn field IS the value
 * space, and the knob never leaves the drawn shape. These are plain
 * numbers, so they are checked as numbers rather than by eye.
 */
class StanceFieldGeometryTest {

    // The field at a density of 1: the dp values are the pixel values.
    private val halfSide = FIELD_SIZE.value / 2f
    private val corner = FIELD_CORNER.value
    private val knob = KNOB_RADIUS.value
    private val extent = FIELD_EXTENT.value

    @Test
    fun oneUnitOfTravelIsTheHalfSideLessTheKnob() {
        // What makes the knob's EDGE land on the field's edge at ±1
        // rather than hanging over it.
        assertThat(extent).isWithin(0.001f).of(halfSide - knob)
    }

    @Test
    fun travelMapsAcrossForValenceAndUpForConnection() {
        val point = stancePointFromTravel(Offset(extent / 2f, -extent / 4f), extent)

        assertThat(point.directed).isWithin(0.001).of(0.5)
        assertThat(point.interest).isWithin(0.001).of(0.25)
    }

    @Test
    fun eachAxisClampsOnItsOwnSoTheCornersStayReachable() {
        // Clamping by distance would make (±1, ±1) unreachable, and the
        // control never refuses a choice (design.md §8.2).
        val corner = stancePointFromTravel(Offset(extent * 9f, -extent * 9f), extent)

        assertThat(corner).isEqualTo(StancePoint(1.0, 1.0))
    }

    @Test
    fun anUnmeasuredFieldPicksTheOriginRatherThanDividingByZero() {
        assertThat(stancePointFromTravel(Offset(40f, 40f), 0f)).isEqualTo(StancePoint.Origin)
    }

    @Test
    fun theKnobStaysInsideTheDrawnFieldAtEveryCornerAndEdge() {
        val extremes = listOf(
            StancePoint(1.0, 1.0),
            StancePoint(1.0, -1.0),
            StancePoint(-1.0, 1.0),
            StancePoint(-1.0, -1.0),
            StancePoint(1.0, 0.0),
            StancePoint(-1.0, 0.0),
            StancePoint(0.0, 1.0),
            StancePoint(0.0, -1.0),
        )

        for (point in extremes) {
            assertThat(knobInsideField(point, halfSide, corner, knob, extent)).isTrue()
        }
    }

    @Test
    fun theKnobStaysInsideTheDrawnFieldAcrossTheWholeSquare() {
        // A dense sweep, because a rounded corner fails in a band rather
        // than at a single point.
        for (i in -20..20) {
            for (j in -20..20) {
                val point = StancePoint(i / 20.0, j / 20.0)
                assertThat(knobInsideField(point, halfSide, corner, knob, extent)).isTrue()
            }
        }
    }

    @Test
    fun travelBeyondTheFieldStillLeavesTheKnobInside() {
        // The adversarial case: a thumb dragged far past the field in
        // every direction. Clamping happens in the mapping, so the knob
        // has nowhere outside to go.
        for (i in -8..8) {
            for (j in -8..8) {
                if (i == 0 && j == 0) continue
                val travel = Offset(extent * i * 3f, extent * j * 3f)
                val point = stancePointFromTravel(travel, extent)
                assertThat(knobInsideField(point, halfSide, corner, knob, extent)).isTrue()
            }
        }
    }

    @Test
    fun theKnobRadiusIsTheSoftestCornerAKnobParkedInItStillFits() {
        // Why the two constants are one number: at the knob radius the
        // knob fills the corner exactly, and any softer corner cuts into
        // a knob parked there.
        val cornered = StancePoint(1.0, 1.0)

        assertThat(knobInsideField(cornered, halfSide, corner, knob, extent)).isTrue()
        assertThat(knobInsideField(cornered, halfSide, corner * 1.5f, knob, extent)).isFalse()
        assertThat(knobInsideField(cornered, halfSide, corner * 2f, knob, extent)).isFalse()
    }

    @Test
    fun theCentreOfTheFieldIsTheOrigin() {
        val at = knobOffset(StancePoint.Origin, extent)

        assertThat(at.x).isWithin(0.001f).of(0f)
        assertThat(at.y).isWithin(0.001f).of(0f)
    }
}
