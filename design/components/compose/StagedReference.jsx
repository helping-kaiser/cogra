import React from "react";
import { NodeMark } from "../content/ReferenceRow.jsx";
import { Icon } from "../navigation/Icon.jsx";
import { BUTTON_CLASS } from "../core/Button.jsx";
import { formatStancePair, formatStanceWords, nearestAnchor, SR_ONLY } from "../stance/StanceReadout.jsx";

/* A reference already staged in a composer (item 17, the conformance round):
   the citation the author has committed to, shown back to them — the kind's
   mark, what it points at, the pair signed on the act, and the × that takes it
   back out.

   THE MARK IS `NodeMark`, so a person arrives as a circle and everything else
   as its tile. Citing a post and mentioning a person stage the same fact, and a
   row that drew them differently would deny it — which is the whole point of
   the menus round.

   IT IS THE COMPOSER'S TWIN OF `ReferenceRow`, not a variant of it. The reading
   row is a way in: it is pressable, it navigates, and it has no ×. This one
   navigates nowhere — the author is holding it, not following it. Two jobs, two
   rows, one mark.

   AND THE ROW IS A BUTTON WHEN, AND ONLY WHEN, THERE IS SOMETHING ELSE A
   CITATION IS FOR (`onEdit`, jakob's ruling 2026-09-10) — `TopicRemovable`'s
   rule, said for the other family. The conformance round left the row inert
   because removal was the only thing a staged citation was for; it no longer
   is. A citation's two axes are BOTH signed (`ReferenceInput`, api-spec.md), so
   unlike a tag's pair this one is `StancePad`'s own shape, and what the row
   opens is that pad in a sheet. Given no `onEdit` the row stays exactly as
   inert as the conformance round left it.

   EACH CONTROL NAMES ITS OWN CITATION — "Remove <name>", "<name> — set how it
   relates" — because a block of these is a block of identically-named controls
   otherwise. The phrase is the one a staged tag already wears: opening a pair
   editor is one gesture, whichever family the pair belongs to. */

/* The row minus its ×: the mark, what it points at, and the pair it signs. One
   markup whether or not it is pressable, so the drawing cannot drift between
   the two states.

   THE PAIR ARRIVES AS NUMBERS AND THE ROW FORMATS IT (backlog item 53). A
   citation signs both axes (`ReferenceInput`, api-spec.md), so it wears the
   stance shape; the digits ride a `cg-exact` span and paint only in geek mode
   (readme §13), with a screen-reader-only twin so nothing spoken moves with
   the setting.

   AND THE FACE IS WHAT IS LEFT WHEN THEY DO NOT PAINT (jakob's ruling, the
   geek round — backlog item 53.3). The citation's two axes fill the slots
   `STANCE_ANCHORS` is drawn over, so the row reads the twenty faces, the same
   lookup `RefPair`'s readout uses. The anchor's WORD does not come with it:
   it names a feeling about a stance and this record is a citation, so the
   spoken reading stays the pair exactly.

   UNLESS THE PAIR IS A STANCE IN ITS OWN RIGHT (`stance`, the kept picks'
   review, 2026-10-01). A kept pick is an opinion waiting to be signed, not a
   citation, and its row reads the pair the way `StanceReadout` does — so the
   spoken twin is the readout's own, the anchor's word and both axes named
   (`Nice, For or against +0.10, How much reaches you +0.10`), and the drawing
   is unchanged.

   A KEPT PICK'S TWO ROW STATES (jakob 2026-10-02, kept picks 2 and 3).
   `removed` is the target's removal mark — `Removed by its author`, `Deleted
   account` — for a target removed or redacted while the pick waited: nothing
   leaves the graph, so the row stays and the pick still signs, but it wears
   the standard removed-mark face instead of a live preview — the mark's tile
   empty (`NodeMark`'s `redacted`), the mark's line in the name's place in the
   system's voice, `text-secondary` at the body's weight, as a comment's head
   row over a removed post reads. `consequence` is a pick that would net its
   bundle to nothing: the row says so inline, in the family's own landing
   words, the way `Remove citation` says its cost where the control is — Sign
   is the confirmation, and no dialog follows.

   A STANDING CITATION WEARS THE SAME FACE (jakob 2026-10-05, the 134
   residue's 3a): on an edit, a citation whose target was removed keeps its
   row, its pair and both its controls, with the removal mark in the name's
   place. The controls name the row by its mark too, never by the removed
   name: the × `Remove this citation: Post, Removed by its author` (a kept
   pick's says `pick`), and the row `Post, Removed by its author — set how it
   relates` (both blessed, jakob 2026-10-05). */
