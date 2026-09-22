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
   · `surfaceContainerHigh` at the 28px rung — a rung higher when it is
     `stacked` — TOP CORNERS ONLY: the bottom edge is the screen's, and a
     rounded bottom on a surface flush to the edge draws a gap that is not
     there.
   · The grab handle is `outlineVariant`, 32×4, and it is not a control: it says
     which edge this came from and which way it goes back.
   · It covers the bottom bar rather than sitting above it. A sheet is a decision
     surface; a navigation bar under it would offer to leave mid-decision.
   · Scrim at 50%, and pressing it closes. Escape closes. Both because a drawer
     the reader opened is a drawer the reader can drop.
   · Never open beside the opinion pad: one parked surface at a time, and the pad
     owns the same corner of the screen.
   · Enters over 400ms from the bottom, leaves over 200ms to the bottom
     (`tokens/transitions.css`) — a dismissal exits the edge it entered from. */

/* THE TALLEST SHEET IS A CLASS, AND IT IS THE CEILING OVER ALL OF THEM (jakob's
   ruling, the sheets-and-video round). A sheet's top edge never rises above a
   72px sliver measured from the top of the SAFE AREA — Android below the status
   bar and the display cutout, web from the viewport top. The rounded top corners
   keep a strip of the surface behind visible, and no sheet ever touches the safe
   area: a drawer that reached the top edge would be a screen, and a reader who
   cannot see what they left cannot tell a drawer from a destination.

   The ceiling caps every height class rather than replacing any. `maxHeight`
   keeps its 62% default and the raised 88% class stays what a sheet asks for
   when its content needs the room; `height` pins a sheet at a size instead of
   letting content set it, for the footed filter whose Done row is pinned beneath
   its scrolling sections. Each is held under the ceiling by `min()`, so no class
   can out-grow the sliver on a screen short enough for its percentage to reach
   it.

   `tallest` IS THAT CLASS ASKED FOR BY NAME — the comments sheet, whose pinned
   composer row needs the surface itself to own the height (readme §13,
   2026-08-28). It pins the sheet at the ceiling and the children manage their
   own scrolling. */
const SHEET_CEILING = "calc(100% - 72px - env(safe-area-inset-top, 0px))";

/* `stacked` is the sheet that opens over another sheet — the comment's menu and
   the comment's license, both over the comments thread. A SHEET OVER A SHEET IS
   DRAWN AS LAYERS. Left flat, the upper sheet's wash resolves beneath the lower
   sheet's surface: nothing dims, and two surfaces of one colour meet at a
   shadowless seam. Stacked, the sheet takes the layer above, so the wash it
   already draws — the same `--scrim-dialog` — falls BETWEEN the two and dims
   what it covers, while the sheet below keeps its top edge, its handle and its
   title visible above this one. Its surface takes the next tonal rung,
   `surfaceContainerHighest`: elevation is tonal (`tokens/semantic.css`), and two
   surfaces at one rung claim one elevation. */
export function BottomSheet({ open = false, onClose, ariaLabel, children, inline = false, maxHeight = "62%", height, tallest = false, stacked = false }) {
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

  /* The wash's layer; the surface rides one above it, so a stacked sheet's wash
     clears the sheet below instead of sliding under it. */
  const washLayer = stacked ? 42 : 40;

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
        background: stacked ? "var(--surface-container-highest)" : "var(--surface-dialog)",
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
              zIndex: washLayer + 1,
              ...(tallest
                ? { height: SHEET_CEILING, overflow: "hidden" }
                : height
                  ? { height: `min(${height}, ${SHEET_CEILING})`, overflow: "hidden" }
                  : { maxHeight: `min(${maxHeight}, ${SHEET_CEILING})`, overflowY: "auto" }),
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
        style={{ position: "fixed", inset: 0, zIndex: washLayer, background: "var(--scrim-dialog)" }}
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
   and a third way out is a third thing to read.

   `trailing` is the slot for what the heading line carries besides its name — the
   screen's one "?", or the switch the sheet exists for. It is the heading's own
   row, so a sheet that needs one stops assembling a heading by hand; a close
   control is still the one thing it never takes. */
export function SheetTitle({ children, trailing }) {
  const heading = { fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" };
  if (!trailing) {
    return (
      <h2 style={{ margin: 0, padding: "0 var(--space-6) var(--space-2)", ...heading }}>
        {children}
      </h2>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "0 var(--space-6) var(--space-2)" }}>
      <h2 style={{ margin: 0, flex: 1, ...heading }}>{children}</h2>
      {trailing}
    </div>
  );
}
