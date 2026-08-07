// @vitest-environment node

// Custody round-trips over fake-indexeddb; Ed25519 needs Node's
// crypto.subtle, hence the node environment (as the crypto suites).
// Custody is account-keyed (roadmap.md slice 1.1): the suite drives the
// active account through the injected resolver.

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

import { beforeEach, describe, expect, it } from "vitest";

import { ActorKey, importActorKeyPair } from "@/lib/crypto/actor-key";
import { randomBytes } from "@/lib/crypto/bytes";
import { verify, Tags } from "@/lib/crypto/hashing";
import { AddrId, ActId } from "@/lib/crypto/identifiers";
import { Proposal, StructuralBody } from "@/lib/crypto/handshake";
import { createIdentityStore, type IdentityStore } from "./store";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";

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

/**
 * Seeds records the way the pre-multi-account store laid them out:
 * singleton keys, no account anywhere.
 */
async function seedLegacy(records: {
  actorSeed?: Uint8Array;
  backupBlob?: Uint8Array;
  reciprocationDismissed?: boolean;
  handshakeIds?: string[];
}): Promise<void> {
  const actor =
    records.actorSeed === undefined
      ? null
      : {
          ...(await importActorKeyPair(records.actorSeed)),
          seed: records.actorSeed.slice(),
        };
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open("cogra.identity", 2);
    req.onupgradeneeded = () => {
      for (const name of ["actor", "pendingBackup", "handshake", "ux"]) {
        req.result.createObjectStore(name);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(["actor", "pendingBackup", "handshake", "ux"], "readwrite");
      if (actor !== null) tx.objectStore("actor").put(actor, "current");
      if (records.backupBlob !== undefined) {
        tx.objectStore("pendingBackup").put(records.backupBlob, "current");
      }
      if (records.reciprocationDismissed !== undefined) {
        tx.objectStore("ux").put(records.reciprocationDismissed, "reciprocationDismissed");
      }
      for (const id of records.handshakeIds ?? []) {
        tx.objectStore("handshake").put({ marker: id }, id);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

describe("identity store", () => {
  let store: IdentityStore;
  let account: string | null;

  function freshStore(): IdentityStore {
    return createIdentityStore({ activeAccountId: () => account });
  }

  beforeEach(() => {
    // A fresh factory per test — the documented fake-indexeddb reset;
    // deleting the database would block on the prior store's open
    // connection, which the store deliberately never closes.
    globalThis.indexedDB = new IDBFactory();
    account = ACCOUNT_A;
    store = freshStore();
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

  it("remembers the reciprocation dismissal one-way", async () => {
    expect(await store.reciprocationDismissed()).toBe(false);
    await store.markReciprocationDismissed();
    expect(await store.reciprocationDismissed()).toBe(true);
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
    store = freshStore();
    await store.markReciprocationDismissed();
    expect(await store.reciprocationDismissed()).toBe(true);
  });

  it("keeps two accounts' custody side by side", async () => {
    const seedA = randomBytes(32);
    const seedB = randomBytes(32);
    await store.saveActor(seedA, true);
    await store.savePendingBackupBlob(randomBytes(64));
    await store.markReciprocationDismissed();

    account = ACCOUNT_B;
    await store.saveActor(seedB, true);

    expect(await store.actorSeed()).toEqual(seedB);
    expect(await store.pendingBackupBlob()).toBeNull();
    expect(await store.reciprocationDismissed()).toBe(false);

    account = ACCOUNT_A;
    expect(await store.actorSeed()).toEqual(seedA);
    expect(await store.pendingBackupBlob()).not.toBeNull();
    expect(await store.reciprocationDismissed()).toBe(true);
  });

  it("reads empty for an account that stored nothing", async () => {
    await store.saveActor(randomBytes(32), true);
    account = ACCOUNT_B;
    expect(await store.actorKey()).toBeNull();
    expect(await store.actorSeed()).toBeNull();
    expect(await store.pendingBackupBlob()).toBeNull();
    expect(await store.handshakeIds()).toEqual([]);
  });

  it("scopes handshake ids to the active account", async () => {
    const key = await ActorKey.generate();
    const pre = await key.preSign(sampleProposal());
    await store.saveHandshake("staged-a", pre);

    account = ACCOUNT_B;
    await store.saveHandshake("staged-b", pre);
    expect(await store.handshakeIds()).toEqual(["staged-b"]);
    expect(await store.handshake("staged-a")).toBeNull();

    account = ACCOUNT_A;
    expect(await store.handshakeIds()).toEqual(["staged-a"]);
  });

  it("reads empty and refuses writes without an active account", async () => {
    account = null;
    expect(await store.actorKey()).toBeNull();
    expect(await store.actorSeed()).toBeNull();
    expect(await store.pendingBackupBlob()).toBeNull();
    expect(await store.handshakeIds()).toEqual([]);
    expect(await store.reciprocationDismissed()).toBe(false);
    await expect(store.saveActor(randomBytes(32), true)).rejects.toThrow(
      "custody write without an active account",
    );
    await expect(store.setEphemeral(true)).rejects.toThrow(
      "custody write without an active account",
    );
  });

  it("adopts legacy singleton records into the first signed-in account", async () => {
    const seed = randomBytes(32);
    const blob = randomBytes(64);
    await seedLegacy({ actorSeed: seed, backupBlob: blob, reciprocationDismissed: true });

    store = freshStore();
    expect(await store.actorSeed()).toEqual(seed);
    expect(await store.pendingBackupBlob()).toEqual(blob);
    expect(await store.reciprocationDismissed()).toBe(true);

    // The move happened exactly once — a later account reads empty.
    account = ACCOUNT_B;
    expect(await store.actorKey()).toBeNull();
    expect(await store.pendingBackupBlob()).toBeNull();
    expect(await store.reciprocationDismissed()).toBe(false);
  });

  it("adopts legacy records only into a vacant slot", async () => {
    const ownSeed = randomBytes(32);
    await store.saveActor(ownSeed, true);
    const legacySeed = randomBytes(32);
    await seedLegacy({ actorSeed: legacySeed });

    // A fresh page (fresh adoption memo) with an occupied slot keeps
    // its own record; the legacy one waits for a vacant account.
    store = freshStore();
    expect(await store.actorSeed()).toEqual(ownSeed);

    account = ACCOUNT_B;
    expect(await store.actorSeed()).toEqual(legacySeed);
  });

  it("adopts legacy handshake material under the account prefix", async () => {
    await seedLegacy({ handshakeIds: ["staged-legacy"] });
    store = freshStore();
    expect(await store.handshakeIds()).toEqual(["staged-legacy"]);

    account = ACCOUNT_B;
    expect(await store.handshakeIds()).toEqual([]);
  });

  it("purges a flagged account's material, leaving the other account's", async () => {
    const key = await ActorKey.generate();
    const pre = await key.preSign(sampleProposal());
    await store.saveActor(randomBytes(32), true);
    await store.savePendingBackupBlob(randomBytes(64));
    await store.saveHandshake("staged-1", pre);
    await store.markReciprocationDismissed();
    await store.setEphemeral(true);

    account = ACCOUNT_B;
    const seedB = randomBytes(32);
    await store.saveActor(seedB, true);

    account = ACCOUNT_A;
    await store.purgeIfEphemeral();
    expect(await store.actorKey()).toBeNull();
    expect(await store.pendingBackupBlob()).toBeNull();
    expect(await store.handshakeIds()).toEqual([]);
    expect(await store.reciprocationDismissed()).toBe(false);

    account = ACCOUNT_B;
    expect(await store.actorSeed()).toEqual(seedB);
  });

  it("keeps everything on an unflagged purge — the default sign-out", async () => {
    await store.saveActor(randomBytes(32), true);
    await store.savePendingBackupBlob(randomBytes(64));
    await store.purgeIfEphemeral();
    expect(await store.actorKey()).not.toBeNull();
    expect(await store.pendingBackupBlob()).not.toBeNull();
  });

  it("an unchecked login clears an earlier ephemeral flag", async () => {
    await store.saveActor(randomBytes(32), true);
    await store.setEphemeral(true);
    await store.setEphemeral(false);
    await store.purgeIfEphemeral();
    expect(await store.actorKey()).not.toBeNull();
  });

  it("purges nothing without an active account", async () => {
    await store.saveActor(randomBytes(32), true);
    await store.setEphemeral(true);
    account = null;
    await store.purgeIfEphemeral();
    account = ACCOUNT_A;
    expect(await store.actorKey()).not.toBeNull();
  });
});
