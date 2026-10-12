// @vitest-environment jsdom

// The sealed copy's custody (FC-G5): sealed at staging, purged on landing,
// restored on an unlanded expiry — and never lost on the way.

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { success, failed, refused } from "@/lib/api/outcome";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { newReferenceDraft } from "@/lib/references/draft";
import { untypedTargetView } from "@/lib/references/normalize";
import { newTagDraft } from "@/lib/topics/draft";
import { createComposeDraftStore, type ComposeDraftStore } from "./draft-store";
import {
  createSealedDraftStore,
  fateOf,
  type SealedDraftStore,
  type StagedFate,
} from "./sealed-draft";
import { emptyWizard, wizardReducer, type WizardState } from "./wizard";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";

let account: string | null;
let drafts: ComposeDraftStore;
let seals: SealedDraftStore;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  account = ACCOUNT_A;
  drafts = createComposeDraftStore({ activeAccountId: () => account });
  seals = createSealedDraftStore({ activeAccountId: () => account });
});

/** The composed state of a full media post: body, description, tags, references, an uploaded picture. */
function composed(title = "Salt maps"): WizardState {
  let state = wizardReducer(emptyWizard(), {
    type: "pick",
    assets: [{ id: "a0", file: new Blob([new Uint8Array([7, 8, 9]) as BlobPart], { type: "image/webp" }) }],
  });
  state = wizardReducer(state, { type: "upload", id: "a0", upload: { kind: "done", mediaId: "m-1" } });
  state = wizardReducer(state, { type: "title", title });
  state = wizardReducer(state, { type: "description", description: "Three weekends at low tide." });
  state = wizardReducer(state, { type: "tags", tags: [newTagDraft("tides")] });
  state = wizardReducer(state, {
    type: "references",
    references: [newReferenceDraft("node-9", untypedTargetView("node-9"))],
  });
  return { ...state, step: "seal" };
}

/** A fate table by write id; anything unnamed is still relaying. */
const fates =
  (table: Record<string, StagedFate>) =>
  async (id: string): Promise<StagedFate> =>
    table[id] ?? "alive";

