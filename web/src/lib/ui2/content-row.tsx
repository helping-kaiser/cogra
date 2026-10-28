"use client";

// THE IDENTITY ROW (design/components/core/ContentRow.jsx): the card-lite line
// every list in the product is built from — a 40px disc saying who or what,
// two lines of words saying which and when, and whatever the list keeps on its
// trailing edge. One master, so the lists that reuse it (Saved first; the
// chronicle, notifications, the wallet, Hidden accounts later) cannot drift.
//
// THE DISC LEADS, BY PRECEDENCE, not by choice: a deleted account's reserved
// disc, else a picture, else a monogram for a name, else a stance face, else
// the kind's glyph.
//
// THE SECOND LINE IS ONE LINE, ellipsized, in every variant: a row in a list is
// scanned, not read.
//
// A ROW MAY CARRY ONE CONTROL OF ITS OWN (`action`) in the trailing-most slot,
// the chevron's. It does not take the trailing edge, which keeps its content
// inboard (on Saved that is when the reader saved the thing — the list's whole
// order). With an action the row splits into the pressable part and the
// control beside it, so a button never nests in a button.
//
// Only the variants this product draws today are here — the chronicle, and
// the door (Explore's Your topics); the others join with the list that
// first draws them.

import Link from "next/link";
import type { ReactNode } from "react";

import { bundleReadout, EMPTY_PICK_LABEL, ZERO_BUNDLE_EMOJI } from "@/lib/stance/anchors";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon, type GlyphName } from "@/lib/ui/icons";
import { formatStancePair, STANCE_SEVERANCE_WORDS } from "@/lib/ui/stance-format";
import { MonogramAvatar } from "./monogram-avatar";

/** The word a deleted account's row reads, in the system's voice (`ActorChip.jsx`). */
export const REDACTED_ACTOR_NAME = "Deleted account";

/**
 * `chronicle`: the second line is the thing's own words, so it takes body
 * type; the trailing edge is a TIME, a quiet fact, so it is not loud.
 */
export type ContentRowVariant = "chronicle" | "door";

export type ContentRowDisc =
  | { readonly kind: "picture"; readonly src: string; readonly name: string }
  | { readonly kind: "monogram"; readonly name: string }
  /**
   * A stance's face where a picture would go, no digits (the chronicle's
   * opinion row). A pair at exactly (0, 0) cannot say by its numbers whether
   * it was walked back or empty-signed, so the data says (ContentRow.jsx
   * `face.severed`, seam 245 ask 19): `severed` speaks `Walked back`; absent
   * or false, the (0, 0) says nothing — `Says nothing`.
   */
  | {
      readonly kind: "face";
      readonly pDirected: number;
      readonly pInterest: number;
      readonly severed?: boolean;
    }
  /** 🤷 where a picture would go, for a stance walked back (the withdrawal notification). */
  | { readonly kind: "walkedBack" }
  | { readonly kind: "glyph"; readonly glyph: GlyphName }
  /**
   * A kind with no glyph wears its letter (ContentRow.jsx `letter`): the `#`
   * every topic wears, in the door's filled `primary` disc.
   */
  | { readonly kind: "letter"; readonly letter: string }
  | { readonly kind: "redacted" };

/** The walk-back's zero word (`SEVERED_LABEL`), spoken only for a `severed` face. */
const SEVERED_LABEL = STANCE_SEVERANCE_WORDS.zero;

const ELLIPSIS ="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap";

