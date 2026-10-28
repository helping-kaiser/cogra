import React from "react";
import { BottomSheet, SheetTitle } from "../core/BottomSheet.jsx";
import { Button, InlineAction } from "../core/Button.jsx";
import { Icon } from "../navigation/Icon.jsx";
import { MediaThumb } from "./MediaThumb.jsx";

/* Show all — the per-picture manager (media slice, 2026-08-31): opened by the
   pick step's "Show all" and by the details step's picked row. One home for
   every per-picture concern:

   · IT IS AN EDITING SHEET (readme §4, *Sheets*; jakob 2026-10-02, the
     editing-sheet exemption): every reorder, removal and cover change applies
     the moment it is made, so `Done`, the scrim, a swipe down, Back and Escape
     all just close it and what was applied stands.
   · ORDER — drag by the handle; the FIRST one is the cover and the badge
     travels with it. Making a picture the cover moves it to the head of the
     list — by the drag or by `Make it the cover`, below. When the drag lifts a
     row, Android gives the platform's one lift pulse —
     `HapticFeedbackConstants.DRAG_START` (`LONG_PRESS` below API 34; readme
     §4, *Haptics*) — and nothing else in the reorder vibrates; the web gives
     none.
   · THE DRAG HAS NON-DRAG TWINS (the K13 round, ruled; readme §10; drawn by
     jakob's final brief, 2026-10-05). The row's second line carries, after
     `Describe`, three small inline actions — `Make it the cover` · `Move up` ·
     `Move down` — and each row offers only the moves it can make: the cover
     neither becomes the cover nor moves up, the last row does not move down.
     The same moves are TalkBack custom actions on Android. The handle is
     focusable — named for its picture, `Reorder the cover` or `Reorder
     picture 2` — and ↑ / ↓ move the focused row, focus riding along. The
     footnote names the cover rule and nothing else, since the drag is no
     longer the only way.
   · REMOVE — the X on each row.
   · DESCRIBE — the per-picture entry into `DescribeSheet`; a described
     picture shows the quiet word "Described" instead of the link.

   Rows are 56px thumbs with a name ("Cover — shown first", "Picture 2") so a
   screen-reader pass reads as a list of pictures, not a list of buttons. */

/* `node` is the data-node name its placer gives the sheet (seam 248): the
   sheet takes it, its `title`, one `picture` per row keyed by its place in the
   media, counted from 1 — `reorder`, `thumb`, `label`, `described` or
   `describe`, `makeCover`, `moveUp`, `moveDown`, `remove` — the `note` and
   `done`. Given none, it renders exactly as before. */
export function PickedSheet({ open = false, onClose, items = [], onDone, inline = false, node }) {
  const part = (name) => node && name;
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={`Picked · ${items.length}`} inline={inline} maxHeight="88%" node={node}>
      <SheetTitle node={part("title")}>Picked · {items.length}</SheetTitle>
      <div style={{ display: "flex", flexDirection: "column", padding: "0 var(--space-6)", borderTop: "1px solid var(--border-hairline)" }}>
        {items.map((item, index) => (
          <div
            key={item.src ?? index}
            data-node={part("picture")}
            data-node-key={node && String(index + 1)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-4)",
              minHeight: "68px",
              borderBottom: "1px solid var(--border-hairline)",
            }}
          >
            <button
              type="button"
              aria-label={`Reorder ${index === 0 ? "the cover" : `picture ${index + 1}`}`}
              aria-keyshortcuts="ArrowUp ArrowDown"
              data-node={part("reorder")}
              className="cg-state cg-focus cg-hit"
              style={{
                border: 0,
                background: "none",
                padding: 0,
                color: "var(--text-secondary)",
                flex: "none",
                display: "inline-flex",
                cursor: "grab",
              }}
            >
              <Icon name="drag_indicator" size={20} />
            </button>
            <MediaThumb src={item.src} alt={item.alt} size={56} cover={index === 0} node={part("thumb")} />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
              <span
                style={{
                  fontSize: "var(--text-label-large)",
                  lineHeight: "var(--text-label-large--line-height)",
                  fontWeight: "var(--text-label-large--font-weight)",
                  letterSpacing: "var(--text-label-large--letter-spacing)",
                }}
                data-node={part("label")}
              >
                {index === 0 ? "Cover — shown first" : `Picture ${index + 1}`}
              </span>
              {/* The actions wrap; a wrapped line keeps a 24px pitch, so their
                  hit areas stand clear under WCAG 2.5.8's spacing rule. */}
              <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: "var(--space-3)", rowGap: "var(--space-2)" }}>
                {item.described ? (
                  <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }} data-node={part("described")}>
                    Described
                  </span>
                ) : (
                  <InlineAction size="sm" onClick={item.onDescribe} node={part("describe")}>
                    Describe
                  </InlineAction>
                )}
                {index > 0 && (
                  <InlineAction size="sm" onClick={item.onMakeCover} node={part("makeCover")}>
                    Make it the cover
                  </InlineAction>
                )}
                {index > 0 && (
                  <InlineAction size="sm" onClick={item.onMoveUp} node={part("moveUp")}>
                    Move up
                  </InlineAction>
                )}
                {index < items.length - 1 && (
                  <InlineAction size="sm" onClick={item.onMoveDown} node={part("moveDown")}>
                    Move down
                  </InlineAction>
                )}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Remove ${index === 0 ? "the cover" : `picture ${index + 1}`}`}
              onClick={item.onRemove}
              data-node={part("remove")}
              className="cg-state cg-focus cg-hit"
              style={{
                border: 0,
                background: "none",
                padding: 0,
                cursor: "pointer",
                color: "var(--text-secondary)",
                display: "inline-flex",
                flex: "none",
              }}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
      </div>
      <p
        style={{
          margin: 0,
          padding: "var(--space-3) var(--space-6) 0",
          fontSize: "var(--text-label-small)",
          lineHeight: "var(--text-label-small--line-height)",
          letterSpacing: "var(--text-label-small--letter-spacing)",
          color: "var(--text-secondary)",
        }}
        data-node={part("note")}
      >
        The first one is the cover.
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "var(--space-2) var(--space-4) var(--space-2)" }}>
        <Button variant="text" onClick={onDone ?? onClose} node={part("done")}>
          Done
        </Button>
      </div>
    </BottomSheet>
  );
}
