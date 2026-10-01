import React from "react";
import { Icon } from "./Icon.jsx";

/* The house page header (Android's TopAppBar): a back arrow, the page title, and
   an optional trailing action — one pattern for every inner surface. Tab roots
   carry no back arrow.

   THE ARROW IS HISTORY ON A READ DRILL-IN, A LINK IN THE ENTRY FUNNEL (readme §4,
   *Navigation*; jakob's layer law, 2026-10-01). A post, a profile, a tag page
   opened from anywhere — a deep link included — sits as a layer over the state
   the reader came from, and the arrow returns to exactly that state; with no
   prior state it falls back to the owning tab's root. `backLabel` names where it
   goes by the screen's origin-noun table, and a board draws the cold entry's
   label. The entry funnel's screens are reached from outside the app with
   nothing beneath them, so their arrow is a link to a named board — `backHref`
   is that link there, and the cold fallback's route everywhere else.

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

export function PageHeader({ title, backHref, backLabel, onBack, action, node }) {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", minHeight: "48px", padding: "0 var(--space-3)" }} data-node={node}>
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
            data-node={node && "back"}
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
              // A page title is a name and never wraps — a two-line header
              // steals the content's first row (seen on the seals, where the
              // trailing group is widest).
              whiteSpace: "nowrap",
            }}
            data-node={node && "title"}
          >
            {title}
          </h1>
        )}
      </div>
      {action}
    </header>
  );
}
