// The emoji readout of the stance field (design.md §8.4).
//
// The committed value is the exact continuous pair; the face is a LOSSY
// readout of the edge being authored — this pick, not the bundle it
// joins. Decoupling the two is what lets the value stay continuous while
// the feedback stays legible, and it is why the anchor count controls
// readability only, never precision.
//
// Twenty anchors sit in the field and the readout is the nearest one by
// Euclidean distance. They are dense in the for-it-and-want-it quadrant,
// where most real stances land and small differences matter, and sparse
// at the extremes, where finer distinctions carry no meaning — a regular
// grid cannot express that and puts visible seams in a continuous field.
//
// The table in design.md §8.4 is the contract: both clients read these
// values, and a change there changes both apps.

package com.cogra.core.designsystem

import androidx.annotation.StringRes
import androidx.compose.runtime.Immutable

/**
 * A point in the stance field: valence on the horizontal, connection on
 * the vertical, each a continuous value on the closed `[-1, +1]`.
 */
@Immutable
data class StancePoint(val directed: Double, val interest: Double) {
    companion object {
        val Origin = StancePoint(0.0, 0.0)
    }
}

/** One readout anchor: a place in the field, its face, and its words. */
@Immutable
data class StanceAnchor(
    val at: StancePoint,
    val emoji: String,
    @get:StringRes val label: Int,
)

/** The twenty anchors of design.md §8.4, in the doc's own order. */
val STANCE_ANCHORS: List<StanceAnchor> = listOf(
    StanceAnchor(StancePoint(0.15, 0.15), "🙂", R.string.stance_anchor_nice),
    StanceAnchor(StancePoint(0.55, 0.20), "😊", R.string.stance_anchor_like_this),
    StanceAnchor(StancePoint(0.90, 0.25), "😍", R.string.stance_anchor_love_this),
    StanceAnchor(StancePoint(0.20, 0.60), "👀", R.string.stance_anchor_show_me_more),
    StanceAnchor(StancePoint(0.60, 0.65), "🤩", R.string.stance_anchor_really_into_this),
    StanceAnchor(StancePoint(0.25, 0.95), "🍿", R.string.stance_anchor_tell_me_everything),
    StanceAnchor(StancePoint(0.95, 0.90), "🔥", R.string.stance_anchor_all_in),
    StanceAnchor(StancePoint(-0.15, 0.15), "😕", R.string.stance_anchor_not_for_me),
    StanceAnchor(StancePoint(-0.55, 0.25), "🙁", R.string.stance_anchor_dont_like_this),
    StanceAnchor(StancePoint(-0.90, 0.30), "😠", R.string.stance_anchor_really_against_this),
    StanceAnchor(StancePoint(-0.45, 0.75), "😤", R.string.stance_anchor_against_keep_posted),
    StanceAnchor(StancePoint(-0.90, 0.90), "🤬", R.string.stance_anchor_against_want_all),
    StanceAnchor(StancePoint(0.20, -0.20), "😶", R.string.stance_anchor_fine_not_for_me),
    StanceAnchor(StancePoint(0.70, -0.30), "😌", R.string.stance_anchor_good_not_my_world),
    StanceAnchor(StancePoint(0.30, -0.80), "🙈", R.string.stance_anchor_rather_not_see),
    StanceAnchor(StancePoint(0.90, -0.85), "🤐", R.string.stance_anchor_good_keep_it_away),
    StanceAnchor(StancePoint(-0.20, -0.20), "😑", R.string.stance_anchor_meh),
    StanceAnchor(StancePoint(-0.60, -0.45), "😖", R.string.stance_anchor_dislike_keep_away),
    StanceAnchor(StancePoint(-0.35, -0.85), "🚫", R.string.stance_anchor_keep_this_away),
    StanceAnchor(StancePoint(-0.90, -0.90), "💀", R.string.stance_anchor_absolutely_not),
)

/**
 * The nearest anchor by Euclidean distance. Ties go to the earlier anchor,
 * which keeps the mapping a pure function of the table's order rather than
 * of iteration luck.
 *
 * INTERNAL ON PURPOSE: nothing draws a face from the bare table. Every pair
 * drawn as a face reads through [bundleReadout], which asks the table only
 * when both numbers are non-zero — the module boundary is what keeps a
 * surface in another module from bypassing that rule.
 */
