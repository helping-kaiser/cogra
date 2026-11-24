"use client";

// The tags-and-references sheet (`design/designs/canonical/screens/RefsSheet.jsx`,
// design/readme.md §13): the card's counts open it, and every signed act on the
// node gets a full row — leading mark, name, and the pair the author signed on
// it. One row shape across every node kind.
//
// THIS SHEET IS THE REVEAL, AND THE ONLY ONE (jakob's ruling, the tag round). A
// chip's tap goes to the tag's page on every surface, so there is no expanding
// chip and no second gesture that shows a value: what a node's tags are worth is
// read here, in the list that already exists to hold them.
//
// THE TWO SECTIONS COUNT IN DIFFERENT UNITS, AND THE ROWS SAY SO. A tag's
// confidence is census-bounded to [0, 1] (hashtag.md §4), so it wears no sign —
// `+0.40 / 0.90`. A citation's second axis is support over [-1, +1]
// (`ReferenceClaim.support`), so it keeps one — `+0.10 / +0.10`. `formatTagPair`
// and `formatStancePair` are where the difference is assigned, and the faces
// come from two disjoint tables for the same reason.
//
// AND THIS SHEET IS WHERE "STILL SETTLING" SHOWS (jakob's ruling, 2026-09-10).
// The chip on the card says nothing about an act still finding its place in the
// order — a tag's word is the tag's word either way — so the honesty lands here,
// on the row that already carries the act's own numbers. It rides the PAIR, not
// the name: what has not landed is the ACT, not the node it points at.
//
// THE COUNT IS THE LIST'S LENGTH (jakob's ruling, 2026-09-10). A reference
// counts whatever kind of node it points at, so the card's number and the rows
// under References are the same set — including a citation whose far end this
// instance cannot type, which still names itself by its L1 identifier. A count
// that quietly dropped a kind would tell a reader the sheet holds less than it
// does, and this sheet is the only place the number can be checked.

import type { ReactNode } from "react";

import { bundleReadout } from "@/lib/stance/anchors";
import { tagReadout } from "@/lib/topics/anchors";
import { SEVERED_LABEL } from "@/lib/ui/stance-readout";
import type { ReferenceClaimNode } from "@/lib/references/claims";
import { targetView, untypedTargetView } from "@/lib/references/normalize";
import type { ReferenceTargetView } from "@/lib/references/draft";
import { personHref, tagPageHref } from "@/lib/ui/back-origin";
import { Button } from "@/lib/ui/button";
import { TransportError } from "@/lib/ui/transport-error";
import { SLOW_ANSWER_MS, useWaitedPast } from "@/lib/ui2/waiting-commit";
import { Icon } from "@/lib/ui/icons";
import { formatReferenceParamWords } from "@/lib/ui/reference-format";
import { formatStancePair } from "@/lib/ui/stance-format";
import { formatTagPair, formatTagParamWords } from "@/lib/ui/tag-format";
import { BottomSheet, SHEET_RAISED } from "./bottom-sheet";
import { ListRow } from "./list-row";
import { MonogramAvatar } from "./monogram-avatar";
import { PairReadout } from "./pair-readout";

/** A standing tag claim, as every content document serves it. */
export type TopicClaimNode = {
  readonly hashtag: { readonly name: { readonly value?: string | null } };
  readonly relevance: number;
  readonly confidence: number;
  readonly pending: boolean;
};

/** The drawn title, and the two captions over the groups. */
const TITLE = "Tags & references";
const TAGS_LABEL = "Tags";
const REFERENCES_LABEL = "References";

/**
 * A quiet section caption (`SectionLabel.jsx`): the small secondary word that
 * names a group. It is a caption, not a heading — what it names is already
 * visible underneath it — and its padding is asymmetric on purpose, so the
 * label sits with the group it opens rather than floating between two of them.
 * The sheet's body carries the gutter.
 */
