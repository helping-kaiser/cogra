// The mapper arms every surface shares. Surface mappers keep their
// specific arms and delegate the tail here, so the rate-limit and
// generic copy have one home.

import { CombinedGraphQLErrors } from "@apollo/client/errors";

import type { ErrorCode } from "@/__generated__/graphql";
import type { Outcome, UserError } from "@/lib/api/outcome";
import { DeviceRefusalError } from "@/lib/signing/device-refusal";

/**
 * An answered refusal of the whole act — FORBIDDEN, INTERNAL,
 * SIGNATURE_INVALID, a BAD_INPUT naming no field: the line that takes the
 * commit's place with `Retry` (NetworkError.md:13-17; copy-voice, *Faults by
 * code*). Never the "can't reach the server" line: the server answered.
 */
export const NOT_THROUGH_LINE = "That didn't go through. Try again.";

/**
 * No answer at all, on a seal, pad, dialog or form (NetworkError.md:3;
 * copy-voice, *No answer at all*) — never TransportError's long fallback
 * where a commit stands to be pressed again.
 */
export const NO_ANSWER_LINE = "That didn't send. Try again.";

/** EMAIL_NOT_VERIFIED, in the same place (NetworkError.md:19; copy-voice, *Faults by code*). */
export const UNVERIFIED_LINE = "Verify your email first — the link is in your inbox.";

/** The codes NetworkError.md reads as the not-through line, wherever they are anchored. */
const NOT_THROUGH_CODES: ReadonlySet<ErrorCode> = new Set(["FORBIDDEN", "INTERNAL", "SIGNATURE_INVALID"]);

/**
 * The line an answered refusal of the WHOLE act says in the commit's place, or
 * null when the errors are about something narrower (a field, a row, the write
 * rule's notice) or are no answer at all. EMAIL_NOT_VERIFIED is checked first:
 * it names the one thing the reader can do.
 */
export function wholeActLine(errors: readonly UserError[]): string | null {
  if (errors.some((error) => error.code === "EMAIL_NOT_VERIFIED")) return UNVERIFIED_LINE;
  const notThrough = errors.some(
    (error) =>
      NOT_THROUGH_CODES.has(error.code) ||
      (error.code === "BAD_INPUT" && (error.field === null || error.field.length === 0)),
  );
  return notThrough ? NOT_THROUGH_LINE : null;
}

/**
 * The same, for a fault that rode the transport tier. Everything in GraphQL's
 * `errors` array is an ANSWER (api-spec.md, *Errors are tiered*): an INTERNAL
 * there, or a BAD_INPUT (which names no field on that tier), is the
 * not-through line, never the no-answer one. The codes `outcome.ts` already
 * lifts into `refused` never reach here; a link fault (no response) answers
 * null.
 */
export function answeredFaultLine(cause: unknown): string | null {
  // The device's own signer said no: an answer too (seam 355).
  if (cause instanceof DeviceRefusalError) return NOT_THROUGH_LINE;
  if (!CombinedGraphQLErrors.is(cause)) return null;
  const codes = cause.errors.map((error) => error.extensions?.code);
  return codes.some((code) => code === "INTERNAL" || code === "BAD_INPUT" || code === "SIGNATURE_INVALID")
    ? NOT_THROUGH_LINE
    : null;
}

/** The whole-act line of one non-success outcome, or null (no answer, or a narrower refusal). */
export function outcomeFaultLine(outcome: Outcome<unknown>): string | null {
  if (outcome.kind === "refused") return wholeActLine(outcome.errors);
  if (outcome.kind === "failed") return answeredFaultLine(outcome.cause);
  return null;
}

/** The tail arms of every refusal mapper. */
export function fallbackMessage(code: ErrorCode): string {
  switch (code) {
    case "RATE_LIMITED":
      return "Too many attempts — wait a moment and try again.";
    case "FORBIDDEN":
      return NOT_THROUGH_LINE;
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
    case "EMAIL_NOT_VERIFIED":
      return UNVERIFIED_LINE;
    case "FORBIDDEN":
    case "INTERNAL":
    case "SIGNATURE_INVALID":
      return NOT_THROUGH_LINE;
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
  if (first === undefined) return whenEmpty;
  // A BAD_INPUT naming no field has no field to say it on (NetworkError.md:17).
  if (first.code === "BAD_INPUT" && (first.field === null || first.field.length === 0)) return NOT_THROUGH_LINE;
  return writeRefusalMessage(first.code);
}
