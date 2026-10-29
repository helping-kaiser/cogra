import React from "react";
import { MonogramAvatar, REDACTED_ACTOR_NAME } from "./ActorChip.jsx";
import { EMPTY_PICK_LABEL, SEVERED_LABEL, StanceValue } from "../stance/StanceReadout.jsx";

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
   the single element every existing list already draws.

   V1.0 PASSES NO HISTORY DOOR (readme §13, the scope cut's F-1): no canonical
   screen hands `onOpenHistory`, so every V1.0 row is the single element and
   no door exists. The change-histories round wires it. */

/* What the value's own target is called. A readout names its value, never its
   destination, so the door needs a spoken name of its own; `HISTORY_DOOR_TAIL`
   is the same promise in the words the pad's label wears. */
export const HISTORY_DOOR_LABEL = "See how this opinion built";

/* WHICH (0, 0) THE ROW DRAWS IS THE ROW'S DATA (seam 245, ask 19). A stance
   at exactly (0, 0) wears 🤷 either way, but its numbers cannot tell a
   standing walked back to nothing from one an empty sign joined, and the
   spoken word differs — `Walked back` is false of the second. So the row
   carries the bundle's own `severed`: walked back speaks `Walked back`;
   absent or false, the (0, 0) `Says nothing`. */
/* `node` / `nodeKey` are the data-node name and key its placer gives the row
   (seam 248) — keyed by the holder's handle. The row takes them, and names
   its parts `avatar`, `name`, `handle` and `value` (the readout's `face` and
   `exact` inside it); the history door, where it stands, is `history`. Given
   none, the row renders exactly as before. */
/* A DELETED ACCOUNT'S ROW (round 27, seam 252): `ActorChip`'s law at row
   scale, as `ContentRow`'s `redacted` is — the reserved disc, `Deleted
   account` in the system's voice in `text-secondary`, and no handle line,
   since printing one would invent a handle the reader could try to reach. The
   opinion it holds or is held by stays, read as any row's. The row is still a
   door: a deleted account's page is reached by structure that still points at
   it (`ProfileDeleted`). Its placer names it `redactedRow`, keyed by the
   actor's id — `row`'s rule names the handle, and a registered rule is never
   reworded (ruling 56(c), `redactedAccount`'s precedent). */
export function StanceRow({ name: nameGiven, handle, src, redacted = false, pDirected, pInterest, severed = false, onOpen, onOpenHistory, node, nodeKey }) {
  const name = redacted ? REDACTED_ACTOR_NAME : nameGiven;
  const zeroLabel = severed ? SEVERED_LABEL : EMPTY_PICK_LABEL;
  const box = { display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box", minHeight: 56, border: 0, background: "none", padding: "6px 16px", cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--on-surface)", textAlign: "left" };
  const named = (own) => (own ? { "data-node": node, "data-node-key": node && nodeKey } : null);
  const person = (
    <button
      type="button"
      onClick={onOpen}
      className="cg-state cg-focus"
      style={onOpenHistory ? { ...box, width: "auto", flex: 1, minWidth: 0, paddingRight: 0 } : box}
      {...named(!onOpenHistory)}
    >
      <MonogramAvatar name={name} size={40} src={redacted ? undefined : src} redacted={redacted} node={node && "avatar"} />
      <span style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)", ...(redacted ? { color: "var(--text-secondary)" } : null) }} data-node={node && "name"}>{name}</span>
        {!redacted && <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }} data-node={node && "handle"}>@{handle}</span>}
      </span>
      {!onOpenHistory && <StanceValue pDirected={pDirected} pInterest={pInterest} zeroLabel={zeroLabel} node={node && "value"} />}
    </button>
  );
  if (!onOpenHistory) return person;
  return (
    <div style={{ ...box, padding: "0 16px 0 0", cursor: "default" }} {...named(true)}>
      {person}
      <button
        type="button"
        onClick={onOpenHistory}
        aria-label={HISTORY_DOOR_LABEL}
        className="cg-state cg-focus cg-hit"
        style={{ flex: "none", display: "inline-flex", alignItems: "center", border: 0, background: "none", padding: "0 0 0 12px", borderRadius: "var(--radius-medium)", cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--on-surface)" }}
        data-node={node && "history"}
      >
        <StanceValue pDirected={pDirected} pInterest={pInterest} zeroLabel={zeroLabel} node={node && "value"} />
      </button>
    </div>
  );
}
