import React from "react";

/* The wallet's progress (item 12 round 2, jakob: "his progress maybe some
   charts"): earnings per settlement, as bars — HONEST decoration, because
   every bar is a real payout from a real public settlement and taps into it
   (the traceability promise makes a chart safe here; nothing is modeled or
   invented). The latest bar wears primary, the rest the secondary fill —
   colour as emphasis on recency, never as direction. Heights normalize to
   the largest bar; a zero settlement is a visible stub, not a gap. */

export function EarnedChart({ points = [], caption = "Earned · last settlements", height = 64 }) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.amount), 0.000001);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", padding: "0 var(--space-4)", flex: "none" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-2)", height: `${height}px` }}>
        {points.map((point, index) => {
          const h = Math.max(4, Math.round((point.amount / max) * height));
          const latest = index === points.length - 1;
          return (
            <button
              key={index}
              type="button"
              onClick={point.onOpen}
              aria-label={point.label ?? `Settlement ${index + 1}`}
              className="cg-state cg-focus"
              style={{
                flex: 1,
                height: `${h}px`,
                border: 0,
                padding: 0,
                borderRadius: "var(--radius-extra-small) var(--radius-extra-small) 0 0",
                background: latest ? "var(--primary)" : "var(--secondary-container)",
                cursor: point.onOpen ? "pointer" : "default",
                alignSelf: "flex-end",
              }}
            />
          );
        })}
      </div>
      <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: "4px" }}>
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          {caption}
        </span>
      </div>
    </div>
  );
}
