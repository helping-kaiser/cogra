import React from "react";
import { BUTTON_CLASS } from "../core/Button.jsx";

/* BACK TO TOP — the feed's way out of a long scroll (jakob's ruling
   2026-09-14). A reader three screens down who wants the newest thing has two
   ways up today: flick until the list runs out, or find the Feed slot in the
   bar and tap it a second time. The first is work and the second is a rung
   nobody is told about, so the way up gets a control that says itself.

   IT RIDES THE RETURNING BAND. The pill appears WITH the collapsing top — the
   same upward scroll that summons the band summons this, and it sits centred
   directly under it. Nothing new had to be invented for when it arrives: the
   band's own motion rule already says when a reader is looking for the top of
   the screen, and a second trigger would be a second rule to keep in step.

   IT IS NOT INSIDE THE COLLAPSING BLOCK, and that is the whole reason it is
   drawn fixed rather than dropped into `CollapsingTop`'s children. The region
   hides once HALF ITS OWN SLOT has scrolled past, so its threshold is a
   function of its own height: put the pill in the block and the band starts
   collapsing at a different moment on the feed than everywhere else — and a
   taller collapsing block is exactly what re-clamps the list, the leftover
   scroll reading back as "at the top" and the region returning the instant it
   left (backlog item 45.3, found by Android's W1 lane). A fixed element takes
   no layout space, so the block it sits under measures the same with it as
   without it.

   IT SLIDES UNDER THE BAND, never over it: `zIndex` 19 against the region's 20,
   the same 200ms `translateY` the band spends. What leaves and what it leaves
   behind move as one thing.

   PLAIN WORDS, NO GLYPH. `Back to top` says the destination and the direction;
   an arrow alone would be a control a listener meets as "button" and a reader
   meets as a guess. §5 forbids drawing an icon the inlined set does not carry,
   and the set carries no arrow that points up.

   THE GROUND IS TONAL, NOT `primary`. Filled `primary` is reserved for the one
   committing action on a surface (§6) and this commits nothing — it is a way
   back through a list the reader already owns. Elevation in this system is
   tonal rather than a shadow, so the lift off the feed is
   `surface-container-highest`: the quiet container ground, the pill shape every
   button here wears, and 32px of ink inside the unconditional 48px target. */

/* ABSOLUTE AGAINST THE SCREEN, not fixed. The shell's `.screen` is the
   positioned ancestor every overlay in this system hangs from — `PadKeyAbsent`
   parks its pad the same way — and a fixed pill would measure itself against
   the window instead, landing off the phone the moment the board is read at any
   other width. Centred by its own half-width, so the pill's words decide where
   its middle is.

   56px clears the feed's collapsing block — the 48px band plus the region's own
   `space-2` tail — so the pill sits directly beneath it rather than on it. A
   surface whose block is taller passes its own. */
export function BackToTop({ onPress, offset = 56, inline = false }) {
  const placement = inline
    ? { position: "relative", margin: "0 auto", width: "fit-content" }
    : { position: "absolute", left: "50%", top: `${offset}px`, transform: "translateX(-50%)", zIndex: 19 };

  return (
    <div style={placement}>
      <button
        type="button"
        onClick={onPress}
        className={BUTTON_CLASS}
        style={{
          border: 0,
          borderRadius: "var(--radius-full)",
          background: "var(--surface-container-highest)",
          color: "var(--on-surface)",
          padding: "6px 16px",
          minHeight: "32px",
          minWidth: "64px",
          boxSizing: "border-box",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-label-large)",
          lineHeight: "var(--text-label-large--line-height)",
          letterSpacing: "var(--text-label-large--letter-spacing)",
          fontWeight: "var(--text-label-large--font-weight)",
          whiteSpace: "nowrap",
        }}
      >
        Back to top
      </button>
    </div>
  );
}
