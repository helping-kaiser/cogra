import React from "react";
import { PendingMarker } from "../honesty/PendingMarker.jsx";
import { formatTagPair, nearestTagAnchor, SR_ONLY } from "../stance/StanceReadout.jsx";

/* One row of a tag's page (readme §13, the tag round): the claim that put this
   content here, and then the content itself.

   THE PAIR BELONGS TO THE ROW, NOT THE CARD. `taggedContent` hands back
   `{ node, relevance, confidence, pending }` (api-spec.md) — the node is the
   post or the comment, and the pair is a fact about the TAG RECORD pointing at
   it, not about the post. So the card is drawn by its own master, untouched,
   and the claim sits above it. Neither `PostCard` nor `CommentCard` learns
   anything about tags they did not already know, and no board that lists them
   elsewhere moves a pixel.

   THE PAIR IS PLAIN (jakob's ruling, the tag round). A signed act is public
   record, so it is simply shown — there is no reveal gesture here and none
   anywhere else on a content surface: a chip's tap goes to the tag's page, and
   what a node's own tags are worth is read in the tags-and-references sheet.
   `formatTagPair`'s shape says which family this is — relevance signed over
   [-1, +1], confidence unsigned over [0, 1].

   THE ROW WEARS THE TAG TABLE'S GLYPH (jakob's ruling, backlog item 53). The
   claim's nearest of the thirteen objects leads the flag and carries the
   reading; the exact pair rides a `cg-exact` span beside it and paints only in
   geek mode. The glyph is the lossy readout the row always needed — a reader
   who does not read numbers was being told nothing by this flag at all.

   THE PAIR ARRIVES AS NUMBERS, NOT AS A STRING. The row picks the glyph and
   the row formats the pair, from one value, so the two can never disagree and
   no screen can hand-type a format the contract does not use.

   "TAGGED" NEEDS NO NAME BESIDE IT. The page is titled by the tag, so
   repeating it on every row is noise; the word says which act the glyph and
   the numbers belong to, and they say what it claimed.

   THE SPOKEN READING IS ONE SPAN, and it is the same in both modes: an emoji's
   own accessible name is "magnifying glass tilted left", never "had to look,
   but it's in there", so the visible parts are `aria-hidden` and a
   screen-reader-only span names the claim and its values (§10).

   A CLAIM STILL IN FLIGHT SAYS SO, with the same marker every other
   unsettled record wears.

   THE CLAIM IS ATTACHED, NOT HOVERING (jakob's review, 2026-09-09, twice
   refined): the line draws as a flag flush with the screen's left edge, zero
   gap to the card, and the card squares its top-left corner under it
   (`attach` on the card masters) — so flag and card fuse into one
   folder-tab silhouette instead of a rounded card with a sticker floating
   near its curve. A free-floating line between cards belonged to neither
   neighbour. */

export function TaggedRow({ pair, pending = false, children }) {
  const anchor = nearestTagAnchor(pair);
  const exact = formatTagPair(pair);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: "var(--space-2)",
          padding: "2px 10px",
          background: "var(--surface-container-high)",
          borderRadius: "var(--radius-small) var(--radius-small) 0 0",
          fontSize: "var(--text-body-small)",
          lineHeight: "var(--text-body-small--line-height)",
          color: "var(--text-secondary)",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: "var(--text-body-medium)", lineHeight: 1 }}>{anchor.emoji}</span>
        <span aria-hidden="true">Tagged</span>
        <span className="cg-exact" aria-hidden="true" style={{ whiteSpace: "nowrap" }}>{exact}</span>
        <span style={SR_ONLY}>{`Tagged: ${anchor.label}, ${exact}`}</span>
        {pending && <PendingMarker />}
      </div>
      {children}
    </div>
  );
}
