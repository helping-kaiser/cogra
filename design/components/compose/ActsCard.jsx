import React from "react";
import { InlineAction } from "../core/Button.jsx";

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
   promises reaches the row's own edges instead of being cut back to the ink. */

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
  letterSpacing: "0.5px",
  color: "var(--text-secondary)",
};

const COUNT = {
  flex: "none",
  fontSize: "var(--text-label-small)",
  lineHeight: "var(--text-label-small--line-height)",
  letterSpacing: "0.4px",
  color: "var(--text-secondary)",
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
        ) : (
          <div key={index} style={ROW}>
            <span style={LABEL}>{row.label}</span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "var(--text-body-medium)",
                lineHeight: "var(--text-body-medium--line-height)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.value}
            </span>
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
              letterSpacing: "0.4px",
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
