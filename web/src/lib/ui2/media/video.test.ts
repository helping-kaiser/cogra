// @vitest-environment node
//
// The client's video gate, asserted against the SERVER'S OWN RULES rather than
// against itself. Every number and every brand here is a copy of something in
// `crates/api/src/media/video.rs`; if the two drift, a reader is told their
// file is fine and the server then refuses it, which is the failure this file
// exists to make loud.
//
// What cannot be tested here: the probe and the frame capture, which need a
// real decoder. Node has no video element and jsdom has no media pipeline, so
// those are exercised by hand rather than pretended at — noted, not papered
// over.

import { describe, expect, it } from "vitest";

import { formatDuration, isVideoFile, looksLikeMp4, sniffMp4, VIDEO_TYPE } from "./video";

/** An `ftyp` header: size, "ftyp", major brand, then compatible brands. */
function ftyp(major: string, compatible: readonly string[] = []): Uint8Array<ArrayBuffer> {
  const brands = [major, ...compatible];
  const size = 8 + brands.length * 4;
  const bytes = new Uint8Array(new ArrayBuffer(size + 32));
  bytes[0] = (size >> 24) & 0xff;
  bytes[1] = (size >> 16) & 0xff;
  bytes[2] = (size >> 8) & 0xff;
  bytes[3] = size & 0xff;
  const write = (text: string, at: number) => {
    for (let i = 0; i < 4; i += 1) bytes[at + i] = text.charCodeAt(i);
  };
  write("ftyp", 4);
  brands.forEach((brand, index) => write(brand, 8 + index * 4));
  return bytes;
}

describe("the pinned contract", () => {
  it("names the one stored moving format", () => {
    expect(VIDEO_TYPE).toBe("video/mp4");
  });
});

describe("sniffMp4", () => {
  it("admits every brand the server's BRANDS list admits", () => {
    for (const brand of ["isom", "iso2", "iso4", "iso6", "mp41", "mp42", "avc1"]) {
      expect(sniffMp4(ftyp(brand)), brand).toBe(true);
    }
  });

  it("admits a file that only mentions the brand among its compatible ones", () => {
    // A writer states the strictest brand it meets as the major one and lists
    // the rest, so the compatible list is load-bearing rather than decorative.
    expect(sniffMp4(ftyp("mmp4", ["isom", "mp42"]))).toBe(true);
  });

  it("refuses the ISO relatives that wear the same box grammar", () => {
    // The whole reason the brand is checked at all: these parse as ISO base
    // media and are not the container clients are asked to produce.
    expect(sniffMp4(ftyp("qt  ")), "QuickTime").toBe(false);
    expect(sniffMp4(ftyp("avif")), "AVIF").toBe(false);
    expect(sniffMp4(ftyp("heic")), "HEIC").toBe(false);
  });

  it("refuses bytes with no ftyp box at all", () => {
    expect(sniffMp4(new Uint8Array(32))).toBe(false);
    expect(sniffMp4(new Uint8Array([0, 0, 0, 8, 109, 111, 111, 118]))).toBe(false);
  });

  it("refuses a header too short to carry a brand", () => {
    expect(sniffMp4(new Uint8Array(4))).toBe(false);
  });

  it("does not walk past the box the header declares", () => {
    // A corrupt size must not let the scan wander into the payload and find
    // four bytes that happen to spell a brand.
    const bytes = ftyp("qt  ");
    // The payload after the declared box carries "isom" — outside the box.
    const at = 12;
    for (let i = 0; i < 4; i += 1) bytes[at + i] = "isom".charCodeAt(i);
    expect(sniffMp4(bytes)).toBe(false);
  });
});

describe("looksLikeMp4", () => {
  it("reads the header off the blob rather than trusting its type", async () => {
    // The exact lie the sniff exists to catch: a renamed file whose `type` the
    // operating system guessed from the extension.
    const lying = new Blob([ftyp("qt  ")], { type: "video/mp4" });
    await expect(looksLikeMp4(lying)).resolves.toBe(false);

    const honest = new Blob([ftyp("isom")], { type: "application/octet-stream" });
    await expect(looksLikeMp4(honest)).resolves.toBe(true);
  });
});

describe("isVideoFile", () => {
  it("sorts the picked file into the moving kind by its type", () => {
    expect(isVideoFile(new Blob([], { type: "video/mp4" }))).toBe(true);
    expect(isVideoFile(new Blob([], { type: "video/quicktime" }))).toBe(true);
    expect(isVideoFile(new Blob([], { type: "image/jpeg" }))).toBe(false);
  });
});

describe("formatDuration", () => {
  it("draws the badge the cover board draws", () => {
    expect(formatDuration(42_000)).toBe("0:42");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(600_000)).toBe("10:00");
  });

  it("grows an hours field only when there are hours", () => {
    // There is no duration cap, so a long clip is a real case rather than a
    // theoretical one — and a ten-second clip must not read "0:00:10".
    expect(formatDuration(3_903_000)).toBe("1:05:03");
    expect(formatDuration(9_000)).toBe("0:09");
  });

  it("says zero rather than NaN for a duration the header never stated", () => {
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("0:00");
    expect(formatDuration(Number.NaN)).toBe("0:00");
    expect(formatDuration(-1)).toBe("0:00");
  });
});
