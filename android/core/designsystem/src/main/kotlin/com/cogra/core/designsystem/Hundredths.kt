// THE HUNDREDTHS GRID (jakob 2026-10-20): a pick is a value in
// [-1.00, +1.00] at step 0.01, and release lands it on the nearest hundredth
// (ComposePad.md, EditPad.md) — so the number a readout prints is the pick
// itself, and an exact-zero gate is reached by a pick that reads `+0.00`
// rather than missed by a float's 0.004. The web's twin is
// `snapDimension` in `lib/stance/model.ts`; both pin the same table.

package com.cogra.core.designsystem

import kotlin.math.abs
import kotlin.math.roundToLong
import kotlin.math.sign

/**
 * [value] on the hundredths grid: clipped to [-1, +1], then the nearest
 * hundredth. Halves round away from zero, so a pick and its mirror land on
 * mirrored hundredths — `roundToLong` on the magnitude is the web's
 * `Math.round` exactly, which keeps the two clients on one grid. NaN folds to
 * the origin and −0 to +0 (the PR-91 rider).
 */
fun hundredth(value: Double): Double {
    if (value.isNaN()) return 0.0
    val bounded = value.coerceIn(-1.0, 1.0)
    return sign(bounded) * (abs(bounded) * HUNDREDTHS_PER_UNIT).roundToLong() / HUNDREDTHS_PER_UNIT + 0.0
}

/** How many grid steps one unit of a dimension holds. */
private const val HUNDREDTHS_PER_UNIT = 100.0

/** Both slots of a ranged pick on the grid, then inside the field's reach. */
fun PairRanges.snap(point: PairPoint): PairPoint = PairPoint(
    directed = directed.clamp(hundredth(point.directed)),
    interest = interest.clamp(hundredth(point.interest)),
)
