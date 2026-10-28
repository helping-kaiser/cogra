import { describe, expect, it } from "vitest";

import { COMMENT_ATTACHMENT_CAP } from "./comment-media";
import { COMMENT_BODY_MAX_CHARS } from "./reply-wizard";
import {
  addTo,
  clipOf,
  coverChosen,
  describedCount,
  editBlocked,
  editClaims,
  galleryChanged,
  galleryOf,
  keptMediaIds,
  pictureId,
  removeFrom,
  uploadsDone,
  uploadsFailed,
  uploadsPending,
  withAltText,
  withNewCover,
  withUpload,
  type EditGallery,
} from "./comment-edit";
import type { PickedAsset } from "./wizard";

const ATTACHMENTS = [
  { id: "m1", url: "https://media.test/1.webp", altText: "A film camera" },
  { id: "m2", url: "https://media.test/2.webp", altText: null },
];

/** A video whose cover the server names, taken silently or chosen by the author. */
const videoAttachment = (coverTaken: boolean) => [
  {
    id: "v1",
    url: "https://media.test/v1.mp4",
    altText: null,
    coverMedia: { id: "c1" },
    coverTaken,
  },
];

function picked(count: number, from = 0) {
  return Array.from({ length: count }, (_, index) => ({
    id: `new-${index + from}`,
    file: new Blob(["x"], { type: "image/jpeg" }),
  }));
}

function landed(gallery: EditGallery, id: string, mediaId: string): EditGallery {
  return withUpload(gallery, id, { kind: "done", mediaId });
}

describe("the gallery an edit opens with", () => {
  it("keeps what the comment already carries, in the author's order", () => {
    const gallery = galleryOf(ATTACHMENTS);
    expect(gallery.map(pictureId)).toEqual(["m1", "m2"]);
    expect(gallery.every((picture) => picture.kind === "kept")).toBe(true);
  });

  it("reads a missing description as no description, never as the word null", () => {
    expect(describedCount(galleryOf(ATTACHMENTS))).toBe(1);
  });

  it("is empty for a comment that carries no pictures", () => {
    expect(galleryOf([])).toEqual([]);
  });
});

describe("changing the gallery", () => {
  it("adds picked pictures after the kept ones", () => {
    const gallery = addTo(galleryOf(ATTACHMENTS), picked(1));
    expect(gallery.map(pictureId)).toEqual(["m1", "m2", "new-0"]);
  });

  it("counts kept and added together against the comment's cap of four", () => {
    const gallery = addTo(galleryOf(ATTACHMENTS), picked(5));
    expect(gallery).toHaveLength(COMMENT_ATTACHMENT_CAP);
  });

  it("removes a kept picture by its media id", () => {
    expect(removeFrom(galleryOf(ATTACHMENTS), "m1").map(pictureId)).toEqual(["m2"]);
  });

  it("removes an added picture by its own id", () => {
    const gallery = addTo(galleryOf([]), picked(2));
    expect(removeFrom(gallery, "new-0").map(pictureId)).toEqual(["new-1"]);
  });

  it("describes either kind", () => {
    let gallery = addTo(galleryOf(ATTACHMENTS), picked(1));
    gallery = withAltText(gallery, "m2", "The market");
    gallery = withAltText(gallery, "new-0", "A print");
    expect(describedCount(gallery)).toBe(3);
  });
});

describe("the uploads", () => {
  it("waits only on pictures this editor added", () => {
    const gallery = addTo(galleryOf(ATTACHMENTS), picked(1));
    // The kept two are already on the server; only the new one is moving.
    expect(uploadsPending(gallery)).toBe(1);
  });

  it("counts a failure so the editor can say so", () => {
    const gallery = withUpload(addTo(galleryOf([]), picked(1)), "new-0", {
      kind: "failed",
      message: "no",
      retryable: true,
    });
    expect(uploadsFailed(gallery)).toBe(1);
    expect(uploadsPending(gallery)).toBe(0);
  });
});

describe("what the edit leaves standing", () => {
  it("sends an empty gallery when the last picture is removed", () => {
    const gallery = removeFrom(removeFrom(galleryOf(ATTACHMENTS), "m1"), "m2");
    // Complete state, not a delta: empty has to travel as empty.
    expect(editClaims(gallery)).toEqual([]);
  });

  it("re-states the kept pictures by their own media ids", () => {
    expect(editClaims(galleryOf(ATTACHMENTS))).toEqual([
      { mediaId: "m1", altText: "A film camera", coverMediaId: null, coverTaken: null },
      { mediaId: "m2", altText: null, coverMediaId: null, coverTaken: null },
    ]);
  });

  it("holds back while an added picture is still on its way", () => {
    expect(editClaims(addTo(galleryOf(ATTACHMENTS), picked(1)))).toBeNull();
  });

  it("names an added picture by the id its upload came back with", () => {
    const gallery = landed(addTo(galleryOf([]), picked(1)), "new-0", "m9");
    expect(editClaims(gallery)).toEqual([
      { mediaId: "m9", altText: null, coverMediaId: null, coverTaken: null },
    ]);
  });

  it("sends a blank description as none, so a reader is told nothing rather than nothing-at-all", () => {
    const gallery = withAltText(landed(addTo(galleryOf([]), picked(1)), "new-0", "m9"), "new-0", "   ");
    expect(editClaims(gallery)).toEqual([
      { mediaId: "m9", altText: null, coverMediaId: null, coverTaken: null },
    ]);
  });

  // THE EDIT ROUND-TRIP: `coverTaken` rides the kept placement exactly as
  // `coverMediaId` does. Dropping it here would silently turn a silently
  // TAKEN cover into a CHOSEN one on the very next save — the one direction
  // this must never fail in, per `coverMediaId`'s own doc comment above.
  it("re-states a silently-taken cover through the edit", () => {
    expect(editClaims(galleryOf(videoAttachment(true)))).toEqual([
      { mediaId: "v1", altText: null, coverMediaId: "c1", coverTaken: true },
    ]);
  });

  it("re-states a chosen cover through the edit, never flipping it to taken", () => {
    expect(editClaims(galleryOf(videoAttachment(false)))).toEqual([
      { mediaId: "v1", altText: null, coverMediaId: "c1", coverTaken: false },
    ]);
  });
});

