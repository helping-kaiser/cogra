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
  targetSize,
  WEBP_QUALITY,
} from "./encode-image";

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
function installFakeCanvas(pixelSeed: number) {
  const drawn: { width: number; height: number }[] = [];
  class FakeOffscreenCanvas {
    constructor(
      public width: number,
      public height: number,
    ) {}
    getContext() {
      return {
        drawImage: (_bitmap: unknown, _x: number, _y: number, w: number, h: number) => {
          drawn.push({ width: w, height: h });
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

    expect(drawn).toEqual([{ width: 1080, height: 810 }]);
    expect(result.width).toBe(1080);
    expect(result.height).toBe(810);
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
