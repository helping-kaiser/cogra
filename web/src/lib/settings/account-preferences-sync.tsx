"use client";

// Reads the account's cross-device preferences into this tab whenever the
// signed-in account changes (settings packet §3.1a: "the apps read
// `me.preferences`, never a local copy that could disagree"). Mounted once,
// in the root layout, so every veil the app draws — the feed's cards, a
// post's detail, the comments sheet — answers the account's choice without
// each surface asking for it. Signed out, it forgets: a guest reads veiled.

import { useEffect } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchMe } from "@/lib/api/auth-api";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
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
    if (phase !== "signedIn") return;
    let cancelled = false;
    void guard.run(() => fetchMe(client)).then((outcome) => {
      if (cancelled || outcome.kind !== "success") return;
      setAccountFilterLevel(outcome.value.preferences?.contentFilteringSeverityLevel ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [phase, account, client, guard]);

  return null;
}
