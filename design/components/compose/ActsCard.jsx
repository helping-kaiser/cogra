import React from "react";

/* The seal's acts card (media slice, 2026-08-31 — extracted the moment a
   second seal needed it: the profile-picture seal joined the post's and the
   reply's). The container-highest card listing what one signature commits:
   one row per act kind — quiet label, the value, the count — and the total as
   the footer row. The all-or-nothing sentence, when a seal carries more than
   one act, belongs to the screen below the card, not in it. */

export function ActsCard({ rows = [], total }) {
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
      {rows.map((row, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            minHeight: "44px",
            borderBottom: "1px solid var(--border-hairline)",
          }}
        >
          <span
            style={{
              flex: "none",
              width: "76px",
              fontSize: "var(--text-label-small)",
              lineHeight: "var(--text-label-small--line-height)",
              fontWeight: "var(--text-label-small--font-weight)",
              letterSpacing: "0.5px",
              color: "var(--text-secondary)",
            }}
          >
            {row.label}
          </span>
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
          <span
            style={{
              flex: "none",
              fontSize: "var(--text-label-small)",
              lineHeight: "var(--text-label-small--line-height)",
              letterSpacing: "0.4px",
              color: "var(--text-secondary)",
            }}
          >
            {row.count}
          </span>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", minHeight: "48px" }}>
        <span
          style={{
            flex: 1,
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            fontWeight: "var(--text-label-large--font-weight)",
          }}
        >
          {total}
        </span>
      </div>
    </div>
  );
}
