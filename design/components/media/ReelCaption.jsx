import React from "react";
import { SensitiveVeil } from "../honesty/SensitiveVeil.jsx";

/* THE STREAM'S CAPTION (readme §13, the reel round) — the post's words along the
   bottom of the clip, in the card's own budget: the handle, the title, and the
   body clamped to two lines with the same `More` opener a card carries. A
   stream that spends more than that on words is a feed with a video behind it.

   IT KEEPS CLEAR OF THE RAIL on the right and of the bottom bar below, and it
   carries a text shadow rather than a plate, for the same reason the rail's
   glyphs do: a panel behind the words would cover the frame they sit on.

   The author's face is NOT here — it is the rail's first item, because people
   lead in this product and the rail is where the acts on a person begin.

   THE WORDS ARE THE DESCRIPTION, never a body: a clip post's body is its media,
   so the words beside it are the caption (post.md's words-XOR-media).

   A SENSITIVE POST'S CAPTION VEILS THE WAY A CARD'S DOES (`SensitiveVeil`'s
   law, `PostCard`'s idiom): the description blurs in place behind the
   `text` veil, the handle and the title stay readable so choosing to look is
   informed, and the reveal belongs to the post's one `SensitiveScope` — the
   same tap that unveils the clip unveils these words.

   `More` ANSWERS TO 48px (readme §4, the K13 round): `cg-hit` grows its target
   around the word, which keeps its ink. There is no real option; the floor is
   ruled. */

/* THE STREAM'S OWN LINE RIDES AT THE CAPTION'S HEAD (`notice`, jakob
   2026-10-12, the slice-3 round): the last clip's line and the load that did
   not come stand on a `ReelPlate` above the handle, so the caption keeps its
   place and the line reads first. */
/* NAMED ONLY WHEN PLACED NAMED (the data-node join): the caption names its
   `handle`, `title`, `description`, the veil's `show` and `More`'s `more`; the
   line at its head is the placer's (`notice`, on its plate). The veil names
   only its control, a leaf beside the words it blurs, so the description's
   path holds in both states. */
export function ReelCaption({ handle, title, description, bottom = 86, onMore, sensitive = false, notice, node }) {
  // The veil wraps the clamped line, never the text inside it — the clamp clips
  // first, so the blur's halo stays soft on every side (PostCard's reason).
  const veiled = (words) => (sensitive ? <SensitiveVeil kind="text" node={node && "show"}>{words}</SensitiveVeil> : words);
  return (
    <div
      data-node={node}
      style={{
        position: "absolute",
        left: 16,
        right: 76,
        bottom: `${bottom}px`,
        zIndex: 3,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        color: "#fff",
        textShadow: "0 1px 4px rgba(0,0,0,0.6)",
      }}
    >
      {notice}
      {handle && (
        <span style={{ fontSize: "var(--text-label-large)", fontWeight: "var(--text-label-large--font-weight)" }} data-node={node && "handle"}>@{handle}</span>
      )}
      {title && (
        <span
          data-node={node && "title"}
          style={{
            fontSize: "var(--text-title-small)",
            lineHeight: "var(--text-title-small--line-height)",
            fontWeight: "var(--text-title-small--font-weight)",
          }}
        >
          {title}
        </span>
      )}
      {description && veiled(
        <span
          data-node={node && "description"}
          style={{
            fontSize: "var(--text-body-small)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {description}
        </span>
      )}
      {description && (
        <button
          type="button"
          onClick={onMore ?? (() => {})}
          data-node={node && "more"}
          className="cg-state cg-focus cg-hit"
          style={{
            alignSelf: "flex-start",
            border: 0,
            background: "none",
            padding: "2px 0",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-label-medium)",
            fontWeight: "var(--text-label-medium--font-weight)",
            color: "#fff",
          }}
        >
          More
        </button>
      )}
    </div>
  );
}
