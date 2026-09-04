import React from "react";
import { MonogramAvatar } from "../people/ActorChip.jsx";

/* THE THING BEING ANSWERED, held above the answer. Every reply composer opens
   with it: whose post this is and how it starts, on a tone of its own so the
   words the reader is about to type are visibly not part of it.

   It is CONTAINED and it is INERT. Contained, because the composer's own body
   sits on the page's ground with no box at all — the box is the whole signal
   that this block is quoted rather than written. Inert, because the reader is
   already inside the thing it names: a row that navigated away from a composer
   holding unsent words would be a trap, and there is nowhere for it to go.

   The snippet ellipsizes and the title does not. The title is a name and a
   handle — losing its end loses who — while the snippet is only a taste, and
   one line of it is the point. That is why the column carries no gap: title and
   snippet are one two-line address, not two facts. */

export function QuotedRow({ title, snippet, name, src }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        minHeight: "56px",
        padding: "var(--space-2) var(--space-3)",
        borderRadius: "var(--radius-small)",
        background: "var(--surface-container-highest)",
      }}
    >
      <MonogramAvatar name={name} size={32} src={src} />
      <span style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span
          style={{
            fontSize: "var(--text-label-large)",
            lineHeight: "var(--text-label-large--line-height)",
            fontWeight: "var(--text-label-large--font-weight)",
          }}
        >
          {title}
        </span>
        {snippet && (
          <span
            style={{
              fontSize: "var(--text-label-small)",
              lineHeight: "var(--text-label-small--line-height)",
              color: "var(--text-secondary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {snippet}
          </span>
        )}
      </span>
    </div>
  );
}
