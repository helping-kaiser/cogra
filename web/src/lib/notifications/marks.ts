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

import type { ApolloClient } from "@apollo/client";

import { markNotificationRead, markNotificationsSeen } from "@/lib/api/notifications-api";
import type { AuthGuard } from "@/lib/session/guard";

type Guarded = Pick<AuthGuard, "run">;

let pendingThrough: string | null = null;
const pendingReads = new Set<string>();
let sending = false;
let listening = false;
let lastSend: (() => void) | null = null;

/** The read marks the queue still owes, for tests. */
export function pendingMarks(): { through: string | null; reads: readonly string[] } {
  return { through: pendingThrough, reads: [...pendingReads] };
}

/** Test seam: forget what is owed. */
export function resetMarks(): void {
  pendingThrough = null;
  pendingReads.clear();
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
    const through = pendingThrough;
    if (through !== null) {
      const outcome = await guard.run(() => markNotificationsSeen(client, through));
      if (outcome.kind === "success" && pendingThrough === through) pendingThrough = null;
    }
    for (const id of [...pendingReads]) {
      const outcome = await guard.run(() => markNotificationRead(client, id));
      if (outcome.kind === "success") pendingReads.delete(id);
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
  pendingThrough = pendingThrough === null ? through : later(pendingThrough, through);
  return sender(client, guard)();
}

/** A row was opened. */
export function markRead(client: ApolloClient, guard: Guarded, id: string): Promise<void> {
  pendingReads.add(id);
  return sender(client, guard)();
}

/** A checkpoint: send whatever is still owed. */
export function flushMarks(client: ApolloClient, guard: Guarded): Promise<void> {
  return sender(client, guard)();
}
