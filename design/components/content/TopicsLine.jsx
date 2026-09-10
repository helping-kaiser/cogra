import React from "react";
import { TopicChip } from "../core/Chip.jsx";

/* The tags-and-citations line a content card wears, shared by PostCard and
   CommentCard — it appeared on a second surface, so it moved here (the repo's
   own rule; a copy is never the answer).

   AT MOST TWO CHIPS, THEN THE COUNTS (readme §13, 2026-08-28): a clipped
   parade of half-chips says nothing, so the line shows up to two tags whole
   and states the rest in words: "· 23 tags · 3 references". A tag never gets
   cut to make room — one that would need cutting is not drawn as a chip at
   all; it folds into the counts instead (jakob's ruling A3). The counts are
   the readable fact AND the way in: the tags-and-references sheet is the
   full set's home. Never a wrap, never a second row (readme §13's collapse
   order).

   THE FILE AND ITS PROPS KEEP THE RECORD'S WORD (the naming law, readme §13,
   the tag round): `TopicsLine`, `topics` — what the graph carries is a topic.
   Every string it renders says "tag", which is what the reader calls it.

   Two tap models, never mixed: in a summary card the chips navigate to their
   tag pages and the counts open the sheet; on a detail surface pass `onOpen`
   and the WHOLE LINE is one control opening the sheet, the chips inert
   inside it. */

const VISIBLE_CHIPS = 2;

/* WHOLE OR FOLDED, NEVER CUT. This line renders at one fixed context only —
   a 390px card, 16px insets — so "does a chip fit" is a threshold derived
   from that context rather than measured live: this file renders through
   ReactDOMServer (no DOM, no real glyph metrics), so the check has to run
   ahead of paint, on the tag string alone.

   Two chips plus the counts have to clear the card's 358px content width
   (390 minus the 16px insets either side); this file has always reserved
   96px of that per chip. A chip's pill is border-box with 12px of padding
   and a 1px border either side, so 26px of the 96 is never text — 70px is
   the actual budget for "#name". There's no font-metrics table to turn 70px
   into a character count, so this calibrates against the line's own
   documented two-chip example ("#coastroad", "#saltmarsh" — 10 characters
   each, the pair this file has always shown as filling the budget):
   70px / 10 chars ⇒ MAX_CHIP_CHARS = 10. A "#name" longer than that doesn't
   get a chip; a third tag once two have already fit doesn't either — both
   fold into the trailing count. Visible chips are always a PREFIX of
   `topics`: the walk stops at the first tag that doesn't fit, so a later,
   shorter tag never jumps ahead of one the line already gave up on. */
const MAX_CHIP_CHARS = 10;

function chipLabel(topic) {
  return `#${topic.replace(/^#/, "")}`;
}

function fitsWhole(topic) {
  return chipLabel(topic).length <= MAX_CHIP_CHARS;
}

const CHIP_STYLE = { flex: "none" };

const COUNT_STYLE = {
  flex: "none",
  color: "var(--text-secondary)",
  fontSize: "var(--text-body-small)",
  lineHeight: "var(--text-body-small--line-height)",
  whiteSpace: "nowrap",
};

function countsText(hiddenTopics, references) {
  const parts = [];
  if (hiddenTopics > 0) parts.push(hiddenTopics === 1 ? "1 tag" : `${hiddenTopics} tags`);
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

function visibleChips(topics) {
  const visible = [];
  for (const topic of topics) {
    if (visible.length >= VISIBLE_CHIPS || !fitsWhole(topic)) break;
    visible.push(topic);
  }
  return visible;
}

export function TopicsLine({ topics = [], references = 0, onOpen, onOpenReferences }) {
  if (topics.length === 0 && references === 0) return null;
  const visible = visibleChips(topics);
  const counts = countsText(topics.length - visible.length, references);

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="Tags and references"
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
          <TopicChip key={topic} topic={topic} inert style={CHIP_STYLE} />
        ))}
        {counts && <span style={COUNT_STYLE}>{counts}</span>}
      </button>
    );
  }

  return (
    <div style={LINE}>
      {visible.map((topic) => (
        <TopicChip key={topic} topic={topic} style={CHIP_STYLE} />
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
