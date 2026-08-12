// The mapper arms every surface shares. Surface mappers keep their
// specific arms and delegate the tail here, so the rate-limit and
// generic copy have one home.

import type { ErrorCode } from "@/__generated__/graphql";

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
