// Account-management calls, lifted into outcomes (auth.md "Sessions",
// "Password change", "Email change"; api-spec.md "Private viewer state") —
// authenticated-only, never member-gated. The one exception is the
// signed-out landing's link check, which is anonymous by design.

import type { ApolloClient } from "@apollo/client";

import {
  CancelEmailChangeDocument,
  ChangeHandleDocument,
  ChangePasswordDocument,
  ConfirmEmailChangeDocument,
  DefaultLicenseDocument,
  EmailChangeLinkCheckDocument,
  RequestEmailChangeDocument,
  ResendEmailChangeDocument,
  RevokeOtherSessionsDocument,
  RevokeSessionDocument,
  SetPreferencesDocument,
  SettingsAccountDocument,
  type EmailChangeLinkState,
  type PendingEmailChangeFieldsFragment,
  type SettingsAccountQuery,
} from "@/__generated__/graphql";
import type { License } from "@/lib/license";
import {
  fetchOutcome,
  payloadOutcome,
  success,
  viewerField,
  type Outcome,
} from "./outcome";

export type SettingsAccount = NonNullable<SettingsAccountQuery["me"]>;
export type SessionView = NonNullable<SettingsAccount["sessions"]>[number];
export type PendingEmailChange = PendingEmailChangeFieldsFragment;

/** Everything the settings page's rows stand on, in one viewer-only read. */
export function fetchSettingsAccount(client: ApolloClient): Promise<Outcome<SettingsAccount>> {
  return viewerField(
    () => client.query({ query: SettingsAccountDocument, fetchPolicy: "network-only" }),
    (data) => data.me,
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

/**
 * Opens the change: a wrong current password is INVALID_CREDENTIALS and a
 * malformed address BAD_INPUT; an address another account holds reads as
 * success (auth.md "Email change"). The change just opened comes back.
 */
export function requestEmailChange(
  client: ApolloClient,
  newEmail: string,
  currentPassword: string,
): Promise<Outcome<PendingEmailChange>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: RequestEmailChangeDocument,
        variables: { input: { newEmail, currentPassword } },
      }),
    (data) => data.requestEmailChange.userErrors,
    (data) => data.requestEmailChange.pendingEmailChange,
  );
}

/** Where the account's address stands after a confirm or a cancel. */
export type EmailStanding = {
  email: string | null;
  /** Null once the change applied or ended. */
  pending: PendingEmailChange | null;
};

/**
 * One side's proof — the 6-digit code from the current address, or the new
 * address's link token. Success leaves the change pending (a side still owed)
 * or applied (`pending` null).
 */
export async function confirmEmailChange(
  client: ApolloClient,
  code: string,
): Promise<Outcome<EmailStanding>> {
  const outcome = await payloadOutcome(
    () =>
      client.mutate({
        mutation: ConfirmEmailChangeDocument,
        variables: { input: { code: code.trim() } },
      }),
    (data) => data.confirmEmailChange.userErrors,
    (data) => data.confirmEmailChange.user,
  );
  if (outcome.kind !== "success") return outcome;
  return success({ email: outcome.value.email ?? null, pending: outcome.value.pendingEmailChange ?? null });
}

/** Re-mails the sides still owed; NOT_FOUND once nothing is pending. */
export function resendEmailChange(client: ApolloClient): Promise<Outcome<PendingEmailChange>> {
  return payloadOutcome(
    () => client.mutate({ mutation: ResendEmailChangeDocument }),
    (data) => data.resendEmailChange.userErrors,
    (data) => data.resendEmailChange.pendingEmailChange,
  );
}

export async function cancelEmailChange(client: ApolloClient): Promise<Outcome<EmailStanding>> {
  const outcome = await payloadOutcome(
    () => client.mutate({ mutation: CancelEmailChangeDocument }),
    (data) => data.cancelEmailChange.userErrors,
    (data) => data.cancelEmailChange.user,
  );
  if (outcome.kind !== "success") return outcome;
  return success({ email: outcome.value.email ?? null, pending: outcome.value.pendingEmailChange ?? null });
}

/** The license a new post starts from; null is public domain. */
export async function fetchDefaultLicense(client: ApolloClient): Promise<Outcome<License | null>> {
  const outcome = await viewerField(
    () => client.query({ query: DefaultLicenseDocument, fetchPolicy: "network-only" }),
    (data) => data.me,
  );
  if (outcome.kind !== "success") return outcome;
  return success(outcome.value.preferences?.defaultLicense ?? null);
}

/** Saves the account's default license; null restores public domain. */
export async function setDefaultLicense(
  client: ApolloClient,
  license: License | null,
): Promise<Outcome<License | null>> {
  const outcome = await payloadOutcome(
    () =>
      client.mutate({
        mutation: SetPreferencesDocument,
        variables: {
          input: {
            defaultLicense:
              license === null
                ? null
                : { attribution: license.attribution, provenance: license.provenance },
          },
        },
      }),
    (data) => data.setPreferences.userErrors,
    (data) => data.setPreferences.preferences,
  );
  if (outcome.kind !== "success") return outcome;
  return success(outcome.value.defaultLicense ?? null);
}

export type EmailChangeLink = { newEmail: string; state: EmailChangeLinkState };

/**
 * The signed-out landing's read of a new-address link. Anonymous and
 * write-free; null for any token that names no change.
 */
export async function emailChangeLinkCheck(
  client: ApolloClient,
  token: string,
): Promise<Outcome<EmailChangeLink | null>> {
  const outcome = await fetchOutcome(() =>
    client.query({
      query: EmailChangeLinkCheckDocument,
      variables: { token },
      fetchPolicy: "network-only",
    }),
  );
  if (outcome.kind !== "success") return outcome;
  return success(outcome.value.emailChangeLinkCheck ?? null);
}
