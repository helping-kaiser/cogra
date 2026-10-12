"use client";

// THE SENSITIVE-CONTENT CHOICE FOLLOWS THE ACCOUNT (Settings.md: "the
// Sensitive content choice follows the account, never this device alone";
// settings packet §3.1a, contract A6). Settings' `Always unveil sensitive
// content` writes the account's `contentFilteringSeverityLevel`, read as ONE
// threshold until the gradient ships: 0 unveils sensitive content wherever
// the account reads, null or 1–10 keeps the veil (api-spec.md
// `UserPreferences`; design/readme.md, "a single show-sensitive threshold").
//
// This module is the veil's predicate and the tab's copy of the account's
// answer. It is NOT a device preference — the device-local ones live in
// `device-preference.ts` and `localStorage`. Nothing here is written to
// storage: the value is what `me.preferences` last said in this tab, so a
// choice made on another device reads here at the next account read, and a
// signed-out or still-unread tab reads the default, veiled.
//
// The session-scoped single reveal (`ui2/media/reveal.ts`) is a different
// thing and stays as it is: one tap answers one node, while this answers
// every node at once.

import { useSyncExternalStore } from "react";

/** The threshold that unveils everything — the switch's On. */
export const UNVEIL_LEVEL = 0;

/** Whether an account's filter level unveils sensitive content (level 0 only). */
export function unveilsSensitive(level: number | null | undefined): boolean {
  return level === UNVEIL_LEVEL;
}

let level: number | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The account's filter level as this tab last read it; null when unread or unset. */
export function accountFilterLevel(): number | null {
  return level;
}

/**
 * Records the account's filter level from a `me.preferences` read or a
 * saved `setPreferences` answer; null on sign-out, so the next account
 * starts veiled.
 */
export function setAccountFilterLevel(next: number | null): void {
  if (level === next) return;
  level = next;
  for (const listener of listeners) listener();
}

/**
 * Whether this account always unveils sensitive content, as a value every
 * veil re-renders on. The server snapshot is `false`: a server render has
 * no account, and the veil is the honest first paint.
 */
export function useAlwaysUnveil(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => unveilsSensitive(level),
    () => false,
  );
}
