import React from "react";
import { TopicChip } from "../core/Chip.jsx";

/* The topics-and-citations line a content card wears, shared by PostCard and
   CommentCard — it appeared on a second surface, so it moved here (the repo's
   own rule; a copy is never the answer).

   ONE LINE, ON EVERY VARIANT, with the citation count riding its end — never a
   wrap: overflow is simply clipped (readme §13's collapse order: this line
   gives way before media or the affordance row ever shrink), and the
   topics-and-references SHEET is the full set's home (readme §13, 2026-08-28).

   Two tap models, never mixed: in a summary card the chips navigate to their
   topics and only the count opens the sheet; on a detail surface pass `onOpen`
   and the WHOLE LINE is one control opening the sheet, the chips inert inside
   it — fifty chips are fifty reasons not to make each its own target there. */

function Count({ references }) {
  if (references === 0) return null;
  return (
    <span
      style={{
        flex: "none",
        color: "var(--text-secondary)",
        fontSize: "var(--text-body-small)",
        lineHeight: "var(--text-body-small--line-height)",
        whiteSpace: "nowrap",
      }}
    >
      · {references === 1 ? "1 reference" : `${references} references`}
    </span>
  );
}

const LINE = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  flexWrap: "nowrap",
  overflow: "hidden",
  minWidth: 0,
};

export function TopicsLine({ topics = [], references = 0, onOpen, onOpenReferences }) {
  if (topics.length === 0 && references === 0) return null;

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="Topics and references"
        className="cg-state cg-focus"
        style={{
          ...LINE,
          width: "100%",
          border: 0,
          background: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          textAlign: "left",
        }}
      >
        {topics.map((topic) => (
          <TopicChip key={topic} topic={topic} inert />
        ))}
        <Count references={references} />
      </button>
    );
  }

  return (
    <div style={LINE}>
      {topics.map((topic) => (
        <TopicChip key={topic} topic={topic} />
      ))}
      {references > 0 &&
        (onOpenReferences ? (
          <button
            type="button"
            onClick={onOpenReferences}
            className="cg-state cg-focus"
            style={{ flex: "none", border: 0, background: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-sans)" }}
          >
            <Count references={references} />
          </button>
        ) : (
          <Count references={references} />
        ))}
    </div>
  );
}
