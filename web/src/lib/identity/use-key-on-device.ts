"use client";

// Null while resolving, then whether the signed-in account's actor
// key sits in this browser. One read per mount — restoring navigates
// away and back, so staleness self-heals.

import { useEffect, useState } from "react";

import { identityStore, type IdentityStore } from "@/lib/identity/store";

export function useKeyOnDevice(store: IdentityStore = identityStore): boolean | null {
  const [onDevice, setOnDevice] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void store.actorKey().then((key) => {
      if (live) setOnDevice(key !== null);
    });
    return () => {
      live = false;
    };
  }, [store]);
  return onDevice;
}
