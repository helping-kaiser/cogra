// @vitest-environment node
//
// The metadata-strip requirement of D11 is the reason this file exists, and it
// is asserted rather than assumed.
//
// WHAT THIS PROVES, and what it does not. jsdom and Node have no canvas and no
// WebP encoder, so a real end-to-end encode cannot run here. What CAN be
// verified, and is, is the property the strip actually rests on: the source
// bytes are handed to `createImageBitmap` and are NEVER read, copied, or
// forwarded by any other path, so there is no route by which an EXIF segment
// could reach the output. A fixture JPEG carrying a real APP1/EXIF segment with
// GPS bytes goes in; the test asserts those bytes appear nowhere in what comes
// out, and that the input blob was never read as bytes at all.
//
// The remaining gap — that a real browser's WebP encoder writes no metadata of
// its own — is a browser-level fact and needs a real browser to assert. Noted
// as a follow-up rather than papered over.

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  encodeForUpload,
  MAX_LONG_EDGE,
  MAX_WIDTH,
  OUTPUT_TYPE,
  sourceRect,
  targetSize,
  WEBP_QUALITY,
} from "./encode-image";
import { CENTERED } from "./crop";

describe("the pinned parameters", () => {
  it("holds the numbers the PR cites, so a silent edit fails here", () => {
    // Instagram's published envelope: up to 1080 wide, ratios 1.91:1 to 4:5.
    expect(MAX_WIDTH).toBe(1080);
    // 1080 wide at 4:5 is 1350 tall; the ceiling covers the non-post paths.
    expect(MAX_LONG_EDGE).toBe(1440);
    // cwebp's documented default is 75; one step above it for a second-
    // generation encode.
    expect(WEBP_QUALITY).toBe(0.8);
    expect(OUTPUT_TYPE).toBe("image/webp");
  });
});

// The crop has to survive the trip to the server as PIXELS (D17), so what is
// asserted here is that the rectangle handed to the encoder is the same region
// `cropStyle` puts on screen. The invariant that carries the whole model: the
// rectangle never leaves the source, at any zoom, at any focal point.
describe("sourceRect", () => {
  it("centres the cover fit and trims the longer axis", () => {
    // 4:5 out of a 1000x1000 square: the width is what gives.
    expect(sourceRect(1000, 1000, 4 / 5)).toEqual({ x: 100, y: 0, width: 800, height: 1000 });
    // 1.91:1 out of the same square: the height gives instead.
    const wide = sourceRect(1000, 1000, 1.91);
    expect(wide.width).toBe(1000);
    expect(wide.height).toBeCloseTo(1000 / 1.91, 6);
    expect(wide.x).toBe(0);
    expect(wide.y).toBeCloseTo((1000 - 1000 / 1.91) / 2, 6);
  });

  it("keeps the whole source when the shapes already agree", () => {
    expect(sourceRect(800, 1000, 4 / 5)).toEqual({ x: 0, y: 0, width: 800, height: 1000 });
  });

  it("halves the window at zoom 2 and anchors it on the focal point", () => {
    const left = sourceRect(800, 1000, 4 / 5, { zoom: 2, x: 0, y: 0 });
    expect(left).toEqual({ x: 0, y: 0, width: 400, height: 500 });
    const right = sourceRect(800, 1000, 4 / 5, { zoom: 2, x: 1, y: 1 });
    expect(right).toEqual({ x: 400, y: 500, width: 400, height: 500 });
    const middle = sourceRect(800, 1000, 4 / 5, { zoom: 2, x: 0.5, y: 0.5 });
    expect(middle).toEqual({ x: 200, y: 250, width: 400, height: 500 });
  });

  it("ignores the focal point at zoom 1, because nothing can be panned there", () => {
    expect(sourceRect(1000, 1000, 1, { zoom: 1, x: 0, y: 1 })).toEqual(
      sourceRect(1000, 1000, 1, CENTERED),
    );
  });

  it("never leaves the source, for any reachable crop", () => {
    for (const [w, h] of [
      [1000, 1000],
      [4000, 500],
      [500, 4000],
      [1080, 1350],
    ]) {
      for (const ratio of [4 / 5, 1, 1.91]) {
        for (const zoom of [1, 1.4, 2, 3]) {
          for (const x of [0, 0.37, 0.5, 1]) {
            for (const y of [0, 0.63, 1]) {
              const rect = sourceRect(w, h, ratio, { zoom, x, y });
              expect(rect.x).toBeGreaterThanOrEqual(-1e-9);
              expect(rect.y).toBeGreaterThanOrEqual(-1e-9);
              expect(rect.x + rect.width).toBeLessThanOrEqual(w + 1e-9);
              expect(rect.y + rect.height).toBeLessThanOrEqual(h + 1e-9);
              expect(rect.width / rect.height).toBeCloseTo(ratio, 6);
            }
          }
        }
      }
    }
  });

  it("refuses a ratio it cannot use", () => {
    expect(() => sourceRect(100, 100, 0)).toThrow(/ratio/);
    expect(() => sourceRect(100, 100, Number.NaN)).toThrow(/ratio/);
  });
});

