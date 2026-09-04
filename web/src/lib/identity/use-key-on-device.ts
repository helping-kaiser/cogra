"use client";

// Whether the signed-in account's actor key sits in this browser. One read
// per mount — restoring navigates away and back, so staleness self-heals.

import { useEffect, useState } from "react";

import { identityStore, type IdentityStore } from "@/lib/identity/store";

/**
 * The four answers, because "no key" and "could not ask" are different.
 *
 * Custody lives in IndexedDB, and IndexedDB rejects outright in a browser with
 * storage blocked or partitioned — private browsing, a third-party context, a
 * blocked version upgrade. Left uncaught that rejection is an unhandled
 * promise and a hook stuck at "resolving" for the life of the page, which is
 * the one state a surface cannot render honestly.
 */
export type KeyOnDevice = "resolving" | "present" | "absent" | "unavailable";

export function useKeyOnDeviceState(store: IdentityStore = identityStore): KeyOnDevice {
  const [state, setState] = useState<KeyOnDevice>("resolving");
  useEffect(() => {
    let live = true;
    void store.actorKey().then(
      (key) => {
        if (live) setState(key === null ? "absent" : "present");
      },
      () => {
        if (live) setState("unavailable");
      },
    );
    return () => {
      live = false;
    };
  }, [store]);
  return state;
}

/**
 * The same read as a two-state answer: `null` while resolving, `false` once
 * this device cannot sign — whether because no key is here or because custody
 * cannot be reached. A device that cannot answer cannot sign either way, and
 * the route the screens offer is the same one: restore the key.
 */
export function useKeyOnDevice(store: IdentityStore = identityStore): boolean | null {
  const state = useKeyOnDeviceState(store);
  return state === "resolving" ? null : state === "present";
}
