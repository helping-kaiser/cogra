"use client";

// THE SHAPE EVERY NUMBER TAKES (design/components/core/ExplainableNumber.jsx):
// a quiet figure that opens its own explanation, never the explanation
// itself. The product's one figure is the Feed score every ranked card wears,
// and its explanation is four screens deep (`FeedEntry` and below).
//
// - A GLYPH, NOT A WORD: `graph`, with the label in the accessibility tree,
//   which keeps the affordance row on one line.
// - The figure is drawn in BOTH reading modes (readme §13): geek mode governs
//   the pairs, and a score has no glyph that could carry its magnitude.
// - NEGATIVE IS ORDINARY: a minus, never a colour.
// - NO VALUE, NO FIGURE: a thing still settling stands as the bare glyph, and
//   the door still opens (ruling 90); the dash is a value, passed as one.
//
// IT IS A LINK. The master's `onOpenDetail` goes to another screen, and on the
// web a control that navigates is an anchor — middle-click, the status bar and
// the history all behave. `onOpen` runs on the tap, before the navigation, so
// the opener can hand the screen what it already holds.

import Link from "next/link";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon, type GlyphName } from "@/lib/ui/icons";

export function ExplainableNumber({
  label,
  value,
  glyph,
  href,
  onOpen,
  overMedia = false,
  pending,
  node,
  testId,
}: {
  /**
   * THE MEDIA DRESS (`ExplainableNumber.jsx` `overMedia`; the stream's rail):
   * white glyph and figure under a soft shadow, because a token colour on
   * photography is not a quiet control but an invisible one.
   */
  overMedia?: boolean;
  /** The spoken name; with a glyph it lives only in the accessibility tree. */
  label: string;
  /** Already formatted. Omitted, the glyph stands bare — a figure still settling. */
  value?: string;
  glyph: GlyphName;
  /** The explanation's screen. */
  href: string;
  onOpen?: () => void;
  /**
   * A PENDING MARK'S WORDS UNDER THE BARE GLYPH, INSIDE THE DOOR
   * (`ExplainableNumber.jsx` `pending`, round 26, seam 250): the stream's
   * settling face is the glyph with `Still settling` under it, and the whole
   * face is the door. The glyph row keeps the 48px it stood in, so the glyph
   * does not move; the words are the node's `settling` part. Given, no figure
   * is drawn. A client face — no field on the wire says it.
   */
  pending?: string;
  /** The registered slot (`feed.card.actionRow.score`); its figure is `value`, its pending mark `settling`. */
  node?: DataNode;
  testId?: string;
}) {
  const figure = pending === undefined ? value : undefined;
  return (
    <Link
      href={href}
      onClick={onOpen}
      // THE NAME SPEAKS THE FIGURE (`Feed score 15.20`), or the pending mark
      // (`Feed score Still settling`): the label lives in the accessibility
      // tree, and a sr-only span beside the digits would run the two together
      // (`Feed score15.20`) in the computed name.
      aria-label={pending !== undefined ? `${label} ${pending}` : figure === undefined ? label : `${label} ${figure}`}
      {...testAttributes(node, testId)}
      className={
        pending === undefined
          ? "cg-state cg-focus cg-hit -mx-2 inline-flex min-h-12 flex-none items-center gap-1.5 rounded-full px-2 text-[length:var(--text-body-small)] [line-height:normal] text-on-surface-variant"
          : "cg-state cg-focus cg-hit -mx-2 inline-flex flex-none flex-col items-center gap-0.5 rounded-full px-2 text-[length:var(--text-body-small)] [line-height:normal] text-on-surface-variant"
      }
      // A literal, as the master's: the media dress reads over any frame in
      // both themes (`ExplainableNumber.jsx:65-67`).
      style={overMedia ? { color: "#fff", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" } : undefined}
    >
      {pending !== undefined ? (
        <>
          <span className="inline-flex min-h-12 items-center">
            <Icon name={glyph} size={18} />
          </span>
          <span
            className="text-center text-label-small"
            style={{ maxWidth: 56, ...(overMedia ? { color: "#fff" } : undefined) }}
            {...testAttributes(part(node, "settling"), testId === undefined ? undefined : `${testId}-settling`)}
          >
            {pending}
          </span>
        </>
      ) : (
        <Icon name={glyph} size={18} />
      )}
      {figure !== undefined && (
        <span
          className="text-on-surface [font-weight:500]"
          style={overMedia ? { color: "#fff" } : undefined}
          {...testAttributes(part(node, "value"))}
        >
          {figure}
        </span>
      )}
    </Link>
  );
}
