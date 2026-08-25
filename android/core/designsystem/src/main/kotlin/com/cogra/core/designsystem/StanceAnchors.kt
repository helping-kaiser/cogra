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
 * The readout for [point]: the nearest anchor by Euclidean distance.
 * Ties go to the earlier anchor, which keeps the mapping a pure function
 * of the table's order rather than of iteration luck.
 *
 * This reads PICKS and non-zero bundles. A standing goes through
 * [standingReadout] instead, which knows about the zero bundle.
 */
fun nearestStanceAnchor(point: StancePoint): StanceAnchor =
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
 * Whether this is the zero bundle: a standing at exactly `(0, 0)`,
 * severed or netted there. Severance produces exact zero by
 * construction — it stages the counter-records that cancel the bundle —
 * so exact equality is the test, not a tolerance.
 */
val StancePoint.isZeroBundle: Boolean
    get() = directed == 0.0 && interest == 0.0

/**
 * The face a STANDING reads as (design.md §8.4). A bundle standing at
 * exactly `(0, 0)` never speaks through the table: it is the absence of
 * a feeling, and reading it as its nearest neighbour — "🙂 Nice" — is a
 * lie. It gets the shrug and the no-standing wording instead, on every
 * surface that shows a standing.
 */
fun standingReadout(standing: StancePoint): StanceAnchor =
    if (standing.isZeroBundle) ZERO_BUNDLE_READOUT else nearestStanceAnchor(standing)