function SectionLabel({ children }: { children: string }) {
  return (
    <span className="block pt-3 pb-1 text-label-small text-on-surface-variant">{children}</span>
  );
}

/**
 * The leading mark says the kind, without a word beside it (`ReferenceRow.jsx`).
 * A person keeps their avatar — people are circles everywhere in this system —
 * and every other kind is a 32px tile: a topic the same # its chip wears, a post
 * the letter T, a comment its node glyph.
 *
 * A MEDIA POST WEARS ITS COVER IN THE MASTER AND ITS TILE HERE. The cover is not
 * on the wire: `ReferenceClaimFields`' `Post` branch selects the title, the body
 * and the author, and pulling each cited post's gallery would add a list read per
 * citation to every feed card's query. So a cited post takes the master's own
 * no-`src` path, which is the letter tile.
 */
function NodeTile({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-small bg-surface-container-highest text-title-medium text-on-surface-variant"
    >
      {children}
    </span>
  );
}

/**
 * The kind in words, which is what makes the leading mark decorative rather
 * than load-bearing (`ListRow`). A citation at a person is a MENTION — the
 * target's class is the whole distinction between quoting, embedding and
 * mentioning (D2) — and a claim this instance cannot type is a reference and
 * nothing more precise.
 */
function referenceKind(view: ReferenceTargetView): string {
  switch (view.kind) {
    case "User":
      return "Mention";
    case "Post":
      return "Post";
    case "Comment":
      return "Comment";
    default:
      return "Reference";
  }
}

function referenceMark(view: ReferenceTargetView): ReactNode {
  switch (view.kind) {
    case "User":
      // The monogram is the DESIGNED placeholder rather than a gap waiting for a
      // photo, so a mention needs no avatar on the wire to draw its circle.
      return <MonogramAvatar name={view.displayName ?? view.label} size={32} tier="md" />;
    case "Post":
      return <NodeTile>T</NodeTile>;
    case "Comment":
      return (
        <NodeTile>
          <Icon name="chat_bubble" size={18} />
        </NodeTile>
      );
    default:
      // A citation this instance cannot type still counts and still shows: the
      // board draws no mark for a kind it does not know, so the tile carries
      // none rather than claiming a class the client cannot read.
      return <NodeTile>{null}</NodeTile>;
  }
}

