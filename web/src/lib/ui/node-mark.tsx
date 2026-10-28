// A kind's mark — `design/components/content/ReferenceRow.jsx` `NodeMark` —
// in the placements the cards draw it: the comment feed card's head row,
// naming what the comment answers, and the tag card's lead and glimpse. A
// post's mark is its cover where it has one, else the text post's `T`; a
// comment's is its glyph; a topic's is `#`. A REMOVED target keeps the tile's
// space and fills it with nothing (FeedCommentShapes.md: "an empty tile"), the
// way a redacted disc does.
//
// THE MARK SITS ON THE CARD (`onCard`), so it takes the darker tile tone a
// card's own surface needs to read against.

import { testAttributes, type DataNode } from "./data-node";
import { Icon } from "./icons";

export function NodeMark({
  kind,
  src,
  redacted = false,
  testId,
  node,
}: {
  kind: "post" | "comment" | "topic";
  /** A post's cover, or a clip's still; null draws the text post's letter. */
  src?: string | null;
  redacted?: boolean;
  testId?: string;
  /** The registered mark (`history.tagCard.mark`). */
  node?: DataNode;
}) {
  const ids = testAttributes(node, testId);
  const tile =
    "grid size-8 flex-none place-items-center overflow-hidden rounded-small bg-surface-container-high text-on-surface-variant";
  if (redacted) return <span aria-hidden="true" {...ids} className={tile} />;
  if (kind === "post" && src) {
    return (
      <span aria-hidden="true" {...ids} className={tile}>
        {/* A decorative 32px thumbnail of a picture the row names in words. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- a 32px decorative tile, never a layout image */}
        <img src={src} alt="" className="size-full object-cover" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" {...ids} className={`${tile} text-title-medium`}>
      {kind === "comment" ? <Icon name="chat_bubble" size={18} /> : kind === "topic" ? "#" : "T"}
    </span>
  );
}
