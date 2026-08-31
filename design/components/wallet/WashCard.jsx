import React from "react";
import { CgtMark } from "../core/MoneyFigure.jsx";

/* The brand-wash card (item 12 round 3): the `--surface-hero` surface with
   the ghosted oversized brand coin, as ONE component — the wallet's hero
   rides it, and so do the wallet's MOMENT cards (first open, guest,
   applicant): the screens that are a person's first look at the money side
   must feel like the brand, not like settings (jakob 2026-08-31). The
   charter holds: the wash dresses a page's ONE moment, never a default card
   fill — at most one WashCard per screen. */

export function WashCard({ ghost = true, style, children }) {
  return (
    <div
      style={{
        position: "relative",
        margin: "0 var(--space-4)",
        borderRadius: "var(--radius-large)",
        background: "var(--surface-hero)",
        padding: "var(--space-5)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        flex: "none",
        ...style,
      }}
    >
      {ghost && (
        <span aria-hidden="true" style={{ position: "absolute", right: "-30px", bottom: "-44px", opacity: 0.18, pointerEvents: "none" }}>
          <CgtMark size={150} />
        </span>
      )}
      {children}
    </div>
  );
}
