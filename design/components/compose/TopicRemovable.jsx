import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { BUTTON_CLASS } from "../core/Button.jsx";

/* A tag staged on a composer (item 17, the conformance round): the hash and
   the word in the secondary container, with the × that takes it back out. The
   file keeps the record's word and draws the reader's (the naming law, readme
   §13, the tag round).

   IT IS NOT A `Chip`. A chip is a control the reader presses to change what
   they are looking at — a filter, a readout. This is a piece of the thing being
   authored, shown back to the author. Same pill, different job, so it keeps the
   `secondary-container` pair rather than borrowing the chip's.

   THE HASH IS DRAWN, NOT TYPED. The author names a tag; the mark that says
   what kind of name it is belongs to the row that shows it back.

   THE × IS ITS OWN BUTTON (jakob's ruling, the conformance round). It was
   drawn as a glyph, which cannot be reached by keyboard and tells a screen
   reader nothing — `PickTray`'s "Show all" had exactly this shape and was
   ruled the same way. The button adds no box of its own — no border, no
   background, no padding, colour inherited — so the drawing is the glyph it
   always was, and the state layer, the focus ring and the 48px target arrive
   with `BUTTON_CLASS`.

   AND THE PILL IS A BUTTON WHEN, AND ONLY WHEN, THERE IS SOMETHING ELSE A TAG
   IS FOR (`onEdit`, the tag round). The conformance round left the pill inert
   with a reason — making it pressable would have said removal was the only
   thing a tag was for, and at the time it was. It no longer is: a staged tag
   carries a relevance/confidence pair the author may set, and the pair editor
   is what the pill opens. Given no `onEdit` the pill stays exactly as inert as
   that ruling left it.

   THE DEVIATION IS WHAT IT SAYS (`pair`). A tag sitting at the contract's
   default — relevance +0.1, confidence 1 (`TagInput`, api-spec.md) — says
   nothing, and one the author moved says where it moved to. That is the
   filter trigger's rule (readme §13, "the trigger speaks deviations only")
   applied to the one other place this system shows a set of authored values
   back: a row of pills each carrying two numbers is the clipped parade
   `TopicsLine` already refuses.

   EACH CONTROL NAMES ITS OWN TAG. "Remove #coastroad", "#coastroad — set how
   it relates", with the hash the pill draws, because a row of these is a row
   of identically-named controls otherwise. */

/* The deviation rides at the pill's own small rung on the container's dimmer
   ink — present enough to read, quiet enough that a row of default tags is
   still a row of words. */
const PAIR = {
  fontSize: "var(--text-label-small)",
  lineHeight: "var(--text-label-small--line-height)",
  fontWeight: "var(--text-label-small--font-weight)",
  letterSpacing: "var(--text-label-small--letter-spacing)",
  opacity: 0.75,
};

export function TopicRemovable({ topic, pair, onRemove, onEdit }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: 32,
        padding: "4px 12px",
        borderRadius: "var(--radius-full)",
        background: "var(--secondary-container)",
        color: "var(--on-secondary-container)",
        fontSize: "var(--text-label-large)",
        lineHeight: "var(--text-label-large--line-height)",
        fontWeight: "var(--text-label-large--font-weight)",
        letterSpacing: "var(--text-label-large--letter-spacing)",
      }}
    >
      {onEdit ? (
        <button
          type="button"
          aria-label={`#${topic} — set how it relates`}
          onClick={onEdit}
          className={BUTTON_CLASS}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: 0,
            background: "none",
            padding: 0,
            borderRadius: "var(--radius-full)",
            color: "inherit",
            font: "inherit",
            letterSpacing: "inherit",
            cursor: "pointer",
          }}
        >
          #{topic}
          {pair && <span style={PAIR}>{pair}</span>}
        </button>
      ) : (
        <>
          #{topic}
          {pair && <span style={PAIR}>{pair}</span>}
        </>
      )}
      <button
        type="button"
        aria-label={`Remove #${topic}`}
        onClick={onRemove}
        className={BUTTON_CLASS}
        style={{
          flex: "none",
          display: "inline-flex",
          border: 0,
          background: "none",
          padding: 0,
          borderRadius: "var(--radius-full)",
          color: "inherit",
          cursor: "pointer",
        }}
      >
        <Icon name="close" size={16} />
      </button>
    </span>
  );
}
