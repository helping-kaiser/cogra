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

/**
 * The question each axis asks, as this record family words it.
 *
 * **Two words, not the master's six.** `AFFINITY_AXES` on the canvas
 * (`design/designs/canonical/screens/_shared.jsx`) carries the two
 * questions AND the four ends, because the drawn pad's field labels its
 * corners. This pad does not: nothing in [StancePad] or [StanceSlider]
 * renders an end word, so the four have no surface here to reach. The
 * two questions do — they are the sliders' labels, the typed fields'
 * labels, and every spoken readout — which is exactly the half the
 * ruling says the accessible route must ask (`TagPageHeldPad`: "the two
 * questions reach the sliders, the typed fields and every spoken
 * readout"). That this pad draws no ends at all is its own gap, and it
 * predates the Affinity words.
 */
data class StanceAxes(
    /** What the `p_d` axis asks. */
    @param:StringRes val directed: Int,
    /** What the `p_i` axis asks. */
    @param:StringRes val interest: Int,
) {
    companion object {
        /**
         * An opinion's own words — the default every surface had before
         * families named theirs, and still the words toward a post, a
         * comment or a person.
         */
        val Opinion = StanceAxes(
            directed = R.string.stance_axis_directed,
            interest = R.string.stance_axis_interest,
        )

        /**
         * An Affinity toward a Type — the gesture a topic's stance row
         * wears (ruled 2026-09-15, drawn on `TagPageHeldPad`). It fills
         * the same two signed slots with association and attraction, and
         * its questions are neither the opinion's: "how you stand" names
         * a verdict this record does not carry, and "in your world"
         * names reach rather than closeness.
         */
        val Affinity = StanceAxes(
            directed = R.string.stance_axis_affinity_directed,
            interest = R.string.stance_axis_affinity_interest,
        )
    }
}
