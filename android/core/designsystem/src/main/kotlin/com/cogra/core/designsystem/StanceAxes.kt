// What a record family calls the two slots it fills. The control owns
// the geometry; the family owns the words.
//
// One gesture, one face table, one ceremony (jakob, 2026-09-14): an
// Affinity is not a second kind of feeling, so nothing here restyles a
// pixel or moves a knob — only the words at the axes belong to the
// family. The web app carries the same parameter under the same name
// (`StanceAxes` in `web/src/lib/ui/stance-format.ts`), which is what
// keeps the two apps asking one question.

package com.cogra.core.designsystem

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource

/**
 * The master's six words (`STANCE_AXES`, `PadAxes` in StancePad.d.ts): the
 * question each axis asks, and the four ends the field draws in its
 * gutters. The poles say where an axis ENDS and the questions what it
 * ASKS; the field draws the ends only, and the questions reach the
 * sliders, the typed fields and every spoken readout (backlog item 79).
 */
data class StanceAxes(
    /** What the `p_d` axis asks. */
    @param:StringRes val directed: Int,
    /** What the `p_i` axis asks. */
    @param:StringRes val interest: Int,
    /** The `p_d` axis's low end, drawn left of the field. */
    @param:StringRes val left: Int,
    /** The `p_d` axis's high end, drawn right of the field. */
    @param:StringRes val right: Int,
    /** The `p_i` axis's low end, drawn under the field. */
    @param:StringRes val bottom: Int,
    /** The `p_i` axis's high end, drawn over the field. */
    @param:StringRes val top: Int,
) {
    companion object {
        /**
         * An opinion's own words — `For or against`, `Against`/`For`;
         * `How much reaches you`, `Less`/`More` — toward a post, a comment
         * or a person.
         */
        val Opinion = StanceAxes(
            directed = R.string.stance_axis_directed,
            interest = R.string.stance_axis_interest,
            left = R.string.valence_pole_against,
            right = R.string.valence_pole_for,
            bottom = R.string.stance_pole_less,
            top = R.string.stance_pole_more,
        )

        /**
         * An Affinity toward a Type — the gesture a topic's stance row
         * wears (`AFFINITY_AXES`, ruled 2026-09-15, drawn on
         * `TagPageHeldPad`): association and attraction in the same two
         * signed slots, `Dislike`/`Like` across and `Far away`/`Close to
         * me` up.
         */
        val Affinity = StanceAxes(
            directed = R.string.stance_axis_affinity_directed,
            interest = R.string.stance_axis_affinity_interest,
            left = R.string.stance_pole_affinity_left,
            right = R.string.stance_pole_affinity_right,
            bottom = R.string.stance_pole_affinity_bottom,
            top = R.string.stance_pole_affinity_top,
        )
    }
}

/** The family's six words, resolved — the shape the ranged field takes. */
@Composable
fun StanceAxes.words(): PairAxes = PairAxes(
    directed = stringResource(directed),
    interest = stringResource(interest),
    left = stringResource(left),
    right = stringResource(right),
    bottom = stringResource(bottom),
    top = stringResource(top),
)
