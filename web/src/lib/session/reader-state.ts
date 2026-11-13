// THE READER'S ACCOUNT STATE, READ ONCE PER SESSION AND SHARED BY EVERY DOOR
// (auth.md "Application"; ApplicantFeed.md:49-51, ProfileApplicant.md:24-26,
// ProfileMenu.md:19). An applicant can read everything and post nothing: every
// door into the post composer — the bar's New post, a card's Cite, a person's
// Mention, a tag's `Tag a new post with it`, the composer's own address — answers
// an applicant with `You can post once you're in.` and never opens the wizard,
// and every stance face with `You can give your opinion once you're in.`
// (ruling PR-103).
//
// ONE READ, NOT ONE PER CARD. The doors stand on cards whose hosts do not know
// who is reading, so the state lives here, outside React, and the root layout's
// one account read (`AccountPreferencesSync`, which already reads `me` once per
// account for the veil) publishes into it — the same shape as the veil's own
// `sensitive-content.ts`. A door reads it through `useReaderIsApplicant`.
// The landing is the change of state a session sees live, by two witnesses:
// the registration loop that observes it (`signing/provider.tsx`) settles
// MEMBER, and any later `me` read a surface makes (the feed's, the profile's)
// publishes what it answered through the sync's cache watch.
//
// SETTLED OR NOT. A surface that must not flash the wizard before the answer
// (the composer opened by address) waits for `settled`; a read that did not
// answer settles with no state, and the doors then stand open: what an
// applicant's post meets past them is the server's answer to `preparePost`
// (auth.md "Account states").

import { useSyncExternalStore } from "react";

/** `User.accountState` (schema.graphql). */
export type ReaderAccountState = "GUEST" | "APPLICANT" | "MEMBER";

export type ReaderState = {
  /** The session's account read has answered, or failed, or there is no session. */
  readonly settled: boolean;
  /** What it answered; null while unsettled, signed out, or unanswered. */
  readonly accountState: ReaderAccountState | null;
};

/** The applicant family's `once you're in` for every door into the post composer. */
export const POST_LOCKED = "You can post once you're in.";

/** The same family's line for every stance face (ApplicantFeed.md:45-47, ProfileOther.md:47-49). */
export const OPINION_LOCKED = "You can give your opinion once you're in.";

/** And for every door into the comment composer (ReplyEntry.md:25, ProfileComments.md:33). */
export const COMMENT_LOCKED = "You can comment once you're in.";

const UNSETTLED: ReaderState = { settled: false, accountState: null };

let current: ReaderState = UNSETTLED;
const listeners = new Set<() => void>();

function publish(next: ReaderState): void {
  if (current.settled === next.settled && current.accountState === next.accountState) return;
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A new account (or none yet) is being read: nothing of the previous one carries over. */
export function unsettleReaderState(): void {
  publish(UNSETTLED);
}

/** The session's account read answered `state` — or null: signed out, or unanswered. */
export function settleReaderState(state: ReaderAccountState | null): void {
  publish({ settled: true, accountState: state });
}

/** The reader's state now, outside React. */
export function readerState(): ReaderState {
  return current;
}

/** The reader's state, live. The server render has no reader: unsettled. */
export function useReaderState(): ReaderState {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => UNSETTLED,
  );
}

/** The reader is an applicant: every door into the post composer answers `POST_LOCKED`. */
export function useReaderIsApplicant(): boolean {
  return useReaderState().accountState === "APPLICANT";
}

export function resetReaderStateForTests(): void {
  current = UNSETTLED;
}
