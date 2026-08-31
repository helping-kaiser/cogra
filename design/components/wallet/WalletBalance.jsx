import React from "react";
import { HelpDot } from "../core/HelpDot.jsx";
import { MoneyFigure, CgtMark } from "../core/MoneyFigure.jsx";

/* The wallet's HERO (item 12 round 2, jakob 2026-08-31): the balance is a
   trophy, not a ledger line — this page is the user's reach paying off, and
   it should feel that way. The card rides THE BRAND WASH (`--surface-hero`,
   the one decorative gradient surface, blessed same day) with the brand coin
   GHOSTED oversized into the corner, cropped by the card's edge — the mark as
   texture, never a second logo.

   Still the one surface that spells CGT (readme §13, Money figures): mark and
   word adjacent at display size, the "?" (What is CGT?) beside them. The
   ≈ L-BTC line reads the public ladder market — an estimate, never a promise,
   hidden at zero. `delta` is the recent-earnings chip ("+14.40 this week"):
   quiet pride, real number, omitted when there is nothing new. */

export function WalletBalance({ amount = 0, approx, delta, onHelp }) {
  return (
    <div
      style={{
        position: "relative",
        margin: "0 var(--space-4)",
        borderRadius: "var(--radius-large)",
        background: "var(--surface-hero)",
        padding: "var(--space-5) var(--space-5) var(--space-5)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        flex: "none",
      }}
    >
      {/* The ghost coin — the brand mark at texture scale, cropped by the
          edge. aria-hidden: it says nothing the figure doesn't. */}
      <span aria-hidden="true" style={{ position: "absolute", right: "-30px", bottom: "-44px", opacity: 0.18, pointerEvents: "none" }}>
        <CgtMark size={150} />
      </span>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <span
          style={{
            fontSize: "var(--text-label-medium)",
            lineHeight: "var(--text-label-medium--line-height)",
            fontWeight: "var(--text-label-medium--font-weight)",
            letterSpacing: "var(--text-label-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          Your balance
        </span>
        <HelpDot ariaLabel="What is CGT?" onOpen={onHelp} />
      </div>
      <span
        style={{
          position: "relative",
          fontSize: "var(--text-display-small)",
          lineHeight: "var(--text-display-small--line-height)",
          fontWeight: "var(--text-title-large--font-weight)",
        }}
      >
        <MoneyFigure amount={amount} unit />
      </span>
      {(approx || delta) && amount !== 0 && (
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          {approx && (
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
              ≈ {approx} L-BTC right now
            </span>
          )}
          {delta && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: "24px",
                padding: "2px 10px",
                borderRadius: "var(--radius-full)",
                background: "var(--surface-container-lowest)",
                color: "var(--primary)",
                fontSize: "var(--text-label-small)",
                lineHeight: "var(--text-label-small--line-height)",
                fontWeight: "var(--text-label-small--font-weight)",
                letterSpacing: "0.5px",
              }}
            >
              {delta}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
