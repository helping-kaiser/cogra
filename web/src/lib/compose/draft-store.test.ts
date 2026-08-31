// @vitest-environment jsdom

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { composeDraftStore, draftIsWorthKeeping, draftSummary } from "./draft-store";
import { emptyWizard, wizardReducer, type WizardState } from "./wizard";

function draft(...changes: ((s: WizardState) => WizardState)[]): WizardState {
  return changes.reduce((state, change) => change(state), emptyWizard());
}

const picked = (id: string) => (state: WizardState) =>
  wizardReducer(state, {
    type: "pick",
    assets: [{ id, file: new Blob([new Uint8Array([7]) as BlobPart]) }],
  });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("the local draft", () => {
  it("is absent until something is saved", async () => {
    expect(await composeDraftStore.load()).toBeNull();
  });

  it("brings the pictures back, not just the words", async () => {
    const state = draft(picked("a0"), (s) =>
      wizardReducer(s, { type: "title", title: "Salt maps of the coast road" }),
    );
    await composeDraftStore.save(state);

    const restored = await composeDraftStore.load();
    expect(restored!.title).toBe("Salt maps of the coast road");
    expect(restored!.assets).toHaveLength(1);
    expect(restored!.assets[0]!.file).toBeInstanceOf(Blob);
    expect(await restored!.assets[0]!.file.text()).toBe(await state.assets[0]!.file.text());
  });

  it("resumes on the step the draft was left on", async () => {
    const state = draft(picked("a0"), (s) => wizardReducer(s, { type: "advance" }));
    expect(state.step).toBe("crop");
    await composeDraftStore.save(state);
    expect((await composeDraftStore.load())!.step).toBe("crop");
  });

  it("restarts an upload that the reload interrupted", async () => {
    const state = draft(
      picked("a0"),
      picked("a1"),
      (s) => wizardReducer(s, { type: "upload", id: "a0", upload: { kind: "uploading" } }),
      (s) => wizardReducer(s, { type: "upload", id: "a1", upload: { kind: "encoding" } }),
    );
    await composeDraftStore.save(state);

    const restored = await composeDraftStore.load();
    expect(restored!.assets.map((a) => a.upload)).toEqual([
      { kind: "waiting" },
      { kind: "waiting" },
    ]);
  });

  it("keeps an id an upload already earned, because the asset row is immutable", async () => {
    const state = draft(picked("a0"), (s) =>
      wizardReducer(s, { type: "upload", id: "a0", upload: { kind: "done", mediaId: "m-1" } }),
    );
    await composeDraftStore.save(state);
    expect((await composeDraftStore.load())!.assets[0]!.upload).toEqual({
      kind: "done",
      mediaId: "m-1",
    });
  });

  it("replaces rather than accumulates, and clears on demand", async () => {
    await composeDraftStore.save(draft(picked("a0")));
    await composeDraftStore.save(draft(picked("b0"), picked("b1")));
    expect((await composeDraftStore.load())!.assets).toHaveLength(2);

    await composeDraftStore.clear();
    expect(await composeDraftStore.load()).toBeNull();
  });

  // The published draft that came back. `save` has to read every picked blob
  // before it can write, so a save that began before the post was signed is
  // still reading when `clear` runs — and its write lands afterwards.
  it("does not let a save that began before the clear write the draft back", async () => {
    let release!: (bytes: ArrayBuffer) => void;
    const held = new Promise<ArrayBuffer>((resolve) => {
      release = resolve;
    });
    const state = draft(picked("a0"));
    const slow = {
      type: "image/webp",
      arrayBuffer: () => held,
    } as unknown as Blob;
    const saving = composeDraftStore.save({
      ...state,
      assets: [{ ...state.assets[0]!, file: slow }],
    });

    await composeDraftStore.clear();
    release(new Uint8Array([7]).buffer);
    await saving;

    expect(await composeDraftStore.load()).toBeNull();
  });

  it("still saves normally once the cleared draft has been replaced by a new one", async () => {
    await composeDraftStore.save(draft(picked("a0")));
    await composeDraftStore.clear();

    await composeDraftStore.save(draft(picked("b0")));
    expect((await composeDraftStore.load())!.assets).toHaveLength(1);
  });
});

describe("what the draft card says", () => {
  it("prefers the title, then the first line of the words", () => {
    expect(draftSummary(draft((s) => wizardReducer(s, { type: "title", title: "Salt maps" }))).title).toBe(
      "Salt maps",
    );
    const words = draft(
      (s) => wizardReducer(s, { type: "mode", mode: "words" }),
      (s) => wizardReducer(s, { type: "words", words: "Three weekends\nof walking" }),
    );
    expect(draftSummary(words).title).toBe("Three weekends");
    expect(draftSummary(words).detail).toBe("Words — kept on this device");
    expect(draftSummary(emptyWizard()).title).toBe("Untitled");
  });

  it("counts the pictures in the singular and the plural", () => {
    expect(draftSummary(draft(picked("a"))).detail).toBe("1 picture — kept on this device");
    expect(draftSummary(draft(picked("a"), picked("b"))).detail).toBe(
      "2 pictures — kept on this device",
    );
  });

  it("is not worth offering back when it holds nothing", () => {
    expect(draftIsWorthKeeping(emptyWizard())).toBe(false);
    expect(draftIsWorthKeeping(draft(picked("a")))).toBe(true);
    expect(
      draftIsWorthKeeping(draft((s) => wizardReducer(s, { type: "description", description: "x" }))),
    ).toBe(true);
  });
});
