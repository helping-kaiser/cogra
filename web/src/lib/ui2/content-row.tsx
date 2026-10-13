"use client";

// THE IDENTITY ROW (design/components/core/ContentRow.jsx): the card-lite line
// every list in the product is built from — a 40px disc saying who or what,
// two lines of words saying which and when, and whatever the list keeps on its
// trailing edge. One master, so the lists that reuse it (Saved first; the
// chronicle, notifications, the wallet, Hidden accounts later) cannot drift.
//
// THE DISC LEADS, BY PRECEDENCE, not by choice: a deleted account's reserved
// disc, else a picture, else a monogram for a name, else the kind's glyph.
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
// Only the variant this product draws today is here; the others join with the
// list that first draws them.

import Link from "next/link";
import type { ReactNode } from "react";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon, type GlyphName } from "@/lib/ui/icons";
import { MonogramAvatar } from "./monogram-avatar";

/** The word a deleted account's row reads, in the system's voice (`ActorChip.jsx`). */
export const REDACTED_ACTOR_NAME = "Deleted account";

/**
 * `chronicle`: the second line is the thing's own words, so it takes body
 * type; the trailing edge is a TIME, a quiet fact, so it is not loud.
 */
export type ContentRowVariant = "chronicle";

export type ContentRowDisc =
  | { readonly kind: "picture"; readonly src: string; readonly name: string }
  | { readonly kind: "monogram"; readonly name: string }
  | { readonly kind: "glyph"; readonly glyph: GlyphName }
  | { readonly kind: "redacted" };

const ELLIPSIS = "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap";

function Disc({ disc }: { disc: ContentRowDisc }) {
  switch (disc.kind) {
    case "redacted":
      return <MonogramAvatar name="" redacted size={40} />;
    case "picture":
      return <MonogramAvatar name={disc.name} src={disc.src} size={40} />;
    case "monogram":
      return <MonogramAvatar name={disc.name} size={40} />;
    case "glyph":
      return (
        <span className="grid size-10 place-items-center rounded-full bg-surface-container-high text-on-surface-variant">
          <Icon name={disc.glyph} size={20} />
        </span>
      );
  }
}

export function ContentRow({
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
}: {
  variant?: ContentRowVariant;
  title: string;
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
  const title = redacted ? REDACTED_ACTOR_NAME : titleGiven;
  const aside = redacted ? undefined : asideGiven;
  const quiet = redacted || titleQuiet;
  const heading = (
    <span
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
            className={`${ELLIPSIS} text-body-medium text-on-surface-variant`}
            {...testAttributes(part(node, "second"), `${testId}-second`)}
          >
            {second}
          </span>
        )}
      </span>
      {trailing !== undefined && (
        <span
          className="flex-none text-label-small text-on-surface-variant"
          {...testAttributes(part(node, "trailing"), `${testId}-trailing`)}
        >
          {trailing}
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
