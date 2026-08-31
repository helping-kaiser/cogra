import { describe, expect, it } from "vitest";

import {
  COMMENT_ATTACHMENT_CAP,
  commentAttachmentIds,
  commentGate,
  NO_COMMENT_MEDIA,
  pickInto,
  removeFrom,
  uploadsFailed,
  uploadsPending,
  withUpload,
  type CommentMedia,
} from "./comment-media";
import { CENTERED } from "@/lib/ui2/media/crop";

const file = () => new Blob([new Uint8Array([1]) as BlobPart], { type: "image/jpeg" });
const picks = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, file: file() }));

const done = (media: CommentMedia): CommentMedia =>
  media.map((asset, i) => ({ ...asset, upload: { kind: "done" as const, mediaId: `m${i}` } }));

describe("a comment's pictures", () => {
  it("caps at four, and takes only what fits", () => {
    expect(COMMENT_ATTACHMENT_CAP).toBe(4);
    const media = pickInto(NO_COMMENT_MEDIA, picks(6));
    expect(media).toHaveLength(4);
    // Already full: a further pick changes nothing rather than replacing.
    expect(pickInto(media, picks(1))).toBe(media);
  });

  it("takes only the room that is left, over several picks", () => {
    const media = pickInto(pickInto(NO_COMMENT_MEDIA, picks(3)), [
      { id: "x0", file: file() },
      { id: "x1", file: file() },
    ]);
    expect(media).toHaveLength(4);
    expect(media[3]!.id).toBe("x0");
  });

  // There is no crop step at comment scale, so nothing is ever framed and the
  // encoder keeps each picture's own shape.
  it("picks every picture unframed and waiting", () => {
    const media = pickInto(NO_COMMENT_MEDIA, picks(1));
    expect(media[0]!.crop).toEqual(CENTERED);
    expect(media[0]!.altText).toBe("");
    expect(media[0]!.upload).toEqual({ kind: "waiting" });
  });

  it("removes one without touching the others", () => {
    const media = pickInto(NO_COMMENT_MEDIA, picks(3));
    const left = removeFrom(media, "c1");
    expect(left.map((a) => a.id)).toEqual(["c0", "c2"]);
  });

  it("counts what is still moving and what gave up", () => {
    let media = pickInto(NO_COMMENT_MEDIA, picks(3));
    media = withUpload(media, "c0", { kind: "uploading" });
    media = withUpload(media, "c1", { kind: "failed", message: "no", retryable: true });
    media = withUpload(media, "c2", { kind: "done", mediaId: "m2" });
    expect(uploadsPending(media)).toBe(1);
    expect(uploadsFailed(media)).toBe(1);
  });
});

describe("the comment gate", () => {
  it("needs words — the pictures are the optional half", () => {
    expect(commentGate("", NO_COMMENT_MEDIA)).toEqual({
      ok: false,
      reason: "A comment needs words.",
    });
    expect(commentGate("  ", done(pickInto(NO_COMMENT_MEDIA, picks(1))))).toMatchObject({
      ok: false,
    });
    expect(commentGate("something", NO_COMMENT_MEDIA)).toEqual({ ok: true });
  });

  it("holds while a picture is still on its way, and says how many", () => {
    const one = pickInto(NO_COMMENT_MEDIA, picks(1));
    expect(commentGate("words", one)).toEqual({
      ok: false,
      reason: "One picture is still uploading.",
    });
    expect(commentGate("words", pickInto(NO_COMMENT_MEDIA, picks(3)))).toEqual({
      ok: false,
      reason: "3 pictures are still uploading.",
    });
  });

  it("reports a failure ahead of a pending one — it is the one worth acting on", () => {
    let media = pickInto(NO_COMMENT_MEDIA, picks(2));
    media = withUpload(media, "c0", { kind: "failed", message: "no", retryable: true });
    expect(commentGate("words", media)).toEqual({
      ok: false,
      reason: "One picture didn't upload.",
    });
  });

  it("opens once every picture has an id", () => {
    expect(commentGate("words", done(pickInto(NO_COMMENT_MEDIA, picks(2))))).toEqual({ ok: true });
  });
});

describe("what goes on the wire", () => {
  it("is null when there are no pictures — a comment is words plus optional media", () => {
    expect(commentAttachmentIds(NO_COMMENT_MEDIA)).toBeNull();
  });

  it("withholds the whole gallery while any picture is unresolved", () => {
    const media = withUpload(pickInto(NO_COMMENT_MEDIA, picks(2)), "c0", {
      kind: "done",
      mediaId: "m0",
    });
    expect(commentAttachmentIds(media)).toBeNull();
  });

  it("keeps the author's order, so the first picture leads", () => {
    expect(commentAttachmentIds(done(pickInto(NO_COMMENT_MEDIA, picks(3))))).toEqual([
      "m0",
      "m1",
      "m2",
    ]);
  });
});
