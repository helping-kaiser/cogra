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

   CHATS RIDE THE BAND (jakob 2026-09-01): messaging must be reachable from any
   major screen, so every tab root's band carries the chats affordance built in.
   It sits LEFT of the screen's own trailing control, so the ruled corner
   occupants (the feed's filter trigger, the profile's gear) keep their edge.
   `chats={false}` opts a band out where messaging cannot apply. */

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
