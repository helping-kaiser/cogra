// What a record family calls a bundle netted back to `(0, 0)`. The
// control owns the geometry; the family owns the words — the same split
// [StanceAxes] already makes for the two signed slots.
//
// PERSONS, posts and comments SEVER; TOPICS DISCONNECT (jakob's I2
// ruling, copy-voice.md "Awaiting blessing — the topic disconnects",
// 2026-09-15: "we want human wording not this nerdy stuff!"). The split
// is by record family, not by surface, so every kind but a topic keeps
// the severance wording verbatim and only a topic's pad and confirmation
// swap in [Disconnected].

package com.cogra.core.designsystem

import androidx.annotation.StringRes

/**
 * The route's own word, the confirmation's title and body, the landing
 * a pick reaches, and the standing a severed/disconnected bundle reads
 * as — everything a record family says about reaching zero.
 */
data class StanceZeroWords(
    /** The pad's own way out — the button and the accessibility action. */
    @param:StringRes val open: Int,
    /** The confirmation's title. */
    @param:StringRes val title: Int,
    /** The pad's landing line, and the confirmation's own pick-reached line. */
    @param:StringRes val reached: Int,
    /** The confirmation's consequences paragraph. */
    @param:StringRes val body: Int,
    /** The zero-bundle standing line. */
    @param:StringRes val standingZero: Int,
    /** The confirmation's confirming button. */
    @param:StringRes val confirm: Int,
) {
    companion object {
        /** Every kind but a topic — the words every surface already carried. */
        val Severed = StanceZeroWords(
            open = R.string.stance_severance_open,
            title = R.string.stance_severance_title,
            reached = R.string.stance_severance_reached,
            body = R.string.stance_severance_body,
            standingZero = R.string.stance_standing_zero,
            confirm = R.string.stance_severance_confirm,
        )

        /** A topic's own words (`TagPageHeldPad`'s dialog). */
        val Disconnected = StanceZeroWords(
            open = R.string.stance_disconnect_open,
            title = R.string.stance_disconnect_title,
            reached = R.string.stance_disconnect_reached,
            body = R.string.stance_disconnect_body,
            standingZero = R.string.stance_disconnect_standing_zero,
            confirm = R.string.stance_disconnect_confirm,
        )
    }
}
