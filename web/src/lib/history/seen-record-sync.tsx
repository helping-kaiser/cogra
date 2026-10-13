"use client";

// Keys the device's seen record to the signed-in account and runs its sync
// (`seen-sync.ts`) at app open and at sign-in. Mounted once, in the root
// layout, beside the preferences sync: the record is the reader's whichever
// surface is open, and the sync must never ride the feed path.
//
// ONCE PER ACCOUNT PER PAGE LOAD (`claimSync`). A switch back to an account
// already synced in this load asks no second time: mid-session seeing on
// another device waits for this device's next open (OS-22). A sync that
// failed is not retried here either — the next open tries again, and the
// watermark it left makes that cheap.

import { useEffect } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchSeenPage } from "@/lib/api/history-api";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { seenRecord } from "./seen-record";
import { claimSync, syncSeenRecord } from "./seen-sync";

export function SeenRecordSync() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const phase = useAuthPhase();
  const account = useActiveAccountId();

  useEffect(() => {
    if (phase === "resolving") return;
    const reader = phase === "signedIn" ? account : null;
    void seenRecord.use(reader);
    if (reader === null || !claimSync(reader)) return;
    void syncSeenRecord(seenRecord, reader, (after) =>
      guard.run(() => fetchSeenPage(client, after)),
    );
  }, [phase, account, client, guard]);

  return null;
}
