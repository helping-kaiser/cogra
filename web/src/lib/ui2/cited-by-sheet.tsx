"use client";

// WHAT CITES THIS (`design/designs/canonical/screens/CitedBy.jsx`,
// `CommentCitedByEmpty.jsx`; design/readme.md item 55): the inbound mirror of
// the references a node declares. A post has always said what it points AT;
// this is the list of what points back.
//
// IT IS NOT `RefsSheet` WITH MORE IN IT. That sheet holds the tags and
// citations the AUTHOR signed, and the card's count IS that list's length — a
// law this sheet leaves exactly where it stands. These are other people's acts,
// by other authors, in a different order; folded together, neither number would
// be checkable.
//
// NEWEST-FIRST, AND THAT IS THE DEPARTURE. The opinions sheet is
// strongest-first. An opinions list is a STANDING, where the strongest position
// is the one worth reading; this is a CHRONICLE of acts — each happened at a
// moment, no citation outranks another, and what a reader comes for is what has
// just arrived. The server's terminal-anchored read already serves that order.
//
// THE ROWS ARE THE READING SIDE'S REFERENCE ROW, so an inbound citation reads
// exactly as an outbound one does: the kind's own mark, the artifact's name, and
// the pair its author signed on the act.
//
// NOTHING READ HERE REACHES A FEED. Inbound records are public topology and
// display only; only viewer-rooted forward paths shape a rank.

import type { ReactNode } from "react";

import type { CitingRecordView } from "@/lib/api/references-api";
import { nearestAnchor } from "@/lib/stance/anchors";
import { Icon } from "@/lib/ui/icons";
import { formatReferenceParamWords } from "@/lib/ui/reference-format";
import { formatStancePair } from "@/lib/ui/stance-format";
import { BottomSheet } from "./bottom-sheet";
import { ListRow } from "./list-row";
import { PairReadout } from "./pair-readout";

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

/** The 32px kind tile the reading-side rows share. */
function NodeTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-8 flex-none items-center justify-center rounded-small bg-surface-container-highest text-label-large text-on-surface-variant">
      {children}
    </span>
  );
}

/**
 * What the row names, drawn from the citing artifact. The kind rides in words
 * beside the name, which is what lets the leading mark stay decorative.
 *
 * A citing artifact this client cannot type still counts and still shows: it
 * keeps its row and simply offers no destination, the same contract
 * `RefsSheet` gives a citation whose far end it cannot address.
 */
function citingView(target: CitingRecordView["target"]): {
  label: string;
  kind: string;
  mark: ReactNode;
  href: string | undefined;
} {
  if (target?.__typename === "Post") {
    return {
      label: target.title.value ?? "",
      kind: "Post",
      mark: <NodeTile>T</NodeTile>,
      href: `/posts/${target.id}`,
    };
  }
  if (target?.__typename === "Comment") {
    // A citing comment opens the thread it answers, per the screen graph — a
    // comment has no surface of its own. One hop is what the document asks
    // for; a reply nested deeper keeps its row without a destination rather
    // than paying for a walk up the chain.
    const root = target.target?.__typename === "Post" ? target.target.id : null;
    return {
      label: target.content.value ?? "",
      kind: "Comment",
      mark: (
        <NodeTile>
          <Icon name="chat_bubble" size={18} />
        </NodeTile>
      ),
      href: root === null ? undefined : `/posts/${root}`,
    };
  }
  return { label: "", kind: "Reference", mark: <NodeTile>{null}</NodeTile>, href: undefined };
}

export function CitedBySheet({
  open,
  onClose,
  records,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  stacked = false,
  testId = "cited-by-sheet",
}: {
  open: boolean;
  onClose: () => void;
  records: readonly CitingRecordView[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** The comment path opens this over the thread's own sheet. */
  stacked?: boolean;
  testId?: string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={TITLE} stacked={stacked} testId={testId}>
      {records.length === 0 && (
        <p
          className="px-6 pb-2 text-body-medium text-on-surface-variant"
          data-testid={`${testId}-empty`}
        >
          {EMPTY}
        </p>
      )}
      {records.map((record) => {
        const view = citingView(record.target);
        const pair = { pDirected: record.pDirected, pInterest: record.pInterest };
        const anchor = nearestAnchor(pair);
        return (
          <ListRow
            key={record.id}
            testId={`${testId}-record-${record.id}`}
            mark={view.mark}
            title={view.label}
            kind={view.kind}
            href={view.href}
            trailing={
              <PairReadout
                emoji={anchor.emoji}
                exact={formatStancePair(pair)}
                spoken={formatReferenceParamWords(record.pDirected, record.pInterest)}
                pending={false}
                testId={`${testId}-record-${record.id}-pair`}
              />
            }
          />
        );
      })}
      {hasMore && (
        <button
          type="button"
          className="min-h-12 w-full px-6 text-left text-label-large text-primary"
          data-testid={`${testId}-more`}
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </BottomSheet>
  );
}
