import React from "react";
import { BottomSheet, SheetTitle } from "../core/BottomSheet.jsx";
import { Button, InlineAction } from "../core/Button.jsx";
import { Icon } from "../navigation/Icon.jsx";
import { MediaThumb } from "./MediaThumb.jsx";

/* Show all — the per-picture manager (media slice, 2026-08-31): opened by the
   pick step's "Show all" and by the details step's picked row. One home for
   every per-picture concern:

   · ORDER — drag by the handle; the FIRST one is the cover and the badge
     travels with it. No separate cover control exists. When the drag lifts a
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

export function PickedSheet({ open = false, onClose, items = [], onDone, inline = false }) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={`Picked · ${items.length}`} inline={inline} maxHeight="88%">
      <SheetTitle>Picked · {items.length}</SheetTitle>
      <div style={{ display: "flex", flexDirection: "column", padding: "0 var(--space-6)", borderTop: "1px solid var(--border-hairline)" }}>
        {items.map((item, index) => (
          <div
            key={item.src ?? index}
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
            <MediaThumb src={item.src} alt={item.alt} size={56} cover={index === 0} />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
              <span
                style={{
                  fontSize: "var(--text-label-large)",
                  lineHeight: "var(--text-label-large--line-height)",
                  fontWeight: "var(--text-label-large--font-weight)",
                  letterSpacing: "var(--text-label-large--letter-spacing)",
                }}
              >
                {index === 0 ? "Cover — shown first" : `Picture ${index + 1}`}
              </span>
              {/* The actions wrap; a wrapped line keeps a 24px pitch, so their
                  hit areas stand clear under WCAG 2.5.8's spacing rule. */}
              <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: "var(--space-3)", rowGap: "var(--space-2)" }}>
                {item.described ? (
                  <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
                    Described
                  </span>
                ) : (
                  <InlineAction size="sm" onClick={item.onDescribe}>
                    Describe
                  </InlineAction>
                )}
                {index > 0 && (
                  <InlineAction size="sm" onClick={item.onMakeCover}>
                    Make it the cover
                  </InlineAction>
                )}
                {index > 0 && (
                  <InlineAction size="sm" onClick={item.onMoveUp}>
                    Move up
                  </InlineAction>
                )}
                {index < items.length - 1 && (
                  <InlineAction size="sm" onClick={item.onMoveDown}>
                    Move down
                  </InlineAction>
                )}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Remove ${index === 0 ? "the cover" : `picture ${index + 1}`}`}
              onClick={item.onRemove}
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
      >
        The first one is the cover.
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "var(--space-2) var(--space-4) var(--space-2)" }}>
        <Button variant="text" onClick={onDone ?? onClose}>
          Done
        </Button>
      </div>
    </BottomSheet>
  );
}
