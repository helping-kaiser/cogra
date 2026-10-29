"use client";

// WHAT CITES THIS (`design/designs/canonical/screens/CitedBy.jsx`,
// `CommentCitedByEmpty.jsx`; CitedBy.md, CommentCitedByEmpty.md; design/readme.md
// item 55): the inbound mirror of the references a node declares. A post has
// always said what it points AT; this is the list of what points back.
//
// IT IS NOT `RefsSheet` WITH MORE IN IT. That sheet holds the tags and
// citations the AUTHOR signed, and the card's count IS that list's length — a
// law this sheet leaves exactly where it stands. These are other people's acts,
// by other authors, in a different order; folded together, neither number would
// be checkable.
//
// ONE ROW PER STANDING CITATION, and exactly as many as the detail's `Cited by
// N` counts (CitedBy.md): the rows are the fold over the records
// (`citing-fold.ts`), handed in whole — a revised citation is one row at its
// net, a withdrawn one is none.
//
// NEWEST-FIRST, AND THAT IS THE DEPARTURE. The opinions sheet is
// strongest-first. An opinions list is a STANDING, where the strongest position
// is the one worth reading; this is a CHRONICLE of acts — each happened at a
// moment, no citation outranks another, and what a reader comes for is what has
// just arrived.
//
// THE ROWS ARE `ReferenceRow`, so an inbound citation reads exactly as an
// outbound one does: the kind's own mark — a media post its cover — the
// artifact's name, and the pair its author signed on the act, its digits the
// geek reading. A sheet of rows (`BottomSheet` `rows`): the rows run edge to
// edge carrying their own 24px gutter.
//
// NOTHING READ HERE REACHES A FEED. Inbound records are public topology and
// display only; only viewer-rooted forward paths shape a rank.

import type { CitingArtifactView, CitingTarget } from "@/lib/api/references-api";
import { postTitle } from "@/lib/saved/row-content";
import { postPreview, removalMark } from "@/lib/stance/kept-preview";
import { instance, part, type DataNode } from "@/lib/ui/data-node";
import { EmptyState } from "@/lib/ui/empty-state";
import { BottomSheet, SHEET_DEFAULT, SHEET_RAISED } from "./bottom-sheet";
import { ReferenceRow, type ReferenceKind } from "./reference-row";

/**
 * The drawn title, on both doors. A comment's sheet is titled the same as a
 * post's: the surface the reader tapped from says what "this" is, and a title
 * that repeated it would be the only place in the product that did.
 */
const TITLE = "Cited by";

/**
 * The empty line, reachable only from a comment's ⋮ — a post's count line drops
 * away at zero. `No opinions yet — yours would be the first.`'s twin, and kept
 * a twin on purpose: the two sheets are reached the same way, from the same
 * menu, and a reader who has met one should recognize the other.
 */
const EMPTY = "Nothing cites this yet — yours would be the first.";

/**
 * What the row names, drawn from the citing artifact.
 *
 * A citing artifact this client cannot type still counts and still shows: it
 * keeps its row and simply offers no destination, the same contract
 * `RefsSheet` gives a citation whose far end it cannot address. A REMOVED
 * artifact keeps its row too, its mark emptied and its name the removal's own
 * mark — the citation is still a fact, its payload is what went.
 */
function citingView(target: CitingTarget | null): {
  kind: ReferenceKind;
  name: string;
  src: string | null;
  href: string | null;
  redacted: boolean;
} {
  if (target?.__typename === "Post") {
    const removed = removalMark(target.removal);
    return {
      kind: "post",
      name: removed ?? postTitle(target),
      src: removed === null ? postPreview(target).src : null,
      href: `/posts/${target.id}`,
      redacted: removed !== null,
    };
  }
  if (target?.__typename === "Comment") {
    // A citing comment opens the thread it answers, per the screen graph — a
    // comment has no surface of its own. One hop is what the document asks
    // for; a reply nested deeper keeps its row without a destination rather
    // than paying for a walk up the chain.
    const root = target.target?.__typename === "Post" ? target.target.id : null;
    const removed = removalMark(target.removal);
    return {
      kind: "comment",
      name: removed ?? target.content.value ?? "",
      src: null,
      href: root === null ? null : `/posts/${root}`,
      redacted: removed !== null,
    };
  }
  return { kind: "post", name: "", src: null, href: null, redacted: false };
}

export function CitedBySheet({
  open,
  onClose,
  artifacts,
  stacked = false,
  node,
  testId = "cited-by-sheet",
}: {
  open: boolean;
  onClose: () => void;
  /** The standing citations, newest first; null while the read is out. */
  artifacts: readonly CitingArtifactView[] | null;
  /** The comment path opens this over the thread's own sheet. */
  stacked?: boolean;
  /**
   * The sheet's node on the detail (`postDetail.citedBySheet`, nodes.json
   * CitedBy): each row a `citation` keyed by its place, newest first, from 1.
   */
  node?: DataNode;
  testId?: string;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={TITLE}
      stacked={stacked}
      rows
      // The post's list is drawn at the raised class (CitedBy, 88%); the
      // comment's, stacked over the thread, at the default (CommentCitedByEmpty, 62%).
      maxHeight={stacked ? SHEET_DEFAULT : SHEET_RAISED}
      node={node}
      testId={testId}
    >
      {artifacts !== null && artifacts.length === 0 && (
        <div className="px-6 pb-2">
          <EmptyState title={EMPTY} testId={`${testId}-empty`} node={part(node, "empty")} />
        </div>
      )}
      {artifacts?.map((artifact, index) => {
        const view = citingView(artifact.target);
        return (
          <ReferenceRow
            key={artifact.key}
            kind={view.kind}
            name={view.name}
            src={view.src}
            redacted={view.redacted}
            href={view.href}
            // The sheet is the door, not the destination: dropped as a row is
            // followed, so Back lands where the reader opened it from.
            onOpen={onClose}
            pair={artifact.pair}
            // The chronicle serves ordered fact only (api-spec.md: "the record
            // set has no pending namespace"), so a row read from it has landed.
            pending={false}
            node={instance(node, "citation", String(index + 1))}
            testId={`${testId}-row-${index + 1}`}
          />
        );
      })}
    </BottomSheet>
  );
}
