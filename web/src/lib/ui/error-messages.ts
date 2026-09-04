// The mapper arms every surface shares. Surface mappers keep their
// specific arms and delegate the tail here, so the rate-limit and
// generic copy have one home.

import type { ErrorCode } from "@/__generated__/graphql";
import type { UserError } from "@/lib/api/outcome";

/** The tail arms of every refusal mapper. */
export function fallbackMessage(code: ErrorCode): string {
  switch (code) {
    case "RATE_LIMITED":
      return "Too many attempts — wait a moment and try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

/**
 * The refusal copy for a signed write — the composer, the reply, the post and
 * comment editors, the profile edit.
 *
 * THE SERVER'S SENTENCE IS NOT THIS SENTENCE. `UserError.message` is
 * developer-facing fallback text and the client localizes off `code`
 * (api-spec.md § Errors); printing the message put the backend's English on
 * the content surfaces while auth and settings ran a code vocabulary beside
 * them. One vocabulary, and it lives here.
 */
export function writeRefusalMessage(code: ErrorCode): string {
  switch (code) {
    case "BAD_INPUT":
      return "Something in this wasn't accepted — check the details and try again.";
    case "FORBIDDEN":
      return "You can't do that here.";
    case "NOT_FOUND":
      return "That isn't there any more.";
    case "WRITE_RULE_FAILED":
      return "This write didn't pass the network's rules — your balance may not cover it.";
    case "SIGNATURE_INVALID":
      return "This device's signature wasn't accepted.";
    case "STAGED_WRITE_EXPIRED":
      return "This took too long and expired — start it again.";
    default:
      return fallbackMessage(code);
  }
}

/** The same, for the attachment legs, which name what was refused. */
export function mediaRefusalMessage(code: ErrorCode, subject: string): string {
  switch (code) {
    case "BAD_INPUT":
      return `That ${subject} wasn't accepted — try a different one.`;
    case "FORBIDDEN":
      return `You can't attach that ${subject}.`;
    default:
      return writeRefusalMessage(code);
  }
}

/**
 * The first refusal in a batch as copy, or the caller's own sentence when the
 * list came back empty — which the contract allows and no code covers.
 */
export function firstRefusalMessage(errors: readonly UserError[], whenEmpty: string): string {
  const first = errors[0];
  return first === undefined ? whenEmpty : writeRefusalMessage(first.code);
}

/**
 * The re-arm refusal copy (auth.md "Expiry"), shared by the Home re-arm
 * card and the /join re-arm panel.
 */
export function rearmMessage(code: ErrorCode): string {
  switch (code) {
    case "INVITE_UNUSABLE":
      return "This invite can't be used — it may have expired or been revoked.";
    case "BAD_INPUT":
      return "Your application is still live — it doesn't need a fresh invite.";
    default:
      return fallbackMessage(code);
  }
}