internal fun nearestStanceAnchor(point: StancePoint): StanceAnchor =
    STANCE_ANCHORS.minBy { anchor ->
        val dd = anchor.at.directed - point.directed
        val di = anchor.at.interest - point.interest
        dd * dd + di * di
    }

/**
 * The zero bundle's own readout, outside the table (design.md §8.4). It
 * is deliberately not one of [STANCE_ANCHORS]: the table maps a felt
 * value onto a face, and this is the absence of one.
 */
val ZERO_BUNDLE_READOUT = StanceAnchor(
    at = StancePoint.Origin,
    emoji = "🤷",
    label = R.string.stance_standing_zero,
)

/**
 * ONE NUMBER AT ZERO THINKS; BOTH AT ZERO SHRUG (jakob 2026-10-20: "shrug
 * should be the 0,0 only"). A state with exactly one number at zero — an
 * unreachable landing, and the one-axis 0.00, which is `(0, 1)` with the
 * pin — wears 🤔, outside the table like 🤷 and 🫥, so the held,
 * unreachable state never reads as severance's face. The master is
 * `StanceReadout.jsx`'s `UNREACHABLE_EMOJI`.
 */
const val UNREACHABLE_EMOJI = "🤔"

/**
 * Whether this pair is exactly `(0, 0)`. Severance produces exact zero by
 * construction — it stages the counter-records that cancel the bundle —
 * and so does an empty sign, so exact equality is the test, not a
 * tolerance. Which of the two a `(0, 0)` is, the pair cannot say: the
 * bundle's `severed` does.
 */
val StancePoint.isZeroBundle: Boolean
    get() = directed == 0.0 && interest == 0.0

/**
 * A PICK OF NOTHING SAYS NOTHING (`EMPTY_PICK_LABEL`): a pick at exactly
 * `(0, 0)` adds nothing to what stands, and a standing there that was never
 * walked back — an empty sign joined it (jakob 2026-10-21) — is spoken this
 * way too. `Walked back` ([R.string.stance_standing_zero]) would be false
 * of either.
 */
val EMPTY_PICK_LABEL: Int = R.string.stance_says_nothing

/** A standing walked back to nothing, as a label beside the shrug (`SEVERED_LABEL`). */
val SEVERED_LABEL: Int = R.string.stance_standing_zero

/**
 * The state a pair with exactly one number at zero reads as, by the sign of
 * the number that stands (`unreachableHead`).
 */
@StringRes
fun unreachableHeadLabel(pair: StancePoint): Int = when {
    pair.directed == 0.0 && pair.interest > 0.0 -> R.string.stance_unreachable_interested
    pair.directed == 0.0 -> R.string.stance_unreachable_rather_not
    pair.directed > 0.0 -> R.string.stance_unreachable_for
    else -> R.string.stance_unreachable_against
}

/**
 * FACES FOLLOW THE VALUE, EVERYWHERE (jakob 2026-10-21, seam 242; the
 * master's `bundleReadout`). Any pair drawn as a face — the pick, a standing
 * opinion, the resting anchor, a record's row, the snackbar — reads here,
 * and the table reads only a pair with both numbers non-zero: exactly
 * `(0, 0)` shrugs and speaks [zeroLabel] (the context knows which zero it
 * is), exactly one zero thinks and names its state. 🫥 stays the control's
 * own, outside every value.
 */
fun bundleReadout(pair: StancePoint, @StringRes zeroLabel: Int = SEVERED_LABEL): StanceAnchor {
    val directedZero = pair.directed == 0.0
    val interestZero = pair.interest == 0.0
    return when {
        directedZero && interestZero -> ZERO_BUNDLE_READOUT.copy(label = zeroLabel)
        directedZero || interestZero -> StanceAnchor(pair, UNREACHABLE_EMOJI, unreachableHeadLabel(pair))
        else -> nearestStanceAnchor(pair)
    }
}
