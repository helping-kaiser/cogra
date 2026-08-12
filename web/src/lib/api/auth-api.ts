// Session and account calls, lifted into outcomes. logIn, refreshSession,
// and the password-reset pair are unauthenticated entry gestures
// (api-spec.md § Mutations → Conventions); Me is guarded by the caller.

import type { ApolloClient } from "@apollo/client";

import {
  ConfirmPasswordResetDocument,
  KeyBackupDocument,
  LogInDocument,
  MeDocument,
  RefreshSessionDocument,
  RequestPasswordResetDocument,
  UploadKeyBackupDocument,
  type MeQuery,
} from "@/__generated__/graphql";
import {
  payloadOutcome,
  success,
  viewerField,
  type Outcome,
} from "./outcome";
import type { RefreshExecutor } from "@/lib/session/refresher";
import type { SessionAuth } from "@/lib/session/token-store";

export type MeUser = NonNullable<MeQuery["me"]>;

/**
 * Lifts a payload's `AuthSession` into the stored shape. A non-null auth
 * without its user is a server-contract break — the null feeds `payload`'s
 * null-without-userErrors failure.
 */
export function sessionAuthOf(
  auth:
    | { accessToken: string; refreshToken: string; user: { id: string } | null }
    | null
    | undefined,
): SessionAuth | null {
  if (auth == null || auth.user === null) return null;
  return {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    accountId: auth.user.id,
  };
}

/**
 * A successful login's payload: the token pair plus the pending
 * refresh-token-reuse security event, delivered exactly once by the
 * first login after detection (auth.md "Reuse detection").
 */
export type LoginGrant = {
  readonly auth: SessionAuth;
  readonly reuseDetectedAt: string | null;
};

export function logIn(
  client: ApolloClient,
  email: string,
  password: string,
  deviceLabel: string | null,
): Promise<Outcome<LoginGrant>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: LogInDocument,
        variables: { input: { email, password, deviceLabel } },
      }),
    (data) => data.logIn.userErrors,
    (data) => {
      const auth = sessionAuthOf(data.logIn.auth);
      return auth === null ? null : { auth, reuseDetectedAt: data.logIn.reuseDetectedAt ?? null };
    },
  );
}

export function refreshExecutor(client: ApolloClient): RefreshExecutor {
  return (refreshToken) =>
    payloadOutcome(
      () =>
        client.mutate({
          mutation: RefreshSessionDocument,
          variables: { input: { refreshToken } },
        }),
      (data) => data.refreshSession.userErrors,
      (data) => sessionAuthOf(data.refreshSession.auth),
    );
}

/** One of api-spec.md's three deliberately-silent verbs — never a userError. */
export function requestPasswordReset(
  client: ApolloClient,
  email: string,
): Promise<Outcome<boolean>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: RequestPasswordResetDocument,
        variables: { input: { email } },
      }),
    () => [],
    (data) => data.requestPasswordReset.ok,
  );
}

export function confirmPasswordReset(
  client: ApolloClient,
  resetToken: string,
  newPassword: string,
): Promise<Outcome<true>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: ConfirmPasswordResetDocument,
        variables: { input: { resetToken, newPassword } },
      }),
    (data) => data.confirmPasswordReset.userErrors,
    (data) => (data.confirmPasswordReset.ok === true ? true : null),
  );
}

/**
 * The viewer's newest backup blob (base64), null when none was ever
 * uploaded. Guarded by the caller.
 */
export async function fetchKeyBackup(client: ApolloClient): Promise<Outcome<string | null>> {
  const me = await viewerField(
    () => client.query({ query: KeyBackupDocument, fetchPolicy: "network-only" }),
    (data) => data.me,
  );
  if (me.kind !== "success") return me;
  return success(me.value.keyBackup);
}

export function uploadKeyBackup(client: ApolloClient, blob: string): Promise<Outcome<true>> {
  return payloadOutcome(
    () => client.mutate({ mutation: UploadKeyBackupDocument, variables: { input: { blob } } }),
    (data) => data.uploadKeyBackup.userErrors,
    (data) => (data.uploadKeyBackup.ok === true ? true : null),
  );
}

/**
 * The viewer, live — a null `me` is an UNAUTHENTICATED refusal so the
 * guard treats a stale access token and an explicit refusal the same way.
 */
export function fetchMe(client: ApolloClient): Promise<Outcome<MeUser>> {
  return viewerField(
    () => client.query({ query: MeDocument, fetchPolicy: "network-only" }),
    (data) => data.me,
  );
}
