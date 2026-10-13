"use client";

// THE BELL'S DOT (FeedUnread.md; notifications.md "Read state has two levels").
// One state for the whole shell, so every root band shows the same dot:
//
// - IT LIGHTS ONLY ON A FRESH ROOT LOAD. A root that loads fresh asks the
//   server once (`useFreshRootBell`) and the answer is the dot. Nothing
//   listens in between: something arriving while the reader sits on a root
//   never lights it live (FeedUnread.md:7), and a return by back or the bar is
//   not a fresh load, so it never lights it either (:9).
// - IT CLEARS LOCALLY WHEN THE LIST OPENS (:17), at once — the server's
//   pointer moves behind it through the marks queue (`marks.ts`).
// - IT IS ONE READER'S. The state is keyed by the account it was read for, so
//   a sign-out or an account switch reads an unlit bell until that reader's
//   own root loads fresh.
//
// Module scope through `useSyncExternalStore` (React, "Subscribing to an
// external store"), the way the feed keeps its memory (`feed-memory.ts`): a
// root's mount and unmount must not reset what the shell knows.

import { useEffect, useSyncExternalStore } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchBell } from "@/lib/api/notifications-api";
import { useAuthGuard } from "@/lib/session/runtime";

type BellState = { readonly account: string | null; readonly lit: boolean };

let state: BellState = { account: null, lit: false };
const listeners = new Set<() => void>();

function set(next: BellState): void {
  if (next.account === state.account && next.lit === state.lit) return;
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether the bell's dot is lit for `account`. */
export function bellLit(account: string | null): boolean {
  return account !== null && state.account === account && state.lit;
}

/** The answer a fresh root load brought for `account`. */
export function setBell(account: string, lit: boolean): void {
  set({ account, lit });
}

/** The list opened: the dot goes at once, whoever's it was. */
export function clearBell(): void {
  set({ account: state.account, lit: false });
}

/** Test seam: forget every reader's dot. */
export function resetBell(): void {
  set({ account: null, lit: false });
  arrived.clear();
}

/**
 * The roots this page load has already shown `account`. A root that keeps no
 * memory of its own (the profile) re-mounts on every return, so its FIRST
 * arrival per load is its fresh load, and every later one is a return by back
 * or the bar — which never lights the dot (FeedUnread.md:9).
 */
const arrived = new Set<string>();

/** Whether this is `account`'s first arrival on `root` in this page load; records it. */
export function firstArrival(account: string | null, root: string): boolean {
  if (account === null) return false;
  const key = `${account}:${root}`;
  if (arrived.has(key)) return false;
  arrived.add(key);
  return true;
}

/** The dot as the shell holds it for `account`, re-rendering when it changes. */
export function useBellLit(account: string | null): boolean {
  return useSyncExternalStore(
    subscribe,
    () => bellLit(account),
    () => false,
  );
}

/**
 * A root's fresh load asks the server whether anything arrived since the
 * reader last opened the list (FeedUnread.md:3, :5). `fresh` is the root's own
 * reading of its arrival — a remembered feed coming back is not fresh — and
 * `signal` re-asks on the root's own reload (a pull). A failed ask changes
 * nothing: the dot is a convenience and never a fault.
 */
export function useFreshRootBell(account: string | null, fresh: boolean, signal: unknown = 0): void {
  const client = useApolloClient();
  const guard = useAuthGuard();
  useEffect(() => {
    if (!fresh || account === null) return;
    let live = true;
    void (async () => {
      const outcome = await guard.run(() => fetchBell(client));
      if (live && outcome.kind === "success") setBell(account, outcome.value);
    })();
    return () => {
      live = false;
    };
  }, [account, fresh, signal, client, guard]);
}
