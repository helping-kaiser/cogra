import React from "react";
import { HelpDot } from "../core/HelpDot.jsx";
import { MoneyFigure } from "../core/MoneyFigure.jsx";
import { WashCard } from "./WashCard.jsx";

/* The wallet's HERO (item 12 rounds 2–3): the balance as a trophy on the
   brand wash (`WashCard` — the wash + ghosted coin live there). Still the
   one surface that spells CGT (readme §13, Money figures): mark and word
   adjacent at display size, the "?" (What is CGT?) beside them. The ≈ L-BTC
   line reads the public ladder market — an estimate, never a promise, hidden
   at zero. `delta` is the recent-earnings chip ("+14.40 this week"): quiet
   pride, real number, omitted when there is nothing new. */

export function WalletBalance({ amount = 0, approx, delta, onHelp }) {
  return (
    <WashCard>
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
    </WashCard>
  );
}
