// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isStreamClip, streamClipsOf, type StreamCandidate } from "./stream-clip";

function clip(aspectRatio: string | null, extra: Partial<StreamCandidate> = {}): StreamCandidate {
  return {
    __typename: "Post",
    attachmentsStatus: "PRESENT",
    attachments: [{ mimeType: "video/mp4", status: "PRESENT", options: { aspectRatio } }],
    ...extra,
  };
}

describe("the stream's predicate (Reel.md:3)", () => {
  it("admits a clip taller than it is wide", () => {
    expect(isStreamClip(clip("9:16"))).toBe(true);
    expect(isStreamClip(clip("4:5"))).toBe(true);
  });

  it("refuses a square and a wide clip — the post opens for them", () => {
    expect(isStreamClip(clip("1:1"))).toBe(false);
    expect(isStreamClip(clip("16:9"))).toBe(false);
  });

  it("refuses an unprobed or malformed shape", () => {
    expect(isStreamClip(clip(null))).toBe(false);
    expect(isStreamClip(clip("9:16:1"))).toBe(false);
    expect(isStreamClip(clip("0:16"))).toBe(false);
  });

  it("refuses pictures, a comment's clip and a removed clip", () => {
    expect(
      isStreamClip({
        __typename: "Post",
        attachments: [{ mimeType: "image/webp", options: { aspectRatio: "4:5" } }],
      }),
    ).toBe(false);
    expect(isStreamClip(clip("9:16", { __typename: "Comment" }))).toBe(false);
    expect(isStreamClip(clip("9:16", { attachmentsStatus: "REDACTED" }))).toBe(false);
    expect(
      isStreamClip({
        __typename: "Post",
        attachments: [{ mimeType: "video/mp4", status: "REDACTED", options: { aspectRatio: "9:16" } }],
      }),
    ).toBe(false);
    expect(isStreamClip({ __typename: "Post", attachments: [] })).toBe(false);
  });

  it("narrows a list in its own order", () => {
    const a = { ...clip("9:16"), id: "a" };
    const b = { ...clip("16:9"), id: "b" };
    const c = { ...clip("3:4"), id: "c" };
    expect(streamClipsOf([c, b, a]).map((row) => (row as { id: string }).id)).toEqual(["c", "a"]);
  });
});
