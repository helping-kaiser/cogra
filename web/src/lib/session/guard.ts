// The auth guard (Android's AuthGuard): on an UNAUTHENTICATED refusal,
// refresh once and replay once. Anything else passes through; a replay
// that is still unauthenticated is surfaced, never looped.

import { hasCode, type Outcome } from "@/lib/api/outcome";
import type { Refresher } from "./refresher";
import type { TokenStore } from "./token-store";

export type AuthGuard = {
  run<T>(block: () => Promise<Outcome<T>>): Promise<Outcome<T>>;
  /**
   * Settle this tab's session: a token in hand, or the knowledge that there
   * is none to have. Resolving is the whole contract — settled is not signed
   * in, and an anonymous tab settles as anonymous.
   *
   * `run` discovers a missing token from the server's answer, which is the
   * right shape for a request whose cost is a round trip and the wrong one
   * for two kinds of call. For a request whose cost is a file: the body is
   * transferred in full before the refusal comes back, so the replay sends it
   * a SECOND time. And for a read the server answers rather than refuses: a
   * tab's access token lives in memory alone, so a freshly loaded page sends
   * every mount-time read without one, and viewer-shaped nulls come back as
   * success — the guest's view, with no refusal for `run` to replay and
   * nothing to refetch when the token lands.
   *
   * So this runs ahead of both: the whole browser chain waits on it
   * (`apollo-link.ts`), and the uploads ask for it by name before they build
   * their bytes. Nothing here replaces `run` — a token that expires mid-call
   * is still the replay's job.
   */
  prime(): Promise<void>;
};

export function createGuard(store: TokenStore, refresher: Refresher): AuthGuard {
  // One refresh for however many callers arrive at once — the page's whole
  // first wave of reads, or ten pictures starting together. The refresher
  // serializes its callers, but a queue of primes each passing a null stale
  // token would rotate the pair once per caller — and rotating a refresh
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
