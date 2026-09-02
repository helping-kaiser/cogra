// @vitest-environment node
//
// The animated-GIF scanner, over GIFs built byte by byte to the GIF89a spec.
// Fixtures rather than real files, because what has to be proven is that the
// BLOCK STRUCTURE is walked correctly — the colour tables skipped at their
// declared sizes, extensions stepped over, sub-block chains followed — and a
// binary fixture proves none of that when it passes.

import { describe, expect, it } from "vitest";

import { countGifFrames, isAnimatedGif, isGifFile, sniffGif } from "./gif";

/** Assembles a GIF from parts, so each test states only what it is about. */
function gif({
  globalTable = 0,
  frames = 1,
  localTable = 0,
  extensions = 0,
  trailer = true,
}: {
  globalTable?: number;
  frames?: number;
  localTable?: number;
  extensions?: number;
  trailer?: boolean;
} = {}): Uint8Array<ArrayBuffer> {
  const out: number[] = [];
  for (const ch of "GIF89a") out.push(ch.charCodeAt(0));
  // Logical screen descriptor: width, height, packed, background, ratio.
  const globalPacked = globalTable === 0 ? 0x00 : 0x80 | (globalTable - 1);
  out.push(1, 0, 1, 0, globalPacked, 0, 0);
  if (globalTable > 0) out.push(...new Array(3 * 2 ** globalTable).fill(0));

  for (let i = 0; i < extensions; i += 1) {
    // A Graphic Control Extension: introducer, label, then sub-blocks.
    out.push(0x21, 0xf9, 4, 0, 0, 0, 0, 0);
  }

  for (let i = 0; i < frames; i += 1) {
    const localPacked = localTable === 0 ? 0x00 : 0x80 | (localTable - 1);
    // Image descriptor: introducer, x, y, w, h, packed.
    out.push(0x2c, 0, 0, 0, 0, 1, 0, 1, 0, localPacked);
    if (localTable > 0) out.push(...new Array(3 * 2 ** localTable).fill(0));
    // LZW minimum code size, one sub-block, terminator.
    out.push(2, 3, 0x44, 0x01, 0x00, 0);
  }

  if (trailer) out.push(0x3b);
  return new Uint8Array(new ArrayBuffer(out.length)).map((_, i) => out[i]!);
}

describe("sniffGif", () => {
  it("reads the signature from the bytes", () => {
    expect(sniffGif(gif())).toBe(true);
    expect(sniffGif(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toBe(false);
  });
});

describe("countGifFrames", () => {
  it("counts one image in a still GIF", () => {
    expect(countGifFrames(gif({ frames: 1 }))).toBe(1);
  });

  it("counts more than one in an animation", () => {
    expect(countGifFrames(gif({ frames: 2 }))).toBe(2);
    // Bounded: it answers the question and stops rather than parsing on.
    expect(countGifFrames(gif({ frames: 9 }))).toBe(2);
  });

  it("steps over a global colour table at its declared size", () => {
    // Mis-sizing the table lands the cursor in palette bytes and finds
    // whatever happens to be there, so this is the load-bearing case.
    expect(countGifFrames(gif({ globalTable: 8, frames: 2 }))).toBe(2);
    expect(countGifFrames(gif({ globalTable: 2, frames: 1 }))).toBe(1);
  });

  it("steps over a local colour table too", () => {
    expect(countGifFrames(gif({ localTable: 4, frames: 2 }))).toBe(2);
  });

  it("steps over extensions without counting them as frames", () => {
    // A Graphic Control Extension precedes each frame of most animations —
    // counting those instead of images would miss a frame carrying none.
    expect(countGifFrames(gif({ extensions: 3, frames: 1 }))).toBe(1);
  });

  it("stops at the trailer", () => {
    expect(countGifFrames(gif({ frames: 1, trailer: true }))).toBe(1);
  });

  it("says nothing about bytes that are not a GIF", () => {
    expect(countGifFrames(new Uint8Array(20))).toBe(0);
    expect(countGifFrames(new Uint8Array(4))).toBe(0);
  });

  it("stops rather than guessing when the structure stops making sense", () => {
    // A byte that is neither image, extension nor trailer means the walk is
    // lost; reporting "one frame" there would be the silent flattening this
    // module exists to end, so it reports what it actually counted.
    const broken = gif({ frames: 1, trailer: false });
    const withJunk = new Uint8Array(new ArrayBuffer(broken.length + 4));
    withJunk.set(broken);
    withJunk.set([0x77, 0x77, 0x77, 0x77], broken.length);
    expect(countGifFrames(withJunk)).toBe(1);
  });
});

describe("isAnimatedGif", () => {
  it("refuses only the animated ones", async () => {
    const animated = new Blob([gif({ frames: 2 }) as BlobPart], { type: "image/gif" });
    const still = new Blob([gif({ frames: 1 }) as BlobPart], { type: "image/gif" });
    await expect(isAnimatedGif(animated)).resolves.toBe(true);
    await expect(isAnimatedGif(still)).resolves.toBe(false);
  });

  it("leaves every other format alone", async () => {
    // A JPEG must never take the GIF path, whatever its bytes look like.
    const jpeg = new Blob([gif({ frames: 2 }) as BlobPart], { type: "image/jpeg" });
    await expect(isAnimatedGif(jpeg)).resolves.toBe(false);
  });
});

describe("isGifFile", () => {
  it("sorts by the declared type, which is what the picker hands over", () => {
    expect(isGifFile(new Blob([], { type: "image/gif" }))).toBe(true);
    expect(isGifFile(new Blob([], { type: "image/webp" }))).toBe(false);
  });
});
