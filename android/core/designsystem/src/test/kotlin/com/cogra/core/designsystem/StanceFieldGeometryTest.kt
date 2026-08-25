package com.cogra.core.designsystem

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.dp
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
    fun oneUnitOfTravelIsTheHalfSideLessTheInset() {
        assertThat(extent).isWithin(0.001f).of(halfSide - knobTravelInset().value)
    }

    @Test
    fun theFieldTakesTheShapeScalesSixteenRung() {
        // design.md §4: the M3 rungs are the only radii that exist, and
        // an off-scale corner is how the two clients drift apart.
        assertThat(corner).isIn(listOf(4f, 8f, 12f, 16f, 28f))
    }

    @Test
    fun theInsetIsTheKnobRadiusWhenTheCornerIsNoSofterThanTheKnob() {
        // A flat edge — or a corner tighter than the knob — asks for the
        // knob's own radius and nothing more.
        assertThat(knobTravelInset(corner = 4.dp, knob = 10.dp).value).isWithin(0.001f).of(10f)
        assertThat(knobTravelInset(corner = 10.dp, knob = 10.dp).value).isWithin(0.001f).of(10f)
    }

    @Test
    fun aSofterCornerAsksForMoreInsetThanTheKnobRadius() {
        assertThat(knobTravelInset(corner = 28.dp, knob = 10.dp).value)
            .isGreaterThan(knobTravelInset(corner = 16.dp, knob = 10.dp).value)
    }

    @Test
    fun theDerivedInsetContainsTheKnobForEveryCornerOnTheShapeScale() {
        // The formula, not the chosen numbers: whatever rung the field
        // takes, the knob it derives an inset for stays inside it.
        for (rung in listOf(4f, 8f, 12f, 16f, 28f)) {
            val inset = knobTravelInset(corner = rung.dp, knob = knob.dp).value
            val travel = halfSide - inset
            assertThat(knobInsideField(StancePoint(1.0, 1.0), halfSide, rung, knob, travel)).isTrue()
        }
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

    // -- A second drag, from the pick already standing (design.md §8.3) --

    @Test
    fun aSecondDragAdjustsThePickItStartsFromRatherThanStartingOver() {
        // The parked pad's field moves the knob by the same accumulated
        // travel the opening drag uses — from where it already stands.
        val moved = stancePointFrom(StancePoint(0.5, 0.25), Offset(extent / 4f, -extent / 4f), extent)

        assertThat(moved.directed).isWithin(0.001).of(0.75)
        assertThat(moved.interest).isWithin(0.001).of(0.5)
    }

    @Test
    fun aDragFromTheOriginIsTheOpeningDragsOwnRule() {
        // One rule for how a finger moves the knob, not two: the opening
        // drag is this one with the origin as its base.
        val travel = Offset(extent / 3f, -extent / 5f)

        assertThat(stancePointFrom(StancePoint.Origin, travel, extent))
            .isEqualTo(stancePointFromTravel(travel, extent))
    }

    @Test
    fun aSecondDragClampsTheSumSoAnOffCentreBaseStillReachesTheCorner() {
        // Clamping the travel first would stop the knob short whenever
        // the base already sat off centre — the far corner has to stay
        // reachable from anywhere (design.md §8.2).
        val cornered = stancePointFrom(StancePoint(-0.5, -0.5), Offset(extent * 4f, -extent * 4f), extent)

        assertThat(cornered).isEqualTo(StancePoint(1.0, 1.0))
    }

    @Test
    fun anUnmeasuredFieldKeepsTheBaseRatherThanDividingByZero() {
        assertThat(stancePointFrom(StancePoint(0.4, -0.2), Offset(40f, 40f), 0f))
            .isEqualTo(StancePoint(0.4, -0.2))
    }

    @Test
    fun noSecondDragFromAnywhereEverPutsTheKnobOutsideTheDrawnField() {
        // The invariant has to survive the re-drag path too, from every
        // base the first drag could have left the knob at.
        for (bd in -4..4) {
            for (bi in -4..4) {
                val base = StancePoint(bd / 4.0, bi / 4.0)
                for (i in -6..6) {
                    for (j in -6..6) {
                        val travel = Offset(extent * i * 2f, extent * j * 2f)
                        val point = stancePointFrom(base, travel, extent)
                        assertThat(knobInsideField(point, halfSide, corner, knob, extent)).isTrue()
                    }
                }
            }
        }
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
    fun theInsetIsTheSmallestOneThatContainsTheKnob() {
        // Tight, not generous: a hair less and the corner cuts in.
        val cornered = StancePoint(1.0, 1.0)
        val looser = halfSide - (knobTravelInset().value - 0.5f)

        assertThat(knobInsideField(cornered, halfSide, corner, knob, extent)).isTrue()
        assertThat(knobInsideField(cornered, halfSide, corner, knob, looser)).isFalse()
    }

    @Test
    fun aSofterCornerThanTheFieldWasInsetForWouldCutIntoTheKnob() {
        val cornered = StancePoint(1.0, 1.0)

        assertThat(knobInsideField(cornered, halfSide, corner * 2f, knob, extent)).isFalse()
    }

    @Test
    fun theCentreOfTheFieldIsTheOrigin() {
        val at = knobOffset(StancePoint.Origin, extent)

        assertThat(at.x).isWithin(0.001f).of(0f)
        assertThat(at.y).isWithin(0.001f).of(0f)
    }
}
