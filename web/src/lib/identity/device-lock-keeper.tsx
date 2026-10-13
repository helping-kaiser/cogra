"use client";

// The device lock's start-time duties (sign-out-custody §3.4-§3.5), mounted
// once in the root layout beside the other syncs:
// - every page load: a lock a crash interrupted is finished, and a locked
//   slot's leftover plaintext draft is removed (`recover`), for every account
//   in this browser — signed in or not;
// - every signed-in start of a "don't remember" account that holds no lock:
//   the issue is retried (the holding invariant's fourth reconcile point —
//   a switch flipped offline, an issue that got no answer).
//
// Never in the way: both run behind the page and fail silently, to be tried
// again at the next start.

import { useEffect } from "react";

import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { useDeviceLock } from "@/lib/session/runtime";
import type { DeviceLockEngine } from "./device-lock";
import { identityStore, type IdentityStore } from "./store";

export function DeviceLockKeeper({
  store = identityStore,
  deviceLock,
}: {
  /** Test injection. */
  store?: IdentityStore;
  deviceLock?: Pick<DeviceLockEngine, "recover" | "ensureHeld">;
} = {}) {
  const clientLock = useDeviceLock();
  const engine = deviceLock ?? clientLock;
  const phase = useAuthPhase();
  const account = useActiveAccountId();

  useEffect(() => {
    void engine.recover().catch(() => undefined);
  }, [engine]);

  useEffect(() => {
    if (phase !== "signedIn" || account === null) return;
    void (async () => {
      if (!(await store.isEphemeralFor(account))) return;
      await engine.ensureHeld(account);
    })().catch(() => undefined);
  }, [engine, store, phase, account]);

  return null;
}
