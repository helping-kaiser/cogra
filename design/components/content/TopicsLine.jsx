import React from "react";
import { TopicChip } from "../core/Chip.jsx";

/* The topics-and-citations line a content card wears, shared by PostCard and
   CommentCard — it appeared on a second surface, so it moved here (the repo's
   own rule; a copy is never the answer).

   AT MOST TWO CHIPS, THEN THE COUNTS (readme §13, 2026-08-28): a clipped
   parade of half-chips says nothing, so the line shows up to two topics whole
   — each capped so both always fit beside the counts — and states the rest in
   words: "· 23 topics · 3 references". The counts are the readable fact AND
   the way in: the topics-and-references sheet is the full set's home. Never a
   wrap, never a second row (readme §13's collapse order).

   Two tap models, never mixed: in a summary card the chips navigate to their
   topics and the counts open the sheet; on a detail surface pass `onOpen` and
   the WHOLE LINE is one control opening the sheet, the chips inert inside it. */

const VISIBLE_CHIPS = 2;
/* Two capped chips + the counts fit a 390px card at its 16px insets. */
const CHIP_CAP = {
  display: "inline-block",
  boxSizing: "border-box",
  maxWidth: "96px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  lineHeight: "30px",
};

const COUNT_STYLE = {
  flex: "none",
  color: "var(--text-secondary)",
  fontSize: "var(--text-body-small)",
  lineHeight: "var(--text-body-small--line-height)",
  whiteSpace: "nowrap",
};

function countsText(hiddenTopics, references) {
  const parts = [];
  if (hiddenTopics > 0) parts.push(hiddenTopics === 1 ? "1 topic" : `${hiddenTopics} topics`);
  if (references > 0) parts.push(references === 1 ? "1 reference" : `${references} references`);
  if (parts.length === 0) return null;
  return `· ${parts.join(" · ")}`;
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
  const visible = topics.slice(0, VISIBLE_CHIPS);
  const counts = countsText(topics.length - visible.length, references);

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
        {visible.map((topic) => (
          <TopicChip key={topic} topic={topic} inert style={CHIP_CAP} />
        ))}
        {counts && <span style={COUNT_STYLE}>{counts}</span>}
      </button>
    );
  }

  return (
    <div style={LINE}>
      {visible.map((topic) => (
        <TopicChip key={topic} topic={topic} style={CHIP_CAP} />
      ))}
      {counts &&
        (onOpenReferences ? (
          <button
            type="button"
            onClick={onOpenReferences}
            className="cg-state cg-focus"
            style={{ flex: "none", border: 0, background: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-sans)" }}
          >
            <span style={COUNT_STYLE}>{counts}</span>
          </button>
        ) : (
          <span style={COUNT_STYLE}>{counts}</span>
        ))}
    </div>
  );
}
