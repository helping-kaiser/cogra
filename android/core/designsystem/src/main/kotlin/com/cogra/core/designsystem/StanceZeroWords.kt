// What a record family calls a bundle netted back to `(0, 0)`. The
// control owns the geometry; the family owns the words — the same split
// [StanceAxes] already makes for the two signed slots.
//
// PERSONS, posts and comments are WALKED BACK; TOPICS DISCONNECT (jakob's
// I2 ruling, 2026-09-15: "we want human wording not this nerdy stuff!";
// `STANCE_SEVERANCE_WORDS` and `AFFINITY_SEVERANCE` in the masters). The
// split is by record family, not by surface.

package com.cogra.core.designsystem

import androidx.annotation.StringRes

/**
 * Everything a record family says about reaching zero (`severanceWords`):
 * the pad's control and the dialog's confirming button, the confirm's busy
 * word, its title, effect and raw-total sentence, the landing a pick of
 * (0, 0) reads, the bundle already at nothing as a sentence and as a
 * label, and the help lines that name the way out.
 */
data class StanceZeroWords(
    /** The pad's own way out, and the dialog's confirming button (`control`). */
    @param:StringRes val open: Int,
    /** The confirming button while its signing is in flight (`busy`). */
    @param:StringRes val busy: Int,
    /** The confirmation's title, `%1$s` the target (`title`). */
    @param:StringRes val title: Int,
    /** What the pad's landing says a pick of (0, 0) would do (`landing`). */
    @param:StringRes val reached: Int,
    /** The confirmation's consequences, `%1$s` the target (`effect`). */
    @param:StringRes val body: Int,
    /** The raw total, `%1$s` the target and `%2$s` the raw pair (`sum`). */
    @param:StringRes val sum: Int,
    /** A bundle already at nothing, as a sentence, `%1$s` the target (`gone`). */
    @param:StringRes val standingZero: Int,
    /** The same fact as a label beside the shrug (`zero`). */
    @param:StringRes val zeroLabel: Int,
    /** The pad's fourth help line (`help`). */
    @param:StringRes val help: Int,
    /** The alternates' fourth help line (`helpAlternates`). */
    @param:StringRes val helpAlternates: Int,
) {
    companion object {
        /** Every kind but a topic — the person family's words. */
        val Severed = StanceZeroWords(
            open = R.string.stance_severance_open,
            busy = R.string.stance_severance_busy,
            title = R.string.stance_severance_title,
            reached = R.string.stance_severance_reached,
            body = R.string.stance_severance_body,
            sum = R.string.stance_severance_sum,
            standingZero = R.string.stance_standing_gone,
            zeroLabel = R.string.stance_standing_zero,
            help = R.string.stance_severance_help,
            helpAlternates = R.string.stance_severance_help_alternates,
        )

        /** A topic's own words (`TagPageHeldPad`'s dialog). */
        val Disconnected = StanceZeroWords(
            open = R.string.stance_disconnect_open,
            busy = R.string.stance_disconnect_busy,
            title = R.string.stance_disconnect_title,
            reached = R.string.stance_disconnect_reached,
            body = R.string.stance_disconnect_body,
            sum = R.string.stance_disconnect_sum,
            standingZero = R.string.stance_disconnect_standing_zero,
            zeroLabel = R.string.stance_disconnect_zero,
            help = R.string.stance_disconnect_help,
            helpAlternates = R.string.stance_disconnect_help_alternates,
        )
    }
}
