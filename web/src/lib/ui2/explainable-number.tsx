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
  node,
  testId,
}: {
  /** The spoken name; with a glyph it lives only in the accessibility tree. */
  label: string;
  /** Already formatted. Omitted, the glyph stands bare — a figure still settling. */
  value?: string;
  glyph: GlyphName;
  /** The explanation's screen. */
  href: string;
  onOpen?: () => void;
  /** The registered slot (`feed.card.actionRow.score`); its figure is `value`. */
  node?: DataNode;
  testId?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onOpen}
      // THE NAME SPEAKS THE FIGURE (`Feed score 15.20`): the label lives in
      // the accessibility tree, and a sr-only span beside the digits would
      // run the two together (`Feed score15.20`) in the computed name.
      aria-label={value === undefined ? label : `${label} ${value}`}
      {...testAttributes(node, testId)}
      className="cg-state cg-focus cg-hit -mx-2 inline-flex min-h-12 flex-none items-center gap-1.5 rounded-full px-2 text-[length:var(--text-body-small)] [line-height:normal] text-on-surface-variant"
    >
      <Icon name={glyph} size={18} />
      {value !== undefined && (
        <span className="text-on-surface [font-weight:500]" {...testAttributes(part(node, "value"))}>
          {value}
        </span>
      )}
    </Link>
  );
}
