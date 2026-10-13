// The device lock's verbs (auth.md "Device lock"; api-spec.md "Auth and
// accounts"), lifted into outcomes. Each takes an optional access token the
// call carries instead of the tab's (`EXPLICIT_ACCESS_TOKEN`): the sign-in's
// leg runs before its fresh session is committed, and the lock's own calls
// may run after the tab's session was cleared.

import type { ApolloClient } from "@apollo/client";

import {
  DiscardDeviceLockDocument,
  IssueDeviceLockDocument,
  ReleaseDeviceLockDocument,
} from "@/__generated__/graphql";
import { fromBase64 } from "@/lib/crypto/bytes";
import { EXPLICIT_ACCESS_TOKEN } from "@/lib/apollo-link";
import { payloadOutcome, type Outcome } from "./outcome";

/** The server half of a lock, as the device receives it. */
export type IssuedLock = {
  readonly id: string;
  readonly secret: Uint8Array;
};

function contextOf(accessToken: string | undefined) {
  return accessToken === undefined ? undefined : { [EXPLICIT_ACCESS_TOKEN]: accessToken };
}

/** A secret the server answered in a shape this client cannot read is a contract break. */
function secretOf(base64: string | null | undefined): Uint8Array | null {
  if (base64 == null) return null;
  try {
    const bytes = fromBase64(base64);
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}

export function issueDeviceLock(
  client: ApolloClient,
  accessToken?: string,
): Promise<Outcome<IssuedLock>> {
  return payloadOutcome(
    () => client.mutate({ mutation: IssueDeviceLockDocument, context: contextOf(accessToken) }),
    (data) => data.issueDeviceLock.userErrors,
    (data) => {
      const lock = data.issueDeviceLock.lock;
      const secret = secretOf(lock?.secret);
      return lock == null || secret === null ? null : { id: lock.id, secret };
    },
  );
}

/** The lock's secret behind the account's current password — idempotent, never spends the lock. */
export function releaseDeviceLock(
  client: ApolloClient,
  lock: string,
  password: string,
  accessToken?: string,
): Promise<Outcome<Uint8Array>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: ReleaseDeviceLockDocument,
        variables: { input: { lock, password } },
        context: contextOf(accessToken),
      }),
    (data) => data.releaseDeviceLock.userErrors,
    (data) => secretOf(data.releaseDeviceLock.secret),
  );
}

/** Deletes one of the viewer's locks — idempotent and silent for an unknown id. */
export function discardDeviceLock(
  client: ApolloClient,
  lock: string,
  accessToken?: string,
): Promise<Outcome<true>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: DiscardDeviceLockDocument,
        variables: { input: { lock } },
        context: contextOf(accessToken),
      }),
    (data) => data.discardDeviceLock.userErrors,
    (data) => (data.discardDeviceLock.ok === true ? true : null),
  );
}
