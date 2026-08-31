import React from "react";
import { BottomSheet, SheetTitle } from "../core/BottomSheet.jsx";
import { Button } from "../core/Button.jsx";
import { Icon } from "../navigation/Icon.jsx";
import { MediaThumb } from "./MediaThumb.jsx";

/* Show all — the per-picture manager (media slice, 2026-08-31): opened by the
   pick step's "Show all" and by the details step's picked row. One home for
   every per-picture concern:

   · ORDER — drag by the handle; the FIRST one is the cover and the badge
     travels with it. No separate cover control exists.
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
            <span
              aria-hidden="true"
              style={{ color: "var(--text-secondary)", flex: "none", display: "inline-flex", cursor: "grab" }}
            >
              <Icon name="drag_indicator" size={20} />
            </span>
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
              {item.described ? (
                <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
                  Described
                </span>
              ) : (
                <button
                  type="button"
                  onClick={item.onDescribe}
                  className="cg-state cg-focus cg-hit"
                  style={{
                    alignSelf: "flex-start",
                    border: 0,
                    background: "none",
                    padding: 0,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-label-small)",
                    lineHeight: "var(--text-label-small--line-height)",
                    fontWeight: "var(--text-label-small--font-weight)",
                    letterSpacing: "0.5px",
                    color: "var(--primary)",
                  }}
                >
                  Describe
                </button>
              )}
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
          letterSpacing: "0.4px",
          color: "var(--text-secondary)",
        }}
      >
        The first one is the cover — drag to reorder.
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "var(--space-2) var(--space-4) var(--space-2)" }}>
        <Button variant="text" onClick={onDone ?? onClose}>
          Done
        </Button>
      </div>
    </BottomSheet>
  );
}
