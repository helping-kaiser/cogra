import React from "react";
import { InlineAction } from "./Button.jsx";

/* A FACT ROW: one hairline line reading label · value, with an optional action
   at the end of it. The wizard's "What you sign" list and the wallet's campaign
   facts are the same row — they disagree only about which half is the quiet
   one, and that disagreement is the variant.

   `seal` is the list a reader checks before signing. The LABEL is the strong
   half, because what they read down is the names of the things they are about
   to put their name on; the value is the current answer, and it goes quiet. Its
   rules ENCLOSE — a hairline above every row and one below the last — so the
   block reads as a bounded list standing on the page's own ground.

   `ledger` is a list of facts about something already made. There the label is
   the question and the VALUE is the answer, so the value keeps `on-surface` and
   right-aligns while the label goes quiet. Its rules SEPARATE — under every row
   but the last — because the block sits inside a card that already bounds it.

   THE ROW HOLDS ONE LINE, which is why the action slot draws an `InlineAction`
   and never a `Button`: the pill's 64px minimum width is exactly what wraps a
   row ruled to stay on one.

   The 44px minimum is the row's own, not a tap target — the row is not
   pressable; the word at its end is, and that word brings its own 48px. */

const EMPHASIS = {
  seal: {
    label: { whiteSpace: "nowrap" },
    value: { color: "var(--text-secondary)" },
    /* A node in the seal's value slot draws its own line — the stance readout
       is a face and a pair, not a sentence — so only a string gets the voice. */
    wrapNodes: false,
    border: (last) => ({
      borderTop: "1px solid var(--border-hairline)",
      borderBottom: last ? "1px solid var(--border-hairline)" : undefined,
    }),
  },
  ledger: {
    label: { color: "var(--text-secondary)" },
    value: { textAlign: "right" },
    wrapNodes: true,
    border: (last) => ({
      borderBottom: last ? undefined : "1px solid var(--border-hairline)",
    }),
  },
};

export function FactRow({ label, value, action, onAction, emphasis = "seal", last = false }) {
  const shape = EMPHASIS[emphasis] ?? EMPHASIS.seal;
  const type = {
    fontSize: "var(--text-body-medium)",
    lineHeight: "var(--text-body-medium--line-height)",
  };
  const wrapped =
    value != null && (typeof value === "string" || shape.wrapNodes) ? (
      <span style={{ ...type, ...shape.value }}>{value}</span>
    ) : (
      value
    );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        minHeight: "44px",
        ...shape.border(last),
      }}
    >
      <span style={{ flex: 1, ...type, ...shape.label }}>{label}</span>
      {wrapped}
      {typeof action === "string" ? <InlineAction onClick={onAction}>{action}</InlineAction> : action}
    </div>
  );
}
