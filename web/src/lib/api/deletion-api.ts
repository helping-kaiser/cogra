// Account-deletion calls, lifted into outcomes (auth.md "Self-service
// deletion"; api-spec.md "Auth and accounts"; the erasure packet's slice C1).
//
// THE PATH IS THE SERVER'S. `deletionPath` (OS-15) names the one deletion verb
// that will answer — IMMEDIATE, BY_LINK or LOCKED — and every client surface
// keys on it. Nothing here reads `application.*` to re-derive it: a lapsed
// vouch clears `approvedAt` while the funding stays, so a client-side reading
// would unlock a row the server refuses.
//
// A NULL DELETION IS AN ANSWER. `accountDeletion` is non-null only while a
// confirmed deletion runs its grace, so a request (nothing confirmed yet) and
// a cancel (nothing standing any more) both answer null with no userErrors —
// unlike the house payloads, where null without errors is a contract break.

import type { ApolloClient } from "@apollo/client";

import {
  AccountDeletionDocument,
  CancelAccountDeletionDocument,
  ConfirmAccountDeletionDocument,
  DeleteApplicantAccountDocument,
  RequestAccountDeletionDocument,
  type AccountDeletionFieldsFragment,
  type AccountDeletionPath,
} from "@/__generated__/graphql";
import { failed, fetchOutcome, refused, success, viewerField, type Outcome, type UserError } from "./outcome";

/** A confirmed deletion in its grace: the deadline and whether the sweep is in. */
export type AccountDeletion = AccountDeletionFieldsFragment;
export type DeletionPath = AccountDeletionPath;

/** What the viewer's account reads about its own deletion. */
export type DeletionStanding = {
  /** Null only for a viewer the server does not resolve (viewer-only field). */
  path: DeletionPath | null;
  /** Non-null exactly while a confirmed deletion runs its grace. */
  deletion: AccountDeletion | null;
};

export function fetchDeletionStanding(client: ApolloClient): Promise<Outcome<DeletionStanding>> {
  return viewerField(
    () => client.query({ query: AccountDeletionDocument, fetchPolicy: "network-only" }),
    (data) =>
      data.me === null || data.me === undefined
        ? null
        : { path: data.me.deletionPath ?? null, deletion: data.me.accountDeletion ?? null },
  );
}

/** The deletion payloads' split: userErrors refuse, and a null deletion is a value. */
async function deletionPayload<D>(
  call: () => Promise<{ data: D | undefined; error?: unknown }>,
  pick: (data: D) => { userErrors: readonly UserError[]; accountDeletion?: AccountDeletion | null } | null | undefined,
): Promise<Outcome<AccountDeletion | null>> {
  const fetched = await fetchOutcome(call);
  if (fetched.kind !== "success") return fetched;
  const payload = pick(fetched.value);
  if (payload === null || payload === undefined) return failed(new Error("response carried no payload"));
  if (payload.userErrors.length > 0) return refused(payload.userErrors);
  return success(payload.accountDeletion ?? null);
}

/**
 * The member path's first step: records the content-sweep choice and mails
 * the link. Answers null — nothing is confirmed until the link is opened —
 * or, during a confirmed grace, that deletion, unchanged. A spent deletion
 * mail budget is a transport-tier RATE_LIMITED.
 */
export function requestAccountDeletion(
  client: ApolloClient,
  includeContent: boolean,
): Promise<Outcome<AccountDeletion | null>> {
  return deletionPayload(
    () => client.mutate({ mutation: RequestAccountDeletionDocument, variables: { input: { includeContent } } }),
    (data) => data.requestAccountDeletion,
  );
}

/**
 * The mailed link, opened. Session-free — the token is the capability. Every
 * dead link is one DELETION_TOKEN_INVALID; `includeContent: true` adds the
 * sweep, and omitting it leaves the standing choice as it is.
 */
export async function confirmAccountDeletion(
  client: ApolloClient,
  deletionToken: string,
  includeContent?: true,
): Promise<Outcome<AccountDeletion>> {
  const outcome = await deletionPayload(
    () =>
      client.mutate({
        mutation: ConfirmAccountDeletionDocument,
        variables: { input: includeContent ? { deletionToken, includeContent } : { deletionToken } },
      }),
    (data) => data.confirmAccountDeletion,
  );
  if (outcome.kind !== "success") return outcome;
  // A confirm that answers no deletion is a contract break, not a state.
  return outcome.value === null ? failed(new Error("confirm answered no deletion")) : success(outcome.value);
}

/** Ends the standing deletion. Idempotent: nothing standing answers null too. */
export async function cancelAccountDeletion(client: ApolloClient): Promise<Outcome<true>> {
  const outcome = await deletionPayload(
    () => client.mutate({ mutation: CancelAccountDeletionDocument }),
    (data) => data.cancelAccountDeletion,
  );
  return outcome.kind === "success" ? success(true) : outcome;
}

/** The unfunded applicant's immediate delete; every session dies with it. */
export async function deleteApplicantAccount(client: ApolloClient): Promise<Outcome<true>> {
  const fetched = await fetchOutcome(() => client.mutate({ mutation: DeleteApplicantAccountDocument }));
  if (fetched.kind !== "success") return fetched;
  const payload = fetched.value.deleteApplicantAccount;
  if (payload.userErrors.length > 0) return refused(payload.userErrors);
  return payload.ok === true ? success(true) : failed(new Error("delete answered no ok"));
}
