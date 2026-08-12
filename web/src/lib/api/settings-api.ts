// Account-management calls (auth.md "Sessions", "Password change",
// "Email change", api-spec.md "Auth and accounts"), lifted into
// outcomes. requestEmailChange is a silent verb: no userErrors by
// design — surfacing a failure would reveal whether the new address is
// registered. Every call here is authenticated-only, never
// member-gated: the applicant manages their account like anyone else.

import type { ApolloClient } from "@apollo/client";

import {
  ChangeHandleDocument,
  ChangePasswordDocument,
  ConfirmEmailChangeDocument,
  RequestEmailChangeDocument,
  RevokeOtherSessionsDocument,
  RevokeSessionDocument,
  SessionsDocument,
  type SessionsQuery,
} from "@/__generated__/graphql";
import {
  payloadOutcome,
  success,
  viewerField,
  type Outcome,
} from "./outcome";

type SessionsUser = NonNullable<SessionsQuery["me"]>;
export type SessionView = NonNullable<SessionsUser["sessions"]>[number];

export function fetchSessions(
  client: ApolloClient,
): Promise<Outcome<readonly SessionView[]>> {
  return viewerField(
    () => client.query({ query: SessionsDocument, fetchPolicy: "network-only" }),
    (data) => data.me?.sessions,
  );
}

/** Revokes one session — the current one when `session` is null. */
export async function revokeSession(
  client: ApolloClient,
  session: string | null,
): Promise<Outcome<true>> {
  const outcome = await payloadOutcome(
    () =>
      client.mutate({
        mutation: RevokeSessionDocument,
        variables: { input: session === null ? {} : { session } },
      }),
    (data) => data.revokeSession.userErrors,
    (data) => data.revokeSession.session,
  );
  if (outcome.kind !== "success") return outcome;
  return success(true);
}

export function revokeOtherSessions(client: ApolloClient): Promise<Outcome<number>> {
  return payloadOutcome(
    () => client.mutate({ mutation: RevokeOtherSessionsDocument }),
    (data) => data.revokeOtherSessions.userErrors,
    (data) => data.revokeOtherSessions.revokedCount,
  );
}

export function changePassword(
  client: ApolloClient,
  currentPassword: string,
  newPassword: string,
): Promise<Outcome<true>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: ChangePasswordDocument,
        variables: { input: { currentPassword, newPassword } },
      }),
    (data) => data.changePassword.userErrors,
    (data) => (data.changePassword.ok === true ? true : null),
  );
}

/** The renamed account's new handle. */
export async function changeHandle(client: ApolloClient, handle: string): Promise<Outcome<string>> {
  const outcome = await payloadOutcome(
    () => client.mutate({ mutation: ChangeHandleDocument, variables: { input: { handle } } }),
    (data) => data.changeHandle.userErrors,
    (data) => data.changeHandle.user,
  );
  if (outcome.kind !== "success") return outcome;
  return success(outcome.value.handle);
}

/** Silent verb: no userErrors by design — success and refusal are one. */
export function requestEmailChange(
  client: ApolloClient,
  newEmail: string,
  currentPassword: string,
): Promise<Outcome<boolean>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: RequestEmailChangeDocument,
        variables: { input: { newEmail, currentPassword } },
      }),
    () => [],
    (data) => data.requestEmailChange.ok,
  );
}

export function confirmEmailChange(client: ApolloClient, code: string): Promise<Outcome<true>> {
  const trimmed = code.trim();
  return payloadOutcome(
    () =>
      client.mutate({ mutation: ConfirmEmailChangeDocument, variables: { input: { code: trimmed } } }),
    (data) => data.confirmEmailChange.userErrors,
    (data) => (data.confirmEmailChange.user === null ? null : true),
  );
}
