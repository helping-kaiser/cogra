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
// and none of them asks the server for it. Any later `me` read the session
// makes refreshes it through the cache (`watchFresherReads`).

import { useEffect } from "react";
import type { ApolloClient } from "@apollo/client";
import { useApolloClient } from "@apollo/client/react";

import { ReaderAccountStateFragmentDoc } from "@/__generated__/graphql";
import { fetchMe } from "@/lib/api/auth-api";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import {
  settleReaderState,
  unsettleReaderState,
  type ReaderAccountState,
} from "@/lib/session/reader-state";
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
    let watching: { unsubscribe(): void } | null = null;
    void guard.run(() => fetchMe(client)).then((outcome) => {
      if (cancelled) return;
      if (outcome.kind !== "success") {
        settleReaderState(null);
        return;
      }
      setAccountFilterLevel(outcome.value.preferences?.contentFilteringSeverityLevel ?? null);
      settleReaderState(outcome.value.accountState ?? null);
      watching = watchFresherReads(client, outcome.value.id, outcome.value.accountState ?? null);
    });
    return () => {
      cancelled = true;
      watching?.unsubscribe();
    };
  }, [phase, account, client, guard]);

  return null;
}

/**
 * A LATER `me` READ IS FRESHER THAN THIS ONE: an applicant let in mid-session
 * finds the doors open once any surface's account read (the feed's, the
 * profile's) answers member, with no reload. Every `fetchMe` is `network-only`,
 * whose result Apollo stores in the cache (Apollo Client docs, "Queries" ›
 * fetch policies), and `watchFragment` on this account's own entry delivers
 * each change of it (API reference, `ApolloClient.watchFragment`) — no read of
 * its own, no poll. The entry, not `me`: the root field is any `me`-rooted
 * read's to re-point.
 *
 * Only a CHANGE of the cached `accountState` publishes: a write that leaves
 * it alone re-delivers the old value, which must not undo what the landing
 * settled (`signing/provider.tsx`).
 */
function watchFresherReads(
  client: ApolloClient,
  account: string,
  answered: ReaderAccountState | null,
): { unsubscribe(): void } {
  let seen = answered;
  return client
    .watchFragment({ fragment: ReaderAccountStateFragmentDoc, from: { __typename: "User", id: account } })
    .subscribe({
      next: (result) => {
        if (!result.complete) return;
        const state = result.data.accountState ?? null;
        if (state === seen) return;
        seen = state;
        settleReaderState(state);
      },
    });
}
