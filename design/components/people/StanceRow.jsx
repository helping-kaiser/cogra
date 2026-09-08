import React from "react";
import { MonogramAvatar } from "./ActorChip.jsx";
import { StanceValue } from "../stance/StanceReadout.jsx";

/* A person on a stances list (item 17, the conformance round): their face,
   their name, and THE STANCE THE ROW IS ABOUT (jakob 2026-09-01) — the
   record's own value, read-only.

   THE VALUE IS THE ROW'S INFORMATION, which is what makes this row different
   from every followers list it resembles. A follow is a fact you either have
   or don't, so such a list shows only who. A stance has a sign and a
   magnitude, so a list of stances that showed only who would be hiding the
   part that says anything.

   IT IS READ-ONLY, AND THE WHOLE ROW OPENS THE PERSON. There is no adjust
   control here: acting on a stance means going to the profile it is about,
   where the pad and its context live. A slider in a list row would let someone
   change a public record while scrolling past it. */

export function StanceRow({ name, handle, src, pDirected, pInterest, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cg-state cg-focus"
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box", minHeight: 56, border: 0, background: "none", padding: "6px 16px", cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--on-surface)", textAlign: "left" }}
    >
      <MonogramAvatar name={name} size={40} src={src} />
      <span style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>{name}</span>
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>@{handle}</span>
      </span>
      <StanceValue pDirected={pDirected} pInterest={pInterest} />
    </button>
  );
}