function Body({ kind, name, sub, src, pair, stance, removed, consequence, node }) {
  const exact = pair ? formatStancePair(pair) : null;
  const anchor = pair ? nearestAnchor(pair) : null;
  const spoken = pair && stance ? `${anchor.label}, ${formatStanceWords(pair)}` : exact;
  return (
    <>
      {/* The row stands on `surface-container-highest`, the tile's own tone,
          so its mark takes the card tone (`NodeMark`'s `onCard`, jakob's
          ruling on the tag card's `#`) — a staged tag's `#` would vanish
          into the row otherwise. */}
      <NodeMark kind={kind} name={name} src={src} onCard redacted={Boolean(removed)} node={node && "mark"} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            ...(removed ? { fontWeight: 400, color: "var(--text-secondary)" } : null),
          }}
          data-node={node && "name"}
        >
          {removed || name}
        </span>
        {sub && (
          <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }} data-node={node && "kind"}>
            {sub}
          </span>
        )}
        {consequence && (
          <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }} data-node={node && "consequence"}>
            {consequence}
          </span>
        )}
      </span>
      {exact && (
        <>
          <span
            aria-hidden="true"
            style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}
            data-node={node && "pair"}
          >
            <span style={{ fontSize: "var(--text-body-medium)", lineHeight: 1 }} data-node={node && "face"}>
              {anchor.emoji}
            </span>
            <span className="cg-exact" data-node={node && "exact"}>
              {exact}
            </span>
          </span>
          <span style={SR_ONLY}>{spoken}</span>
        </>
      )}
    </>
  );
}

export function StagedReference({ kind = "post", name, sub, src, pair, stance = false, removed, consequence, onRemove, onEdit, node, nodeKey }) {
  const body = <Body kind={kind} name={name} sub={sub} src={src} pair={pair} stance={stance} removed={removed} consequence={consequence} node={node} />;
  // A removed target is named by its mark, never by the name it no longer shows.
  const markName = removed ? `${sub ? `${sub}, ` : ""}${removed}` : name;
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "8px 12px", borderRadius: "var(--radius-small)", background: "var(--surface-container-highest)", boxSizing: "border-box" }}
      data-node={node}
      data-node-key={nodeKey}
    >
      {/* The button adds no box of its own — no border, no background, no
          padding, ink inherited — so the row is the row it always was, and the
          state layer, the focus ring and the 48px target arrive with
          `BUTTON_CLASS`. */}
      {onEdit ? (
        <button
          type="button"
          aria-label={`${markName} — set how it relates`}
          onClick={onEdit}
          className={BUTTON_CLASS}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, border: 0, background: "none", padding: 0, borderRadius: "var(--radius-small)", color: "inherit", font: "inherit", letterSpacing: "inherit", textAlign: "left", cursor: "pointer" }}
        >
          {body}
        </button>
      ) : (
        body
      )}
      <button
        type="button"
        aria-label={removed ? `Remove this ${stance ? "pick" : "citation"}: ${markName}` : `Remove ${name}`}
        onClick={onRemove}
        className="cg-state cg-focus"
        style={{ flex: "none", display: "grid", placeItems: "center", height: 32, width: 32, border: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer", padding: 0 }}
        data-node={node && "remove"}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
