import React from "react";
import { NodeMark } from "../content/ReferenceRow.jsx";
import { Icon } from "../navigation/Icon.jsx";
import { BUTTON_CLASS } from "../core/Button.jsx";
import { formatStancePair, SR_ONLY } from "../stance/StanceReadout.jsx";

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
   unlike a tag's pair this one is the stance pad's own shape, and what the row
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
   the setting. */
function Body({ kind, name, sub, src, pair }) {
  const exact = pair ? formatStancePair(pair) : null;
  return (
    <>
      <NodeMark kind={kind} name={name} src={src} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
        {sub && <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>{sub}</span>}
      </span>
      {exact && (
        <>
          <span className="cg-exact" aria-hidden="true" style={{ flex: "none", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{exact}</span>
          <span style={SR_ONLY}>{exact}</span>
        </>
      )}
    </>
  );
}

export function StagedReference({ kind = "post", name, sub, src, pair, onRemove, onEdit }) {
  const body = <Body kind={kind} name={name} sub={sub} src={src} pair={pair} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "8px 12px", borderRadius: "var(--radius-small)", background: "var(--surface-container-highest)", boxSizing: "border-box" }}>
      {/* The button adds no box of its own — no border, no background, no
          padding, ink inherited — so the row is the row it always was, and the
          state layer, the focus ring and the 48px target arrive with
          `BUTTON_CLASS`. */}
      {onEdit ? (
        <button
          type="button"
          aria-label={`${name} — set how it relates`}
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
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        className="cg-state cg-focus"
        style={{ flex: "none", display: "grid", placeItems: "center", height: 32, width: 32, border: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer", padding: 0 }}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
