import React from "react";
import { MoneyFigure } from "../core/MoneyFigure.jsx";
import { PendingMarker } from "../honesty/PendingMarker.jsx";

/* One line of the wallet's history (item 12): the words carry what happened
   and what paid it — every amount traceable, the "?" promise — the figure
   carries the money. One stream, newest first (jakob 2026-08-31); the kinds
   that appear are the rail's own: payouts, tips in and out, campaign
   deposits and refunds. Direction is the sign and the words, never a
   colour (readme §13, Money figures). A payout that has not landed yet
   wears the same Still settling the rest of the product uses. */

export function LedgerRow({ words, when, amount, signed = true, pending = false, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cg-state cg-focus"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        width: "100%",
        minHeight: "var(--touch-target-min)",
        border: 0,
        background: "none",
        padding: "6px 0",
        cursor: onOpen ? "pointer" : "default",
        fontFamily: "var(--font-sans)",
        color: "var(--on-surface)",
        textAlign: "left",
      }}
    >
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
        <span
          style={{
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {words}
        </span>
        {when && (
          <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
            {when}
          </span>
        )}
      </span>
      <span style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
        <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: pending ? "var(--text-secondary)" : "var(--on-surface)" }}>
          <MoneyFigure amount={amount} signed={signed} />
        </span>
        {pending && <PendingMarker />}
      </span>
    </button>
  );
}
