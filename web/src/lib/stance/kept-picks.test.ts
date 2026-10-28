// The kept picks' custody (PadKeyAbsent.md:33-41, KeptPicksReview.md:5):
// one per target, several at once, per account, surviving a restart, and a
// vouch-back or an approval kept as itself — never as a plain opinion.

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import {
  createKeptPickStore,
  keepPick,
  keptOpinions,
  listKeptPicks,
  refreshKeptPicks,
  resetKeptPicksForTests,
} from "./kept-picks";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const POST = { kind: "post" as const, id: "post-1" };
const PERSON = { kind: "profile" as const, id: "user-1" };

let idb: IDBFactory;
beforeEach(() => {
  idb = new IDBFactory();
  resetKeptPicksForTests(() => idb);
  window.localStorage.clear();
});

describe("a kept pick", () => {
  it("replaces the pick already kept on the same target", async () => {
    // PadKeyAbsent.md:31 — the new pick replaces the kept one.
    const store = createKeptPickStore({ idb: () => idb });
    await store.keep(A, POST, { pDirected: 0.1, pInterest: 0.1 }, "opinion");
    await store.keep(A, POST, { pDirected: 0.55, pInterest: 0.2 }, "opinion");
    const kept = await store.list(A);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.pick).toEqual({ pDirected: 0.55, pInterest: 0.2 });
  });

  it("waits beside others, one per target, in the order they were kept", async () => {
    // PadKeyAbsent.md:35 — several picks can wait at once, one per target.
    await keepPick(A, POST, { pDirected: 0.1, pInterest: 0.1 });
    await keepPick(A, PERSON, { pDirected: 0.55, pInterest: 0.2 });
    expect((await listKeptPicks(A)).map((k) => k.target)).toEqual([POST, PERSON]);
  });

  it("survives a restart: a fresh store over the same custody reads it back", async () => {
    // PadKeyAbsent.md:33 — lives on this device only and survives a restart.
    await createKeptPickStore({ idb: () => idb }).keep(A, POST, { pDirected: 0.1, pInterest: 0.1 }, "opinion");
    const reopened = createKeptPickStore({ idb: () => idb });
    expect((await reopened.list(A)).map((k) => k.target)).toEqual([POST]);
  });

  it("belongs to its account and never shows on another's", async () => {
    await keepPick(A, POST, { pDirected: 0.1, pInterest: 0.1 });
    expect(await listKeptPicks(B)).toEqual([]);
  });

  it("keeps a vouch-back or an approval as itself, out of the opinions' batch", async () => {
    // KeptPicksReview.md:5 — a kept vouch-back or approval never joins the review.
    await keepPick(A, POST, { pDirected: 0.1, pInterest: 0.1 }, "opinion");
    await keepPick(A, PERSON, { pDirected: 0.3, pInterest: 0.3 }, "approval");
    const all = await listKeptPicks(A);
    expect(all.map((k) => k.family)).toEqual(["opinion", "approval"]);
    expect(keptOpinions(all).map((k) => k.target)).toEqual([POST]);
  });

  it("is dropped one by one, and all at once by the don't-remember sign-out", async () => {
    const store = createKeptPickStore({ idb: () => idb });
    await store.keep(A, POST, { pDirected: 0.1, pInterest: 0.1 }, "opinion");
    await store.keep(A, PERSON, { pDirected: 0.1, pInterest: 0.1 }, "opinion");
    await store.keep(B, POST, { pDirected: 0.1, pInterest: 0.1 }, "opinion");
    await store.drop(A, [POST]);
    expect((await store.list(A)).map((k) => k.target)).toEqual([PERSON]);
    await store.forget(A);
    expect(await store.list(A)).toEqual([]);
    expect(await store.list(B)).toHaveLength(1);
  });

  it("adopts the localStorage stand-in's picks once, then drops the stand-in", async () => {
    window.localStorage.setItem(
      `cogra.keptPicks.${A}`,
      JSON.stringify({ "post:post-1": { pDirected: 0.55, pInterest: 0.2 } }),
    );
    await refreshKeptPicks(A);
    const kept = await listKeptPicks(A);
    expect(kept.map((k) => [k.target, k.pick, k.family])).toEqual([
      [POST, { pDirected: 0.55, pInterest: 0.2 }, "opinion"],
    ]);
    expect(window.localStorage.getItem(`cogra.keptPicks.${A}`)).toBeNull();
  });
});
