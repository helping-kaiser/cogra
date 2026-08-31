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
   baseline, and reads in both themes through the primary pair. A bare C in a
   disc is any game's coin (jakob 2026-08-31), so the coin carries the brand
   mark itself — cogra-mark.svg verbatim, knocked out monochrome in the
   on-primary (the two-colour original needs its own ground; a coin has only
   the disc). */
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
      <g transform="translate(2.26 2.26) scale(0.155)" fill="none" stroke="var(--on-primary)">
        <circle cx="50.00" cy="38.35" r="22.52" strokeWidth="15.66" />
        <path
          d="M72.520 17.220 L72.520 62.560 C72.450 63.280 72.340 65.460 72.090 66.870 C71.830 68.290 71.480 69.710 70.980 71.050 C70.470 72.390 69.830 73.720 69.060 74.920 C68.280 76.130 67.360 77.280 66.330 78.270 C65.300 79.270 64.110 80.150 62.880 80.890 C61.660 81.620 60.310 82.210 58.950 82.690 C57.600 83.170 56.180 83.500 54.760 83.740 C53.340 83.980 51.890 84.080 50.450 84.140 C49.010 84.200 47.560 84.170 46.120 84.090 C44.680 84.020 42.520 83.760 41.810 83.690"
          strokeWidth="15.66"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="53.53" cy="34.82" r="8.52" fill="var(--on-primary)" stroke="none" />
      </g>
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
