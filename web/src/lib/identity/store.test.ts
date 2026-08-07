// @vitest-environment node

// Custody round-trips over fake-indexeddb; Ed25519 needs Node's
// crypto.subtle, hence the node environment (as the crypto suites).

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

import { beforeEach, describe, expect, it } from "vitest";

import { ActorKey } from "@/lib/crypto/actor-key";
import { randomBytes } from "@/lib/crypto/bytes";
import { verify, Tags } from "@/lib/crypto/hashing";
import { AddrId, ActId } from "@/lib/crypto/identifiers";
import { Proposal, StructuralBody } from "@/lib/crypto/handshake";
import { createIdentityStore, type IdentityStore } from "./store";

function sampleProposal(): Proposal {
  const body = new StructuralBody({
    author: "aa".repeat(20),
    seq: 1n,
    family: "registration",
    middle: null,
    target: new AddrId("bb".repeat(20)),
    pD: 0.5,
    pI: 0.25,
    settlementRef: null,
    license: null,
    assertedParents: [new ActId("cc".repeat(20), 4n, "opinion")],
  });
  return new Proposal(body, new TextEncoder().encode("payload"), [
    new ActId("dd".repeat(20), 9n, "publish"),
  ]);
}

describe("identity store", () => {
  let store: IdentityStore;

  beforeEach(() => {
    // A fresh factory per test — the documented fake-indexeddb reset;
    // deleting the database would block on the prior store's open
    // connection, which the store deliberately never closes.
    globalThis.indexedDB = new IDBFactory();
    store = createIdentityStore();
  });

  it("is empty before the ceremony", async () => {
    expect(await store.actorKey()).toBeNull();
    expect(await store.actorSeed()).toBeNull();
    expect(await store.pendingBackupBlob()).toBeNull();
    expect(await store.handshakeIds()).toEqual([]);
  });

  it("persists a minted actor with the seed retained", async () => {
    const seed = randomBytes(32);
    const saved = await store.saveActor(seed, true);
    expect(await store.actorSeed()).toEqual(seed);

    const loaded = await store.actorKey();
    expect(loaded).not.toBeNull();
    expect(loaded?.publicKeyBytes()).toEqual(saved.publicKeyBytes());
    expect(loaded?.publicKeyBytes()).toEqual((await ActorKey.fromSeed(seed)).publicKeyBytes());
  });

  it("a loaded key signs verifiably and does not retain the seed", async () => {
    await store.saveActor(randomBytes(32), true);
    const loaded = await store.actorKey();
    if (loaded === null) throw new Error("expected a stored key");
    const msg = new TextEncoder().encode("msg");
    const signature = await loaded.signTagged(Tags.APPROVAL, msg);
    expect(await verify(loaded.publicKeyBytes(), Tags.APPROVAL, msg, signature)).toBe(true);
    expect(() => loaded.seed()).toThrow("not retained");
  });

  it("a restore persists without the seed", async () => {
    await store.saveActor(randomBytes(32), false);
    expect(await store.actorKey()).not.toBeNull();
    expect(await store.actorSeed()).toBeNull();
  });

  it("wipes the seed once a blob is uploaded, keeping the key", async () => {
    const seed = randomBytes(32);
    await store.saveActor(seed, true);
    await store.clearActorSeed();
    expect(await store.actorSeed()).toBeNull();
    expect(await store.actorKey()).not.toBeNull();
    await store.clearActorSeed();
    expect(await store.actorSeed()).toBeNull();
  });

  it("parks and clears the pending backup blob", async () => {
    const blob = randomBytes(64);
    await store.savePendingBackupBlob(blob);
    expect(await store.pendingBackupBlob()).toEqual(blob);
    await store.clearPendingBackupBlob();
    expect(await store.pendingBackupBlob()).toBeNull();
  });

  it("round-trips handshake material by staged-write id", async () => {
    const key = await ActorKey.generate();
    const pre = await key.preSign(sampleProposal());
    await store.saveHandshake("staged-1", pre);

    const loaded = await store.handshake("staged-1");
    expect(loaded).not.toBeNull();
    expect(loaded?.nonce).toEqual(pre.nonce);
    expect(loaded?.preSignature).toEqual(pre.preSignature);
    expect(loaded?.authorPubkey).toEqual(pre.authorPubkey);
    expect(loaded?.proposal.equals(pre.proposal)).toBe(true);

    expect(await store.handshakeIds()).toEqual(["staged-1"]);
    await store.clearHandshake("staged-1");
    expect(await store.handshake("staged-1")).toBeNull();
    expect(await store.handshakeIds()).toEqual([]);
  });

  it("returns null for unknown handshake ids", async () => {
    expect(await store.handshake("missing")).toBeNull();
  });

  it("remembers the reciprocation answer one-way", async () => {
    expect(await store.reciprocationHandled()).toBe(false);
    await store.markReciprocationHandled();
    expect(await store.reciprocationHandled()).toBe(true);
  });

  it("upgrades a v1 database in place", async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("cogra.identity", 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("actor");
        req.result.createObjectStore("pendingBackup");
        req.result.createObjectStore("handshake");
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    store = createIdentityStore();
    await store.markReciprocationHandled();
    expect(await store.reciprocationHandled()).toBe(true);
  });
});
