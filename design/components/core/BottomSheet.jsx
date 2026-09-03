import React from "react";

/* The bottom sheet (backlog item 3). `design.md` §6 lists sheets in the
   scaffolding and the product never built one, so three surfaces were each
   improvising: the overflow menu, the license terms, a filter.

   WHY A SHEET AND NOT A DIALOG. A dialog is a question the reader has to answer
   before anything else can happen. A sheet is a drawer of choices they opened and
   can close by looking away — so it comes from the edge they pulled it from, it
   does not trap focus, and nothing behind it is inert. Choosing a dialog for a
   drawer is how a product starts asking permission to show a menu.

   Rules it keeps:
   · `surfaceContainerHigh` at the 28px rung, TOP CORNERS ONLY — the bottom edge
     is the screen's, and a rounded bottom on a surface flush to the edge draws a
     gap that is not there.
   · The grab handle is `outlineVariant`, 32×4, and it is not a control: it says
     which edge this came from and which way it goes back.
   · It covers the bottom bar rather than sitting above it. A sheet is a decision
     surface; a navigation bar under it would offer to leave mid-decision.
   · Scrim at 50%, and pressing it closes. Escape closes. Both because a drawer
     the reader opened is a drawer the reader can drop.
   · Never open beside the stance pad: one parked surface at a time, and the pad
     owns the same corner of the screen.
   · Enters over 400ms from the bottom, leaves over 200ms to the bottom
     (`tokens/transitions.css`) — a dismissal exits the edge it entered from. */

/* `height` pins the sheet at a fixed size instead of letting content set it —
   the comments sheet fills the screen up to a sliver below the top (readme §13,
   2026-08-28), and a pinned input row at its foot needs the surface itself to
   own the height. The children then manage their own scrolling. */
export function BottomSheet({ open = false, onClose, ariaLabel, children, inline = false, maxHeight = "62%", height }) {
  const [shown, setShown] = React.useState(open);
  const [closing, setClosing] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setShown(true);
      setClosing(false);
      return undefined;
    }
    if (!shown) return undefined;
    setClosing(true);
    const timer = setTimeout(() => {
      setShown(false);
      setClosing(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [open, shown]);

  React.useEffect(() => {
    if (!open || inline) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, inline, onClose]);

  const surface = (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={ariaLabel}
      className={inline ? undefined : closing ? "cg-sheet-out" : "cg-sheet-in"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        background: "var(--surface-dialog)",
        color: "var(--on-surface)",
        borderRadius: "var(--radius-extra-large) var(--radius-extra-large) 0 0",
        padding: "var(--space-2) 0 calc(var(--space-6) + env(safe-area-inset-bottom, 0px))",
        ...(inline
          ? { position: "relative", width: "100%" }
          : {
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 41,
              ...(height ? { height, overflow: "hidden" } : { maxHeight, overflowY: "auto" }),
            }),
      }}
    >
      <span aria-hidden="true" style={{ alignSelf: "center", height: "4px", width: "32px", flex: "none", borderRadius: "var(--radius-full)", background: "var(--border-hairline)", marginBottom: "var(--space-3)" }} />
      {children}
    </div>
  );

  if (inline) return surface;
  if (!shown) return null;

  return (
    <>
      <div
        aria-hidden="true"
        onPointerDown={onClose}
        className={closing ? "cg-scrim-out" : "cg-scrim-in"}
        style={{ position: "fixed", inset: 0, zIndex: 40, background: "var(--scrim-dialog)" }}
      />
      {surface}
    </>
  );
}

/* One row in a sheet: `label-large`, the 48px minimum, left-aligned, one line.
   No icons in the list — a mixed list of iconned and un-iconned rows is how an
   icon set starts to look accidental (§5). */
export function SheetItem({ label, onSelect, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={ariaLabel}
      className="cg-state cg-focus"
      style={{
        display: "flex",
        alignItems: "center",
        minHeight: "var(--touch-target-min)",
        border: 0,
        background: "none",
        padding: "0 var(--space-6)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-label-large)",
        lineHeight: "var(--text-label-large--line-height)",
        letterSpacing: "var(--text-label-large--letter-spacing)",
        fontWeight: "var(--text-label-large--font-weight)",
        color: "var(--on-surface)",
        textAlign: "left",
      }}
    >
      {label}
    </button>
  );
}

/* A sheet's own heading, when the choices need naming. `title-medium`, sentence
   case, and never a close button beside it: the scrim and Escape already do that,
   and a third way out is a third thing to read. */
export function SheetTitle({ children }) {
  return (
    <h2 style={{ margin: 0, padding: "0 var(--space-6) var(--space-2)", fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
      {children}
    </h2>
  );
}
