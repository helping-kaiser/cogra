// The write-it-down gate in front of dismissing a freshly shown
// recovery code (auth.md "Key recovery"). A code is displayed exactly
// once, so "I've written it down" has to be earned: the reader types
// back the code they are looking at, or pastes the one they copied.
//
// The comparison reads the typed text under the recovery code's own
// normalization, so a transcription that swapped `O` for `0` — the
// confusion the alphabet is chosen to survive — still passes.

package com.cogra.domain.identity

import com.cogra.crypto.RecoveryCode

/**
 * Whether [typed] is the code [shown], read under the recovery code's
 * normalization rules. Separators are optional and case does not
 * matter; an empty answer never matches.
 */
fun recoveryCodeTypedBack(shown: String, typed: String): Boolean {
    val answer = RecoveryCode.normalize(typed)
    return answer.isNotEmpty() && answer == RecoveryCode.normalize(shown)
}

/**
 * Whether [typed] is a prefix that can no longer become [shown] — not
 * merely incomplete, but already wrong. Reads both through the same
 * [RecoveryCode.normalize] call [recoveryCodeTypedBack] uses to decide
 * the match itself: a divergence line folding confusables on some
 * other rule could flag a prefix the button would still accept once
 * completed, or stay silent on one the button will reject — the line
 * has to agree with the button it sits next to. An empty answer is
 * not yet a mistake.
 */
fun recoveryCodePrefixDiverged(shown: String, typed: String): Boolean {
    val prefix = RecoveryCode.normalize(typed)
    return prefix.isNotEmpty() && !RecoveryCode.normalize(shown).startsWith(prefix)
}
