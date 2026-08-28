import React from "react";
import { Icon } from "./Icon.jsx";

/* The read shell's top-left identity: the mark and the wordmark on a 48px band.
   Every tab root wears it (a tab root carries no back arrow — PageHeader is the
   inner surfaces' header). Children ride below the band inside the same
   non-shrinking block: the borrowed-view band, the APK line, a search field. */

export function CograBand({ children }) {
  return (
    <div style={{ flex: "none" }}>
      <div style={{ height: "48px", display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "0 var(--space-4)" }}>
        <span style={{ display: "inline-flex", color: "var(--primary)" }} aria-hidden="true">
          <Icon name="mark" size={24} pickColor="var(--primary-container)" />
        </span>
        <span style={{ fontSize: "var(--text-title-large)", lineHeight: "var(--text-title-large--line-height)", fontWeight: 600 }}>cogra</span>
      </div>
      {children}
    </div>
  );
}
