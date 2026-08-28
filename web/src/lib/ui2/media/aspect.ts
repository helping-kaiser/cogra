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

// The avatar and the cover are not post bodies and do not take a post shape
// (D13). They are listed here so every fixed ratio in the client has one home.
export const AVATAR_RATIO = 1;
export const COVER_RATIO = 1.91;

// The portrait cap, as a bound on the TILE rather than on the picture.
//
// Media that did not come through this composer — anything at 3:4, 2:3, 9:16 —
// is not shown taller than 4:5, but neither is it cut: the frame is fitted
// WHOLE inside the capped tile and the reserved surface shows at the sides. The
// layout never decides the author's crop. The bars stay a plain reserved
// surface and are never a blurred enlargement of the photo, which would invent
// image where there is none.
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
  const [width, height] = text.split(":");
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return w / h;
}

/**
 * Whether the frame is fitted whole inside the tile (letterboxed) or fills it.
 *
 * `contain` is the default for a lead tile and any lone attachment, because the
 * author's crop is theirs. `cover` is correct for exactly one case: a gallery's
 * secondary squares, which are an index INTO the set rather than the media
 * itself, and a ragged grid of fitted thumbnails reads as a mistake.
 */
export function fitFor(sourceRatio: number | null | undefined): "contain" | "cover" {
  if (typeof sourceRatio !== "number" || !Number.isFinite(sourceRatio) || sourceRatio <= 0) {
    return "cover";
  }
  // Only a frame TALLER than the cap gets letterboxed — everything else already
  // matches the tile it was cropped for, so `cover` and `contain` agree and
  // `cover` avoids a sub-pixel seam at the edges.
  return sourceRatio < PORTRAIT_CAP ? "contain" : "cover";
}
