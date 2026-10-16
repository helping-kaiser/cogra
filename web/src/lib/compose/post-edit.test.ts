// The post edit's state (EditCompose.md, EditWords.md, EditPicked.md,
// EditComposeUnchanged.md; design/readme.md:8179-8181 for the flip).

import { describe, expect, it } from "vitest";

import type { EditGallery } from "./comment-edit";
import {
  isClipBody,
  isMediaBody,
  postEditInput,
  postEditReducer,
  postEditProblem,
  type PostEditAction,
  type PostEditState,
} from "./post-edit";

function kept(id: string, altText = ""): EditGallery[number] {
  return {
    kind: "kept",
    mediaId: id,
    url: `https://media.test/${id}.webp`,
    altText,
    coverMediaId: null,
    coverTaken: null,
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
    expect(isClipBody(base({ words: "", gallery: [kept("v1")], durations: { v1: 4000 } }))).toBe(true);
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
