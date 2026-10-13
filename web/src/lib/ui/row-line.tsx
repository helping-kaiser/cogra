// THE ROW LINE (design/components/honesty/TransportError.jsx, `SigningPending`'s
// `row` form; RowSigning.md; the failure pack, jakob 2026-09-30 and
// 2026-10-01): the one line a target's own row carries for what happened to a
// gesture made on it — under the face, in the slot the pending marker uses,
// on one line, because the row is one line of controls by rule.
//
// THREE STATES, ONE MASTER:
// - `signing` — a hold's signature past 200ms: `Signing…`, the pending
//   marker's quiet register, announced politely;
// - `didntSign` — the hold did not sign: `That didn't sign.` in the failure
//   voice and `Retry`, which asks the same hold again;
// - `didntGoThrough` — a read-side comfort (save, unsave, hide, undo,
//   unhide) reverted: `That didn't go through.` and `Retry`, which asks the
//   comfort again and signs nothing.
//
// A failure is announced as an alert, NEVER a snackbar (the Snackbar charter
// keeps that for confirmations), and it stands until Retry, another act on
// the same anchor, or the surface's next fresh load — never on a timer.

import type { DataNode } from "./data-node";
import { testAttributes } from "./data-node";
import { InlineAction } from "@/lib/ui2/inline-action";

/** The hold's wait, once 200ms pass without an answer. */
export const SIGNING_ROW = "Signing…";
/** The hold that did not sign. */
export const DIDNT_SIGN_ROW = "That didn't sign.";
/** The comfort that did not go through (copy-voice: "not a code"). */
export const DIDNT_GO_THROUGH_ROW = "That didn't go through.";

export type RowLineState =
  | { readonly kind: "signing" }
  | { readonly kind: "didntSign"; readonly onRetry: () => void }
  | { readonly kind: "didntGoThrough"; readonly onRetry: () => void };

export function RowLine({
  state,
  testId,
  node,
}: {
  state: RowLineState;
  testId: string;
  /** The registered slot the line stands in, where its board names one. */
  node?: DataNode;
}) {
  if (state.kind === "signing") {
    return (
      <p
        role="status"
        {...testAttributes(node, testId)}
        className="m-0 whitespace-nowrap text-label-small text-on-surface-variant"
      >
        {SIGNING_ROW}
      </p>
    );
  }
  return (
    <p
      role="alert"
      {...testAttributes(node, testId)}
      className="m-0 whitespace-nowrap text-label-small"
    >
      <span className="text-error">
        {state.kind === "didntSign" ? DIDNT_SIGN_ROW : DIDNT_GO_THROUGH_ROW}
      </span>{" "}
      <InlineAction size="sm" onClick={state.onRetry} testId={`${testId}-retry`}>
        Retry
      </InlineAction>
    </p>
  );
}
