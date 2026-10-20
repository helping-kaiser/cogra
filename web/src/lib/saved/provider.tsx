"use client";

// One `SavedWrites` for the whole app (see `saved-writes.ts` for why it has to
// be one), sending through the same client and guard every other write uses,
// and dropped whole when the signed-in account changes — a kept state is the
// reader's own, and the next reader on this browser must not inherit it.
//
// A SURFACE RENDERED WITHOUT THE PROVIDER STILL WORKS: it gets a store of its
// own. That is the test harness's case — a screen under test acts on its own
// nodes and reads them back — and it keeps every existing screen test from
// having to learn about Saved.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useApolloClient } from "@apollo/client/react";
import type { ApolloClient } from "@apollo/client";

import { removeBookmark, setBookmark } from "@/lib/api/saved-api";
import { useActiveAccountId } from "@/lib/session/provider";
import type { AuthGuard } from "@/lib/session/guard";
import { useAuthGuard } from "@/lib/session/runtime";
import { SavedWrites, type Intent, type SendResult } from "./saved-writes";

const SavedContext = createContext<SavedWrites | null>(null);

function sender(client: ApolloClient, guard: AuthGuard) {
  return async (node: string, intent: Intent): Promise<SendResult> => {
    if (intent.kind === "drop") {
      const outcome = await guard.run(() => removeBookmark(client, node));
      return outcome.kind === "success" ? { ok: true, kept: null } : { ok: false };
    }
    const outcome = await guard.run(() => setBookmark(client, node, intent.at));
    return outcome.kind === "success" ? { ok: true, kept: outcome.value } : { ok: false };
  };
}

export function SavedProvider({
  writes,
  children,
}: {
  /** Injected by tests; production sends through Apollo. */
  writes?: SavedWrites;
  children: ReactNode;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const account = useActiveAccountId();
  const value = useMemo(() => writes ?? new SavedWrites(sender(client, guard)), [writes, client, guard]);
  const seen = useRef(account);
  useEffect(() => {
    if (seen.current === account) return;
    seen.current = account;
    value.reset();
  }, [account, value]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

/** The app's Saved writes, re-rendering the caller on every change. */
export function useSavedWrites(): SavedWrites {
  const shared = useContext(SavedContext);
  const client = useApolloClient();
  const guard = useAuthGuard();
  // Built once per component and only read where no provider stands — a few
  // empty maps, never sent through unless used.
  const [local] = useState(() => new SavedWrites(sender(client, guard)));
  const writes = shared ?? local;
  useSyncExternalStore(writes.subscribe, writes.snapshot, writes.snapshot);
  return writes;
}
