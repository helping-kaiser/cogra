import React from "react";
import { Icon } from "./Icon.jsx";

/* The house page header (Android's TopAppBar): a back arrow, the page title, and
   an optional trailing action — one pattern for every inner surface. The arrow is
   a LINK, not history.back(), so a deep-linked visitor with no history still lands
   somewhere sensible. Tab roots carry no back arrow.

   The arrow is the Material `arrow_back` glyph, 24px on `onSurfaceVariant` — it
   replaced the interim `←` character when the icon exports landed (2026-08-26).
   The title is `title-large`.

   THE HEADER OWNS ITS BAND: 48px tall, 12px of its own side padding, and a 48px
   square back target with no negative margins. It used to grow a 24px glyph to a
   44px target with `margin: -10px`, which was both under the 48px minimum and a
   bet on the caller providing 24px of gutter — inside a frame with none, the
   target bled outside the surface and was clipped. 12px of padding plus a
   centred glyph in a 48px target puts the arrow exactly on the 24px screen
   gutter without depending on anyone. */

export function PageHeader({ title, backHref, backLabel, onBack, action }) {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", minHeight: "48px", padding: "0 var(--space-3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        {(backHref || onBack) && (
          <a
            href={backHref ?? "#"}
            aria-label={backLabel}
            onClick={onBack}
            className="cg-state cg-focus"
            style={{
              height: "48px",
              width: "48px",
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--radius-full)",
              color: "var(--text-secondary)",
              textDecoration: "none",
              flex: "none",
            }}
          >
            <Icon name="arrow_back" />
          </a>
        )}
        {title !== undefined && (
          <h1
            style={{
              margin: 0,
              fontSize: "var(--text-title-large)",
              lineHeight: "var(--text-title-large--line-height)",
              fontWeight: "var(--text-title-large--font-weight)",
            }}
          >
            {title}
          </h1>
        )}
      </div>
      {action}
    </header>
  );
}
