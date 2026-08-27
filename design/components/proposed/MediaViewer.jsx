import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* PROPOSED — the full-media view. Settled 2026-08-26: media in a post is shown
   WHOLE, and tapping it in the detail view opens it "covering as much of the
   screen as possible".

   THE TWO RULES THIS ENCODES:
   · The frame is never cut here. `contain`, centred, as large as the viewport
     allows — a viewer that crops is not a viewer.
   · It is a place you back out of, not a screen you navigate to: `arrow_back`
     top-left, Escape, and the backdrop all close it, and it never changes the
     underlying route. The reader came to look at one thing and expects to land
     back exactly where they were.

   Nothing else is drawn. No zoom, no share, no counter chrome beyond the plain
   `n of m` — a viewer that grows a toolbar is a viewer nobody trusts to close.

   The scrim is the dialog scrim, so the viewer belongs to the same family as
   every other thing that covers the screen in this system. */

export function MediaViewer({ items = [], index = 0, onClose, onIndexChange }) {
  const [current, setCurrent] = React.useState(index);
  const count = items.length;
  const item = items[Math.min(current, Math.max(count - 1, 0))];

  const move = React.useCallback(
    (next) => {
      const wrapped = (next + count) % count;
      setCurrent(wrapped);
      if (onIndexChange) onIndexChange(wrapped);
    },
    [count, onIndexChange],
  );

  React.useEffect(() => setCurrent(index), [index]);

  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose && onClose();
      if (count > 1 && event.key === "ArrowRight") move(current + 1);
      if (count > 1 && event.key === "ArrowLeft") move(current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, current, move, onClose]);

  if (!item) return null;

  const arrow = (direction) => (
    <button
      type="button"
      aria-label={direction < 0 ? "Previous" : "Next"}
      onClick={(event) => {
        event.stopPropagation();
        move(current + direction);
      }}
      className="cg-state cg-focus"
      style={{
        width: "var(--touch-target-min)",
        height: "var(--touch-target-min)",
        display: "grid",
        placeItems: "center",
        border: "none",
        background: "transparent",
        borderRadius: "var(--radius-full)",
        color: "var(--inverse-on-surface)",
        cursor: "pointer",
        padding: 0,
        flex: "none",
      }}
    >
      <Icon name="arrow_back" style={direction < 0 ? undefined : { transform: "scaleX(-1)" }} />
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "var(--scrim-dialog)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "8px", flex: "none" }}>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="cg-state cg-focus"
          style={{
            width: "var(--touch-target-min)",
            height: "var(--touch-target-min)",
            display: "grid",
            placeItems: "center",
            border: "none",
            background: "transparent",
            borderRadius: "var(--radius-full)",
            color: "var(--inverse-on-surface)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <Icon name="arrow_back" />
        </button>
        {count > 1 && (
          <span style={{ fontSize: "var(--text-label-large)", color: "var(--inverse-on-surface)" }}>
            {current + 1} of {count}
          </span>
        )}
      </div>
      {/* The frame, whole. The click-stop keeps a tap ON the media from closing
          the thing the reader just opened. */}
      <div
        onClick={(event) => event.stopPropagation()}
        style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: "var(--space-1)", padding: "0 4px 16px" }}
      >
        {count > 1 && arrow(-1)}
        {item.kind === "video" ? (
          <video
            src={item.src}
            poster={item.poster}
            controls
            autoPlay
            playsInline
            aria-label={item.alt}
            style={{ flex: 1, minWidth: 0, maxHeight: "100%", objectFit: "contain" }}
          />
        ) : (
          <img
            src={item.src}
            alt={item.alt ?? ""}
            aria-hidden={item.alt ? undefined : "true"}
            style={{ flex: 1, minWidth: 0, maxHeight: "100%", objectFit: "contain" }}
          />
        )}
        {count > 1 && arrow(1)}
      </div>
    </div>
  );
}
