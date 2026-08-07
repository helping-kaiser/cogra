// Session and account calls, lifted into outcomes. logIn, refreshSession,
// and the password-reset pair are unauthenticated entry gestures
// (api-spec.md § Mutations → Conventions); Me is guarded by the caller.

import type { ApolloClient } from "@apollo/client";

import {
  ConfirmPasswordResetDocument,
  LogInDocument,
  MeDocument,
  RefreshSessionDocument,
  RequestPasswordResetDocument,
  type MeQuery,
} from "@/__generated__/graphql";
import {
  fetchOutcome,
  payload,
  payloadOutcome,
  unauthenticated,
  type Outcome,
} from "./outcome";
import type { RefreshExecutor } from "@/lib/session/refresher";
import type { TokenPair } from "@/lib/session/token-store";

export type MeUser = NonNullable<MeQuery["me"]>;

export function logIn(
  client: ApolloClient,
  email: string,
  password: string,
  deviceLabel: string | null,
): Promise<Outcome<TokenPair>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: LogInDocument,
        variables: { input: { email, password, deviceLabel } },
      }),
    (data) => data.logIn.userErrors,
    (data) => data.logIn.auth,
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
      (data) => data.refreshSession.auth,
    );
}

/** Silent verb: no userErrors by design — success and refusal are one. */
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
 * The viewer, live — a null `me` is an UNAUTHENTICATED refusal so the
 * guard treats a stale access token and an explicit refusal the same way.
 */
export async function fetchMe(client: ApolloClient): Promise<Outcome<MeUser>> {
  const fetched = await fetchOutcome(() =>
    client.query({ query: MeDocument, fetchPolicy: "network-only" }),
  );
  if (fetched.kind !== "success") return fetched;
  if (fetched.value.me === null) return unauthenticated();
  return payload([], fetched.value.me);
}
