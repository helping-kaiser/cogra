import React from "react";
import { MonogramAvatar } from "./ActorChip.jsx";
import { StanceValue } from "../stance/StanceReadout.jsx";

/* A person on an opinions list (item 17, the conformance round): their face,
   their name, and THE STANCE THE ROW IS ABOUT (jakob 2026-09-01) — the
   record's own value, read-only.

   THE VALUE IS THE ROW'S INFORMATION, which is what makes this row different
   from every followers list it resembles. A follow is a fact you either have
   or don't, so such a list shows only who. A stance has a sign and a
   magnitude, so a list that showed only who would be hiding the part that
   says anything.

   IT IS READ-ONLY, AND THE WHOLE ROW OPENS THE PERSON. There is no adjust
   control here: acting on an opinion means going to the profile it is about,
   where the pad and its context live. A slider in a list row would let someone
   change a public record while scrolling past it.

   THE VALUE MAY BE A DOOR OF ITS OWN (`onOpenHistory`, the change-histories
   round). A stance IS a history — every record ever cast from one node to
   another — and the door rule says an authoring door is a face or a field
   while a HISTORY door is a readout. So the row splits where the two meanings
   split: the person area opens the person, and the value opens the timeline
   the value was summed from. The split is `ContentRow`'s, for its reason — a
   control inside a control is not markup — and a row handed no history stays
   the single element every existing list already draws. */

/* What the value's own target is called. A readout names its value, never its
   destination, so the door needs a spoken name of its own; `HISTORY_DOOR_TAIL`
   is the same promise in the words the pad's label wears. */
export const HISTORY_DOOR_LABEL = "See how this opinion built";

export function StanceRow({ name, handle, src, pDirected, pInterest, onOpen, onOpenHistory }) {
  const box = { display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box", minHeight: 56, border: 0, background: "none", padding: "6px 16px", cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--on-surface)", textAlign: "left" };
  const person = (
    <button
      type="button"
      onClick={onOpen}
      className="cg-state cg-focus"
      style={onOpenHistory ? { ...box, width: "auto", flex: 1, minWidth: 0, paddingRight: 0 } : box}
    >
      <MonogramAvatar name={name} size={40} src={src} />
      <span style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>{name}</span>
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>@{handle}</span>
      </span>
      {!onOpenHistory && <StanceValue pDirected={pDirected} pInterest={pInterest} />}
    </button>
  );
  if (!onOpenHistory) return person;
  return (
    <div style={{ ...box, padding: "0 16px 0 0", cursor: "default" }}>
      {person}
      <button
        type="button"
        onClick={onOpenHistory}
        aria-label={HISTORY_DOOR_LABEL}
        className="cg-state cg-focus cg-hit"
        style={{ flex: "none", display: "inline-flex", alignItems: "center", border: 0, background: "none", padding: "0 0 0 12px", borderRadius: "var(--radius-medium)", cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--on-surface)" }}
      >
        <StanceValue pDirected={pDirected} pInterest={pInterest} />
      </button>
    </div>
  );
}
