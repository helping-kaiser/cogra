// The shapes a post's media can take, and the one rule that bounds them.
//
// THREE POST SHAPES, chosen at compose and applied to the whole set (D17): the
// author picks one, every picture in the post is cropped to it, and the stored
// bytes are the cropped bytes. There is no per-post shape field anywhere —
// the assets' shared ratio IS the record of the choice.
//
// 4:5 IS THE TALLEST, and that is not a taste call: it is what guarantees the
// feed card's height cap. A 9:16 tile eats a phone screen whole, which is the
// opposite of a scrollable feed.

export const POST_SHAPES = {
  // The order the crop screen draws them in.
  tall: { label: "Tall 4:5", ratio: 4 / 5, css: "4 / 5" },
  square: { label: "Square 1:1", ratio: 1, css: "1 / 1" },
  wide: { label: "Wide 1.91:1", ratio: 1.91, css: "1.91 / 1" },
} as const;

export type PostShape = keyof typeof POST_SHAPES;

export const POST_SHAPE_ORDER: readonly PostShape[] = ["tall", "square", "wide"];

// The avatar is not a post body and does not take a post shape (D13). It is
// listed here so every fixed ratio in the client has one home.
export const AVATAR_RATIO = 1;

// The portrait cap, as a bound on the TILE rather than on the picture.
export const PORTRAIT_CAP = 4 / 5;

/**
 * The ratio a tile reserves for a given source ratio: the source itself, unless
 * it is taller than the 4:5 cap, in which case the cap.
 *
 * A non-finite or non-positive input means the server has not probed the asset
 * yet; the square is the neutral reservation rather than a collapsed box.
 */
export function tileRatio(sourceRatio: number | null | undefined): number {
  if (typeof sourceRatio !== "number" || !Number.isFinite(sourceRatio) || sourceRatio <= 0) {
    return 1;
  }
  return Math.max(sourceRatio, PORTRAIT_CAP);
}

/** The same value as a CSS `aspect-ratio`, which is what reserves the space. */
export function cssRatio(ratio: number): string {
  return `${ratio} / 1`;
}

/**
 * `MediaOptions.aspectRatio` as a number.
 *
 * The server derives the shape from the bytes and states it in lowest terms —
 * "4:5", "1:1", "540:283". Null comes back where the asset has no probed shape,
 * and a malformed or degenerate value is treated the same way rather than
 * producing a NaN that would collapse a tile: the caller's own fallback (a
 * square) is the honest reservation for "shape unknown".
 */
export function parseAspectRatio(text: string | null | undefined): number | null {
  if (typeof text !== "string") return null;
  const parts = text.split(":");
  // Exactly two parts. Reading the first two of three would silently accept
  // "4:5:6" as 4:5, which is a shape nobody stated.
  if (parts.length !== 2) return null;
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return w / h;
}

/**
 * The tile's `object-fit`. Always `cover` — nothing is letterboxed
 * (design/components/media/MediaAttachment.jsx:34, jakob 2026-09-03: the
 * media law). `sourceRatio` stays in the signature so call sites need no
 * change; the fit itself is unconditional now.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for a stable signature, per the doc comment above.
export function fitFor(sourceRatio: number | null | undefined): "contain" | "cover" {
  return "cover";
}
