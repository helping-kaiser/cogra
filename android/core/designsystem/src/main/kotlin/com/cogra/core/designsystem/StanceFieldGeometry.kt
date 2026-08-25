// The stance field's geometry (design.md §8.3): **the drawn field is the
// value space**.
//
// The field is a soft rounded square whose corners are `(±1, ±1)`. The
// knob travels exactly the field and never leaves the drawn shape, so
// what the finger sees is what the value does — a knob that could be
// dragged outside its own drawing is the control lying about its range.
//
// Containment is STRUCTURAL rather than arithmetic. The knob's CENTRE
// travels a box inset from the drawn field, and the inset is the
// smallest one that keeps a knob of the drawn size inside the drawn
// corner — so a knob outside the field is not a bug this file can have.
// [knobTravelInset] derives it; the same derivation runs on web
// (`web/src/lib/stance/pad-geometry.ts`), so both clients place the knob
// by the same rule rather than by two sets of hand-picked numbers.
//
// Everything here is plain math on dp: no Compose composition, so it
// unit-tests directly and the drawing and the gesture read the same
// numbers.

package com.cogra.core.designsystem

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/** The drawn field's side. Its own box is the whole `[-1, +1]²`. */
internal val FIELD_SIZE = 240.dp

/** The knob's outer radius — the 20dp across that web draws it at. */
internal val KNOB_RADIUS = 10.dp

/** The knob's filled centre, inside its ring. */
internal val KNOB_DOT_RADIUS = 6.dp

/** The field's corner rounding: the M3 shape scale's 16dp rung (design.md §4). */
internal val FIELD_CORNER = 16.dp

/**
 * How far the knob's centre stays clear of the field's edge so the knob
 * itself stays inside the drawn shape.
 *
 * A flat edge only asks for the knob's own radius. The rounded corner
 * asks for more: the corner's arc centre sits `r` in from both edges,
 * the inset travel box puts its own corner `√2·(r − inset)` away from
 * that arc centre, and the knob's rim reaches `k` further still.
 * Requiring that to stay within `r` is the second term. Where the corner
 * is gentler than the knob is wide, the first term already covers it.
 */
internal fun knobTravelInset(corner: Dp = FIELD_CORNER, knob: Dp = KNOB_RADIUS): Dp =
    maxOf(knob, corner - (corner - knob) / SQRT_2)

private const val SQRT_2 = 1.4142135f

/**
 * How far the knob's CENTRE travels for one unit of either parameter:
 * the half-side less that inset, so one dp of finger travel is one dp of
 * knob travel and the drawn field reads as the value space.
 */
internal val FIELD_EXTENT = FIELD_SIZE / 2 - knobTravelInset()

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
