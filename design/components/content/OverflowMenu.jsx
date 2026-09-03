import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { BottomSheet, SheetItem } from "../core/BottomSheet.jsx";

/* The overflow menu on a piece of content.

   EVERY post and every comment carries one. Genesis content always declares a
   license (post.md §1), so there is always at least the license entry — and a
   trigger that comes and goes between cards is worse than one that is always in
   the same place.

   It exists because the affordance row has a budget and the things competing for
   it do not all deserve the same weight. A stance is the gesture the product
   lives on; checking a license is something a reader does once in a hundred
   readings. The row carries what a reader reaches for; this carries the rest.

   Rules it keeps:
   · The trigger is `more_vert` at 24px on `onSurfaceVariant`, in the card's
     header beside the timestamp \u2014 never in the affordance row, which is for the
     things a reader actually reaches for.
   · The sheet is `surfaceContainerHigh` at the medium rung. On Android this is a
     bottom sheet (design.md \u00a76 lists them in the scaffolding); on web it is an
     anchored menu, which is the same inventory in the platform's own idiom.
     BOTH CLIENTS RENDER AT PHONE WIDTH and follow one design, so the SHEET is the
     default (`presentation="sheet"`, backlog item 3) and the anchored menu is the
     opt-in for a genuinely wide surface: a popover pinned to a 24px glyph is a
     desktop idiom, and thumbs miss it.
   · Items are `label-large` at the 48px minimum target, left-aligned, one line
     each. No icons in the list: a mixed list of iconned and un-iconned rows is
     the way an icon set starts to look accidental (\u00a75).
   · Escape closes it, a press outside closes it, and nothing behind it is inert \u2014
     an overflow menu is not a decision the reader has to resolve.
   · Nothing in here takes `error` colouring. A destructive item is drawn like the
     rest; the confirmation it opens is where the weight belongs. */

export function OverflowMenu({ items = [], ariaLabel = "More", align = "right", presentation = "sheet" }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} style={{ position: "relative", flex: "none" }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((shown) => !shown)}
        className="cg-state cg-focus"
        style={{
          display: "flex",
          height: "var(--touch-target-min)",
          width: "var(--touch-target-min)",
          margin: "-12px",
          alignItems: "center",
          justifyContent: "center",
          border: 0,
          background: "none",
          borderRadius: "var(--radius-full)",
          color: "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        <Icon name="more_vert" />
      </button>
      {presentation === "sheet" && (
        <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel={ariaLabel}>
          {items.map((item) => (
            <SheetItem
              key={item.label}
              label={item.label}
              onSelect={() => {
                setOpen(false);
                if (item.onSelect) item.onSelect();
              }}
            />
          ))}
        </BottomSheet>
      )}
      {presentation === "menu" && open && (
        <>
          <div
            aria-hidden="true"
            onPointerDown={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 20 }}
          />
          <div
            role="menu"
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              [align]: 0,
              zIndex: 21,
              minWidth: "12rem",
              display: "flex",
              flexDirection: "column",
              borderRadius: "var(--radius-medium)",
              background: "var(--surface-dialog)",
              color: "var(--on-surface)",
              padding: "var(--space-1) 0",
            }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  if (item.onSelect) item.onSelect();
                }}
                className="cg-state cg-focus"
                style={{
                  display: "flex",
                  alignItems: "center",
                  minHeight: "var(--touch-target-min)",
                  border: 0,
                  background: "none",
                  padding: "0 var(--space-4)",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-label-large)",
                  lineHeight: "var(--text-label-large--line-height)",
                  letterSpacing: "var(--text-label-large--letter-spacing)",
                  fontWeight: "var(--text-label-large--font-weight)",
                  color: "var(--on-surface)",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
