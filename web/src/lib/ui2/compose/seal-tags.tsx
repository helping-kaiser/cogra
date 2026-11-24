"use client";

// THE SEAL'S TAGS ROW, MEASURED (design/designs/canonical/screens/_shared.jsx
// `sealTagsRow`, round 62; readme, the seal's Tags row): at most two readout
// chips, and only while they fit the value slot WHOLE. A readout chip is never
// cut — what a signature will carry is being read back — so a tag too long for
// the slot (a name up to 128 characters) folds the row to its count, `1 tag`,
// and the row becomes the door to the sheet that lists the tags, as it does
// past two. The board judges fit on the strings; the clients run the same fold
// measured. One hook for both seals (`sealTagsRow` is one factory: "the reply
// seal mirrors the post seal exactly", seam 254 item 10).
//
// HOW IT MEASURES: the value slot is the acts card's `flex-1` cell, so its
// width never depends on what it holds. The row's value is wrapped in a block
// that fills that cell (`data-seal-tags-slot`), and the chips stand in it at
// their natural width (`data-seal-tags-probe`) — out of flow once folded, as
// `TopicsLine`'s probe is. The two are compared before paint and again
// whenever the slot resizes.

import { useCallback, useRef, useState, type ReactNode } from "react";

import { useMeasureEffect } from "@/lib/ui/measure-effect";
import { ReadoutChip } from "@/lib/ui2/chip";

/** How many chips the Tags row holds before it counts (`TAGS_ROW_HOLDS`). */
export const TAGS_ROW_HOLDS = 2;

/** The folded row's words: `1 tag`, `3 tags` (`tagsRow`'s `value`). */
export function tagsCountWords(count: number): string {
  return count === 1 ? "1 tag" : `${count} tags`;
}

/** The folded row's accessible name: `Manage the 1 tag` (`tagsRow`'s `openLabel`). */
export function manageTagsLabel(count: number): string {
  return `Manage the ${count} ${count === 1 ? "tag" : "tags"}`;
}

const CHIPS = "flex items-center gap-1.5";

/**
 * Whether the Tags row folds to its count, and the row's value for either
 * reading. `folded` is true past `TAGS_ROW_HOLDS`, and true too when the chips
 * together are wider than the slot.
 */
export function useSealTagsFold(names: readonly string[]): {
  folded: boolean;
  value: ReactNode;
} {
  const slotRef = useRef<HTMLSpanElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const [tooWide, setTooWide] = useState(false);
  const many = names.length > TAGS_ROW_HOLDS;

  const measure = useCallback(() => {
    const slot = slotRef.current;
    const probe = probeRef.current;
    if (!slot || !probe) return;
    // Half a pixel of slack: subpixel layout never folds a row that fits.
    setTooWide(probe.getBoundingClientRect().width > slot.getBoundingClientRect().width + 0.5);
  }, []);

  const fitting = names.join("\n");
  useMeasureEffect(() => {
    measure();
    const slot = slotRef.current;
    if (!slot || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    return () => observer.disconnect();
  }, [measure, fitting]);

  const folded = many || tooWide;
  // ONE STRIP OF CHIPS, at its natural width (`w-max`) either way, so the fit
  // is read off the same boxes the reader sees: in flow while it fits, and
  // out of flow, invisible and out of the accessibility tree once the row
  // counts — it costs the folded row nothing, and the reader hears the door
  // once, never the names twice.
  const strip = many ? null : (
    <span
      ref={probeRef}
      data-seal-tags-probe=""
      aria-hidden={folded ? "true" : undefined}
      className={`${CHIPS} w-max${folded ? " pointer-events-none invisible absolute top-0 left-0" : ""}`}
    >
      {names.map((name) => (
        <ReadoutChip key={name}>#{name}</ReadoutChip>
      ))}
    </span>
  );
  const value = (
    <span ref={slotRef} data-seal-tags-slot="" className="relative block min-w-0 truncate">
      {folded && tagsCountWords(names.length)}
      {strip}
    </span>
  );
  return { folded, value };
}
