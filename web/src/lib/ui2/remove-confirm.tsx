"use client";

// REMOVE — THE THINK-TWICE DIALOG (design/designs/canonical/screens/
// RemoveConfirm.jsx, CommentRemoveConfirm.jsx; `_shared.jsx` `RemoveDialog`).
// ONE ANATOMY PER KIND: the nouns swap per kind and nothing else moves (jakob
// 2026-09-23, copy-voice) — the post's confirm and the comment's are this one
// component.
//
// THE SAFE ACTION IS THE FILLED ONE. `Keep it` carries the fill and sits last,
// where the thumb lands; `Remove` is a text button IN NO COLOUR (jakob
// 2026-09-15: "a removal is not an error no?"). What makes the dialog careful
// is the emphasis and the two sentences above the pair, not a red word.
//
// THE DIALOG IS THE REMOVAL'S OWN SURFACE (RemoveConfirm.md:7-13). Pressed,
// `Remove` refuses a second press and never dims; past 200ms unanswered it
// reads `Removing…`, never a spinner (K4.2, `useSlowAnswer`). A removal that
// does not go through keeps the dialog up with its pair, the fault line above
// it — `That didn't send. Try again.`, SeveranceConfirm's placement — and
// `Remove` reading `Retry`. Any non-success is that one state: the client
// never sends a refusable removal of its own content, so a refusal and a lost
// answer are told apart by nothing a reader could act on (the packet's
// residual flag). The comment's confirm carries the line too — RM-G7's build
// word, the nouns-swap rule over its sidecar's silence.
//
// TAKEN, THE NODE NEVER STANDS UNMARKED (RemoveConfirm.md:11). The dialog holds
// `Removing…` through the node's own re-read, hands the host the mark, and
// only then closes — so the surface beneath goes from the thing to its mark
// with no moment of either missing.

import { useApolloClient } from "@apollo/client/react";
import { useEffect, useRef, useState } from "react";

import { markAfterRemoval, removeContent, type Removal } from "@/lib/api/removal-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";

import { DialogSurface } from "./dialog-surface";
import { useSlowAnswer } from "./waiting-commit";

export type RemoveKind = "post" | "comment";

/** The board's `REMOVE_CONFIRM_COPY`, verbatim (copy-voice, the confirm's words). */
export const REMOVE_CONFIRM_COPY: Record<RemoveKind, { title: string; body: string }> = {
  post: {
    title: "Remove this post?",
    body: `The words and pictures leave every reader's view, along with every earlier version's. A visible mark stays in their place — "Removed by its author" — and the post's spot in threads stays with it.`,
  },
  comment: {
    title: "Remove this comment?",
    body: `The words and pictures leave every reader's view, along with every earlier version's. A visible mark stays in their place — "Removed by its author" — and the comment's spot in its thread stays with it.`,
  },
};

export const REMOVE_PERMANENT = "This is immediate and permanent.";
/** The shared no-answer line (copy-voice *Faults by code*; SeveranceConfirm). */
export const REMOVE_NOT_SENT = "That didn't send. Try again.";

/**
 * THE DIALOG ITSELF, its states handed in — the board's `RemoveDialog`. Pure,
 * so every state the sidecars draw can be stood up on its own; the removal
 * that drives it is `RemoveConfirm`'s.
 */
export function RemoveDialog({
  kind,
  busy = false,
  failed = false,
  onRemove,
  onClose,
  node,
  testId,
}: {
  kind: RemoveKind;
  /** The removal is in flight: Remove refuses a second press, the ways out hold. */
  busy?: boolean;
  /** The last removal did not go through: the line stands, Remove reads Retry. */
  failed?: boolean;
  onRemove: () => void;
  /** Keep it, the scrim, Escape — ignored while `busy`. */
  onClose: () => void;
  /** The dialog's node, where its board is registered; parts `title`, `body`, `remove`, `keep`, `line`. */
  node?: DataNode;
  testId: string;
}) {
  const slow = useSlowAnswer(busy);
  const copy = REMOVE_CONFIRM_COPY[kind];
  return (
    <DialogSurface
      title={copy.title}
      // THE WAYS OUT WAIT FOR THE ANSWER while it is in flight — the act was
      // sent from this dialog, so the scrim, Escape and Back hold, locked and
      // never dimmed (the walk-back's rule, the same family of confirm).
      locked={busy}
      onDismiss={onClose}
      node={node}
      testId={testId}
      body={[
        copy.body,
        REMOVE_PERMANENT,
        // ABOVE THE PAIR, where SeveranceConfirm stands its fault line.
        ...(failed
          ? [
              <p
                key="failed"
                role="alert"
                className="m-0 text-error"
                {...testAttributes(part(node, "line"), `${testId}-failed`)}
              >
                {REMOVE_NOT_SENT}
              </p>,
            ]
          : []),
      ]}
      actions={
        <>
          <button
            type="button"
            aria-disabled={busy || undefined}
            aria-busy={slow || undefined}
            onClick={() => {
              if (!busy) onRemove();
            }}
            // A text button in the label's own ink — no error role here.
            className={buttonClassName({ variant: "text" })}
            {...testAttributes(part(node, "remove"), `${testId}-remove`)}
          >
            {slow ? "Removing…" : failed ? "Retry" : "Remove"}
          </button>
          <button
            type="button"
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) onClose();
            }}
            className={buttonClassName({ variant: "primary" })}
            {...testAttributes(part(node, "keep"), `${testId}-keep`)}
          >
            Keep it
          </button>
        </>
      }
    />
  );
}

/** The dialog, driving the removal: `removeContent`, then the node's own re-read. */
export function RemoveConfirm({
  kind,
  nodeId,
  record,
  onClose,
  onRemoved,
  node,
  testId,
}: {
  kind: RemoveKind;
  /** The post or comment being removed — what the re-read asks after. */
  nodeId: string;
  /** Its `genesisRecordId`: what `removeContent` names, the chain with it. */
  record: string;
  /** Keep it, the scrim, Escape — and the close after a taken removal. */
  onClose: () => void;
  /**
   * The removal was taken: the host swaps its node for one wearing `removal`,
   * so the card stands as its mark in place. Called before the dialog closes.
   */
  onRemoved: (removal: Removal) => void;
  node?: DataNode;
  testId: string;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // REFUSES A SECOND PRESS (RemoveConfirm.md:7): held in a ref as well as in
  // state, so two presses inside one frame — before `busy` has rendered —
  // still send one removal.
  const inFlight = useRef(false);
  // A host may take the dialog down mid-flight (its surface left); the answer
  // that arrives after must not set state on what is gone.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const remove = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    const outcome = await guard.run(() => removeContent(client, record));
    if (outcome.kind !== "success") {
      inFlight.current = false;
      if (!mounted.current) return;
      setBusy(false);
      setFailed(true);
      return;
    }
    const removal = await markAfterRemoval(client, kind, nodeId, outcome.value);
    onRemoved(removal);
    inFlight.current = false;
    if (!mounted.current) return;
    setBusy(false);
    onClose();
  };

  return (
    <RemoveDialog
      kind={kind}
      busy={busy}
      failed={failed}
      onRemove={() => void remove()}
      onClose={onClose}
      node={node}
      testId={testId}
    />
  );
}
