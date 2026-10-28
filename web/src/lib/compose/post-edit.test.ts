// The post edit's state (EditCompose.md, EditWords.md, EditPicked.md,
// EditComposeUnchanged.md; design/readme.md:8179-8181 for the flip).

import { describe, expect, it } from "vitest";

import type { EditGallery, KeptPicture } from "./comment-edit";
import type { PickedAsset } from "./wizard";
import {
  isClipBody,
  isMediaBody,
  postEditInput,
  postEditReducer,
  postEditProblem,
  uploadRatio,
  type PostEditAction,
  type PostEditState,
} from "./post-edit";

function kept(id: string, altText = "", extra: Partial<KeptPicture> = {}): EditGallery[number] {
  return {
    kind: "kept",
    mediaId: id,
    url: `https://media.test/${id}.webp`,
    altText,
    coverMediaId: null,
    coverTaken: null,
    video: false,
    ratio: 0.8,
    coverUrl: null,
    newCover: null,
    ...extra,
  };
}

function base(overrides: Partial<PostEditState> = {}): PostEditState {
  return {
    id: "p1",
    license: { attribution: 0, provenance: 0 },
    title: "Salt maps",
    description: "",
    words: "Three weekends at low tide.",
    gallery: [],
    durations: {},
    shape: null,
    tags: [],
    references: [],
    sensitive: false,
    sensitiveReason: "",
    loadedTags: [],
    loadedReferences: [],
    pick: 0,
    recordStaged: false,
    ...overrides,
  };
}

const media = () =>
  base({
    words: "",
    description: "Rubbings against the salt crust.",
    gallery: [kept("m1"), kept("m2")],
    shape: "tall",
  });

const run = (state: PostEditState, ...actions: PostEditAction[]) =>
  actions.reduce(postEditReducer, state);

