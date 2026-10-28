"use client";

// WHO HOLDS AN OPINION ON THIS (`design/designs/canonical/screens/
// PostOpinions.jsx`, `CommentOpinionsEmpty.jsx`; PostOpinions.md,
// CommentOpinionsEmpty.md; design/readme.md item 55). The profile's "opinions
// on you", mirrored onto content — and UNGATED: everyone sees every row, the
// author no more than a stranger.
//
// THE COUNT IS THE LIST'S LENGTH (`RefsSheet`'s discipline): the detail's line
// says eight and eight rows stand here, one per PERSON — the fold over their
// records (`held-opinions.ts`), handed in whole, so a revised opinion is one
// row at its standing value.
//
// THE ROWS ARE `StanceRow`, the master the profile's own opinions page uses:
// the person, and their public opinion, its face leading and its pair riding
// the reading mode. Tapping one opens their profile, where acting on an
// opinion lives. Strongest first, by the for-or-against value, down past
// nothing into the ones held against — `ProfileStances`' order, so the order
// means the same thing wherever a reader meets it.
//
// A SHEET OF ROWS (`BottomSheet` `rows`): the rows run edge to edge carrying
// their own 16px gutter.

import type { HeldOpinionView } from "@/lib/api/opinions-api";
import { instance, part, type DataNode } from "@/lib/ui/data-node";
import { EmptyState } from "@/lib/ui/empty-state";
import { BottomSheet, SHEET_DEFAULT, SHEET_RAISED } from "./bottom-sheet";
import { StanceRow } from "./stance-row";

/**
 * The drawn titles (copy-voice, *The opinions list*): `Opinions on this post`
 * and `Opinions on this comment`. *Opinion* throughout, never *stance*.
 */
export const OPINIONS_TITLE = {
  post: "Opinions on this post",
  comment: "Opinions on this comment",
} as const;

/**
 * The empty line — reachable only from a comment's ⋮, since a post's line
 * drops away at zero. Calm, naming the one thing that would fill it; never a
 * scold, never the error colour.
 */
export const NO_OPINIONS = "No opinions yet — yours would be the first.";

export function OpinionsSheet({
  open,
  onClose,
  on,
  opinions,
  stacked = false,
  node,
  testId = "opinions-sheet",
}: {
  open: boolean;
  onClose: () => void;
  /** What the opinions are on — the title's noun. */
  on: keyof typeof OPINIONS_TITLE;
  /** One row per person, strongest first; null while the read is out. */
  opinions: readonly HeldOpinionView[] | null;
  /** The comment path opens this over the thread's own sheet. */
  stacked?: boolean;
  /**
   * The sheet's node on the detail (`postDetail.opinionsSheet`) — UNREGISTERED:
   * the PostOpinions board names no node, so this is the path it evidently
   * takes, reported to design.
   */
  node?: DataNode;
  testId?: string;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={OPINIONS_TITLE[on]}
      stacked={stacked}
      rows
      // The post's list is drawn at the raised class (PostOpinions, 88%); the
      // comment's, stacked over the thread, at the default (CommentOpinionsEmpty, 62%).
      maxHeight={stacked ? SHEET_DEFAULT : SHEET_RAISED}
      node={node}
      testId={testId}
    >
      {opinions !== null && opinions.length === 0 && (
        <div className="px-6 pb-2">
          <EmptyState title={NO_OPINIONS} testId={`${testId}-empty`} node={part(node, "empty")} />
        </div>
      )}
      {opinions?.map((opinion, index) => (
        <StanceRow
          key={opinion.authorId}
          name={opinion.holder.name}
          handle={opinion.holder.handle}
          src={opinion.holder.avatarUrl}
          redacted={opinion.holder.redacted}
          pair={opinion.pair}
          severed={opinion.severed}
          // The sheet is the door, not the destination: dropped as the row is
          // followed, so Back lands where the reader opened it from.
          onOpen={onClose}
          node={instance(node, "row", String(index + 1))}
          testId={`${testId}-row-${index + 1}`}
        />
      ))}
    </BottomSheet>
  );
}
