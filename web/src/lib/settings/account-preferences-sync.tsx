"use client";

// Reads the account's cross-device preferences into this tab whenever the
// signed-in account changes (settings packet §3.1a: "the apps read
// `me.preferences`, never a local copy that could disagree"). Mounted once,
// in the root layout, so every veil the app draws — the feed's cards, a
// post's detail, the comments sheet — answers the account's choice without
// each surface asking for it. Signed out, it forgets: a guest reads veiled.
//
// THE SAME ONE READ CARRIES THE READER'S ACCOUNT STATE (`reader-state.ts`):
// every door into the post composer asks whether the reader is an applicant,
// and none of them asks the server for it.

import { useEffect } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchMe } from "@/lib/api/auth-api";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { settleReaderState, unsettleReaderState } from "@/lib/session/reader-state";
import { useAuthGuard } from "@/lib/session/runtime";
import { setAccountFilterLevel } from "./sensitive-content";

export function AccountPreferencesSync() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const phase = useAuthPhase();
  const account = useActiveAccountId();

  useEffect(() => {
    if (phase === "resolving") return;
    // A new account (or none) starts from the default veil until its own
    // read answers; nothing of the previous account's choice carries over.
    setAccountFilterLevel(null);
    if (phase !== "signedIn") {
      settleReaderState(null);
      return;
    }
    unsettleReaderState();
    let cancelled = false;
    void guard.run(() => fetchMe(client)).then((outcome) => {
      if (cancelled) return;
      if (outcome.kind !== "success") {
        settleReaderState(null);
        return;
      }
      setAccountFilterLevel(outcome.value.preferences?.contentFilteringSeverityLevel ?? null);
      settleReaderState(outcome.value.accountState ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [phase, account, client, guard]);

  return null;
}
