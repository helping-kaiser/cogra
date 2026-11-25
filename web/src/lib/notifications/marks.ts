"use client";

// THE TWO READ MARKS, SENT SILENTLY (packet notifications-list §6.4, K4.1).
// Both are read-side: the bell clears and a row's dot goes at the tap, and
// the server is told behind it. Seeing has no surface, so a mark that does
// not go through is never shown — it stays queued and is sent again at the
// next checkpoint: the list opening again, the browser coming back online, or
// the page being hidden. That is the seen tracker's posture
// (`seen-tracker.ts`), and the same reasons hold: nothing here is the
// reader's gesture to revert, and a lost mark only means a dot that comes
// back.
//
// The pointer only moves forward on the server, so the queue keeps the
// latest `through` alone; reads are a set, each sent until it lands.
//
// A MARK IS ITS ACCOUNT'S. Several accounts share a tab (auth.md
// "Multi-account device custody"), and a mark is sent under whatever session
// the tab holds when it goes, so the queue is kept per account — the one the
// tab was signed in as when the mark was made — and only the active
// account's marks are ever sent, re-checked before each one. Another
// account's stay queued for it: a remembered account's sign-out clears
// nothing (auth.md "Sign-out").

import type { ApolloClient } from "@apollo/client";

import { markNotificationRead, markNotificationsSeen } from "@/lib/api/notifications-api";
import { failed, type Outcome } from "@/lib/api/outcome";
import type { AuthGuard } from "@/lib/session/guard";
import { tokenStore } from "@/lib/session/token-store";

type Guarded = Pick<AuthGuard, "run">;

type Owed = { through: string | null; readonly reads: Set<string> };

/** Per account (null: no session), what is still owed. */
const owed = new Map<string | null, Owed>();
let sending = false;
let listening = false;
let lastSend: (() => void) | null = null;

const active = () => tokenStore.activeAccountId();

function owedBy(account: string | null): Owed {
  let entry = owed.get(account);
  if (entry === undefined) {
    entry = { through: null, reads: new Set() };
    owed.set(account, entry);
  }
  return entry;
}

/** The read marks the queue still owes the active account, for tests. */
export function pendingMarks(): { through: string | null; reads: readonly string[] } {
  const entry = owed.get(active());
  return { through: entry?.through ?? null, reads: [...(entry?.reads ?? [])] };
}

/** Test seam: forget what is owed. */
export function resetMarks(): void {
  owed.clear();
  sending = false;
}

function later(a: string, b: string): string {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

function listen(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const retry = () => lastSend?.();
  window.addEventListener("online", retry);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") retry();
  });
}

async function flush(client: ApolloClient, guard: Guarded): Promise<void> {
  if (sending) return;
  sending = true;
  try {
    const account = active();
    const entry = owed.get(account);
    if (entry === undefined) return;
    // Every send re-asks whose the tab is, again inside the guard — after any
    // refresh it waited on, as the request is issued: an account that changed
    // under the flush keeps the rest of its marks for its own next checkpoint.
    const stillTheirs = () => active() === account;
    const asTheirs = <T>(send: () => Promise<Outcome<T>>) =>
      guard.run(() => (stillTheirs() ? send() : Promise.resolve(failed(new Error("account changed")))));
    const through = entry.through;
    if (through !== null && stillTheirs()) {
      const outcome = await asTheirs(() => markNotificationsSeen(client, through));
      if (outcome.kind === "success" && entry.through === through) entry.through = null;
    }
    for (const id of [...entry.reads]) {
      if (!stillTheirs()) break;
      const outcome = await asTheirs(() => markNotificationRead(client, id));
      if (outcome.kind === "success") entry.reads.delete(id);
    }
  } finally {
    sending = false;
  }
}

function sender(client: ApolloClient, guard: Guarded): () => Promise<void> {
  const send = () => flush(client, guard);
  lastSend = () => void send();
  listen();
  return send;
}

/** The list opened holding rows up to `through`: everything at or before it is seen. */
export function markSeenThrough(client: ApolloClient, guard: Guarded, through: string): Promise<void> {
  const entry = owedBy(active());
  entry.through = entry.through === null ? through : later(entry.through, through);
  return sender(client, guard)();
}

/** A row was opened. */
export function markRead(client: ApolloClient, guard: Guarded, id: string): Promise<void> {
  owedBy(active()).reads.add(id);
  return sender(client, guard)();
}

/** A checkpoint: send whatever is still owed. */
export function flushMarks(client: ApolloClient, guard: Guarded): Promise<void> {
  return sender(client, guard)();
}
