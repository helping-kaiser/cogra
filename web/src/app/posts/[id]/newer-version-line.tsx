"use client";

// THE EDITED-WHILE-YOU-READ LINE (`postDetail.newerVersion`; drawn 2026-10-12,
// `_shared.jsx` `EditedSinceLine`, PostDetail.md:7-13). One line between the
// detail's header and its post, standing while a fresh read has found another
// version of the post, its tags or its citations than the one the reader
// opened; its tap swaps that version in place and the line goes.
//
// IN THE PAGE'S FLOW, NEVER PINNED (PostDetail.md:11): it scrolls away with the
// page beneath the header that does pin. Full width — the caller stands it in
// the edge-to-edge block the post's card heads, so it meets the screen's sides
// as the card does, its words inset 16px like the card's own content — and the
// row itself is the 48px target, 12px above the post (`DetailColumn`'s gap).
// `label-medium` in `primary`, "because it is an offer and a fact at once"
// (`_shared.jsx`).
//
// ANNOUNCED POLITELY: "it is news, not a fault". The live region stands in the
// tree whether or not the line does, because a region mounted together with its
// words is not reliably announced — assistive technology announces a CHANGE
// to a region it is already watching (WAI-ARIA 1.2, `aria-live`). Empty, it
// is nothing at all to the layout: the block it stands in has no gap of its
// own, so an empty region moves nothing.

import { testAttributes, type DataNode } from "@/lib/ui/data-node";

/** The drawn line, verbatim (PostDetail.md:7; copy-voice.md, "Honesty phrasings"). */
export const NEWER_VERSION_LINE = "Edited since you opened it — tap for the newest version.";

export function NewerVersionLine({
  shown,
  onSwap,
  node,
}: {
  shown: boolean;
  onSwap: () => void;
  node?: DataNode;
}) {
  return (
    <div role="status" aria-live="polite" className={shown ? "pb-3" : undefined}>
      {shown && (
        <button
          type="button"
          onClick={onSwap}
          className="cg-state cg-focus flex w-full items-center border-0 bg-transparent px-4 text-left text-label-medium text-primary"
          style={{ minHeight: "var(--touch-target-min)" }}
          {...testAttributes(node, "post-newer-version")}
        >
          {NEWER_VERSION_LINE}
        </button>
      )}
    </div>
  );
}