function Disc({ disc }: { disc: ContentRowDisc }) {
  switch (disc.kind) {
    case "redacted":
      return <MonogramAvatar name="" redacted size={40} />;
    case "picture":
      return <MonogramAvatar name={disc.name} src={disc.src} size={40} />;
    case "monogram":
      return <MonogramAvatar name={disc.name} size={40} />;
    case "face": {
      // `StanceValue` with `showPair={false}` (StanceReadout.jsx): the face on
      // screen, the label and the exact pair spoken.
      const pair = { pDirected: disc.pDirected, pInterest: disc.pInterest };
      // WHICH (0, 0) THE ROW DRAWS, FROM THE ROW'S OWN DATA: only a standing
      // walked back speaks `Walked back` (ContentRow.jsx `zeroLabel`).
      const readout = bundleReadout(pair, disc.severed === true ? SEVERED_LABEL : EMPTY_PICK_LABEL);
      return (
        <span
          role="img"
          aria-label={`${readout.label}, ${formatStancePair(pair)}`}
          className="grid size-10 place-items-center rounded-full bg-surface-container-high text-title-medium"
        >
          <span aria-hidden="true">{readout.emoji}</span>
        </span>
      );
    }
    case "walkedBack":
      // ContentRow.jsx `face="walkedBack"`: 🤷, the system's own readout for a
      // bundle walked back to zero, at the face's treatment. Decorative — the
      // row's sentence says what happened.
      return (
        <span
          aria-hidden="true"
          className="grid size-10 place-items-center rounded-full bg-surface-container-high text-title-medium"
        >
          {ZERO_BUNDLE_EMOJI}
        </span>
      );
    case "glyph":
      return (
        <span className="grid size-10 place-items-center rounded-full bg-surface-container-high text-on-surface-variant">
          <Icon name={disc.glyph} size={20} />
        </span>
      );
    case "letter":
      return (
        <span
          aria-hidden="true"
          className="grid size-10 place-items-center rounded-full bg-primary text-title-medium text-on-primary"
        >
          {disc.letter}
        </span>
      );
  }
}

