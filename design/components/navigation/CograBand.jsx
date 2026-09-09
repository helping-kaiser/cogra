import React from "react";
import { Icon } from "./Icon.jsx";

/* The read shell's top-left identity: the mark and the wordmark on a 48px band.
   Every tab root wears it (a tab root carries no back arrow — PageHeader is the
   inner surfaces' header). Children ride below the band inside the same
   non-shrinking block: the borrowed-view band, the APK line, a search field.

   THE RIGHT SIDE WORKS. A full-width band spent on identity alone is wasted
   space (ruled 2026-08-28), so `trailing` puts the tab's one working control —
   the feed's filter trigger — on the band's right edge. The whole band scrolls
   away with the top region and returns with it; the control rides along.
   THE BAND RIDES THE BAR THE TOP REGION ALREADY COLLAPSES — it is not a
   second collapsing block. Collapse band and bar as one taller block instead
   and the list re-clamps under it: the leftover scroll reads back as "at the
   top" and the region returns the instant it left (found by Android's
   post-card lane, ruled 2026-09-09).

   CHATS RIDE THE BAND (jakob 2026-09-01): messaging must be reachable from any
   major screen, so every tab root's band carries the chats affordance built in.
   It sits LEFT of the screen's own trailing control, so the ruled corner
   occupants (the feed's filter trigger, the profile's gear) keep their edge.
   `chats={false}` opts a band out where messaging cannot apply.

   That line is the end state, not a shipping claim. The apps draw the
   affordance the release a chat surface exists to receive the tap — until
   then `graph.json` routes the tap to a gap and the button stays out, which
   is the staging rule in readme §2: the canvas draws the whole app, each
   release builds its slice, and nothing ships a control that leads nowhere. */

export function CograBand({ trailing, chats = true, children }) {
  return (
    <div style={{ flex: "none" }}>
      <div style={{ height: "48px", display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "0 var(--space-4)" }}>
        <span style={{ display: "inline-flex", color: "var(--primary)" }} aria-hidden="true">
          <Icon name="mark" size={24} pickColor="var(--primary-container)" />
        </span>
        <span style={{ fontSize: "var(--text-title-large)", lineHeight: "var(--text-title-large--line-height)", fontWeight: 600 }}>cogra</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", minWidth: 0 }}>
          {chats && (
            <button
              type="button"
              aria-label="Chats"
              className="cg-state cg-focus"
              style={{ display: "grid", placeItems: "center", height: "var(--touch-target-min)", width: "var(--touch-target-min)", border: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer", padding: 0, flex: "none" }}
            >
              <Icon name="forum" size={22} />
            </button>
          )}
          {trailing}
        </div>
      </div>
      {children}
    </div>
  );
}
