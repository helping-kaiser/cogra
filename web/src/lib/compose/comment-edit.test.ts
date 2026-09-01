import { describe, expect, it } from "vitest";

import { COMMENT_ATTACHMENT_CAP } from "./comment-media";
import {
  addTo,
  describedCount,
  editClaims,
  galleryChanged,
  galleryOf,
  pictureId,
  removeFrom,
  uploadsFailed,
  uploadsPending,
  withAltText,
  withUpload,
  type EditGallery,
} from "./comment-edit";

const ATTACHMENTS = [
  { id: "m1", url: "https://media.test/1.webp", altText: "A film camera" },
  { id: "m2", url: "https://media.test/2.webp", altText: null },
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
      { mediaId: "m1", altText: "A film camera" },
      { mediaId: "m2", altText: null },
    ]);
  });

  it("holds back while an added picture is still on its way", () => {
    expect(editClaims(addTo(galleryOf(ATTACHMENTS), picked(1)))).toBeNull();
  });

  it("names an added picture by the id its upload came back with", () => {
    const gallery = landed(addTo(galleryOf([]), picked(1)), "new-0", "m9");
    expect(editClaims(gallery)).toEqual([{ mediaId: "m9", altText: null }]);
  });

  it("sends a blank description as none, so a reader is told nothing rather than nothing-at-all", () => {
    const gallery = withAltText(landed(addTo(galleryOf([]), picked(1)), "new-0", "m9"), "new-0", "   ");
    expect(editClaims(gallery)).toEqual([{ mediaId: "m9", altText: null }]);
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