export function ContentRow({
  variant = "chronicle",
  title: titleGiven,
  titleAside: asideGiven,
  titleQuiet = false,
  second,
  trailing,
  disc,
  action,
  href,
  onOpen,
  node,
  testId,
  unread = false,
  sentence = false,
  titleId,
  chevron = variant === "door",
}: {
  /**
   * The chevron that says the row opens another surface (ContentRow.jsx
   * `chevron`, default on). A door draws it; a chronicle row that opens a
   * level of its own asks for it — the score trace's steps (RankPath.jsx).
   */
  chevron?: boolean;
  /** The title's element id, for a control that is described by it. */
  titleId?: string;
  variant?: ContentRowVariant;
  title: string;
  /**
   * Not yet opened: the bell's own dot at row scale, under the trailing edge,
   * spoken `New` (ContentRow.jsx `unread`).
   */
  unread?: boolean;
  /**
   * The title is a sentence that already names a deleted actor in prose (`A
   * deleted account commented on your post`, design digest item 18), so the
   * redacted disc keeps it rather than replacing it with the bare name.
   */
  sentence?: boolean;
  /** A word riding the title's baseline — Saved's `@handle`. */
  titleAside?: string;
  /** The title in the system's voice (`Removed by its author`), `text-secondary`. */
  titleQuiet?: boolean;
  /** One line under the title; a node (the row line) as well as words. */
  second?: ReactNode;
  trailing?: string;
  disc: ContentRowDisc;
  /** One control of the row's own, in the chevron's slot. */
  action?: ReactNode;
  /** Where the row opens. */
  href?: string;
  onOpen?: () => void;
  /** The registered row (`saved.list.entry`, keyed); its parts are named under it. */
  node?: DataNode;
  testId: string;
}) {
  // A DELETED ACCOUNT'S ROW (HA-3, design digest item 56): the reserved disc
  // and `Deleted account` in the system's voice, the aside dropped — anything
  // in the handle's place would invent one.
  const redacted = disc.kind === "redacted";
  const title = redacted && !sentence ? REDACTED_ACTOR_NAME : titleGiven;
  const aside = redacted ? undefined : asideGiven;
  const quiet = (redacted && !sentence) || titleQuiet;
  const heading = (
    <span
      id={titleId}
      className={`${ELLIPSIS} text-label-large ${quiet ? "text-on-surface-variant" : "text-on-surface"}`}
      {...testAttributes(part(node, "title"), `${testId}-title`)}
    >
      {title}
    </span>
  );
  const inner = (
    <>
      <span className="relative size-10 flex-none" {...testAttributes(part(node, "disc"))}>
        <Disc disc={disc} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        {aside !== undefined ? (
          <span className="flex min-w-0 items-baseline gap-2">
            {heading}
            <span
              className="flex-none text-label-small text-on-surface-variant"
              {...testAttributes(part(node, "aside"), `${testId}-aside`)}
            >
              {aside}
            </span>
          </span>
        ) : (
          heading
        )}
        {second !== undefined && second !== null && second !== "" && (
          <span
            className={`${ELLIPSIS} ${variant === "door" ? "text-label-small" : "text-body-medium"} text-on-surface-variant`}
            {...testAttributes(part(node, "second"), `${testId}-second`)}
          >
            {second}
          </span>
        )}
      </span>
      {(trailing !== undefined || unread) && (
        <span className="flex flex-none flex-col items-end gap-0.5">
          {trailing !== undefined && (
            <span
              // The master sets label-small's size, leading and tracking; the
              // weight is the ground's (ContentRow.jsx `TYPE`), a quiet fact.
              // Leading and tracking ride the style, read off the role's own
              // tokens, so a <button> and a <div> row draw one tracking.
              className="text-[length:var(--text-label-small)] text-on-surface-variant"
              style={{
                lineHeight: "var(--text-label-small--line-height)",
                letterSpacing: "var(--text-label-small--letter-spacing)",
              }}
              {...testAttributes(part(node, "trailing"), `${testId}-trailing`)}
            >
              {trailing}
            </span>
          )}
          {/* The shell's unread mark at row scale: a dot, never a weight
              change, so a list of unread rows stays a list. */}
          {unread && (
            <span
              role="img"
              aria-label="New"
              className="size-2 rounded-full bg-primary"
              {...testAttributes(part(node, "dot"), `${testId}-dot`)}
            />
          )}
        </span>
      )}
      {/* A DOOR LEADS SOMEWHERE, and says so with the chevron (ContentRow.jsx
          `chevron`), unless the row carries a control of its own. */}
      {chevron && action === undefined && (
        <span
          aria-hidden="true"
          className="inline-flex flex-none text-on-surface-variant"
          {...testAttributes(part(node, "chevron"))}
        >
          <Icon name="chevron_right" size={18} />
        </span>
      )}
    </>
  );
  // The press covers what the reader aimed at: with an action, the card's
  // padding moves onto the press (all but its right, which the box keeps) so
  // the state layer still spans the words.
  const pad = action !== undefined ? "p-3 pr-0" : "p-3";
  const pressClass = `cg-state cg-focus flex min-w-0 flex-1 items-center gap-3 rounded-medium ${pad} text-left no-underline text-on-surface`;
  const press =
    href !== undefined ? (
      <Link href={href} onClick={onOpen} className={pressClass} data-testid={`${testId}-open`}>
        {inner}
      </Link>
    ) : onOpen !== undefined ? (
      <button
        type="button"
        onClick={onOpen}
        className={`${pressClass} border-0 bg-transparent font-sans`}
        data-testid={`${testId}-open`}
      >
        {inner}
      </button>
    ) : (
      <div className={`flex min-w-0 flex-1 items-center gap-3 ${pad}`}>{inner}</div>
    );
  return (
    <div
      {...testAttributes(node, testId)}
      className={`flex items-center gap-3 rounded-medium bg-surface-container-highest ${action !== undefined ? "pr-3" : ""}`}
    >
      {press}
      {action !== undefined && <span className="inline-flex flex-none">{action}</span>}
    </div>
  );
}
