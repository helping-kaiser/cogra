// Device-held identity custody (web.md "Key custody", android/CLAUDE.md
// "Auth / tokens" for the Android mirror): the actor key persists as a
// non-extractable CryptoKey in IndexedDB with the raw seed beside it
// only while no backup blob exists; the parked backup blob awaits its
// upload; and the per-write handshake material (private nonce +
// pre-signature, keyed by staged-write id) lets the approve step verify
// against what THIS device pre-signed across page reloads. The recovery
// code is never here — displayed once, held only by the user.

import { ActorKey, importActorKeyPair } from "@/lib/crypto/actor-key";
import { PreSignedProposal } from "@/lib/crypto/handshake";
import { decodeProposal, encodeProposal } from "@/lib/crypto/wire";

const DB_NAME = "cogra.identity";
const DB_VERSION = 2;
const ACTOR = "actor";
const BACKUP = "pendingBackup";
const HANDSHAKE = "handshake";
const UX = "ux";
const SINGLETON_KEY = "current";
const RECIPROCATION_KEY = "reciprocationDismissed";

type ActorRecord = {
  privateKey: CryptoKey;
  publicKey: Uint8Array;
  seed: Uint8Array | null;
};

type HandshakeRecord = {
  proposal: Uint8Array;
  authorPubkey: Uint8Array;
  nonce: Uint8Array;
  preSignature: Uint8Array;
};

export type IdentityStore = {
  /** The custody key, or null before the ceremony ran on this device. */
  actorKey(): Promise<ActorKey | null>;
  /** The raw seed — present only while no backup blob exists. */
  actorSeed(): Promise<Uint8Array | null>;
  /**
   * Imports and persists a fresh or restored seed. `retainSeed` is true
   * at the ceremony (no blob exists yet — declining must stay
   * reversible) and false on restore (the blob it came from exists).
   */
  saveActor(seed: Uint8Array, retainSeed: boolean): Promise<ActorKey>;
  /** Wipes the raw seed once a backup blob is uploaded; custody is the CryptoKey alone. */
  clearActorSeed(): Promise<void>;
  savePendingBackupBlob(blob: Uint8Array): Promise<void>;
  pendingBackupBlob(): Promise<Uint8Array | null>;
  clearPendingBackupBlob(): Promise<void>;
  saveHandshake(stagedWriteId: string, pre: PreSignedProposal): Promise<void>;
  handshake(stagedWriteId: string): Promise<PreSignedProposal | null>;
  clearHandshake(stagedWriteId: string): Promise<void>;
  handshakeIds(): Promise<string[]>;
  /**
   * Device-local UX state: whether the first-login reciprocation
   * prompt was dismissed on this device. Dismissal memory only —
   * whether the pair is complete is the graph-derived
   * User.hasReciprocated (auth.md "Reciprocation is the joiner's own
   * act"); the offer legitimately reappears on a new device.
   */
  reciprocationDismissed(): Promise<boolean>;
  markReciprocationDismissed(): Promise<void>;
};

function asPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ACTOR)) db.createObjectStore(ACTOR);
      if (!db.objectStoreNames.contains(BACKUP)) db.createObjectStore(BACKUP);
      if (!db.objectStoreNames.contains(HANDSHAKE)) db.createObjectStore(HANDSHAKE);
      if (!db.objectStoreNames.contains(UX)) db.createObjectStore(UX);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createIdentityStore(): IdentityStore {
  let dbPromise: Promise<IDBDatabase> | null = null;

  function db(): Promise<IDBDatabase> {
    dbPromise ??= openDb().catch((e: unknown) => {
      // A failed open must not poison every later call with the same
      // rejected promise — the next call retries.
      dbPromise = null;
      throw e;
    });
    return dbPromise;
  }

  async function read<T>(store: string, key: IDBValidKey): Promise<T | null> {
    const tx = (await db()).transaction(store, "readonly");
    const result = await asPromise<T | undefined>(tx.objectStore(store).get(key) as IDBRequest<T | undefined>);
    return result ?? null;
  }

  async function write(store: string, key: IDBValidKey, value: unknown): Promise<void> {
    const tx = (await db()).transaction(store, "readwrite");
    await asPromise(tx.objectStore(store).put(value, key));
  }

  async function remove(store: string, key: IDBValidKey): Promise<void> {
    const tx = (await db()).transaction(store, "readwrite");
    await asPromise(tx.objectStore(store).delete(key));
  }

  return {
    async actorKey() {
      const record = await read<ActorRecord>(ACTOR, SINGLETON_KEY);
      if (record === null) return null;
      return ActorKey.stored(record.privateKey, record.publicKey);
    },

    async actorSeed() {
      const record = await read<ActorRecord>(ACTOR, SINGLETON_KEY);
      return record?.seed ?? null;
    },

    async saveActor(seed, retainSeed) {
      const pair = await importActorKeyPair(seed);
      await write(ACTOR, SINGLETON_KEY, {
        privateKey: pair.privateKey,
        publicKey: pair.publicKey,
        seed: retainSeed ? seed.slice() : null,
      } satisfies ActorRecord);
      return ActorKey.stored(pair.privateKey, pair.publicKey);
    },

    async clearActorSeed() {
      const record = await read<ActorRecord>(ACTOR, SINGLETON_KEY);
      if (record === null || record.seed === null) return;
      await write(ACTOR, SINGLETON_KEY, { ...record, seed: null } satisfies ActorRecord);
    },

    async savePendingBackupBlob(blob) {
      await write(BACKUP, SINGLETON_KEY, blob.slice());
    },

    async pendingBackupBlob() {
      return read<Uint8Array>(BACKUP, SINGLETON_KEY);
    },

    async clearPendingBackupBlob() {
      await remove(BACKUP, SINGLETON_KEY);
    },

    async saveHandshake(stagedWriteId, pre) {
      await write(HANDSHAKE, stagedWriteId, {
        proposal: encodeProposal(pre.proposal),
        authorPubkey: pre.authorPubkey.slice(),
        nonce: pre.nonce.slice(),
        preSignature: pre.preSignature.slice(),
      } satisfies HandshakeRecord);
    },

    async handshake(stagedWriteId) {
      const record = await read<HandshakeRecord>(HANDSHAKE, stagedWriteId);
      if (record === null) return null;
      return new PreSignedProposal({
        proposal: decodeProposal(record.proposal),
        authorPubkey: record.authorPubkey,
        nonce: record.nonce,
        preSignature: record.preSignature,
      });
    },

    async clearHandshake(stagedWriteId) {
      await remove(HANDSHAKE, stagedWriteId);
    },

    async handshakeIds() {
      const tx = (await db()).transaction(HANDSHAKE, "readonly");
      const keys = await asPromise(tx.objectStore(HANDSHAKE).getAllKeys());
      return keys.map(String);
    },

    async reciprocationDismissed() {
      return (await read<boolean>(UX, RECIPROCATION_KEY)) === true;
    },

    async markReciprocationDismissed() {
      await write(UX, RECIPROCATION_KEY, true);
    },
  };
}

/** The one custody store of the running page. */
export const identityStore: IdentityStore = createIdentityStore();
