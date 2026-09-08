import React from "react";

/* The "?" affordance — the one-per-screen door to a plain dialog (readme §13:
   captions stay to one short line; the full explanation lives behind a small
   "?", at most one per screen, top-right of the header or of the sheet/card it
   explains). A 32px ring inside the 48px target. It began as a screen helper
   on the search boards and moved into the system when the filter sheet — a
   master — needed to carry one. */

/* `inverse` is `Button`'s word for the same situation: the component standing on
   a TONAL PANEL instead of the page's ground. On the page the ring is
   `--border-hairline` and the glyph `--primary`; inside a `tertiary-container`
   block that pair is a second colour family arguing with the panel's own, so
   there the dot takes the panel's `currentColor` for both. The geometry is the
   same either way — 32px of ring inside the 48px target. Use it only inside such
   a panel. */
const RINGS = {
  page: { border: "1px solid var(--border-hairline)", color: "var(--primary)" },
  inverse: { border: "1px solid currentColor" },
};

export function HelpDot({ ariaLabel = "What is this?", onOpen, variant = "page" }) {
  const ring = RINGS[variant] ?? RINGS.page;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onOpen}
      className="cg-focus"
      style={{
        display: "grid",
        placeItems: "center",
        height: "var(--touch-target-min)",
        width: "var(--touch-target-min)",
        border: 0,
        background: "none",
        borderRadius: "var(--radius-full)",
        cursor: "pointer",
        flex: "none",
        color: variant === "inverse" ? "inherit" : undefined,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          height: "32px",
          width: "32px",
          borderRadius: "var(--radius-full)",
          ...ring,
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-label-large)",
          fontWeight: "var(--text-label-large--font-weight)",
        }}
      >
        ?
      </span>
    </button>
  );
}
