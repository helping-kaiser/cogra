// The three outcome tiers of every API call (Android's Outcome.kt):
// transport faults and the GraphQL errors array become `failed`, payload
// userErrors become `refused`, everything else is `success`.
//
// Two deliberate translations out of the errors array (transport tier per
// api-spec.md § Errors are tiered): UNAUTHENTICATED, because the auth
// guard must be able to refresh-and-replay on it — synthesized into the
// same refusal shape a null viewer read maps to; and RATE_LIMITED,
// because a deliberate backoff rendered as a connectivity failure
// ("can't reach the server") misleads — surfaces already know the code
// from payload userErrors. The guard replays only on UNAUTHENTICATED, so
// a rate-limited call is never replayed.

import { CombinedGraphQLErrors } from "@apollo/client/errors";

import type { ErrorCode } from "@/__generated__/graphql";

export type UserError = {
  message: string;
  code: ErrorCode;
  field: readonly string[] | null;
};

export type Outcome<T> =
  | { readonly kind: "success"; readonly value: T }
  | { readonly kind: "refused"; readonly errors: readonly UserError[] }
  | { readonly kind: "failed"; readonly cause: unknown };

export function success<T>(value: T): Outcome<T> {
  return { kind: "success", value };
}

export function refused(errors: readonly UserError[]): Outcome<never> {
  return { kind: "refused", errors };
}

export function failed(cause: unknown): Outcome<never> {
  return { kind: "failed", cause };
}

/** The refusal a null viewer read and an errors-array UNAUTHENTICATED share. */
export function unauthenticated(): Outcome<never> {
  return refused([
    { code: "UNAUTHENTICATED", message: "no viewer for this request", field: null },
  ]);
}

export function hasCode(outcome: Outcome<unknown>, code: ErrorCode): boolean {
  return outcome.kind === "refused" && outcome.errors.some((e) => e.code === code);
}

function classify(error: unknown): Outcome<never> {
  if (CombinedGraphQLErrors.is(error)) {
    if (error.errors.some((e) => e.extensions?.code === "UNAUTHENTICATED")) {
      return unauthenticated();
    }
    if (error.errors.some((e) => e.extensions?.code === "RATE_LIMITED")) {
      return refused([
        { code: "RATE_LIMITED", message: "too many attempts, wait before retrying", field: null },
      ]);
    }
  }
  return failed(error);
}

/**
 * Transport split: run an Apollo call and lift its result into an outcome.
 * Apollo v4 surfaces GraphQL errors on `result.error` under the default
 * error policy and rejects on link-level faults — both land in `failed`.
 */
export async function fetchOutcome<D>(
  call: () => Promise<{ data: D | undefined; error?: unknown }>,
): Promise<Outcome<D>> {
  let result: { data: D | undefined; error?: unknown };
  try {
    result = await call();
  } catch (error) {
    return classify(error);
  }
  if (result.error !== undefined) return classify(result.error);
  if (result.data === undefined || result.data === null) {
    return failed(new Error("response carried no data"));
  }
  return success(result.data);
}

/**
 * Payload split: the named result field is null exactly when userErrors is
 * non-empty; null with an empty list is a server-contract break.
 */
export function payload<T>(
  errors: readonly UserError[],
  value: T | null | undefined,
): Outcome<T> {
  if (errors.length > 0) return refused(errors);
  if (value === null || value === undefined) {
    return failed(new Error("null result without userErrors"));
  }
  return success(value);
}

/** Both splits in one motion, for the common payload-carrying mutation. */
export async function payloadOutcome<D, T>(
  call: () => Promise<{ data: D | undefined; error?: unknown }>,
  errorsOf: (data: D) => readonly UserError[],
  valueOf: (data: D) => T | null | undefined,
): Promise<Outcome<T>> {
  const fetched = await fetchOutcome(call);
  if (fetched.kind !== "success") return fetched;
  return payload(errorsOf(fetched.value), valueOf(fetched.value));
}
