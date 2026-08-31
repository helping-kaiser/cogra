import React from "react";

/* The money figure — the one shape every CGT amount on screen uses (readme
   §13: money figures, 2026-08-31). The unit is the mark, never the word: a
   coin — the primary disc with the wordmark's lowercase c cut out — trailing
   the figure where the word would sit. The word "CGT" appears only on a
   teaching surface (the wallet's balance headline) via `unit`, mark and word
   adjacent so the reader learns the equivalence once.

   Format: two decimals at rest, thousands grouped (12,500.00); dust renders
   `< 0.01` — never 0.00, a shown number that lies — with the exact value one
   layer down (the surface's job); zero is `0`, plainly — a new member's true
   state, not a failure. Amounts are never negative; a negative number is an
   OUTFLOW on a history line and renders signed (−), `signed` opts positive
   inflows into `+`. No colour on direction: the system has no green, and
   error-colouring an outflow would call spending a failure. */

export function formatCgt(amount) {
  const a = Math.abs(amount);
  if (a === 0) return "0";
  if (a < 0.005) return "< 0.01";
  return a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* The CGT mark. Scales with the surrounding text (1em), sits on the text
   baseline, and reads in both themes through the primary pair. */
export function CgtMark({ size = "1em", style }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ verticalAlign: "-0.125em", flex: "none", ...style }}
    >
      <circle cx="10" cy="10" r="10" fill="var(--primary)" />
      <path
        d="M 13.2 5.9 A 5.2 5.2 0 1 0 13.2 14.1"
        fill="none"
        stroke="var(--on-primary)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

const SR_ONLY = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function MoneyFigure({ amount, signed = false, unit = false, style }) {
  const dust = amount !== 0 && Math.abs(amount) < 0.005;
  /* Dust never signs — "+< 0.01" reads as noise; its line's words carry the
     direction alone. */
  const sign = dust ? "" : amount < 0 ? "−" : signed && amount > 0 ? "+" : "";
  return (
    <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...style }}>
      {sign}
      {formatCgt(amount)}
      {" "}
      <CgtMark />
      {unit ? " CGT" : <span style={SR_ONLY}>CGT</span>}
    </span>
  );
}
