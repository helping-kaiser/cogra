"use client";

// Who has chosen to look, and at what.
//
// THE RULING (round 5). A reveal is PER NODE, PER SESSION, SHARED ACROSS
// SURFACES, and RESET when that node's sensitive state changes. The hand test
// found the opposite on both counts: revealing a post in the feed left it
// veiled again on its own detail page, while within one surface the reveal
// survived "no matter what state changes i make" — including a change to the
// very mark the reader was answering.
//
// Each half of the ruling is a different mistake, and they need different
// answers:
//
//   · CARRYING ACROSS SURFACES is why the decision cannot live in the veil's
//     own `useState`. A card and a detail page are two components that never
//     share a tree, so the decision has to live beside them, keyed by the node
//     it was made about.
//   · RESETTING ON A CHANGE is why remembering the id alone is not enough. "I
//     have seen this" is only true of the thing that was there when the reader
//     looked; if a moderator marks it after the fact, the old consent does not
//     cover the new state. So what is remembered is the node's sensitive state
//     AT THE MOMENT OF THE REVEAL, and a reveal counts only while the state
//     still matches.
//
// PER SESSION means exactly this module's lifetime — a tab. Nothing is written
// to storage: a decision to look at one sensitive post is not a preference, and
// persisting it across visits would quietly turn a single "yes" into a
// standing one.

import { useSyncExternalStore } from "react";

/** Node id → the sensitive state it was revealed at. */
const revealed = new Map<string, string>();

// SHARED ACROSS SURFACES is a claim about every mounted component, not only the
// one that was clicked, so the store carries subscribers the way the mute store
// does. Without them a reveal reaches the card the reader touched and leaves the
// same node veiled everywhere else until something unrelated re-renders it.
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type Marked = {
  attachmentsStatus: string;
  moderationStatus?: string;
};

/**
 * The node's sensitive state, as one comparable value.
 *
 * Both marks are read, not just whether the body is veiled at all: the display
 * state is the OR of the author's mark and the moderator's (round 4), so a
 * moderator marking a post the author had already marked leaves "is it
 * sensitive" unchanged while genuinely changing what the reader is consenting
 * to. Only fields the shared reads already select are used, so remembering a
 * reveal costs no query budget.
 */
export function sensitiveSignature(node: Marked): string {
  return `${node.attachmentsStatus}|${node.moderationStatus ?? ""}`;
}

export function isRevealed(nodeId: string, signature: string): boolean {
  return revealed.get(nodeId) === signature;
}

export function rememberReveal(nodeId: string, signature: string): void {
  if (revealed.get(nodeId) === signature) return;
  revealed.set(nodeId, signature);
  emit();
}

/**
 * A node's reveal, as a value a component re-renders on.
 *
 * `useSyncExternalStore` is React's documented way to read a store that lives
 * outside React, and it is what makes the ruling's "shared across surfaces"
 * true of the render as well as of the map. The server snapshot is `false`:
 * a server render has no reader, and the veil is the honest first paint.
 */
export function useRevealed(nodeId: string, signature: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isRevealed(nodeId, signature),
    () => false,
  );
}

/** Tests only: the map is a session, and a suite is many sessions. */
export function forgetReveals(): void {
  revealed.clear();
  emit();
}
