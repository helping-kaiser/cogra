// The knot between the browser's Apollo client and its auth guard. Each
// needs the other: the guard refreshes THROUGH the client, and the client's
// request chain waits on the guard's readiness before deciding whether a
// request carries a token (`apollo-link.ts`). So they are built together,
// here, rather than one of them reaching for the other later.
//
// ONE GUARD PER CLIENT, and the registry is what keeps it one. A second guard
// would carry a second refresher, and two refreshers are two single-flight
// domains: they would rotate the refresh token in parallel, which is what
// reuse detection treats as theft (auth.md "Reuse detection"). The guard the
// surfaces reach for through `useAuthGuard` is therefore the same object the
// link waits on, never a copy of it.

import type { ApolloClient, ApolloLink } from "@apollo/client";

import { refreshExecutor } from "@/lib/api/auth-api";
import { discardDeviceLock, issueDeviceLock, releaseDeviceLock } from "@/lib/api/device-lock-api";
import type { Outcome } from "@/lib/api/outcome";
import { authorizedLink } from "@/lib/apollo-link";
import { composeDraftStore } from "@/lib/compose/draft-store";
import { seenRecord } from "@/lib/history/seen-record";
import { forgetSeen } from "@/lib/history/seen-sync";
import { createDeviceLockEngine, type DeviceLockEngine } from "@/lib/identity/device-lock";
import { identityStore } from "@/lib/identity/store";
import { createGuard, type AuthGuard } from "./guard";
import { markSessionEnded } from "./ended-session";
import { createRefresher } from "./refresher";
import type { TokenStore } from "./token-store";

const guards = new WeakMap<ApolloClient, AuthGuard>();
const deviceLocks = new WeakMap<ApolloClient, DeviceLockEngine>();

/**
 * Build a client over the authorized chain and give it its guard.
 *
 * `make` receives the finished link and returns the client, because which
 * `ApolloClient` this is differs by caller — the app builds the Next.js
 * streaming subclass, a test builds the plain one — while the chain and the
 * guard over it are the same in both.
 */
export function createGuardedClient<T extends ApolloClient>(
  store: TokenStore,
  uri: string,
  make: (link: ApolloLink) => T,
): T {
  // Assigned on the next line. Nothing can send an operation in between, so
  // the null branch answers the type system rather than a race.
  let guard: AuthGuard | null = null;
  const client = make(authorizedLink(store, uri, () => guard?.prime() ?? Promise.resolve()));
  // A call with no token of its own rides the tab's session, refreshed and
  // replayed by the guard like any other; one with a token carries it.
  const guarded = <T,>(accessToken: string | undefined, call: () => Promise<Outcome<T>>) =>
    accessToken === undefined && guard !== null ? guard.run(call) : call();
  const deviceLock = createDeviceLockEngine({
    identity: identityStore,
    drafts: composeDraftStore,
    idb: () => indexedDB,
    forgetSeen: (account) => forgetSeen(seenRecord, account),
    api: {
      issue: (token) => guarded(token, () => issueDeviceLock(client, token)),
      release: (lock, password, token) =>
        guarded(token, () => releaseDeviceLock(client, lock, password, token)),
      discard: (lock, token) => guarded(token, () => discardDeviceLock(client, lock, token)),
    },
  });
  guard = createGuard(
    store,
    // An invalidated session ends its account's custody here per the
    // "don't remember me" opt-in — locked, or purged where a backup is
    // known, never asked (sign-out-custody §3.6).
    createRefresher(store, refreshExecutor(client), async (clearTokens) => {
      // The sign-in this lands on says why it opened (SignInExpired.md).
      markSessionEnded();
      const account = store.activeAccountId();
      if (account === null) return;
      await deviceLock.endLocalSession(account, clearTokens);
    }),
  );
  guards.set(client, guard);
  deviceLocks.set(client, deviceLock);
  clearAtAccountBoundary(store, client);
  return client;
}

/**
 * Empty the cache whenever the active account ends or changes.
 *
 * The cache is keyed by query, not by viewer (web.md "a viewer-scoped read
 * always asks the server"), so what one account was answered must not
 * outlive it in a tab that keeps accounts side by side. Every boundary —
 * sign-out, a refused refresh, another tab's sign-out or switch, a sign-in
 * or join over a session — moves the token store's active account, so the
 * store is the one place they share. A rotation keeps the account and keeps
 * the cache.
 *
 * The reset is the cache's own, the step Apollo's `clearStore` ends with,
 * without the step it begins with: `clearStore` also rejects every read
 * still in the chain, and that includes the reads parked on the session gate
 * while a refused refresh signs the tab out — reads that then go out, and
 * must be answered, as the guest the tab now is. Nothing refetches, as with
 * `clearStore`: the app keeps no watched query, and its `watchFragment`s
 * pass over an incomplete read. A late answer the old account earned is
 * refused by the chain instead (`answeredAsSender`, `apollo-link.ts`).
 */
function clearAtAccountBoundary(store: TokenStore, client: ApolloClient): void {
  let account = store.activeAccountId();
  store.subscribe(() => {
    const next = store.activeAccountId();
    if (next === account) return;
    account = next;
    void client.cache.reset();
  });
}

export function guardOf(client: ApolloClient): AuthGuard {
  const guard = guards.get(client);
  if (guard === undefined) {
    throw new Error("this Apollo client carries no guard — build it with createGuardedClient");
  }
  return guard;
}

/** The device-lock engine built over this client (auth.md "Device lock"). */
export function deviceLockOf(client: ApolloClient): DeviceLockEngine {
  const engine = deviceLocks.get(client);
  if (engine === undefined) {
    throw new Error("this Apollo client carries no device lock — build it with createGuardedClient");
  }
  return engine;
}
