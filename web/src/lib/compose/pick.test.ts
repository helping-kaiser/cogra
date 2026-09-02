// @vitest-environment node
//
// The pick screening: which files get in, which are refused, and in whose
// words. The board's two sentences are asserted VERBATIM — copy a reader sees
// is part of the contract, and a paraphrase that drifts from
// ComposePickedErrors is a defect no type checker would catch.

import { describe, expect, it } from "vitest";

import { PICTURE_MAX_BYTES, POST_VIDEO_MAX_BYTES, megabytes } from "@/lib/ui2/media/caps";
import {
  ANIMATED_GIF,
  MIXED_BODY,
  screenPick,
  TOO_BIG_PICTURE,
  TOO_BIG_VIDEO,
  UNREADABLE,
} from "./pick";

const EMPTY = { hasVideo: false, count: 0 };

function file(name: string, type: string, bytes: Uint8Array<ArrayBuffer>, size?: number): File {
  const made = new File([bytes as BlobPart], name, { type });
  if (size !== undefined) Object.defineProperty(made, "size", { value: size });
  return made;
}

function mp4(size?: number): File {
  const bytes = new Uint8Array(new ArrayBuffer(32));
  bytes[3] = 16;
  for (const [i, ch] of [..."ftyp"].entries()) bytes[4 + i] = ch.charCodeAt(0);
  for (const [i, ch] of [..."isom"].entries()) bytes[8 + i] = ch.charCodeAt(0);
  return file("clip.mp4", "video/mp4", bytes, size);
}

function picture(name = "shot.jpg", size?: number): File {
  return file(name, "image/jpeg", new Uint8Array(new ArrayBuffer(8)), size);
}

/** A GIF with `frames` image descriptors, built to GIF89a. */
function gifFile(frames: number): File {
  const out: number[] = [];
  for (const ch of "GIF89a") out.push(ch.charCodeAt(0));
  out.push(1, 0, 1, 0, 0x00, 0, 0);
  for (let i = 0; i < frames; i += 1) {
    out.push(0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00);
    out.push(2, 3, 0x44, 0x01, 0x00, 0);
  }
  out.push(0x3b);
  const bytes = new Uint8Array(new ArrayBuffer(out.length)).map((_, i) => out[i]!);
  return file("loop.gif", "image/gif", bytes);
}

describe("the board's own words", () => {
  it("states the caps in MB while the checks stay MiB", () => {
    // Item 31 round 2: the readable number under-promises, so it can never
    // refuse a file the product would have taken.
    expect(TOO_BIG_PICTURE).toBe("That picture is too big — a picture can be up to 10 MB.");
    expect(UNREADABLE).toBe("That file isn't a picture or a video CoGra can read.");
    expect(megabytes(POST_VIDEO_MAX_BYTES)).toBe("100 MB");
    // …and the enforced figure is the larger, mebibyte one.
    expect(POST_VIDEO_MAX_BYTES).toBe(100 * 1024 * 1024);
    expect(PICTURE_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("screenPick", () => {
  it("takes the pictures that pass and refuses only the ones that do not", async () => {
    // THE BATCH CARRIES ON. This is the ComposePickedErrors shape: two
    // accepted beside two refusals, not a whole batch lost to one bad file.
    const outcome = await screenPick(
      [
        picture("a.jpg"),
        picture("huge.jpg", PICTURE_MAX_BYTES + 1),
        picture("b.jpg"),
        file("notes.txt", "text/plain", new Uint8Array(new ArrayBuffer(4))),
      ],
      EMPTY,
    );

    expect(outcome.accepted.map((f) => f.name)).toEqual(["a.jpg", "b.jpg"]);
    expect(outcome.refusals.map((r) => [r.name, r.reason])).toEqual([
      ["huge.jpg", TOO_BIG_PICTURE],
      ["notes.txt", UNREADABLE],
    ]);
  });

  it("gives every refusal its own identity, so each can be dismissed alone", async () => {
    const outcome = await screenPick([picture("x.txt"), picture("y.txt")], {
      hasVideo: false,
      count: 0,
    });
    // Both pass here; the point is the shape when they do not.
    const refused = await screenPick(
      [
        file("one.txt", "text/plain", new Uint8Array(new ArrayBuffer(1))),
        file("two.txt", "text/plain", new Uint8Array(new ArrayBuffer(1))),
      ],
      EMPTY,
    );
    expect(outcome.refusals).toHaveLength(0);
    expect(new Set(refused.refusals.map((r) => r.id)).size).toBe(2);
  });

  it("refuses an animated GIF in words and keeps converting a still one", async () => {
    // The silent flattening this replaces: a canvas holds one frame, so an
    // animation used to arrive as a still with nothing said.
    const animated = await screenPick([gifFile(3)], EMPTY);
    expect(animated.accepted).toHaveLength(0);
    expect(animated.refusals[0]!.reason).toBe(ANIMATED_GIF);

    const still = await screenPick([gifFile(1)], EMPTY);
    expect(still.accepted).toHaveLength(1);
    expect(still.refusals).toHaveLength(0);
  });

  it("reads a video's container from the bytes, not from its name", async () => {
    const renamed = file("clip.mp4", "video/mp4", new Uint8Array(new ArrayBuffer(32)));
    const outcome = await screenPick([renamed], EMPTY);
    expect(outcome.accepted).toHaveLength(0);
    expect(outcome.refusals[0]!.reason).toBe(UNREADABLE);
  });

  it("refuses a video over the cap", async () => {
    const outcome = await screenPick([mp4(POST_VIDEO_MAX_BYTES + 1)], EMPTY);
    expect(outcome.refusals[0]!.reason).toBe(TOO_BIG_VIDEO);
    expect(TOO_BIG_VIDEO).toContain("100 MB");
  });

  it("takes one video and reports the batch as the moving kind", async () => {
    const outcome = await screenPick([mp4()], EMPTY);
    expect(outcome.accepted).toHaveLength(1);
    expect(outcome.kind).toBe("video");
  });

  it("refuses the kinds mixing, and keeps what the draft already holds", async () => {
    // Neither direction may replace what is there: a video dropped onto framed
    // pictures, or pictures dropped onto a video.
    const ontoPictures = await screenPick([mp4()], { hasVideo: false, count: 3 });
    expect(ontoPictures.accepted).toHaveLength(0);
    expect(ontoPictures.refusals[0]!.reason).toBe(MIXED_BODY);

    const ontoVideo = await screenPick([picture()], { hasVideo: true, count: 1 });
    expect(ontoVideo.accepted).toHaveLength(0);
    expect(ontoVideo.refusals[0]!.reason).toBe(MIXED_BODY);

    const bothAtOnce = await screenPick([mp4(), picture()], EMPTY);
    expect(bothAtOnce.accepted).toHaveLength(0);
    expect(bothAtOnce.refusals).toHaveLength(2);
  });

  it("takes one video of several offered and says why the rest did not get in", async () => {
    const outcome = await screenPick([mp4(), mp4(), mp4()], EMPTY);
    expect(outcome.accepted).toHaveLength(1);
    expect(outcome.refusals.map((r) => r.reason)).toEqual([MIXED_BODY, MIXED_BODY]);
  });
});
