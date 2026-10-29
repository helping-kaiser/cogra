"use client";

// The store's React face: a score slot reads its thing's standing for the
// reader it is drawn for, and re-renders when a ranking is held or a trace
// adopts (`standing.ts`).

import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { standingOf, useStandingVersion, type Standing } from "./standing";

/**
 * THE READER — whose ranking the figures came from, never whose view it
 * ranked: the feed's own reading (`feed-view.tsx`), so a slot off the feed
 * looks its thing up in the same held answer. Signed out, there is none.
 */
export function useScoreReader(): string | null {
  const phase = useAuthPhase();
  const account = useActiveAccountId();
  return phase === "signedIn" ? account : null;
}

/** `targetId`'s standing, `pending` being its row's own landing state. */
export function useStanding(targetId: string, pending: boolean): Standing {
  useStandingVersion();
  const reader = useScoreReader();
  return standingOf(reader, targetId, pending);
}
