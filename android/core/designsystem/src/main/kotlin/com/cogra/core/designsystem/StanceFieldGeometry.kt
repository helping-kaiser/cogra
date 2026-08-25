// The stance field's geometry (design.md §8.3): **the drawn field is the
// value space**.
//
// The field is a soft rounded square whose corners are `(±1, ±1)`. The
// knob travels exactly the field and never leaves the drawn shape, so
// what the finger sees is what the value does — a knob that could be
// dragged outside its own drawing is the control lying about its range.
//
// Two numbers make that true at the same time. The knob's CENTRE travels
// a half-extent one knob-radius short of the drawn edge, so the knob's
// own edge lands on the field's edge at `±1` rather than hanging over it.
// And the drawn corner radius is the knob radius — the LARGEST rounding
// the corners can carry without cutting into a knob parked at `(±1, ±1)`.
// At exactly that value the knob's centre coincides with the corner
// arc's centre and the two circles are one, so the corner is as soft as
// it can be while the knob fills it precisely.
//
// Everything here is plain math on pixels: no Compose, so it unit-tests
// directly and the drawing and the gesture read the same numbers.

package com.cogra.core.designsystem

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/** The drawn field's side. Its own box is the whole `[-1, +1]²`. */
internal val FIELD_SIZE = 240.dp

/**
 * The knob's outer radius, and — necessarily — the field's corner radius.
 * They are one number because that is the softest corner a knob parked
 * in it still fits; see the file comment.
 */
internal val KNOB_RADIUS = 20.dp

/** The knob's filled centre, inside its ring. */
internal val KNOB_DOT_RADIUS = 13.dp

/** The field's corner rounding — the knob radius, for the reason above. */
internal val FIELD_CORNER = KNOB_RADIUS

/**
 * How far the knob's CENTRE travels for one unit of either parameter:
 * the half-side less the knob radius, so the knob's edge reaches the
 * field's edge at `±1` exactly.
 */
internal val FIELD_EXTENT = FIELD_SIZE / 2 - KNOB_RADIUS

/**
 * The pair this much accumulated travel picks. Each axis clamps on its
 * own — never by distance — because the whole square is reachable,
 * corners included, and the control never refuses a choice (design.md
 * §8.2). Screen y grows downward and connection grows upward, so the
 * vertical mapping inverts.
 *
 * A zero extent — an unmeasured field — picks the origin rather than
 * dividing by zero.
 */
internal fun stancePointFromTravel(travel: Offset, extentPx: Float): StancePoint {
    if (extentPx <= 0f) return StancePoint.Origin
    return StancePoint(
        directed = (travel.x / extentPx).coerceIn(-1f, 1f).toDouble(),
        interest = (-travel.y / extentPx).coerceIn(-1f, 1f).toDouble(),
    )
}

/** Where the knob's centre sits for [point], offset from the field's centre. */
internal fun knobOffset(point: StancePoint, extentPx: Float): Offset = Offset(
    x = point.directed.toFloat().coerceIn(-1f, 1f) * extentPx,
    y = -point.interest.toFloat().coerceIn(-1f, 1f) * extentPx,
)

/**
 * The signed distance from the field's rounded-square boundary to a
 * point offset from its centre — negative inside, positive outside. The
 * standard rounded-box distance function; it is what lets a test assert
 * containment exactly rather than by eyeballing a screenshot.
 */
internal fun fieldDistance(from: Offset, halfSidePx: Float, cornerPx: Float): Float {
    val qx = abs(from.x) - (halfSidePx - cornerPx)
    val qy = abs(from.y) - (halfSidePx - cornerPx)
    val outside = hypot(max(qx, 0f), max(qy, 0f))
    return min(max(qx, qy), 0f) + outside - cornerPx
}

/**
 * Whether the knob drawn for [point] lies wholly inside the drawn field
 * — the invariant design.md §8.3 states and the pad has to keep under
 * any drag at all.
 */
internal fun knobInsideField(
    point: StancePoint,
    halfSidePx: Float,
    cornerPx: Float,
    knobPx: Float,
    extentPx: Float,
): Boolean = fieldDistance(knobOffset(point, extentPx), halfSidePx, cornerPx) + knobPx <= TOLERANCE_PX

/** One pixel of slack: the geometry is exact, float arithmetic is not. */
private const val TOLERANCE_PX = 0.5f
