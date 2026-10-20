"use client";

// The transient confirmation of design.md §6: "Confirmation of a
// completed action is a snackbar on both platforms, fired once per
// event." §8.3 is what makes it load-bearing rather than decoration — a
// gesture that stages a priced act must never be silent, because silence
// reads as failure and invites the same act again.
//
// The live region is mounted whether or not it has anything to say.
// Assistive technology only announces changes to a region it was already
// watching, so a region that appears together with its own text is
// routinely missed — the point of a confirmation nobody hears is nil.
//
// It clears itself after Material's short duration; anything the reader
// still needs afterwards belongs on the surface it happened on, not
// here.

import { useEffect } from "react";

import { part, testAttributes, type DataNode } from "./data-node";

/** Material's short snackbar duration. */
export const SNACKBAR_MS = 4000;

/**
 * ONE ACTION, AND ONLY WHERE THE ACT IS WORTH REVERSING
 * (`design/components/core/Snackbar.jsx`): Material's snackbar takes a single
 * action and this one takes the same — `Undo` after a hide or an unsave. It is
 * a word on the message's own line, never a button body: a pill's ground on a
 * surface that is itself a lift would be a second surface arguing with the
 * first.
 */
export type SnackbarAction = {
  label: string;
  onAction: () => void;
};

export function Snackbar({
  message,
  onDismiss,
  testId,
  node,
  action,
  token,
}: {
  /** `null` leaves the region mounted and silent. */
  message: string | null;
  onDismiss: () => void;
  testId: string;
  /**
   * The registered snackbar of a registered screen (`feed.snackbar`,
   * `postDetail.snackbar`): the bar wears it, its words `message` and its
   * action `action`.
   */
  node?: DataNode;
  action?: SnackbarAction;
  /**
   * A RENEWED SNACKBAR STANDS ITS FULL 4s AGAIN (SavedUndo.md: a second unsave
   * while it stands "renews" it). The same words raised twice are the same
   * `message`, so the raise itself has to say it is new.
   */
  token?: number;
}) {
  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(onDismiss, SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss, token]);

  return (
    <div role="status" aria-live="polite" data-testid={`${testId}-region`}>
      {message !== null && (
        <div
          {...testAttributes(node, testId)}
          // Elevation is tonal (design.md §4): the inverse surface is
          // what lifts a snackbar off the page, not a drop shadow.
          className="fixed inset-x-4 bottom-20 z-30 mx-auto flex w-fit max-w-[min(92vw,24rem)] items-center gap-4 rounded-extra-small bg-inverse-surface px-4 py-3 text-body-medium text-inverse-on-surface"
        >
          <span className="min-w-0" {...testAttributes(part(node, "message"))}>
            {message}
          </span>
          {action !== undefined && (
            <button
              type="button"
              {...testAttributes(part(node, "action"), `${testId}-action`)}
              onClick={() => {
                action.onAction();
                onDismiss();
              }}
              // `--action-on-snackbar` is `--inverse-primary`
              // (design/tokens/semantic.css): `primary` on the inverse ground
              // is the one place the brand colour stops being legible.
              className="cg-state cg-focus cg-hit flex-none whitespace-nowrap rounded-extra-small border-0 bg-transparent p-0 text-label-large text-inverse-primary"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