describe("the post edit", () => {
  // THE GUARD IS THE ACTS BATCH, NOT A BYTE COMPARISON (EditComposeUnchanged.md:3):
  // the record stays staged once typed, even when the field is typed back.
  it("a_typed_then_reverted_title_still_signs", () => {
    const opened = base();
    expect(opened.recordStaged).toBe(false);
    const reverted = run(opened, { type: "title", title: "Salt maps!" }, { type: "title", title: "Salt maps" });
    expect(reverted.title).toBe(opened.title);
    expect(reverted.recordStaged).toBe(true);
  });

  it("stages the record for a moved picture, a description and the mark", () => {
    expect(run(media(), { type: "movePicture", from: 1, to: 0 }).gallery.map((p) => p.kind === "kept" && p.mediaId)).toEqual(["m2", "m1"]);
    expect(run(media(), { type: "movePicture", from: 1, to: 0 }).recordStaged).toBe(true);
    expect(run(media(), { type: "describe", id: "m1", altText: "A crust" }).recordStaged).toBe(true);
    expect(run(base(), { type: "sensitive", sensitive: true }).recordStaged).toBe(true);
  });

  it("a tag or citation change is its own act and never stages the record", () => {
    expect(run(base(), { type: "tags", tags: [{ name: "x", relevance: 0.1, confidence: 1 }] }).recordStaged).toBe(false);
  });

  // K8.1/D4 (readme.md:8179-8181): the flip drops a standing description.
  it("the_last_picture_leaving_drops_the_standing_description", () => {
    const one = run(media(), { type: "removePicture", id: "m1" });
    expect(isMediaBody(one)).toBe(true);
    expect(one.description).toBe("Rubbings against the salt crust.");
    const words = run(one, { type: "removePicture", id: "m2" });
    expect(isMediaBody(words)).toBe(false);
    expect(words.words).toBe("");
    expect(words.description).toBe("");
    expect(words.recordStaged).toBe(true);
    expect(postEditInput({ ...words, words: "Now it is words." })).toMatchObject({
      description: null,
      content: "Now it is words.",
      attachments: [],
    });
  });

  // EditPicked.md: NEVER the signed edit carries a description — not even one the
  // author re-typed earlier in this same edit, before the last picture left.
  it("a_description_staged_before_the_flip_is_dropped_with_the_last_picture", () => {
    const typed = run(media(), { type: "description", description: "Typed in this edit." });
    expect(postEditInput(typed).description).toBe("Typed in this edit.");
    const words = run(typed, { type: "removePicture", id: "m1" }, { type: "removePicture", id: "m2" });
    expect(words.description).toBe("");
    expect(postEditInput({ ...words, words: "Now words." })).toMatchObject({
      description: null,
      content: "Now words.",
      attachments: [],
    });
  });

  it("the words path sends no description, the media path its own", () => {
    expect(postEditInput(base({ description: "left over" })).description).toBeNull();
    expect(postEditInput(media()).description).toBe("Rubbings against the salt crust.");
    expect(postEditInput(media()).content).toBe("");
  });

  it("re-states the whole gallery, in order, described", () => {
    expect(postEditInput(run(media(), { type: "describe", id: "m2", altText: " A rubbing " })).attachments).toEqual([
      { mediaId: "m1", altText: null, coverMediaId: null, coverTaken: null },
      { mediaId: "m2", altText: "A rubbing", coverMediaId: null, coverTaken: null },
    ]);
  });

  it("reads one clip as the video body", () => {
    expect(isClipBody(base({ words: "", gallery: [kept("v1", "", { video: true })], durations: { v1: 4000 } }))).toBe(true);
    expect(isClipBody(media())).toBe(false);
  });

  // PICK-IS-THE-EDGE (round 15, EditCompose.md + EditPad.md): the edit's
  // record carries its OWN value, 0.00 unless moved, and the client never
  // computes a delta against the backing.
  describe("the edit's own pick", () => {
    it("opens at 0.00 and travels as stated — never left for the server to fill", () => {
      expect(base().pick).toBe(0);
      expect(postEditInput(base()).pDirected).toBe(0);
    });

    it("carries the pick exactly as set, whatever the backing stands at", () => {
      const moved = run(base(), { type: "pick", pick: 0.3 });
      expect(moved.pick).toBe(0.3);
      expect(postEditInput(moved).pDirected).toBe(0.3);
    });

    it("a moved pick alone fills the batch", () => {
      expect(run(base(), { type: "pick", pick: -0.25 }).recordStaged).toBe(true);
    });

    it("a Set at 0.00 adds no record to the batch, and never clears one staged", () => {
      expect(run(base(), { type: "pick", pick: 0 }).recordStaged).toBe(false);
      const typed = run(base(), { type: "title", title: "Salt maps!" }, { type: "pick", pick: 0 });
      expect(typed.recordStaged).toBe(true);
      // Sticky, as every field is: moving it back to 0.00 keeps the record.
      expect(run(base(), { type: "pick", pick: 0.4 }, { type: "pick", pick: 0 }).recordStaged).toBe(true);
    });

    it("a pick that reads 0.00 is 0 and adds no record — never a ghost from a float", () => {
      // The bug this pins: 0.004 printed +0.00 and still staged a record.
      const near = run(base(), { type: "pick", pick: 0.004 });
      expect(near.pick).toBe(0);
      expect(near.recordStaged).toBe(false);
      expect(Object.is(run(base(), { type: "pick", pick: -0.0049 }).pick, 0)).toBe(true);
      expect(run(base(), { type: "pick", pick: -0.0049 }).recordStaged).toBe(false);
      expect(postEditInput(near).pDirected).toBe(0);
    });

    it("carries the pick on the hundredths grid", () => {
      expect(run(base(), { type: "pick", pick: 0.4371 }).pick).toBe(0.44);
      expect(run(base(), { type: "pick", pick: 0.1 + 0.2 }).pick).toBe(0.3);
    });

    it("authors +0 for a −0 (PR-91's normalization) and clamps to the strip", () => {
      expect(Object.is(run(base(), { type: "pick", pick: -0 }).pick, 0)).toBe(true);
      expect(run(base(), { type: "pick", pick: 3 }).pick).toBe(1);
    });
  });

  it("holds the sign on a words body past its cap", () => {
    expect(postEditProblem(base({ words: "x".repeat(5001) }))).not.toBeNull();
    expect(postEditProblem(base())).toBeNull();
  });
});

/** A picture back from the crop, framed, its upload not yet started. */
function framed(id: string, upload: PickedAsset["upload"] = { kind: "waiting" }): PickedAsset {
  return {
    id,
    file: new Blob(["x"], { type: "image/jpeg" }),
    crop: { x: 0, y: 0, zoom: 1, area: null, areaPercent: null },
    altText: "",
    upload,
  };
}

