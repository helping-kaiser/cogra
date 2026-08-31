// The wizard's every branch, exercised on the model rather than through five
// screens. What is worth breaking here is not the happy path: it is the reader
// who changes their mind mid-flow, the eleventh picture, the upload that fails
// after four succeed, and the seal reached while bytes are still moving.

import { describe, expect, it } from "vitest";

import { CENTERED } from "@/lib/ui2/media/crop";
import { PUBLIC_DOMAIN } from "@/lib/license";
import {
  advanceGate,
  attachmentIds,
  bodyContent,
  bodyGate,
  emptyWizard,
  nextStep,
  POST_ATTACHMENT_CAP,
  previousStep,
  sealGate,
  signedActions,
  stepsFor,
  uploadsFailed,
  uploadsPending,
  wizardReducer,
  type WizardAction,
  type WizardState,
} from "./wizard";

const bytes = (n: number) => new Blob([new Uint8Array(n) as BlobPart]);

function run(state: WizardState, ...actions: readonly WizardAction[]): WizardState {
  return actions.reduce(wizardReducer, state);
}

function picks(count: number): WizardAction {
  return {
    type: "pick",
    assets: Array.from({ length: count }, (_, i) => ({ id: `a${i}`, file: bytes(8) })),
  };
}

function uploaded(state: WizardState): WizardState {
  return state.assets.reduce(
    (acc, asset) =>
      wizardReducer(acc, {
        type: "upload",
        id: asset.id,
        upload: { kind: "done", mediaId: `m-${asset.id}` },
      }),
    state,
  );
}

describe("the step sequence", () => {
  it("skips the crop screen for a words post", () => {
    expect(stepsFor("words")).toEqual(["pick", "details", "seal"]);
    expect(stepsFor("media")).toEqual(["pick", "crop", "details", "seal"]);
  });

  it("walks forwards only through gates that open", () => {
    const empty = emptyWizard();
    // Nothing picked: the pick screen holds.
    expect(wizardReducer(empty, { type: "advance" }).step).toBe("pick");

    const withMedia = run(empty, picks(1), { type: "advance" });
    expect(withMedia.step).toBe("crop");
    expect(run(withMedia, { type: "advance" }).step).toBe("details");
    expect(run(withMedia, { type: "advance" }, { type: "advance" }).step).toBe("seal");
  });

  it("stops at the seal, which is signed rather than stepped past", () => {
    const sealed = run(emptyWizard(), picks(1), { type: "goto", step: "seal" });
    expect(nextStep(sealed)).toBeNull();
    expect(wizardReducer(sealed, { type: "advance" }).step).toBe("seal");
  });

  it("has no step before the first, where back leaves the wizard", () => {
    expect(previousStep(emptyWizard())).toBeNull();
    expect(wizardReducer(emptyWizard(), { type: "back" }).step).toBe("pick");
  });

  it("walks back through the mode's own sequence", () => {
    const words = run(emptyWizard(), { type: "mode", mode: "words" }, { type: "goto", step: "seal" });
    // A words post steps back to details, never to a crop screen it never had.
    expect(previousStep(words)).toBe("details");
    expect(run(words, { type: "back" }, { type: "back" }).step).toBe("pick");
  });

  it("starts unmarked, and keeps the reason when the mark is switched off", () => {
    const fresh = emptyWizard();
    expect(fresh.sensitive).toBe(false);
    expect(fresh.sensitiveReason).toBe("");

    const marked = run(
      fresh,
      { type: "sensitive", sensitive: true },
      { type: "sensitiveReason", sensitiveReason: "one rubbing includes a dead seabird" },
    );
    expect(marked.sensitive).toBe(true);

    // Switching off does not throw the words away — an author who toggles back
    // should not have to write them twice. What is SENT is gated on the switch.
    const off = wizardReducer(marked, { type: "sensitive", sensitive: false });
    expect(off.sensitive).toBe(false);
    expect(off.sensitiveReason).toBe("one rubbing includes a dead seabird");
  });

  it("reorders the set, and the first picture is what the cover means", () => {
    const three = run(emptyWizard(), picks(3));
    const moved = wizardReducer(three, { type: "reorder", from: 2, to: 0 });
    expect(moved.assets.map((a) => a.id)).toEqual(["a2", "a0", "a1"]);
  });

  it("carries the focus with the picture that moved, not with its old slot", () => {
    const three = run(emptyWizard(), picks(3), { type: "focus", index: 2 });
    const moved = wizardReducer(three, { type: "reorder", from: 2, to: 0 });
    // The reader was framing a2; they are still framing a2.
    expect(moved.focused).toBe(0);
    expect(moved.assets[moved.focused].id).toBe("a2");
  });

  it("shifts a bystander's focus by one when a picture moves past it", () => {
    const three = run(emptyWizard(), picks(3), { type: "focus", index: 0 });
    const moved = wizardReducer(three, { type: "reorder", from: 2, to: 0 });
    expect(moved.assets[moved.focused].id).toBe("a0");
  });

  it("ignores a reorder that goes nowhere or off the end", () => {
    const three = run(emptyWizard(), picks(3));
    expect(wizardReducer(three, { type: "reorder", from: 1, to: 1 })).toBe(three);
    expect(wizardReducer(three, { type: "reorder", from: 0, to: 9 })).toBe(three);
    expect(wizardReducer(three, { type: "reorder", from: -1, to: 0 })).toBe(three);
  });

  it("steps back ONE stage at a time down the media path", () => {
    // The ruling (jakob 2026-08-31): back steps back one stage — it never jumps
    // to the start and never leaves the wizard from the middle. The draft is
    // kept either way, so there is no cancellation affordance to reach.
    const sealed = run(emptyWizard(), picks(1), { type: "goto", step: "seal" });
    const details = wizardReducer(sealed, { type: "back" });
    expect(details.step).toBe("details");
    const crop = wizardReducer(details, { type: "back" });
    expect(crop.step).toBe("crop");
    const pick = wizardReducer(crop, { type: "back" });
    expect(pick.step).toBe("pick");
    // And the body survives every one of those steps — stepping back is not a
    // discard.
    expect(pick.assets).toHaveLength(1);
    expect(pick.mode).toBe("media");
  });

  it("refuses a goto the mode does not have", () => {
    const words = run(emptyWizard(), { type: "mode", mode: "words" });
    expect(wizardReducer(words, { type: "goto", step: "crop" }).step).toBe("pick");
  });
});

