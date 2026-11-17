"use client";

// THE COMMIT THAT WAITS (design/designs/canonical/screens/_shared.jsx
// `WaitingCommit`; copy-voice *Commits that wait*). A form's commit stays
// disabled until its fields hold something, with nothing on screen about why:
// what it waits for is the button's SPOKEN description alone, a visually
// hidden span it names in `aria-describedby` (design 80fd29912, jakob
// 2026-11-12). The first character in the last empty field wakes it and the
// description goes. The description is no node — nothing of it is drawn.
//
// IN FLIGHT THE LABEL SAYS WHAT IS HAPPENING, LATE: past 200ms without an
// answer the label swaps to its present participle (`Changing password…`),
// never within 200ms, and never a spinner (seam 044 K4.3). The button goes
// inert, not dimmed — it is still the one commitment on the surface.
//
// A FAULT ABOUT THE WHOLE ACT stands in SignInError's slot, right above the
// commit (copy-voice *Faults by code*): the fields keep what was typed and the
// commit stays, the retry.

import { useEffect, useId, useState } from "react";

import { buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";

/** How long an answer may take before a commit admits it is waiting. */
export const SLOW_ANSWER_MS = 200;

/**
 * True once `busy` has held for {@link SLOW_ANSWER_MS} — the moment a commit's
 * label swaps to its present participle. Resets the instant the answer lands.
 */
export function useSlowAnswer(busy: boolean): boolean {
  return useWaitedPast(busy, SLOW_ANSWER_MS);
}

/** How long a signing may take before the seal says the network is slow (SealSigningSlow.md). */
export const SLOW_NETWORK_MS = 5000;

/**
 * True once `busy` has held for `ms`, counted from the moment it turned true;
 * resets the instant it turns false. The 200ms label swap and the seal's 5s
 * slow line are this one clock read twice, both counting from the press.
 */
export function useWaitedPast(busy: boolean, ms: number): boolean {
  const [slow, setSlow] = useState(false);
  // A new wait starts quick: the flag resets the moment `busy` changes,
  // adjusted during render rather than in an effect (React, "You might not
  // need an effect" — adjusting state when a prop changes).
  const [wasBusy, setWasBusy] = useState(busy);
  if (busy !== wasBusy) {
    setWasBusy(busy);
    setSlow(false);
  }
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(timer);
  }, [busy, ms]);
  return busy && slow;
}

export function WaitingCommit({
  label,
  busyLabel,
  reason,
  waiting,
  busy = false,
  fault = null,
  onCommit,
  node,
  type = "submit",
  testId,
}: {
  label: string;
  busyLabel: string;
  /** What the commit waits for, spoken (never shown) while `waiting`. */
  reason?: string;
  waiting: boolean;
  busy?: boolean;
  /** The whole-act fault line above the commit, or null. */
  fault?: string | null;
  onCommit?: () => void;
  node?: DataNode;
  type?: "submit" | "button";
  /** The commit's own test id, on a screen that registers no node. */
  testId?: string;
}) {
  const id = useId();
  const slow = useSlowAnswer(busy);
  const said = waiting && reason !== undefined;
  return (
    <div className="flex flex-col gap-2" {...testAttributes(node)}>
      {said && (
        <span id={`${id}-waits`} className="sr-only">
          {reason}
        </span>
      )}
      {fault !== null && !waiting && (
        <p role="alert" className="m-0 text-body-medium text-error" data-testid="commit-fault">
          {fault}
        </p>
      )}
      <button
        type={type}
        disabled={waiting}
        aria-describedby={said ? `${id}-waits` : undefined}
        aria-busy={busy || undefined}
        aria-disabled={busy || undefined}
        onClick={(event) => {
          if (busy) {
            event.preventDefault();
            return;
          }
          onCommit?.();
        }}
        className={`${buttonClassName({ variant: "primary" })} w-full`}
        {...testAttributes(part(node, "action"), testId)}
      >
        {slow ? busyLabel : label}
      </button>
    </div>
  );
}