const clipPost = (extra: Partial<KeptPicture> = {}) =>
  base({
    words: "",
    gallery: [kept("v1", "", { video: true, ratio: 9 / 16, coverMediaId: "c1", coverTaken: false, ...extra })],
    durations: { v1: 18_000 },
  });

// EditCompose.md: "+ Add pictures · 2 of 10 … they pass the crop locked to the
// post's one shape AND the picked row grows by them".
describe("the edit's add paths", () => {
  it("grows the picked row by what the crop hands back, staging the record", () => {
    const grown = run(media(), { type: "addPictures", assets: [framed("a1")], shape: "tall" });
    expect(grown.gallery).toHaveLength(3);
    expect(grown.recordStaged).toBe(true);
    // The shape stays the post's: the crop was locked to it.
    expect(grown.shape).toBe("tall");
  });

  it("never grows the body past ten pictures", () => {
    const nine = base({ words: "", shape: "square", gallery: Array.from({ length: 9 }, (_, i) => kept(`m${i}`)) });
    const grown = run(nine, { type: "addPictures", assets: [framed("a1"), framed("a2")], shape: "square" });
    expect(grown.gallery).toHaveLength(10);
  });

  // EditWords.md: "they pass the crop AND the words they replace are gone from the body".
  it("lets pictures replace a words body, the shape the chips chose", () => {
    const pictures = run(base(), { type: "addPictures", assets: [framed("a1")], shape: "wide" });
    expect(isMediaBody(pictures)).toBe(true);
    expect(pictures.words).toBe("");
    expect(pictures.shape).toBe("wide");
  });

  it("forgets the shape when the last picture leaves, so words can choose again", () => {
    const words = run(media(), { type: "removePicture", id: "m1" }, { type: "removePicture", id: "m2" });
    expect(words.shape).toBeNull();
  });

  it("holds the gallery back until an added picture has landed", () => {
    const grown = run(media(), { type: "addPictures", assets: [framed("a1")], shape: "tall" });
    const landed = run(grown, { type: "upload", id: "a1", upload: { kind: "done", mediaId: "m9" } });
    expect(postEditInput(landed).attachments.map((entry) => entry.mediaId)).toEqual(["m1", "m2", "m9"]);
  });

  it("an upload's progress stages nothing of its own", () => {
    const grown = { ...run(media(), { type: "addPictures", assets: [framed("a1")], shape: "tall" }), recordStaged: false };
    expect(run(grown, { type: "upload", id: "a1", upload: { kind: "uploading" } }).recordStaged).toBe(false);
  });

  it("cuts an added picture at the post's shape", () => {
    expect(uploadRatio(media(), "a1")).toBeCloseTo(0.8);
  });
});

// EditComposeVideo.md: "a picture is picked for the cover -> it passes the crop
// locked to the clip's shape AND the new cover joins the edit's batch".
describe("a clip's new face", () => {
  it("joins the batch and points the clip at it once it lands", () => {
    const set = run(clipPost(), { type: "cover", cover: framed("face") });
    expect(set.recordStaged).toBe(true);
    const landed = run(set, { type: "upload", id: "face", upload: { kind: "done", mediaId: "c9" } });
    expect(postEditInput(landed).attachments).toEqual([
      { mediaId: "v1", altText: null, coverMediaId: "c9", coverTaken: null },
    ]);
  });

  it("is cut at the clip's own ratio", () => {
    const set = run(clipPost(), { type: "cover", cover: framed("face") });
    expect(uploadRatio(set, "face")).toBeCloseTo(9 / 16);
  });

  // EditComposeVideo.md: "Remove it under the cover row -> the new cover
  // leaves the batch AND the cover field reads as it stood before the edit".
  it("taken back, leaves the clip's face as it stood", () => {
    const back = run(clipPost(), { type: "cover", cover: framed("face") }, { type: "cover", cover: null });
    expect(postEditInput(back).attachments).toEqual([
      { mediaId: "v1", altText: null, coverMediaId: "c1", coverTaken: false },
    ]);
  });

  it("is never set on a body that holds no clip", () => {
    expect(run(media(), { type: "cover", cover: framed("face") })).toEqual(media());
  });
});