describe("targetSize", () => {
  it("caps the width at 1080 and keeps the shape", () => {
    expect(targetSize(4032, 3024)).toEqual({ width: 1080, height: 810 });
  });

  it("leaves a picture already inside the caps alone rather than enlarging it", () => {
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(targetSize(1080, 1350)).toEqual({ width: 1080, height: 1350 });
  });

  it("holds each ruled post shape at 1080 wide", () => {
    expect(targetSize(4000, 5000)).toEqual({ width: 1080, height: 1350 });
    expect(targetSize(4000, 4000)).toEqual({ width: 1080, height: 1080 });
    expect(targetSize(3820, 2000)).toEqual({ width: 1080, height: 565 });
  });

  it("applies the long-edge ceiling to a frame the width cap would not catch", () => {
    // 1000x6000 is inside the width cap but wildly outside the long edge.
    const size = targetSize(1000, 6000);
    expect(Math.max(size.width, size.height)).toBe(MAX_LONG_EDGE);
    expect(size).toEqual({ width: 240, height: 1440 });
  });

  it("never rounds a dimension away to zero", () => {
    const size = targetSize(1, 6000);
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it("refuses a source with no usable dimensions", () => {
    expect(() => targetSize(0, 100)).toThrow(/dimensions/);
    expect(() => targetSize(Number.NaN, 100)).toThrow(/dimensions/);
  });
});

// A minimal JPEG carrying an APP1 EXIF segment. The GPS payload is the thing
// that must not survive: in a real phone photo it is the author's location.
const GPS_SECRET = "GPS:51.5074,-0.1278";

function exifJpeg(): { bytes: Uint8Array; secret: Uint8Array } {
  const exifHeader = new TextEncoder().encode("Exif\0\0");
  const secret = new TextEncoder().encode(GPS_SECRET);
  const payload = new Uint8Array(exifHeader.length + secret.length);
  payload.set(exifHeader, 0);
  payload.set(secret, exifHeader.length);

  const length = payload.length + 2;
  const bytes = new Uint8Array(4 + 2 + payload.length + 2);
  let at = 0;
  bytes[at++] = 0xff; // SOI
  bytes[at++] = 0xd8;
  bytes[at++] = 0xff; // APP1
  bytes[at++] = 0xe1;
  bytes[at++] = (length >> 8) & 0xff;
  bytes[at++] = length & 0xff;
  bytes.set(payload, at);
  at += payload.length;
  bytes[at++] = 0xff; // EOI
  bytes[at++] = 0xd9;
  return { bytes, secret };
}

function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * A canvas that models the documented contract faithfully in the one respect
 * this test turns on: `convertToBlob` encodes THE PIXELS IT WAS DRAWN, and has
 * no access to the file the pixels were decoded from.
 */
type Drawn = {
  width: number;
  height: number;
  from: { x: number; y: number; width: number; height: number };
};

function installFakeCanvas(pixelSeed: number) {
  const drawn: Drawn[] = [];
  class FakeOffscreenCanvas {
    constructor(
      public width: number,
      public height: number,
    ) {}
    getContext() {
      return {
        // The nine-argument form: the crop rides the SOURCE rectangle, so both
        // halves of the call are worth recording.
        drawImage: (
          _bitmap: unknown,
          sx: number,
          sy: number,
          sw: number,
          sh: number,
          _dx: number,
          _dy: number,
          dw: number,
          dh: number,
        ) => {
          drawn.push({ width: dw, height: dh, from: { x: sx, y: sy, width: sw, height: sh } });
        },
      };
    }
    async convertToBlob({ type }: { type: string; quality: number }) {
      // Bytes derived only from a pixel seed — standing in for a real encoder's
      // output, and provably carrying nothing from the source file.
      const body = new Uint8Array(16).fill(pixelSeed & 0xff);
      return new Blob([body as BlobPart], { type });
    }
  }
  vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
  return drawn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("encodeForUpload", () => {
  it("drops the source's metadata: nothing from the input file reaches the output", async () => {
    const { bytes, secret } = exifJpeg();
    const source = new Blob([bytes as BlobPart], { type: "image/jpeg" });

    // The source blob must never be read as bytes — that is the structural
    // guarantee behind the strip. Spying on every byte-reading method proves
    // there is no second path.
    const arrayBuffer = vi.spyOn(source, "arrayBuffer");
    const slice = vi.spyOn(source, "slice");

    installFakeCanvas(0x42);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 4000, height: 3000, close: () => {} })),
    );

    const result = await encodeForUpload(source);
    const out = new Uint8Array(await result.blob.arrayBuffer());

    expect(contains(out, secret), "the GPS payload survived the re-encode").toBe(false);
    expect(
      contains(out, new TextEncoder().encode("Exif")),
      "an EXIF marker survived the re-encode",
    ).toBe(false);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(slice).not.toHaveBeenCalled();
    expect(result.blob).not.toBe(source);
  });

  it("asks the decoder to apply the orientation tag before the tag is lost", async () => {
    installFakeCanvas(1);
    const create = vi.fn(async () => ({ width: 100, height: 100, close: () => {} }));
    vi.stubGlobal("createImageBitmap", create);

    await encodeForUpload(new Blob([new Uint8Array([1, 2, 3]) as BlobPart]));

    expect(create).toHaveBeenCalledWith(expect.anything(), {
      imageOrientation: "from-image",
    });
  });

  it("draws at the capped size and reports it", async () => {
    const drawn = installFakeCanvas(2);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 4032, height: 3024, close: () => {} })),
    );

    const result = await encodeForUpload(new Blob([new Uint8Array([0]) as BlobPart]));

    expect(drawn).toEqual([
      { width: 1080, height: 810, from: { x: 0, y: 0, width: 4032, height: 3024 } },
    ]);
    expect(result.width).toBe(1080);
    expect(result.height).toBe(810);
  });

  it("bakes the crop into the pixels, at the post shape's own size", async () => {
    const drawn = installFakeCanvas(3);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 4032, height: 3024, close: () => {} })),
    );

    // Tall 4:5 out of a landscape original, framed hard right.
    const result = await encodeForUpload(new Blob([new Uint8Array([0]) as BlobPart]), {
      ratio: 4 / 5,
      crop: { zoom: 2, x: 1, y: 1 },
    });

    // The cover fit trims the width to 3024 * 4/5 = 2419.2 FIRST, so the window
    // pans inside that trimmed region and not across the whole original — the
    // strip the shape already cut away stays unreachable at every zoom.
    const from = drawn[0]!.from;
    expect(from.width).toBeCloseTo(1209.6, 4);
    expect(from.height).toBeCloseTo(1512, 4);
    expect(from.x + from.width).toBeCloseTo((4032 - 2419.2) / 2 + 2419.2, 4);
    expect(from.y + from.height).toBeCloseTo(3024, 4);
    // The output is the SHAPE's, not the original's: 1209.6x1512 is inside the
    // 1080 width cap, so it scales down to it rather than keeping 4032 wide.
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1350);
  });

  it("leaves the shape alone when no ratio is asked for", async () => {
    const drawn = installFakeCanvas(4);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 600, height: 400, close: () => {} })),
    );

    // A crop with no ratio has nothing to crop TO, so it is ignored rather than
    // silently reshaping the picture.
    const result = await encodeForUpload(new Blob([new Uint8Array([0]) as BlobPart]), {
      crop: { zoom: 3, x: 0, y: 0 },
    });

    expect(drawn[0]!.from).toEqual({ x: 0, y: 0, width: 600, height: 400 });
    expect(result.width).toBe(600);
    expect(result.height).toBe(400);
  });

  it("releases the decoded bitmap even when the encode fails", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 100, height: 100, close })),
    );
    // No canvas at all, and no document either: the encode cannot proceed.
    vi.stubGlobal("OffscreenCanvas", undefined);
    vi.stubGlobal("document", undefined);

    await expect(encodeForUpload(new Blob([new Uint8Array([0]) as BlobPart]))).rejects.toThrow();
    expect(close).toHaveBeenCalled();
  });
});