export function RefsSheet({
  open,
  onClose,
  topics,
  references,
  failed = false,
  onRetry,
  from = null,
  here = null,
  testId = "refs-sheet",
}: {
  open: boolean;
  onClose: () => void;
  topics: readonly TopicClaimNode[];
  /**
   * The node's citations; null while their read is out. A card carries only
   * the count (`referenceCount`), so its sheet reads the rows by id as it
   * opens (`useReferencesOnOpen`); the detail's own post hands its list.
   */
  references: readonly ReferenceClaimNode[] | null;
  /** The rows' read got no answer: the house line, over Retry. */
  failed?: boolean;
  onRetry?: () => void;
  /**
   * The origin the rows' doors carry: the post's on its detail, so the tag's
   * page reads `Back to the post` (TagPage.md:35), the card's list elsewhere.
   */
  from?: string | null;
  /**
   * The canonical name of the tag whose page the sheet is raised over: its row
   * would open the page it is on, so it is the same row, inert — no link, as
   * the tag's chip on that page (jakob, hand test 2026-11-23).
   */
  here?: string | null;
  testId?: string;
}) {
  // THE SHEET IS THE DOOR, NOT THE DESTINATION. A row that navigated left the
  // sheet open behind it, and the opener remembers that flag — so Back
  // restored the surface AND raised the sheet over it again, with no way out
  // but a second Back. Dropping it as the row is followed is what makes Back
  // land where the reader opened it from.
  //
  // THE ROWS' WAIT IS THE HOUSE LADDER (readme §4, *Loading*; seam 431): under
  // 200ms nothing shows, then `Loading…` stands where the rows will, and a read
  // with no answer says the house line over `Retry`, as the thread's own read
  // does (`comments-sheet.tsx`). The tags are on the card already and never wait.
  const reading = open && references === null && !failed;
  const late = useWaitedPast(reading, SLOW_ANSWER_MS);
  return (
    <BottomSheet open={open} onClose={onClose} title={TITLE} testId={testId} maxHeight={SHEET_RAISED}>
      {topics.length > 0 && <SectionLabel>{TAGS_LABEL}</SectionLabel>}
      {topics.map((claim) => {
        const name = claim.hashtag.name.value ?? "";
        // `TaggedRow`'s face: the tag twin of the choke point (seam 243).
        const anchor = tagReadout(claim.relevance, claim.confidence);
        const exact = formatTagPair(claim.relevance, claim.confidence);
        return (
          <ListRow
            key={name}
            testId={`${testId}-topic-${name}`}
            mark={<NodeTile>#</NodeTile>}
            title={name}
            kind="Tag"
            // `RefsSheet` 1: a tag row goes to the tag's page, the one
            // destination a chip's tap already has on every other surface.
            href={here !== null && name === here ? undefined : tagPageHref(name, from)}
            onNavigate={onClose}
            trailing={
              <PairReadout
                emoji={anchor.emoji}
                exact={exact}
                // THE WORD COMES WITH THE TAG AND NOT WITH THE CITATION: a tag
                // anchor's word names a degree of aboutness and is true of the
                // row, where a stance anchor's names a feeling about a stance,
                // which a citation is not.
                spoken={`${anchor.label}, ${formatTagParamWords(claim.relevance, claim.confidence)}`}
                pending={claim.pending}
                testId={`${testId}-topic-${name}-pair`}
              />
            }
          />
        );
      })}
      {late && (
        <p role="status" aria-live="polite" data-testid={`${testId}-loading`} className="py-3 text-body-medium">
          Loading…
        </p>
      )}
      {references === null && failed && (
        <div className="flex items-center gap-3 py-3">
          <TransportError testId={`${testId}-error`} />
          <Button testId={`${testId}-retry`} variant="outline" size="sm" onClick={() => onRetry?.()}>
            Retry
          </Button>
        </div>
      )}
      {references !== null && references.length > 0 && <SectionLabel>{REFERENCES_LABEL}</SectionLabel>}
      {(references ?? []).map((claim) => {
        const view =
          claim.target === null || claim.target === undefined
            ? untypedTargetView(claim.targetId)
            : targetView(claim.target, claim.targetId);
        const pair = { pDirected: claim.relevance, pInterest: claim.support };
        // `ReferenceRow`'s face: the value's own (seam 243); only the glyph
        // is drawn, a citation's anchor word is never spoken.
        const anchor = bundleReadout(pair, SEVERED_LABEL);
        // A person's row names the sheet's origin on their profile
        // (ProfileOther.md:73, `Back to the post` from a post's references).
        const href =
          view.kind === "User" && view.href !== null && view.handle !== undefined
            ? personHref(view.handle, from)
            : view.href;
        return (
          <ListRow
            key={claim.targetId}
            testId={`${testId}-reference-${claim.targetId}`}
            mark={referenceMark(view)}
            title={view.label}
            kind={referenceKind(view)}
            // `RefsSheet` 2: the referenced node's own surface. The two this
            // client can address are the profile and the post; a citation whose
            // far end it cannot type has no destination and stays a plain row.
            href={href ?? undefined}
            onNavigate={onClose}
            trailing={
              <PairReadout
                emoji={anchor.emoji}
                exact={formatStancePair(pair)}
                spoken={formatReferenceParamWords(claim.relevance, claim.support)}
                pending={claim.pending}
                testId={`${testId}-reference-${claim.targetId}-pair`}
              />
            }
          />
        );
      })}
    </BottomSheet>
  );
}
