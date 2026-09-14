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

import { nearestAnchor } from "@/lib/stance/anchors";
import { nearestTagAnchor } from "@/lib/topics/anchors";
import type { ReferenceClaimNode } from "@/lib/references/claims";
import { targetView, untypedTargetView } from "@/lib/references/normalize";
import type { ReferenceTargetView } from "@/lib/references/draft";
import { Icon } from "@/lib/ui/icons";
import { PendingMarker } from "@/lib/ui/pending-marker";
import { formatReferenceParamWords } from "@/lib/ui/reference-format";
import { formatStancePair } from "@/lib/ui/stance-format";
import { formatTagPair, formatTagParamWords } from "@/lib/ui/tag-format";
import { BottomSheet } from "./bottom-sheet";
import { ListRow } from "./list-row";
import { MonogramAvatar } from "./monogram-avatar";

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
      return <MonogramAvatar name={view.displayName ?? view.label} size={32} />;
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

/**
 * The row's right edge: the face, the exact pair, and — stacked under them —
 * the settling mark. The face is the quick read and the numbers carry the fact;
 * every hidden number has a screen-reader-only twin, because the visual pairing
 * of glyph and digits says nothing on its own.
 */
function PairReadout({
  emoji,
  exact,
  spoken,
  pending,
  testId,
}: {
  emoji: string;
  exact: string;
  spoken: string;
  pending: boolean;
  testId: string;
}) {
  return (
    <span className="flex flex-none flex-col items-end whitespace-nowrap text-body-small text-on-surface-variant">
      <span aria-hidden="true" className="inline-flex items-center gap-1" data-testid={testId}>
        <span>{emoji}</span>
        <span>{exact}</span>
      </span>
      <span className="sr-only">{spoken}</span>
      {pending && <PendingMarker inline testId={`${testId}-pending`} />}
    </span>
  );
}

export function RefsSheet({
  open,
  onClose,
  topics,
  references,
  testId = "refs-sheet",
}: {
  open: boolean;
  onClose: () => void;
  topics: readonly TopicClaimNode[];
  references: readonly ReferenceClaimNode[];
  testId?: string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={TITLE} testId={testId}>
      {topics.length > 0 && <SectionLabel>{TAGS_LABEL}</SectionLabel>}
      {topics.map((claim) => {
        const name = claim.hashtag.name.value ?? "";
        const anchor = nearestTagAnchor(claim.relevance, claim.confidence);
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
            href={`/topics/${name}`}
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
      {references.length > 0 && <SectionLabel>{REFERENCES_LABEL}</SectionLabel>}
      {references.map((claim) => {
        const view =
          claim.target === null || claim.target === undefined
            ? untypedTargetView(claim.targetId)
            : targetView(claim.target, claim.targetId);
        const pair = { pDirected: claim.relevance, pInterest: claim.support };
        const anchor = nearestAnchor(pair);
        const href = view.href;
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
