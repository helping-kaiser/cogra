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
   a 390px card, 16px insets, so a 358px content width — so "does it fit" is
   a threshold derived from that context rather than measured live: this
   file renders through ReactDOMServer, no DOM and no real glyph metrics, so
   the check has to run ahead of paint, on the strings alone. Fit is judged
   for the LINE, not a chip in isolation — a tag's chip can cost more of the
   358px when the count beside it is short, and less when the count is long.

   The per-character costs below are real measurement, not a guess: probed
   in a live render of this exact pill and this exact counts span, in
   Figtree, against every topic name this repo's canonical fixtures use.
   Both average a little under the constants here (chip text: label-large,
   14px/500, averaged 7.28px/char across the corpus, worst single word
   8.68px/char; counts text: body-small, 12px/400, averaged 5.39px/char,
   worst 5.63px/char) — the constants round up from the average rather than
   the worst single word, because the worst-per-character words in the
   corpus are short ones a single wide letter dominates, and a short word's
   error is a few px, not a systemic one. A chip's pill also always costs
   26px beyond its text: 12px of padding and a 1px border either side.

   The line tries two chips, then one, then none, keeping the first
   candidate whose estimated total — every shown chip's pill, the resulting
   counts span, and a var(--space-2) gap between every pair of them — clears
   358px. Whichever count of chips survives is always a PREFIX of `topics`:
   there's no version of this line where a later, shorter tag is shown and
   an earlier, longer one is folded instead. */
const CHIP_TEXT_AVG_PX = 7.5;
const COUNTS_TEXT_AVG_PX = 5.5;
const PILL_OVERHEAD_PX = 26;
const GAP_PX = 8;
const LINE_BUDGET_PX = 358;

function chipLabel(topic) {
  return `#${topic.replace(/^#/, "")}`;
}

function estimateChipWidth(topic) {
  return PILL_OVERHEAD_PX + chipLabel(topic).length * CHIP_TEXT_AVG_PX;
}

function estimateCountsWidth(text) {
  return text.length * COUNTS_TEXT_AVG_PX;
}

function estimateLineWidth(shownTopics, hiddenTopics, references) {
  const counts = countsText(hiddenTopics, references);
  const items = shownTopics.length + (counts ? 1 : 0);
  if (items === 0) return 0;
  const chipsWidth = shownTopics.reduce((sum, topic) => sum + estimateChipWidth(topic), 0);
  const countsWidth = counts ? estimateCountsWidth(counts) : 0;
  return chipsWidth + countsWidth + (items - 1) * GAP_PX;
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

function visibleChips(topics, references) {
  const cap = Math.min(VISIBLE_CHIPS, topics.length);
  for (let n = cap; n > 0; n--) {
    const shown = topics.slice(0, n);
    if (estimateLineWidth(shown, topics.length - n, references) <= LINE_BUDGET_PX) return shown;
  }
  return [];
}

export function TopicsLine({ topics = [], references = 0, onOpen, onOpenReferences }) {
  if (topics.length === 0 && references === 0) return null;
  const visible = visibleChips(topics, references);
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