describe("the body XOR", () => {
  it("sends words on a words post and a gallery on a media post, never both", () => {
    const words = run(emptyWizard(), { type: "mode", mode: "words" }, { type: "words", words: "hi" });
    expect(bodyContent(words)).toBe("hi");
    expect(attachmentIds(words)).toBeNull();

    const media = uploaded(run(emptyWizard(), picks(2)));
    expect(bodyContent(media)).toBeNull();
    expect(attachmentIds(media)).toEqual(["m-a0", "m-a1"]);
  });

  it("keeps the inactive side's draft, so a mis-tap loses nothing", () => {
    const both = run(
      emptyWizard(),
      { type: "mode", mode: "words" },
      { type: "words", words: "three weekends at low tide" },
      { type: "mode", mode: "media" },
      picks(1),
    );
    expect(both.words).toBe("three weekends at low tide");
    expect(both.assets).toHaveLength(1);
    // Only the active side is what the post is made of.
    expect(bodyContent(both)).toBeNull();

    const back = wizardReducer(both, { type: "mode", mode: "words" });
    expect(bodyContent(back)).toBe("three weekends at low tide");
    expect(attachmentIds(back)).toBeNull();
  });

  it("returns to the pick screen when the body changes sides", () => {
    const cropping = run(emptyWizard(), picks(1), { type: "advance" });
    expect(cropping.step).toBe("crop");
    expect(wizardReducer(cropping, { type: "mode", mode: "words" }).step).toBe("pick");
  });

  it("does not move when the mode is set to what it already is", () => {
    const cropping = run(emptyWizard(), picks(1), { type: "advance" });
    expect(wizardReducer(cropping, { type: "mode", mode: "media" })).toBe(cropping);
  });

  it("refuses an empty body on either side", () => {
    expect(bodyGate(emptyWizard()).ok).toBe(false);
    const blank = run(emptyWizard(), { type: "mode", mode: "words" }, { type: "words", words: "   " });
    expect(bodyGate(blank)).toEqual({ ok: false, reason: "The post needs a body." });
  });
});

