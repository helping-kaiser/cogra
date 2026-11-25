// The login's one-time notices, handed from the sign-in to the signed-in
// shell: login navigates away on the phase flip, so the shell renders them
// from this store rather than the login surface.
//
// Two notices ride it:
// - the refresh-token reuse notice (auth.md "Reuse detection",
//   FeedSecurityNotice.md). It is KEPT ON THIS DEVICE for the account the
//   sign-in belongs to, written the moment the sign-in's answer carries it and
//   before anything paints, so it stands through a reload and a restart until
//   `Got it` removes it — in every tab, by the `storage` event — and a tab
//   closed before the first paint does not lose it (FeedSecurityNotice.md:9,
//   15, 17). It shows only while its own account is the active one, a
//   device-local flag bound to its account (auth.md "Multi-account device
//   custody"), and goes with a forgetting account's device material at
//   sign-out (auth.md "Sign-out"). At rest it is the detection time the
//   server gave, under `cogra.securityNotice.<account>` — the `cogra.` prefix
//   Settings' erase clears — and nothing else. A browser that refuses storage
//   keeps it for the page (`safe-storage.ts`).
// - the dead device lock (sign-out-custody SC-G2, ruled PR-62): the sign-in
//   found this account's locked custody on this device, but the server could
//   no longer open its lock, so the locked copy was deleted — and the reader
//   is told once rather than finding the key gone without a word ("Never
//   erase silently"). It lives in this tab's memory only.

import { safeStorage, type SafeStorage } from "@/lib/safe-storage";
import { tokenStore, type TokenStore } from "./token-store";

export type SecurityNotices = {
  /**
   * The active account's pending detection time (ISO 8601); null once
   * dismissed, when none arrived, or while no account is signed in.
   */
  reuseDetectedAt(): string | null;
  /** Keeps `detectedAt` for `account`, the account the sign-in belongs to. */
  post(detectedAt: string, account: string): void;
  /** `Got it`: removes the active account's notice for good. */
  dismiss(): void;
  /** Drops `account`'s pending notice with its other device material. */
  forget(account: string): void;
  /** Whether a dead device lock's notice waits to be said. */
  lockLost(): boolean;
  postLockLost(): void;
  dismissLockLost(): void;
  subscribe(listener: () => void): () => void;
};

const PREFIX = "cogra.securityNotice.";

const keyOf = (account: string) => `${PREFIX}${account}`;

export function createSecurityNotices({
  storage = safeStorage(),
  accounts = tokenStore,
}: {
  storage?: SafeStorage;
  /** Whose notice shows: the active account, and word when it changes. */
  accounts?: Pick<TokenStore, "activeAccountId" | "subscribe">;
} = {}): SecurityNotices {
  let lockLost = false;
  const listeners = new Set<() => void>();

  const notify = () => [...listeners].forEach((listener) => listener());

  return {
    reuseDetectedAt() {
      const account = accounts.activeAccountId();
      if (account === null) return null;
      const stored = storage.getItem(keyOf(account));
      return stored === "" ? null : stored;
    },
    post(detectedAt, account) {
      storage.setItem(keyOf(account), detectedAt);
      notify();
    },
    dismiss() {
      const account = accounts.activeAccountId();
      if (account !== null) storage.removeItem(keyOf(account));
      notify();
    },
    forget(account) {
      storage.removeItem(keyOf(account));
      notify();
    },
    lockLost: () => lockLost,
    postLockLost() {
      lockLost = true;
      notify();
    },
    dismissLockLost() {
      lockLost = false;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      const unsubscribeAccounts = accounts.subscribe(listener);
      // Fires only in the OTHER tabs; a null key is a wholesale clear.
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key.startsWith(PREFIX)) listener();
      };
      if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        unsubscribeAccounts();
        if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      };
    },
  };
}

export const securityNotices: SecurityNotices = createSecurityNotices();
