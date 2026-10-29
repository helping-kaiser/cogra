// Every string the kept picks' review and seal carry, blessed in copy-voice
// (*The kept picks' review*, *The key's lifecycle*, *Faults by code*; round
// 25's `Sign the picks` and the kind words). web's twins are the constants in
// `web/src/app/(app)/kept-picks/kept-picks-view.tsx`.

package com.cogra.feature.stance.kept

import com.cogra.domain.stance.StanceKind

const val KEPT_PICKS_TITLE = "Kept picks"
const val KEPT_PICKS_INTRO =
    "These waited on this device for your key, and nothing is signed yet. " +
        "Remove any you no longer mean — the rest sign together."
const val KEPT_APPROVAL_LINE = "An approval waits in your invites — go there to sign it."
const val KEPT_OPEN_INVITES = "Open Invites"
const val KEPT_SIGN_THEM = "Sign them"
const val KEPT_SEAL_TITLE = "What you sign"
const val KEPT_SEAL_STAGE = "Last step"
const val KEPT_SEAL_LEAVE = "Leave — your picks are kept"
const val KEPT_SEAL_HELP = "How signing works"
const val KEPT_SIGN = "Sign the picks"
const val KEPT_SIGNING = "Signing the picks…"
const val KEPT_RETRY = "Retry"
const val KEPT_BACK = "Back"
const val KEPT_OFFLINE_LINE = "That didn't send. Try again."
const val KEPT_WRITE_RULE_TITLE = "You can't sign right now"
const val KEPT_WRITE_RULE_HELP = "Why signing waits"
const val KEPT_WRITE_RULE_FACT =
    "Each signing is paid for, and there's only so much to go around at a time. " +
        "Nothing was signed or spent — your picks are still kept."
const val KEPT_BUG_TITLE = "This shouldn't have happened"
const val KEPT_BUG_FACT =
    "That's a fault on our side, not yours. Nothing was signed or spent, and telling us helps us fix it."
const val KEPT_TRY_AGAIN = "Try again"
const val KEPT_REPORT = "Report a problem"
const val KEPT_NOT_NOW = "Not now"
const val KEPT_NOTHING_LEFT = "Nothing left to sign."

/** `Removed — 2 picks left.`, `Removed — 1 pick left.` in the singular (KeptPicksReview.md:21). */
fun keptRemoved(left: Int): String = "Removed — $left ${if (left == 1) "pick" else "picks"} left."

/** The settled snackbar in its batch form: `Signed 3 things, still settling.` (KeptPicksSeal.md:27). */
fun keptSigned(count: Int): String = "Signed $count ${if (count == 1) "thing" else "things"}, still settling."

/** The row's kind under the name (KeptPicksReview.md:13). */
fun keptKindWord(kind: StanceKind): String = when (kind) {
    StanceKind.POST -> "Post"
    StanceKind.COMMENT -> "Comment"
    StanceKind.PERSON -> "Person"
    StanceKind.TOPIC -> "Topic"
}

/**
 * What a seal row signs (KeptPicksSeal.md:7): a pick on a post, a comment or a
 * person reads `Opinion`, a pick on a topic `Feeling` — with its count's noun.
 */
fun keptActLabel(kind: StanceKind): String = if (kind == StanceKind.TOPIC) "Feeling" else "Opinion"

fun keptActNoun(kind: StanceKind): String = if (kind == StanceKind.TOPIC) "feeling" else "opinion"
