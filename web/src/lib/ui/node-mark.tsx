// A kind's mark — `design/components/content/ReferenceRow.jsx` `NodeMark` —
// a post's cover where it has one, else the text post's `T`; a comment's
// glyph; a topic's `#`, the same `#` its chip wears. A REMOVED target keeps
// the tile's space and fills it with nothing (FeedCommentShapes.md: "an empty
// tile"), the way a redacted disc does.
//
// ON A CARD THE TILE TAKES THE DARKER TONE (`onCard`, the master's own prop):
// a card — and a staged row — stands on `surface-container-highest`, the
// tile's own tone, so the tile there wears `surface-container-high`. Off a
// card, as in a picker's result list, it keeps `surface-container-highest`.
// The comment feed card's head row and the tag feed card's lead and glimpse
// are cards, which is why `onCard` is the default.

import { Icon } from "./icons";
import { testAttributes, type DataNode } from "./data-node";

export function NodeMark({
  kind,
  src,
  redacted = false,
  onCard = true,
  size = 32,
  testId,
  node,
}: {
  /** The tile's side in px: 32 on a row; the score's trace draws it at the trace's size. */
  size?: number;
  kind: "post" | "comment" | "topic";
  /** A post's cover, or a clip's still; null draws the text post's letter. */
  src?: string | null;
  redacted?: boolean;
  onCard?: boolean;
  testId?: string;
  /** The registered node the tile is (`composeDetails.references.stagedReference.mark`, `history.tagCard.mark`). */
  node?: DataNode;
}) {
  const ids = testAttributes(node, testId);
  const box = { width: size, height: size };
  const tile = `grid flex-none place-items-center overflow-hidden rounded-small ${
    onCard ? "bg-surface-container-high" : "bg-surface-container-highest"
  } text-on-surface-variant`;
  if (redacted) return <span aria-hidden="true" {...ids} style={box} className={tile} />;
  if (kind === "post" && src) {
    return (
      <span aria-hidden="true" {...ids} style={box} className={tile}>
        {/* A decorative 32px thumbnail of a picture the row names in words. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- a 32px decorative tile, never a layout image */}
        <img src={src} alt="" className="size-full object-cover" />
      </span>
    );
  }
  return (
    // The letter takes title-medium's SIZE and WEIGHT and nothing else
    // (ReferenceRow.jsx `NodeMark`): the tile centres it, so the role's
    // leading would only be a line box the master never draws.
    <span
      aria-hidden="true"
      {...ids}
      className={`${tile} text-[length:var(--text-title-medium)]`}
      style={{ ...box, fontWeight: "var(--text-title-medium--font-weight)", lineHeight: "normal" }}
    >
      {kind === "post" ? "T" : kind === "topic" ? "#" : <Icon name="chat_bubble" size={18} />}
    </span>
  );
}
