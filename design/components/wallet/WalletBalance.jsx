import React from "react";
import { Card } from "../core/Card.jsx";
import { HelpDot } from "../core/HelpDot.jsx";
import { MoneyFigure } from "../core/MoneyFigure.jsx";

/* The wallet's balance headline (item 12, jakob's rulings 2026-08-31) — the
   ONE surface that spells the word CGT (readme §13, Money figures): the mark
   and the word adjacent so the reader learns the equivalence, the "?" (What
   is CGT?) beside them.

   The ≈ VALUE LINE (ruled in): "knowing how much value it currently might
   have is super cool" — an estimate read from the public CGT–L-BTC market
   (the protocol's own ladder ships from genesis, ledger.md "The ladder"), so
   it exists the moment the wallet does. It is an estimate and moves with the
   market — never a promise — and it hides when there is nothing to price
   (a zero balance) or no market reading. */

export function WalletBalance({ amount = 0, approx, onHelp }) {
  return (
    <Card style={{ flex: "none" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <span
            style={{
              fontSize: "var(--text-label-medium)",
              lineHeight: "var(--text-label-medium--line-height)",
              fontWeight: "var(--text-label-medium--font-weight)",
              color: "var(--text-secondary)",
            }}
          >
            Your balance
          </span>
          <span
            style={{
              fontSize: "var(--text-headline-small)",
              lineHeight: "var(--text-headline-small--line-height)",
              fontWeight: "var(--text-headline-small--font-weight)",
            }}
          >
            <MoneyFigure amount={amount} unit />
          </span>
          {approx && amount !== 0 && (
            <span
              style={{
                fontSize: "var(--text-label-small)",
                lineHeight: "var(--text-label-small--line-height)",
                letterSpacing: "0.4px",
                color: "var(--text-secondary)",
              }}
            >
              ≈ {approx} L-BTC right now
            </span>
          )}
        </div>
        <HelpDot ariaLabel="What is CGT?" onOpen={onHelp} />
      </div>
    </Card>
  );
}