describe("editBlocked", () => {
  it("is quiet on an empty gallery and words at the cap", () => {
    expect(editBlocked(galleryOf([]), "x".repeat(COMMENT_BODY_MAX_CHARS))).toBeNull();
  });

  // Scalar values, matching the server's count: the astral fixture is the
  // whole point.
  it("refuses words past the cap, counting scalar values and not code units", () => {
    const astralAtCap = "🧂".repeat(COMMENT_BODY_MAX_CHARS);
    expect(astralAtCap.length).toBe(2 * COMMENT_BODY_MAX_CHARS);
    expect(editBlocked(galleryOf([]), astralAtCap)).toBeNull();

    const over = "x".repeat(COMMENT_BODY_MAX_CHARS + 1);
    expect(editBlocked(galleryOf([]), over)).toMatch(/too long/i);
  });

  // CommentEdit.md: "Sign the edit is enabled GIVEN an upload is running" — a
  // press is held at the gate, never refused — and "disabled GIVEN the gate
  // line shows its fault reading".
  it("never holds the commit for a running upload, only for a failed one", () => {
    const gallery = addTo(galleryOf([]), picked(1));
    expect(editBlocked(gallery, "fine")).toBeNull();
    const failed = withUpload(gallery, "new-0", { kind: "failed", message: "no", retryable: true });
    expect(editBlocked(failed, "fine")).toBe("One picture didn't upload.");
  });
});

/** A clip whose face was chosen when it was published. */
const CHOSEN_CLIP = [
  {
    id: "v1",
    url: "https://media.test/v1.mp4",
    altText: "A headland",
    mimeType: "video/mp4",
    options: { aspectRatio: "9:16", durationMs: 18_000 },
    coverMedia: { id: "c1", url: "https://media.test/c1.webp" },
    coverTaken: false,
  },
];

const newFace = (upload: PickedAsset["upload"]): PickedAsset => ({
  id: "face",
  file: new Blob(["x"], { type: "image/jpeg" }),
  crop: { x: 0, y: 0, zoom: 1, area: null, areaPercent: null },
  altText: "",
  upload,
});

describe("a clip's face (EditComposeVideo, CommentEditVideo)", () => {
  it("reads a clip, its own ratio and the face it already wears off the read", () => {
    const clip = clipOf(galleryOf(CHOSEN_CLIP));
    expect(clip?.video).toBe(true);
    expect(clip?.ratio).toBeCloseTo(9 / 16);
    expect(clip?.coverUrl).toBe("https://media.test/c1.webp");
    expect(clipOf(galleryOf(ATTACHMENTS))).toBeUndefined();
  });

  it("offers the door over a taken frame and over no face, the change over a chosen one", () => {
    expect(coverChosen(clipOf(galleryOf(CHOSEN_CLIP))!)).toBe(true);
    expect(coverChosen(clipOf(galleryOf([{ ...CHOSEN_CLIP[0]!, coverTaken: true }]))!)).toBe(false);
    expect(
      coverChosen(clipOf(galleryOf([{ ...CHOSEN_CLIP[0]!, coverMedia: null, coverTaken: null }]))!),
    ).toBe(false);
  });

  it("gates the edit on the new face, and names it once it has landed", () => {
    const waiting = withNewCover(galleryOf(CHOSEN_CLIP), "v1", newFace({ kind: "waiting" }));
    expect(uploadsPending(waiting)).toBe(1);
    expect(editClaims(waiting)).toBeNull();
    const landedFace = withUpload(waiting, "face", { kind: "done", mediaId: "c9" });
    expect(uploadsDone(landedFace)).toBe(1);
    // The clip itself never changes: only its cover pointer, now a chosen one.
    expect(editClaims(landedFace)).toEqual([
      { mediaId: "v1", altText: "A headland", coverMediaId: "c9", coverTaken: null },
    ]);
    // The face it replaced is named by nothing the edit signs.
    expect(keptMediaIds(landedFace)).toEqual(["v1"]);
  });

  it("puts the clip back as it stood when the new face is taken back", () => {
    const opened = galleryOf(CHOSEN_CLIP);
    const back = withNewCover(withNewCover(opened, "v1", newFace({ kind: "waiting" })), "v1", null);
    expect(editClaims(back)).toEqual(editClaims(opened));
    expect(uploadsPending(back)).toBe(0);
  });
});

describe("whether the gallery moved", () => {
  it("is unmoved by an untouched editor", () => {
    const opened = galleryOf(ATTACHMENTS);
    expect(galleryChanged(opened, galleryOf(ATTACHMENTS))).toBe(false);
  });

  it("notices a removal", () => {
    const opened = galleryOf(ATTACHMENTS);
    expect(galleryChanged(opened, removeFrom(opened, "m1"))).toBe(true);
  });

  it("notices an addition", () => {
    const opened = galleryOf(ATTACHMENTS);
    expect(galleryChanged(opened, addTo(opened, picked(1)))).toBe(true);
  });

  it("notices a re-described picture — the description is part of the gallery", () => {
    const opened = galleryOf(ATTACHMENTS);
    expect(galleryChanged(opened, withAltText(opened, "m2", "The market"))).toBe(true);
  });
});