describe("the picker", () => {
  it("stops at the cap rather than letting the seal refuse the batch", () => {
    const full = run(emptyWizard(), picks(POST_ATTACHMENT_CAP + 4));
    expect(full.assets).toHaveLength(POST_ATTACHMENT_CAP);
    expect(bodyGate(full).ok).toBe(true);
  });

  it("takes only what still fits when picking twice", () => {
    const state = run(emptyWizard(), picks(8), {
      type: "pick",
      assets: [
        { id: "x0", file: bytes(1) },
        { id: "x1", file: bytes(1) },
        { id: "x2", file: bytes(1) },
      ],
    });
    expect(state.assets).toHaveLength(10);
    expect(state.assets.map((a) => a.id).slice(-2)).toEqual(["x0", "x1"]);
  });

  it("gives every pick a centred crop and no alt text", () => {
    const state = run(emptyWizard(), picks(1));
    expect(state.assets[0]!.crop).toEqual(CENTERED);
    expect(state.assets[0]!.altText).toBe("");
    expect(state.assets[0]!.upload).toEqual({ kind: "waiting" });
  });

  it("pulls the focus back in range when the focused asset is removed", () => {
    const state = run(emptyWizard(), picks(3), { type: "focus", index: 2 });
    expect(state.focused).toBe(2);
    const fewer = wizardReducer(state, { type: "unpick", id: "a2" });
    expect(fewer.assets).toHaveLength(2);
    expect(fewer.focused).toBe(1);
  });

  it("clamps a focus that points past the end", () => {
    const state = run(emptyWizard(), picks(2), { type: "focus", index: 99 });
    expect(state.focused).toBe(1);
    expect(run(emptyWizard(), { type: "focus", index: 3 }).focused).toBe(0);
  });

  // Round 5: "shape-switch must allow re-framing any section at any ratio". The
  // measured rectangle carries the OLD shape, so keeping it would bake the old
  // shape into the upload; dropping it makes the cropper measure a fresh one
  // against the original picture. Where the reader had put each picture — the
  // position and the zoom — is theirs and stays.
  it("re-frames every picture against the original when the post's shape changes", () => {
    const framed = run(
      emptyWizard(),
      picks(2),
      {
        type: "crop",
        id: "a1",
        crop: { x: 12, y: -8, zoom: 2, area: { x: 0, y: 100, width: 800, height: 1000 } },
      },
      { type: "shape", shape: "wide" },
    );
    expect(framed.shape).toBe("wide");
    expect(framed.assets[1]!.crop).toEqual({ x: 12, y: -8, zoom: 2, area: null });
    expect(framed.assets[0]!.crop.area).toBeNull();
  });

  it("leaves the framing untouched when the shape does not actually change", () => {
    const area = { x: 0, y: 100, width: 800, height: 1000 };
    const framed = run(
      emptyWizard(),
      picks(1),
      { type: "crop", id: "a0", crop: { x: 1, y: 2, zoom: 2, area } },
      { type: "shape", shape: "tall" },
    );
    expect(framed.assets[0]!.crop.area).toEqual(area);
  });
});

