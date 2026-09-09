import React from "react";
import { PendingMarker } from "../honesty/PendingMarker.jsx";

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

   "TAGGED" NEEDS NO NAME BESIDE IT. The page is titled by the tag, so
   repeating it on every row is noise; the word says which act the numbers
   belong to, and the numbers say what it claimed.

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
        <span>Tagged</span>
        <span style={{ whiteSpace: "nowrap" }}>{pair}</span>
        {pending && <PendingMarker />}
      </div>
      {children}
    </div>
  );
}