describe("the sealed copy", () => {
  it("a_staged_post_keeps_a_sealed_copy_until_it_lands", async () => {
    const state = composed();
    await drafts.save(state);
    await seals.seal(state, { node: "post-1", writes: ["w1", "w2"] });

    // Out of the composer: the working draft is gone in the same motion…
    expect(await drafts.load()).toBeNull();
    // …and the copy holds the whole composed post.
    const [copy] = await seals.list();
    expect(copy!.node).toBe("post-1");
    expect(copy!.writes).toEqual(["w1", "w2"]);
    expect(copy!.state.title).toBe("Salt maps");

    // While the write relays, a settle changes nothing — the copy is never offered.
    await seals.settle(fates({}));
    expect(await drafts.load()).toBeNull();
    expect(await seals.list()).toHaveLength(1);
  });

  it("a_landed_post_purges_its_sealed_copy", async () => {
    await seals.seal(composed(), { node: "post-1", writes: ["w1", "w2"] });
    await seals.settle(fates({ w1: "landed", w2: "landed" }));
    expect(await seals.list()).toHaveLength(0);
    expect(await drafts.load()).toBeNull();
  });

  it("a batch only partly landed keeps waiting", async () => {
    await seals.seal(composed(), { node: "post-1", writes: ["w1", "w2"] });
    await seals.settle(fates({ w1: "landed" }));
    expect(await seals.list()).toHaveLength(1);
  });

  it("an_expired_post_restores_its_draft — whole: body, description, tags, references, media", async () => {
    await seals.seal(composed(), { node: "post-1", writes: ["w1", "w2"] });
    await seals.settle(fates({ w1: "expired" }));

    expect(await seals.list()).toHaveLength(0);
    const draft = await drafts.load();
    expect(draft).not.toBeNull();
    expect(draft!.title).toBe("Salt maps");
    expect(draft!.description).toBe("Three weekends at low tide.");
    expect(draft!.tags.map((tag) => tag.name)).toEqual(["tides"]);
    expect(draft!.references.map((reference) => reference.targetId)).toEqual(["node-9"]);
    // The picture itself, and the upload it already earned.
    expect(await draft!.assets[0]!.file.text()).toBe("\u0007\u0008\u0009");
    expect(draft!.assets[0]!.upload).toEqual({ kind: "done", mediaId: "m-1" });
    // It resumes where it was sealed.
    expect(draft!.step).toBe("seal");
  });

  it("a mixed answer restores rather than purges — a spare draft is one Discard away, a lost one is gone", async () => {
    await seals.seal(composed(), { node: "post-1", writes: ["w1", "w2"] });
    await seals.settle(fates({ w1: "landed", w2: "expired" }));
    expect(await drafts.load()).not.toBeNull();
  });

  it("decides nothing on a read that did not answer", async () => {
    await seals.seal(composed(), { node: "post-1", writes: ["w1"] });
    await seals.settle(fates({ w1: "unknown" }));
    expect(await seals.list()).toHaveLength(1);
    expect(await drafts.load()).toBeNull();
  });

  it("never overwrites a draft the author started since: the copy waits for the slot", async () => {
    await seals.seal(composed("the staged one"), { node: "post-1", writes: ["w1"] });
    await drafts.save(composed("a newer draft"));

    await seals.settle(fates({ w1: "expired" }));
    expect((await drafts.load())!.title).toBe("a newer draft");
    expect(await seals.list()).toHaveLength(1);

    // The newer draft is discarded; the next settle hands the copy back.
    await drafts.clear();
    await seals.settle(fates({ w1: "expired" }));
    expect((await drafts.load())!.title).toBe("the staged one");
    expect(await seals.list()).toHaveLength(0);
  });

  it("keeps one copy per staged post, so a second staging never overwrites the first", async () => {
    await seals.seal(composed("first"), { node: "post-1", writes: ["w1"] });
    await seals.seal(composed("second"), { node: "post-2", writes: ["w2"] });
    expect((await seals.list()).map((copy) => copy.state.title)).toEqual(["first", "second"]);

    await seals.settle(fates({ w1: "expired", w2: "expired" }));
    // One draft slot: the oldest takes it, the other waits sealed.
    expect((await drafts.load())!.title).toBe("first");
    expect((await seals.list()).map((copy) => copy.state.title)).toEqual(["second"]);
  });

  it("is the account's own: another account neither sees nor settles it", async () => {
    await seals.seal(composed(), { node: "post-1", writes: ["w1"] });
    account = ACCOUNT_B;
    expect(await seals.list()).toHaveLength(0);
    await seals.settle(fates({ w1: "expired" }));
    expect(await drafts.load()).toBeNull();
    account = ACCOUNT_A;
    expect(await seals.list()).toHaveLength(1);
  });

  it("goes with the draft on a forgetting sign-out, and only this account's", async () => {
    await seals.seal(composed(), { node: "post-1", writes: ["w1"] });
    account = ACCOUNT_B;
    await seals.seal(composed(), { node: "post-2", writes: ["w2"] });
    await seals.forget();
    expect(await seals.list()).toHaveLength(0);
    account = ACCOUNT_A;
    expect(await seals.list()).toHaveLength(1);
  });

  it("is not touched by the draft's own Discard", async () => {
    await seals.seal(composed(), { node: "post-1", writes: ["w1"] });
    await drafts.save(composed("another"));
    await drafts.clear();
    expect(await seals.list()).toHaveLength(1);
  });
});

describe("a staged write's fate", () => {
  const view = (state: StagedWriteView["state"]): StagedWriteView => ({
    id: "w1",
    state,
    family: "PUBLISH",
    canonicalProposal: "AA==",
    verifiedAct: null,
  });

  it("reads LANDED as landed and EXPIRED as expired", () => {
    expect(fateOf(success(view("LANDED")))).toBe("landed");
    expect(fateOf(success(view("EXPIRED")))).toBe("expired");
  });

  it("reads every open state as alive", () => {
    expect(fateOf(success(view("RELAYING")))).toBe("alive");
    expect(fateOf(success(view("SEALING")))).toBe("alive");
  });

  // Only an expired row is ever deleted (the reap), so a vanished write of this
  // account was collected unlanded.
  it("reads a write the server no longer knows as expired", () => {
    expect(fateOf(success(null))).toBe("expired");
  });

  it("reads a read that did not answer as unknown", () => {
    expect(fateOf(failed(new Error("offline")))).toBe("unknown");
    expect(fateOf(refused([{ code: "INTERNAL", message: "x", field: null }]))).toBe("unknown");
  });
});
