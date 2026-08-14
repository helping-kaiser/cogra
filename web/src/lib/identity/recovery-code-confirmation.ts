// The write-it-down gate in front of dismissing a freshly shown
// recovery code (auth.md "Key recovery"). A code is displayed exactly
// once, so "I've written it down" has to be earned: the reader types
// back the code they are looking at, or pastes the one they copied.
//
// The comparison reads the typed text under the recovery code's own
// normalization, so a transcription that swapped `O` for `0` — the
// confusion the alphabet is chosen to survive — still passes.

import { RecoveryCode } from "@/lib/crypto/key-backup";

/**
 * Whether `typed` is the code `shown`, read under the recovery code's
 * normalization rules. Separators are optional and case does not
 * matter; an empty answer never matches.
 */
export function recoveryCodeTypedBack(shown: string, typed: string): boolean {
  const answer = RecoveryCode.normalize(typed);
  return answer !== "" && answer === RecoveryCode.normalize(shown);
}
