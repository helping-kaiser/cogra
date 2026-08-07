// The auth guard (Android's AuthGuard): on an UNAUTHENTICATED refusal,
// refresh once and replay once. Anything else passes through; a replay
// that is still unauthenticated is surfaced, never looped.

import { hasCode, type Outcome } from "@/lib/api/outcome";
import type { Refresher } from "./refresher";
import type { TokenStore } from "./token-store";

export type AuthGuard = {
  run<T>(block: () => Promise<Outcome<T>>): Promise<Outcome<T>>;
};

export function createGuard(store: TokenStore, refresher: Refresher): AuthGuard {
  return {
    async run(block) {
      const before = store.accessToken();
      const first = await block();
      if (!hasCode(first, "UNAUTHENTICATED")) return first;
      return (await refresher.refresh(before)) ? block() : first;
    },
  };
}
