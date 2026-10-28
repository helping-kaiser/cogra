// WHAT INVITES SAYS ON ARRIVAL, when an ask link sent the reader there
// (VouchAsk.md:17, :27, :31; VouchAskPad.md:25, :33). The ask's own page is
// gone by the time Invites stands, so it hands the outcome over and Invites
// takes it once: the snackbar's words, and the row to stand at. It rides the
// navigation result the destination reads (android/CLAUDE.md "Return a
// result"), so it is a plain string. web's twin is
// `web/src/lib/invites/invites-notice.ts`.

package com.cogra.feature.invites

import com.cogra.domain.stance.StancePair

sealed interface InvitesNotice {
    /** The asker, without the @: the row Invites stands at. */
    val handle: String

    /** The asker already waits in the reader's own queue. */
    data class AlreadyWaiting(override val handle: String) : InvitesNotice

    /** Staged, nothing signed: the asker has to finish registering. */
    data class NotRegistered(override val handle: String) : InvitesNotice

    /** The vouch landed: the ordinary signed line, with the pick's face. */
    data class Signed(override val handle: String, val landing: StancePair) : InvitesNotice

    /** The notice as the navigation result carries it. */
    fun encode(): String = when (this) {
        is AlreadyWaiting -> "waiting|$handle"
        is NotRegistered -> "unregistered|$handle"
        is Signed -> "signed|$handle|${landing.pDirected}|${landing.pInterest}"
    }

    companion object {
        /** A carried notice back; anything this build cannot read says nothing. */
        fun decode(carried: String?): InvitesNotice? {
            val parts = carried?.split('|') ?: return null
            return when (parts.firstOrNull()) {
                "waiting" -> parts.getOrNull(1)?.let(::AlreadyWaiting)
                "unregistered" -> parts.getOrNull(1)?.let(::NotRegistered)
                "signed" -> {
                    val handle = parts.getOrNull(1)
                    val directed = parts.getOrNull(2)?.toDoubleOrNull()
                    val interest = parts.getOrNull(3)?.toDoubleOrNull()
                    if (handle == null || directed == null || interest == null) {
                        null
                    } else {
                        Signed(handle, StancePair(directed, interest))
                    }
                }
                else -> null
            }
        }
    }
}
