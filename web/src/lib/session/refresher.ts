// Single-flight refresh (Android's SessionRefresher, extended for tabs).
//
// In-tab: concurrent callers serialize on a promise-chain mutex; a caller
// that finds the access token already rotated skips the network and replays
// with the winner's pair. Cross-tab: the network call runs under a Web Lock
// and re-reads the stored refresh token first, so a consumed token is never
// spent twice — accidental reuse would revoke every session. Web Locks needs
// a secure context; where navigator.locks is absent the in-tab mutex still
// holds and multi-tab safety degrades gracefully.

import { hasCode, type Outcome } from "@/lib/api/outcome";
import type { TokenPair, TokenStore } from "./token-store";

export type RefreshExecutor = (refreshToken: string) => Promise<Outcome<TokenPair>>;

export type Refresher = {
  /**
   * Rotate the pair once; true when the caller should replay. Only a
   * REFRESH_TOKEN_INVALID refusal signs the device out — a transport
   * failure or any other refusal keeps the session.
   */
  refresh(staleAccess: string | null): Promise<boolean>;
};

const LOCK_NAME = "cogra-session-refresh";

async function withWebLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks !== undefined) {
    return await navigator.locks.request(LOCK_NAME, fn);
  }
  return fn();
}

export function createRefresher(store: TokenStore, exec: RefreshExecutor): Refresher {
  let chain: Promise<unknown> = Promise.resolve();

  const withMutex = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  return {
    refresh(staleAccess) {
      return withMutex(async () => {
        if (store.refreshToken() === null) return false;
        if (staleAccess !== null && store.accessToken() !== staleAccess) return true;
        return withWebLock(async () => {
          // Re-read under the lock: another tab may have rotated meanwhile.
          const current = store.refreshToken();
          if (current === null) return false;
          const outcome = await exec(current);
          switch (outcome.kind) {
            case "success":
              store.save(outcome.value);
              return true;
            case "refused":
              if (hasCode(outcome, "REFRESH_TOKEN_INVALID")) store.clear();
              return false;
            case "failed":
              return false;
          }
        });
      });
    },
  };
}
