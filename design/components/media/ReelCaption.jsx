import React from "react";

/* THE STREAM'S CAPTION (readme §13, the reel round) — the post's words along the
   bottom of the clip, in the card's own budget: the handle, the title, and the
   body clamped to two lines with the same `More` opener a card carries. A
   stream that spends more than that on words is a feed with a video behind it.

   IT KEEPS CLEAR OF THE RAIL on the right and of the bottom bar below, and it
   carries a text shadow rather than a plate, for the same reason the rail's
   glyphs do: a panel behind the words would cover the frame they sit on.

   The author's face is NOT here — it is the rail's first item, because people
   lead in this product and the rail is where the acts on a person begin. */

export function ReelCaption({ handle, title, content, bottom = 86, onMore }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        right: 76,
        bottom: `${bottom}px`,
        zIndex: 3,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        color: "#fff",
        textShadow: "0 1px 4px rgba(0,0,0,0.6)",
      }}
    >
      {handle && (
        <span style={{ fontSize: "var(--text-label-large)", fontWeight: "var(--text-label-large--font-weight)" }}>@{handle}</span>
      )}
      {title && (
        <span
          style={{
            fontSize: "var(--text-title-small)",
            lineHeight: "var(--text-title-small--line-height)",
            fontWeight: "var(--text-title-small--font-weight)",
          }}
        >
          {title}
        </span>
      )}
      {content && (
        <span
          style={{
            fontSize: "var(--text-body-small)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {content}
        </span>
      )}
      {content && (
        <button
          type="button"
          onClick={onMore ?? (() => {})}
          className="cg-state cg-focus"
          style={{
            alignSelf: "flex-start",
            border: 0,
            background: "none",
            padding: "2px 0",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-label-medium)",
            fontWeight: "var(--text-label-medium--font-weight)",
            color: "#fff",
          }}
        >
          More
        </button>
      )}
    </div>
  );
}
