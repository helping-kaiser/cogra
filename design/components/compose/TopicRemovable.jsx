import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* A topic staged on a composer (item 17, the conformance round): the hash and
   the word in the secondary container, with the × that takes it back out.

   IT IS NOT A `Chip`. A chip is a control the reader presses to change what
   they are looking at — a filter, a readout. This is a piece of the thing being
   authored, shown back to the author: the topic is already staged, and the only
   thing to do with it is remove it. Same pill, different job, so it keeps the
   `secondary-container` pair rather than borrowing the chip's.

   THE HASH IS DRAWN, NOT TYPED. The author names a topic; the mark that says
   what kind of name it is belongs to the row that shows it back.

   THE × IS DRAWN, NOT WIRED — a glyph inside the pill, not a button, on every
   board that stages a topic. So the one thing the author can do here cannot be
   done by keyboard and has no name a screen reader can read. `PickTray`'s
   "Show all" had exactly this shape and was ruled a real button; this one is
   still waiting on its ruling, and the master draws what was designed rather
   than deciding it. When the ruling comes, the × becomes the button — not the
   pill, which would make removal the only thing a topic is for. */

export function TopicRemovable({ topic }) {
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
      <Icon name="close" size={16} />
    </span>
  );
}
