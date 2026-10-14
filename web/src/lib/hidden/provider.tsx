"use client";

// One `HiddenSet` for the whole app (hidden-actors packet §5.1), sending through
// the same client and guard every other write uses, dropped whole when the
// signed-in account changes — the set is the reader's own, and the next reader
// on this browser must not inherit it — and read again when the reader comes
// back to the tab, so a hide made on another device reaches this one.
//
// A SURFACE RENDERED WITHOUT THE PROVIDER STILL WORKS: it gets a set of its
// own, as `useSavedWrites` does, which is the test harness's case.

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

import { fetchHiddenActors, hideActor, unhideActor } from "@/lib/api/hidden-api";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import type { AuthGuard } from "@/lib/session/guard";
import { useAuthGuard } from "@/lib/session/runtime";
import { HiddenSet, type HiddenIo } from "./hidden-set";

const HiddenContext = createContext<HiddenSet | null>(null);

function io(client: ApolloClient, guard: AuthGuard): HiddenIo {
  return {
    load: async () => {
      const outcome = await guard.run(() => fetchHiddenActors(client));
      return outcome.kind === "success" ? outcome.value : null;
    },
    hide: async (actor, at) => {
      const outcome = await guard.run(() => hideActor(client, actor, at));
      return outcome.kind === "success" ? outcome.value : null;
    },
    unhide: async (actor) => {
      const outcome = await guard.run(() => unhideActor(client, actor));
      return outcome.kind === "success";
    },
  };
}

export function HiddenProvider({
  set,
  children,
}: {
  /** Injected by tests; production sends through Apollo. */
  set?: HiddenSet;
  children: ReactNode;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const account = useActiveAccountId();
  const phase = useAuthPhase();
  const value = useMemo(() => set ?? new HiddenSet(io(client, guard)), [set, client, guard]);
  const seen = useRef(account);
  useEffect(() => {
    if (seen.current === account) return;
    seen.current = account;
    value.reset();
  }, [account, value]);
  // READ AT PAGE LOAD, AND AGAIN ON EVERY RETURN TO THE TAB (§5.1). Only a
  // signed-in reader has a set; a guest's feed hides nobody.
  useEffect(() => {
    if (phase !== "signedIn") return;
    void value.ensure();
    const onVisible = () => {
      if (document.visibilityState === "visible") void value.refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase, account, value]);
  return <HiddenContext.Provider value={value}>{children}</HiddenContext.Provider>;
}

/** The app's hidden set, re-rendering the caller on every change. */
export function useHiddenSet(): HiddenSet {
  const shared = useContext(HiddenContext);
  const client = useApolloClient();
  const guard = useAuthGuard();
  const [local] = useState(() => new HiddenSet(io(client, guard)));
  const set = shared ?? local;
  useSyncExternalStore(set.subscribe, set.snapshot, set.snapshot);
  return set;
}
