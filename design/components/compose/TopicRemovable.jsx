import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { BUTTON_CLASS } from "../core/Button.jsx";

/* A topic staged on a composer (item 17, the conformance round): the hash and
   the word in the secondary container, with the × that takes it back out.

   IT IS NOT A `Chip`. A chip is a control the reader presses to change what
   they are looking at — a filter, a readout. This is a piece of the thing being
   authored, shown back to the author: the topic is already staged, and the only
   thing to do with it is remove it. Same pill, different job, so it keeps the
   `secondary-container` pair rather than borrowing the chip's.

   THE HASH IS DRAWN, NOT TYPED. The author names a topic; the mark that says
   what kind of name it is belongs to the row that shows it back.

   THE × IS THE BUTTON, NOT THE PILL (jakob's ruling, the conformance round).
   It was drawn as a glyph, which cannot be reached by keyboard and tells a
   screen reader nothing — `PickTray`'s "Show all" had exactly this shape and
   was ruled the same way. The pill stays inert: making the whole pill the
   button would say removal is the only thing a topic is for. The button adds
   no box of its own — no border, no background, no padding, colour inherited —
   so the drawing is the glyph it always was, and the state layer, the focus
   ring and the 48px target arrive with `BUTTON_CLASS`.

   IT NAMES THE TOPIC IT REMOVES. "Remove #coastroad", with the hash the pill
   draws, because a row of these is a row of identically-named controls
   otherwise. */

export function TopicRemovable({ topic, onRemove }) {
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
      #{topic}
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
