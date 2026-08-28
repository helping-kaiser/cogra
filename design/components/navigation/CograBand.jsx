import React from "react";
import { Icon } from "./Icon.jsx";

/* The read shell's top-left identity: the mark and the wordmark on a 48px band.
   Every tab root wears it (a tab root carries no back arrow — PageHeader is the
   inner surfaces' header). Children ride below the band inside the same
   non-shrinking block: the borrowed-view band, the APK line, a search field.

   THE RIGHT SIDE WORKS. A full-width band spent on identity alone is wasted
   space (ruled 2026-08-28), so `trailing` puts the tab's one working control —
   the feed's filter trigger — on the band's right edge. The whole band scrolls
   away with the top region and returns with it; the control rides along. */

export function CograBand({ trailing, children }) {
  return (
    <div style={{ flex: "none" }}>
      <div style={{ height: "48px", display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "0 var(--space-4)" }}>
        <span style={{ display: "inline-flex", color: "var(--primary)" }} aria-hidden="true">
          <Icon name="mark" size={24} pickColor="var(--primary-container)" />
        </span>
        <span style={{ fontSize: "var(--text-title-large)", lineHeight: "var(--text-title-large--line-height)", fontWeight: 600 }}>cogra</span>
        {trailing && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", minWidth: 0 }}>{trailing}</div>
        )}
      </div>
      {children}
    </div>
  );
}
