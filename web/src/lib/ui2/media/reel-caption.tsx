"use client";

// THE STREAM'S CAPTION (`design/components/media/ReelCaption.jsx`; readme §13,
// the reel round) — the post's words along the bottom of the clip, in the
// card's own budget: the handle, the title, and the description clamped to two
// lines with the same `More` opener a card carries. "A stream that spends more
// than that on words is a feed with a video behind it" (ReelCaption.prompt.md).
//
// - THE WORDS ARE THE DESCRIPTION, never a body: a clip post's body is its
//   media (post.md's words-XOR-media).
// - A TEXT SHADOW, NEVER A PLATE: a panel behind the words would cover the
//   frame they sit on.
// - IT CLEARS THE RAIL (right 76) and stands 66px above the bar, so `More`'s
//   48px target meets the seek line's without overlapping (Reel.md:15;
//   Reel.jsx:28-31).
// - THE STREAM'S OWN LINE RIDES AT ITS HEAD (`notice`): the last clip's line
//   and the load that did not come, on the stream's plate (Reel.md:41, :45).
// - A SENSITIVE POST'S CAPTION VEILS AS A CARD'S DOES (ReelSensitive.md:11):
//   the description blurs in place behind the text veil with `Show`, the
//   handle and the title stay readable, and `Show` belongs to the post's one
//   reveal — the same tap that unveils the clip unveils these words.

import { useState, type ReactNode } from "react";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";

/** The text veil's word (`SensitiveVeil kind="text"` `revealLabel`). */
export const SHOW = "Show";

export function ReelCaption({
  handle,
  title,
  description,
  bottom,
  notice,
  veiled = false,
  onReveal,
  node,
  testId = "reel-caption",
}: {
  handle: string | null;
  title: string | null;
  description: string | null;
  /** Distance from the surface's bottom edge (`BAND_HEIGHT + 66`). */
  bottom: string;
  /** The stream's line at the caption's head, on its plate. */
  notice?: ReactNode;
  /** The description stands under the text veil (ReelSensitive.md:11). */
  veiled?: boolean;
  /** `Show` on the text veil — the post's one reveal. */
  onReveal?: () => void;
  node?: DataNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const words = description !== null && description !== "" ? description : null;
  const clamp = (
    <span
      {...testAttributes(part(node, "description"), `${testId}-description`)}
      // Size only, as drawn (ReelCaption.jsx:62-74): the clamp's two lines
      // stand in the caption's inherited line box.
      className="text-[length:var(--text-body-small)]"
      style={
        open
          ? undefined
          : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }
      }
    >
      {words}
    </span>
  );
  return (
    <div
      {...testAttributes(node, testId)}
      className="absolute flex flex-col"
      style={{ left: 16, right: 76, bottom, gap: 4, zIndex: 3, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
    >
      {notice}
      {handle !== null && (
        // The board sets the role's SIZE and WEIGHT only (ReelCaption.jsx:48-50);
        // the line box is the caption's own, inherited.
        <span
          {...testAttributes(part(node, "handle"), `${testId}-handle`)}
          className="text-[length:var(--text-label-large)] [font-weight:var(--text-label-large--font-weight)]"
        >
          @{handle}
        </span>
      )}
      {title !== null && title !== "" && (
        <span {...testAttributes(part(node, "title"), `${testId}-title`)} className="text-title-small">
          {title}
        </span>
      )}
      {words !== null &&
        (veiled ? (
          // THE VEIL WRAPS THE CLAMPED LINE, never the text inside it — the
          // clamp clips first, so the blur's halo stays soft on every side
          // (ReelCaption.jsx:35-37; `SensitiveVeil kind="text"`).
          <span className="inline-flex max-w-full items-baseline" style={{ gap: 8 }}>
            <span aria-hidden="true" className="min-w-0 select-none" style={{ filter: "blur(6px)", opacity: 0.75 }}>
              {clamp}
            </span>
            <button
              type="button"
              onClick={onReveal}
              {...testAttributes(part(node, "show"), `${testId}-show`)}
              className="cg-state cg-focus cg-hit flex-none cursor-pointer border-0 bg-transparent p-0 font-sans text-label-small text-on-surface-variant underline"
            >
              {SHOW}
            </button>
          </span>
        ) : (
          clamp
        ))}
      {words !== null && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((shown) => !shown)}
          {...testAttributes(part(node, "more"), `${testId}-more`)}
          className="cg-state cg-focus cg-hit cursor-pointer self-start border-0 bg-transparent font-sans text-[length:var(--text-label-medium)] [font-weight:var(--text-label-medium--font-weight)] [line-height:normal]"
          style={{ padding: "2px 0", color: "#fff" }}
        >
          {open ? "Less" : "More"}
        </button>
      )}
    </div>
  );
}
