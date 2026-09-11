import React from "react";
import { Icon } from "./Icon.jsx";

/* The read shell's top-left identity: the mark and the wordmark on a 48px band.
   Every tab root wears it (a tab root carries no back arrow — PageHeader is the
   inner surfaces' header). Children ride below the band inside the same
   non-shrinking block: the borrowed-view band, the APK line, a search field.

   THE RIGHT SIDE WORKS. A full-width band spent on identity alone is wasted
   space (ruled 2026-08-28), so the right edge carries controls: the screen's
   own one through `trailing` — the feed's filter trigger, the profile's gear —
   between the two the shell owns on every root. The whole band scrolls away
   with the top region and returns with it; the controls ride along.
   THE BAND RIDES THE BAR THE TOP REGION ALREADY COLLAPSES — it is not a
   second collapsing block. Collapse band and bar as one taller block instead
   and the list re-clamps under it: the leftover scroll reads back as "at the
   top" and the region returns the instant it left (found by Android's
   post-card lane, ruled 2026-09-09).

   CHATS RIDE THE BAND (jakob 2026-09-01): messaging must be reachable from any
   major screen, so every tab root's band carries the chats affordance built in.
   `chats={false}` opts a band out where messaging cannot apply.

   THE TRAILING CLUSTER IS [the screen's own control] · chats · bell (the band
   law, jakob 2026-09-11). The screen's own control sits INBOARD: the two the
   shell owns are the same two icons in the same two places on every root, so a
   reader aiming at chats or the bell aims at the same corner whatever tab they
   are on — and the one control that changes per screen is the one that moves
   in from the edge. No band carries a ⋮ any more: a profile's overflow belongs
   in the row of controls that page already has, not in the shell's corner.

   THE BELL IS THE BAND'S RIGHT EDGE (jakob 2026-09-11): notifications are the
   product's second surfacing channel, so the bell is reachable from every
   bottom-bar root and sits right-most on all of them — outboard of the
   screen's own control, which is what makes it the same corner everywhere
   instead of a different corner per tab. `unread` lights its quiet dot: a dot
   and never a count, because the honest thing the shell knows is that
   something arrived, and a number is an errand. It clears when the list opens
   (`docs/implementation/notifications.md`). `bell={false}` opts out where
   nothing can be addressed to the reader — a guest has no account, so a guest
   has no list.

   Those two lines are the end state, not a shipping claim. The apps draw an
   affordance the release a surface exists to receive the tap — until then
   `graph.json` routes the tap to a gap and the control stays out, which is
   the staging rule in readme §2: the canvas draws the whole app, each release
   builds its slice, and nothing ships a control that leads nowhere. */

/* The band's one icon-control shape, assigned once: 40px of ink, no
   background, the secondary text colour — and the full 48px target through
   `cg-hit`, the way every dense control in this system keeps the promise
   (Button's `sm`, Chip, the card's affordances). 48px of DRAWN box is what
   crowded the band: three of them plus the mark and the wordmark left the
   screen's own control too little room, and the feed's filter trigger — the
   one control whose width carries words — ellipsised on the boards that
   narrow the feed. The target never shrank; only the box did. */
export function BandIcon({ name, label, size = 24, dot = false }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="cg-state cg-focus cg-hit"
      style={{ display: "grid", placeItems: "center", height: "40px", width: "40px", border: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer", padding: 0, flex: "none" }}
    >
      <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
        <Icon name={name} size={size} />
        {dot && (
          <span
            aria-hidden="true"
            style={{ position: "absolute", top: "-1px", right: "-2px", width: "8px", height: "8px", borderRadius: "var(--radius-full)", background: "var(--primary)", border: "2px solid var(--surface)", boxSizing: "content-box" }}
          />
        )}
      </span>
    </button>
  );
}

export function CograBand({ trailing, chats = true, bell = true, unread = false, children }) {
  return (
    <div style={{ flex: "none" }}>
      <div style={{ height: "48px", display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "0 var(--space-4)" }}>
        <span style={{ display: "inline-flex", color: "var(--primary)" }} aria-hidden="true">
          <Icon name="mark" size={24} pickColor="var(--primary-container)" />
        </span>
        <span style={{ fontSize: "var(--text-title-large)", lineHeight: "var(--text-title-large--line-height)", fontWeight: 600 }}>cogra</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", minWidth: 0 }}>
          {trailing}
          {chats && <BandIcon name="forum" label="Chats" size={22} />}
          {bell && <BandIcon name="notifications" label={unread ? "Notifications — something new" : "Notifications"} size={22} dot={unread} />}
        </div>
      </div>
      {children}
    </div>
  );
}