describe("the uploads", () => {
  it("blocks the seal while bytes are still moving, and says how many", () => {
    const state = run(emptyWizard(), picks(3), {
      type: "upload",
      id: "a0",
      upload: { kind: "done", mediaId: "m0" },
    });
    expect(uploadsPending(state)).toBe(2);
    expect(sealGate(state)).toEqual({ ok: false, reason: "2 pictures are still uploading." });

    const nearly = wizardReducer(state, {
      type: "upload",
      id: "a1",
      upload: { kind: "uploading" },
    });
    expect(sealGate(nearly)).toEqual({ ok: false, reason: "2 pictures are still uploading." });
  });

  it("reports a failure ahead of a wait, because only one of them is actionable", () => {
    const state = run(
      emptyWizard(),
      picks(2),
      { type: "upload", id: "a0", upload: { kind: "failed", message: "gone", retryable: true } },
      { type: "upload", id: "a1", upload: { kind: "encoding" } },
    );
    expect(uploadsFailed(state)).toBe(1);
    expect(sealGate(state)).toEqual({ ok: false, reason: "One picture didn't upload." });
  });

  it("opens the seal once every asset has an id, and closes it again on a retry", () => {
    const done = uploaded(run(emptyWizard(), picks(2)));
    expect(sealGate(done).ok).toBe(true);
    expect(attachmentIds(done)).toEqual(["m-a0", "m-a1"]);

    // A retry puts one asset back in flight; the gate must close again rather
    // than leaving a stale "ready".
    const retrying = wizardReducer(done, { type: "upload", id: "a0", upload: { kind: "uploading" } });
    expect(sealGate(retrying).ok).toBe(false);
    expect(attachmentIds(retrying)).toBeNull();
  });

  it("keeps the gallery in pick order however the uploads finish", () => {
    const state = run(
      emptyWizard(),
      picks(3),
      { type: "upload", id: "a2", upload: { kind: "done", mediaId: "third" } },
      { type: "upload", id: "a0", upload: { kind: "done", mediaId: "first" } },
      { type: "upload", id: "a1", upload: { kind: "done", mediaId: "second" } },
    );
    expect(attachmentIds(state)).toEqual(["first", "second", "third"]);
  });

  it("never asks the seal about uploads on a words post", () => {
    const words = run(
      emptyWizard(),
      picks(1),
      { type: "upload", id: "a0", upload: { kind: "failed", message: "gone", retryable: true } },
      { type: "mode", mode: "words" },
      { type: "words", words: "no pictures here" },
    );
    expect(sealGate(words).ok).toBe(true);
  });

  it("holds the advance at the seal step itself", () => {
    const stuck = run(emptyWizard(), picks(1), { type: "goto", step: "seal" });
    expect(advanceGate(stuck).ok).toBe(false);
    expect(advanceGate(uploaded(stuck)).ok).toBe(true);
  });
});

describe("the cost", () => {
  it("prices the post plus one act per topic and per citation", () => {
    const bare = emptyWizard();
    expect(signedActions(bare)).toBe(1);

    const withActs = run(
      bare,
      { type: "tags", tags: [{ name: "fieldnotes", relevance: 0.1, confidence: 1 }] },
      {
        type: "references",
        references: [
          { targetId: "t1", relevance: 0.1, support: 0.1, label: "", kind: "post" },
          { targetId: "t2", relevance: 0.1, support: 0.1, label: "", kind: "post" },
        ] as never,
      },
    );
    expect(signedActions(withActs)).toBe(4);
  });

  it("charges nothing for the pictures themselves", () => {
    const gallery = uploaded(run(emptyWizard(), picks(10)));
    expect(signedActions(gallery)).toBe(1);
  });
});

describe("the details and the sheets", () => {
  it("carries the optional fields and the sheets' state without gating on them", () => {
    const state = run(
      emptyWizard(),
      picks(1),
      { type: "title", title: "Salt maps of the coast road" },
      { type: "description", description: "Rubbings from three weekends." },
      { type: "goto", step: "details" },
    );
    expect(state.title).toBe("Salt maps of the coast road");
    expect(state.description).toBe("Rubbings from three weekends.");
    // Everything on the details screen is optional, so it always hands over.
    expect(advanceGate(state).ok).toBe(true);
  });

  it("starts on the account's default licence and the low-defaults stance", () => {
    expect(emptyWizard().license).toEqual(PUBLIC_DOMAIN);
    expect(emptyWizard().pDirected).toBe(0.1);
  });

  it("keeps the author's stance inside the contract's closed interval", () => {
    expect(wizardReducer(emptyWizard(), { type: "pDirected", pDirected: 4 }).pDirected).toBe(1);
    expect(wizardReducer(emptyWizard(), { type: "pDirected", pDirected: -9 }).pDirected).toBe(-1);
    expect(wizardReducer(emptyWizard(), { type: "pDirected", pDirected: -0.4 }).pDirected).toBe(-0.4);
  });

  it("carries alt text per asset", () => {
    const state = run(emptyWizard(), picks(2), {
      type: "altText",
      id: "a1",
      altText: "paper against the salt crust",
    });
    expect(state.assets[0]!.altText).toBe("");
    expect(state.assets[1]!.altText).toBe("paper against the salt crust");
  });
});
