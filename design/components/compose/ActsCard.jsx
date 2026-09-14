import React from "react";
import { InlineAction, BUTTON_CLASS } from "../core/Button.jsx";

/* The seal's acts card (media slice, 2026-08-31 — extracted the moment a
   second seal needed it: the profile-picture seal joined the post's and the
   reply's). The container-highest card listing what one signature commits:
   one row per act kind — quiet label, the value, the count — and the total as
   the footer row. The all-or-nothing sentence, when a seal carries more than
   one act, belongs to the screen below the card, not in it.

   TWO ROW KINDS, and the difference is what the row IS. A row with a `value` is
   a fact: the value slot ends a long one in an ellipsis, because a signed act's
   name can run past the card and the row still has to hold one line. A row with
   an `action` is a control — what could still be added, lined up with what has
   been — and there the whole row is the button. Truncation belongs to the value
   slot alone: an action row has no slot to clip, so the 48px target the word
   promises reaches the row's own edges instead of being cut back to the ink.

   A FACT ROW IS A DOOR WHEN THE FACT IS A COLLECTION (`onOpen`, jakob's ruling
   2026-09-14, backlog item 70). One staged citation reads back as itself; two
   or more read back as their count, and the count is only honest if the reader
   can go and see what it counts. So the row keeps its three slots — label,
   value, count — and the whole row becomes the control, `PickedRow`'s rule for
   the picked pictures said for the acts card: no chevron, no trailing word,
   the accessible name saying what opens. It stays a FACT row and not an action
   row, because what it opens is what it already says. */

const ROW = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  minHeight: "44px",
  borderBottom: "1px solid var(--border-hairline)",
};

const LABEL = {
  flex: "none",
  width: "76px",
  fontSize: "var(--text-label-small)",
  lineHeight: "var(--text-label-small--line-height)",
  fontWeight: "var(--text-label-small--font-weight)",
  letterSpacing: "var(--text-label-small--letter-spacing)",
  color: "var(--text-secondary)",
};

const COUNT = {
  flex: "none",
  fontSize: "var(--text-label-small)",
  lineHeight: "var(--text-label-small--line-height)",
  letterSpacing: "var(--text-label-small--letter-spacing)",
  color: "var(--text-secondary)",
};

const VALUE = {
  flex: 1,
  minWidth: 0,
  fontSize: "var(--text-body-medium)",
  lineHeight: "var(--text-body-medium--line-height)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/* The door's own box is the row's box: no border, no background, no padding,
   the page's ink — so the card reads as the card it always was and only the
   state layer, the focus ring and the 48px target arrive with `BUTTON_CLASS`. */
const DOOR = {
  /* `border: 0` leads, so the row's own hairline — spread in after it — is not
     wiped by the shorthand it would otherwise follow. */
  border: 0,
  ...ROW,
  width: "100%",
  background: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  color: "var(--on-surface)",
  textAlign: "left",
};

export function ActsCard({ rows = [], total, note }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--radius-medium)",
        background: "var(--surface-container-highest)",
        padding: "4px var(--space-4)",
      }}
    >
      {rows.map((row, index) =>
        row.action ? (
          <InlineAction key={index} size="sm" onClick={row.onAct} style={{ ...ROW, textAlign: "left" }}>
            <span style={LABEL}>{row.label}</span>
            <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap" }}>{row.action}</span>
            <span style={COUNT}>{row.count}</span>
          </InlineAction>
        ) : row.onOpen ? (
          <button key={index} type="button" onClick={row.onOpen} aria-label={row.openLabel} className={BUTTON_CLASS} style={DOOR}>
            <span style={LABEL}>{row.label}</span>
            <span style={VALUE}>{row.value}</span>
            <span style={COUNT}>{row.count}</span>
          </button>
        ) : (
          <div key={index} style={ROW}>
            <span style={LABEL}>{row.label}</span>
            <span style={VALUE}>{row.value}</span>
            <span style={COUNT}>{row.count}</span>
          </div>
        )
      )}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "2px", minHeight: "48px", padding: "6px 0" }}>
        <span
          style={{
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            fontWeight: "var(--text-label-large--font-weight)",
          }}
        >
          {total}
        </span>
        {/* The all-or-nothing subline — "they land together, or none does" —
            rides the total whenever the seal commits more than one act. It had
            drifted: on the key-absent and sheet boards but not the seal itself
            (found by the implementation session, 2026-08-31); now it lives
            here once. */}
        {note && (
          <span
            style={{
              fontSize: "var(--text-label-small)",
              lineHeight: "var(--text-label-small--line-height)",
              letterSpacing: "var(--text-label-small--letter-spacing)",
              color: "var(--text-secondary)",
            }}
          >
            {note}
          </span>
        )}
      </div>
    </div>
  );
}
