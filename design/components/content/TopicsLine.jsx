import React from "react";
import { TopicChip } from "../core/Chip.jsx";

/* The topics-and-citations line a content card wears, shared by PostCard and
   CommentCard — it appeared on a second surface, so it moved here (the repo's
   own rule; a copy is never the answer).

   ONE LINE with the citation count riding its end. In a summary card it never
   wraps — overflow is simply clipped (readme §13's collapse order: this line
   gives way before media or the affordance row ever shrink); `wrap` is the
   detail variant's full set. The count opens the topics-and-references sheet,
   where every entry has room to be a full row (readme §13, 2026-08-28). */

export function TopicsLine({ topics = [], references = 0, wrap = false, onOpenReferences }) {
  if (topics.length === 0 && references === 0) return null;
  const count = references === 1 ? "1 reference" : `${references} references`;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        flexWrap: wrap ? "wrap" : "nowrap",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {topics.map((topic) => (
        <TopicChip key={topic} topic={topic} />
      ))}
      {references > 0 &&
        (onOpenReferences ? (
          <button
            type="button"
            onClick={onOpenReferences}
            className="cg-state cg-focus"
            style={{
              flex: "none",
              border: 0,
              background: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              color: "var(--text-secondary)",
              fontSize: "var(--text-body-small)",
              lineHeight: "var(--text-body-small--line-height)",
              whiteSpace: "nowrap",
            }}
          >
            · {count}
          </button>
        ) : (
          <span
            style={{
              flex: "none",
              color: "var(--text-secondary)",
              fontSize: "var(--text-body-small)",
              lineHeight: "var(--text-body-small--line-height)",
              whiteSpace: "nowrap",
            }}
          >
            · {count}
          </span>
        ))}
    </div>
  );
}
