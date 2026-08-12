// Account-keyed IndexedDB custody — actor key, parked backup blob,
// per-write handshake material, ux flags (web.md "Key custody",
// auth.md "Multi-account device custody").

import { ActorKey, importActorKeyPair } from "@/lib/crypto/actor-key";
import { PreSignedProposal } from "@/lib/crypto/handshake";
import { decodeProposal, encodeProposal } from "@/lib/crypto/wire";
import { tokenStore } from "@/lib/session/token-store";

const DB_NAME = "cogra.identity";
const DB_VERSION = 2;
const ACTOR = "actor";
const BACKUP = "pendingBackup";
const HANDSHAKE = "handshake";
const UX = "ux";
// Account ids are UUIDs, so the separator can never appear inside one.
const KEY_SEPARATOR = "/";
const LEGACY_SINGLETON_KEY = "current";
const LEGACY_RECIPROCATION_KEY = "reciprocationDismissed";

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

type UxRecord = {
  reciprocationDismissed: boolean;
  ephemeral: boolean;
};

export type IdentityStore = {
  /** The account's custody key, or null before the ceremony ran on this device. */
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
  /**
   * The "don't remember me" opt-in (auth.md "Sign-out"), recorded at
   * login and restore for the active account — always written, so an
   * unchecked login clears an earlier flag.
   */
  setEphemeral(value: boolean): Promise<void>;
  /**
   * The sign-out (and session-invalidation) custody step: when the
   * active account is flagged ephemeral, purge its records — actor,
   * parked blob, handshake material, ux. Unflagged accounts keep
   * everything; signing out is an auth act, not an identity act
   * (auth.md "Sign-out"). Runs while the account is still active.
   */
  purgeIfEphemeral(): Promise<void>;
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

export function createIdentityStore(deps: {
  /** The signed-in account custody resolves to — per call, never captured. */
  activeAccountId: () => string | null;
}): IdentityStore {
  const { activeAccountId } = deps;
  let dbPromise: Promise<IDBDatabase> | null = null;
  const adoptions = new Map<string, Promise<void>>();

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

  async function allKeys(store: string): Promise<string[]> {
    const tx = (await db()).transaction(store, "readonly");
    const keys = await asPromise(tx.objectStore(store).getAllKeys());
    return keys.map(String);
  }

  function handshakeKey(account: string, stagedWriteId: string): string {
    return `${account}${KEY_SEPARATOR}${stagedWriteId}`;
  }

  async function handshakeIdsOf(account: string): Promise<string[]> {
    const prefix = account + KEY_SEPARATOR;
    return (await allKeys(HANDSHAKE))
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length));
  }

  /** Moves a legacy singleton record into the account's slot — only when vacant. */
  async function adoptSlot(store: string, account: string): Promise<void> {
    const legacy = await read(store, LEGACY_SINGLETON_KEY);
    if (legacy === null) return;
    // An occupied slot keeps its own record; the legacy one stays put
    // for a later account whose slot is still empty.
    if ((await read(store, account)) !== null) return;
    await write(store, account, legacy);
    await remove(store, LEGACY_SINGLETON_KEY);
  }

  async function adoptUx(account: string): Promise<void> {
    const legacy = await read<boolean>(UX, LEGACY_RECIPROCATION_KEY);
    if (legacy === null) return;
    if ((await read(UX, account)) !== null) return;
    await write(UX, account, {
      reciprocationDismissed: legacy === true,
      ephemeral: false,
    } satisfies UxRecord);
    await remove(UX, LEGACY_RECIPROCATION_KEY);
  }

  async function adoptHandshakes(account: string): Promise<void> {
    const bare = (await allKeys(HANDSHAKE)).filter((key) => !key.includes(KEY_SEPARATOR));
    for (const stagedWriteId of bare) {
      const record = await read(HANDSHAKE, stagedWriteId);
      if (record === null) continue;
      const target = handshakeKey(account, stagedWriteId);
      if ((await read(HANDSHAKE, target)) !== null) continue;
      await write(HANDSHAKE, target, record);
      await remove(HANDSHAKE, stagedWriteId);
    }
  }

  async function runAdoption(account: string): Promise<void> {
    await adoptSlot(ACTOR, account);
    await adoptSlot(BACKUP, account);
    await adoptUx(account);
    await adoptHandshakes(account);
  }

  /** One-shot per account and page: later calls await the first pass. */
  function adopted(account: string): Promise<void> {
    let run = adoptions.get(account);
    if (run === undefined) {
      run = runAdoption(account).catch((e: unknown) => {
        adoptions.delete(account);
        throw e;
      });
      adoptions.set(account, run);
    }
    return run;
  }

  /** Reads without an account read as empty — never as another account's. */
  async function forRead(): Promise<string | null> {
    const account = activeAccountId();
    if (account === null) return null;
    await adopted(account);
    return account;
  }

  /** A custody write with nobody signed in has no slot to land in — a bug. */
  async function forWrite(): Promise<string> {
    const account = activeAccountId();
    if (account === null) throw new Error("custody write without an active account");
    await adopted(account);
    return account;
  }

  async function readUx(account: string): Promise<UxRecord> {
    return (
      (await read<UxRecord>(UX, account)) ?? { reciprocationDismissed: false, ephemeral: false }
    );
  }

  return {
    async actorKey() {
      const account = await forRead();
      if (account === null) return null;
      const record = await read<ActorRecord>(ACTOR, account);
      if (record === null) return null;
      return ActorKey.stored(record.privateKey, record.publicKey);
    },

    async actorSeed() {
      const account = await forRead();
      if (account === null) return null;
      const record = await read<ActorRecord>(ACTOR, account);
      return record?.seed ?? null;
    },

    async saveActor(seed, retainSeed) {
      const account = await forWrite();
      const pair = await importActorKeyPair(seed);
      await write(ACTOR, account, {
        privateKey: pair.privateKey,
        publicKey: pair.publicKey,
        seed: retainSeed ? seed.slice() : null,
      } satisfies ActorRecord);
      return ActorKey.stored(pair.privateKey, pair.publicKey);
    },

    async clearActorSeed() {
      const account = await forWrite();
      const record = await read<ActorRecord>(ACTOR, account);
      if (record === null || record.seed === null) return;
      await write(ACTOR, account, { ...record, seed: null } satisfies ActorRecord);
    },

    async savePendingBackupBlob(blob) {
      const account = await forWrite();
      await write(BACKUP, account, blob.slice());
    },

    async pendingBackupBlob() {
      const account = await forRead();
      if (account === null) return null;
      return read<Uint8Array>(BACKUP, account);
    },

    async clearPendingBackupBlob() {
      const account = await forWrite();
      await remove(BACKUP, account);
    },

    async saveHandshake(stagedWriteId, pre) {
      const account = await forWrite();
      await write(HANDSHAKE, handshakeKey(account, stagedWriteId), {
        proposal: encodeProposal(pre.proposal),
        authorPubkey: pre.authorPubkey.slice(),
        nonce: pre.nonce.slice(),
        preSignature: pre.preSignature.slice(),
      } satisfies HandshakeRecord);
    },

    async handshake(stagedWriteId) {
      const account = await forRead();
      if (account === null) return null;
      const record = await read<HandshakeRecord>(HANDSHAKE, handshakeKey(account, stagedWriteId));
      if (record === null) return null;
      return new PreSignedProposal({
        proposal: decodeProposal(record.proposal),
        authorPubkey: record.authorPubkey,
        nonce: record.nonce,
        preSignature: record.preSignature,
      });
    },

    async clearHandshake(stagedWriteId) {
      const account = await forWrite();
      await remove(HANDSHAKE, handshakeKey(account, stagedWriteId));
    },

    async handshakeIds() {
      const account = await forRead();
      if (account === null) return [];
      return handshakeIdsOf(account);
    },

    async reciprocationDismissed() {
      const account = await forRead();
      if (account === null) return false;
      return (await readUx(account)).reciprocationDismissed;
    },

    async markReciprocationDismissed() {
      const account = await forWrite();
      const ux = await readUx(account);
      await write(UX, account, { ...ux, reciprocationDismissed: true } satisfies UxRecord);
    },

    async setEphemeral(value) {
      const account = await forWrite();
      const ux = await readUx(account);
      await write(UX, account, { ...ux, ephemeral: value } satisfies UxRecord);
    },

    async purgeIfEphemeral() {
      const account = await forRead();
      if (account === null) return;
      if (!(await readUx(account)).ephemeral) return;
      await remove(ACTOR, account);
      await remove(BACKUP, account);
      for (const stagedWriteId of await handshakeIdsOf(account)) {
        await remove(HANDSHAKE, handshakeKey(account, stagedWriteId));
      }
      await remove(UX, account);
    },
  };
}

/** The one custody store of the running page, scoped to the active session's account. */
export const identityStore: IdentityStore = createIdentityStore({
  activeAccountId: () => tokenStore.activeAccountId(),
});
