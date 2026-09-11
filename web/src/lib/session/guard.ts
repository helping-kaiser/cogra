// The auth guard (Android's AuthGuard): on an UNAUTHENTICATED refusal,
// refresh once and replay once. Anything else passes through; a replay
// that is still unauthenticated is surfaced, never looped.

import { hasCode, type Outcome } from "@/lib/api/outcome";
import type { Refresher } from "./refresher";
import type { TokenStore } from "./token-store";

export type AuthGuard = {
  run<T>(block: () => Promise<Outcome<T>>): Promise<Outcome<T>>;
  /**
   * Get a token IN HAND before sending something expensive.
   *
   * `run` discovers a missing token from the server's answer, which is the
   * right shape for a request whose cost is a round trip and the wrong one for
   * a request whose cost is a file: the body is transferred in full before the
   * refusal comes back, so the replay sends it a SECOND time. A tab's access
   * token lives in memory alone and reads answer anonymous callers with
   * viewer-shaped nulls rather than refusals, so a freshly loaded page reaches
   * the composer holding nothing and the upload is the first call to find out
   * — which made the doubling the normal case for a video rather than a rare
   * one.
   *
   * Nothing here replaces `run`: a token that expires mid-upload is still the
   * replay's job. This only removes the send that was known to be wasted
   * before it was made.
   */
  prime(): Promise<void>;
};

export function createGuard(store: TokenStore, refresher: Refresher): AuthGuard {
  // One refresh for however many uploads start at once. The refresher
  // serializes its callers, but a queue of primes each passing a null stale
  // token would rotate the pair once per picture — and rotating a refresh
  // token more often than needed is exactly what reuse detection watches for.
  let priming: Promise<unknown> | null = null;

  return {
    async run(block) {
      const before = store.accessToken();
      const first = await block();
      if (!hasCode(first, "UNAUTHENTICATED")) return first;
      return (await refresher.refresh(before)) ? block() : first;
    },

    async prime() {
      if (store.accessToken() !== null) return;
      // A signed-out tab has no refresh token either; `refresh` answers false
      // and the call goes out anonymous, to be refused as it should be.
      priming ??= refresher.refresh(null).finally(() => {
        priming = null;
      });
      await priming;
    },
  };
}
