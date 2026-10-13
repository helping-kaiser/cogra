// Account-keyed IndexedDB custody — actor key, parked backup blob,
// per-write handshake material, ux flags (web.md "Key custody",
// auth.md "Multi-account device custody").

import { ActorKey, importActorKeyPair } from "@/lib/crypto/actor-key";
import { PreSignedProposal } from "@/lib/crypto/handshake";
import { decodeProposal, encodeProposal } from "@/lib/crypto/wire";
import { tokenStore } from "@/lib/session/token-store";

const DB_NAME = "cogra.identity";
const DB_VERSION = 3;
const ACTOR = "actor";
const BACKUP = "pendingBackup";
const HANDSHAKE = "handshake";
const UX = "ux";
/** The device lock's local half while signed in: a non-extractable HKDF base key per account. */
const LOCK_KEY = "deviceLockKey";
/** A signed-out account's custody, locked (sign-out-custody §3.5). */
const LOCKED = "lockedCustody";
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
  ephemeral: boolean;
  /**
   * The device lock's id (auth.md "Device lock"), held from issue to discard
   * — through a lock too, since the sign-in releases the secret by it.
   */
  lock?: string;
  /** A lock begun and not yet finished; the next start completes it. */
  lockPending?: boolean;
};

const EMPTY_UX: UxRecord = { ephemeral: false };

/** The device lock as this browser holds it while the account is signed in. */
export type HeldLock = {
  readonly id: string;
  readonly key: CryptoKey;
};

/** One locked record and the binding it was sealed under (sign-out-custody §3.3). */
export type LockedRecord = {
  readonly kind: string;
  readonly key: string;
  readonly record: Uint8Array;
};

/** The plaintext custody of one account in this database, read for a lock. */
export type SlotCustody = {
  /** The retained seed, or null when none is kept (the key is backed, or absent). */
  readonly seed: Uint8Array | null;
  /** Whether an actor record exists at all. */
  readonly hasActor: boolean;
  readonly backupBlob: Uint8Array | null;
  readonly handshakes: readonly { readonly id: string; readonly record: HandshakeRecord }[];
};

/** What an unlock puts back (sign-out-custody §3.5 UNLOCK step 3). */
export type UnlockedCustody = {
  readonly seed: Uint8Array | null;
  readonly backupBlob: Uint8Array | null;
  readonly handshakes: readonly { readonly id: string; readonly record: HandshakeRecord }[];
};

export type { HandshakeRecord };

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
   * The "don't remember me" opt-in (auth.md "Sign-out"), recorded at
   * login and restore for the active account — always written, so an
   * unchecked login clears an earlier flag.
   */
  setEphemeral(value: boolean): Promise<void>;
  /** Whether the active account is flagged "don't remember" here. */
  isEphemeral(): Promise<boolean>;
  /**
   * Drops every handshake this account has parked on this device.
   *
   * A re-mint orphans the material: what is stored was pre-signed by the key
   * that is being replaced, and no later key can approve it (the pre-signature
   * is the old key's). Leaving it behind only produces approvals signed by a
   * key unrelated to the pre-commitment.
   */
  clearHandshakes(): Promise<void>;
  /**
   * The sign-out (and session-invalidation) custody step: when the
   * active account is flagged ephemeral, purge its records — actor,
   * parked blob, handshake material, ux. Unflagged accounts keep
   * everything; signing out is an auth act, not an identity act
   * (auth.md "Sign-out"). Runs while the account is still active.
   */
  purgeIfEphemeral(): Promise<void>;

  // ------------------------------------------------------------ device lock
  //
  // Every call below names its account rather than resolving the active one:
  // a lock runs while the session is ending, after the tokens were cleared,
  // and an unlock runs before the fresh session is committed (sign-out-custody
  // §3.5, "run for an explicit account id, never through activeAccountId()").

  /** Whether the account is flagged "don't remember" here — by name. */
  isEphemeralFor(account: string): Promise<boolean>;
  /** The lock's id this slot holds — while signed in and while locked alike. */
  lockIdOf(account: string): Promise<string | null>;
  /** The held lock, or null when the slot holds none (or is locked: the key goes at lock). */
  heldLock(account: string): Promise<HeldLock | null>;
  /**
   * Holds a lock: its id in the ux record and its key beside it, in one
   * transaction. Answers the id it replaced, if any, so the caller can
   * discard that one's server half.
   */
  holdLock(account: string, lock: HeldLock): Promise<string | null>;
  /** Forgets the lock locally: id and key, in one transaction. Never touches a locked set. */
  dropLock(account: string): Promise<void>;
  setLockPending(account: string, pending: boolean): Promise<void>;
  isLockPending(account: string): Promise<boolean>;
  /** The plaintext custody a lock reads (seed and records; never the CryptoKey). */
  custodyOf(account: string): Promise<SlotCustody>;
  /**
   * THE LOCK'S COMMIT, one transaction (sign-out-custody §3.5 LOCK step 4):
   * writes the locked set and removes the actor record (CryptoKey and seed
   * both), the parked blob, the handshakes and the held lock key. The ux
   * record keeps the flag, the lock's id and the pending mark.
   *
   * CONDITIONAL: it commits only while the slot still holds its lock key and
   * holds no locked set, and answers whether it did. A second lock racing the
   * first — another tab, or a start-time completion — finds the key gone and
   * writes nothing, so a locked set is never overwritten by a later read of a
   * slot the first lock already emptied.
   */
  commitLock(account: string, locked: readonly LockedRecord[]): Promise<boolean>;
  /**
   * Removes the key material of a slot whose backup is positively known —
   * actor record, parked blob, handshakes — and nothing else: the draft, the
   * flag and the lock stay (sign-out-custody §3.2, a backed key on a session
   * ended elsewhere). The key survives in its backup.
   */
  purgeBackedKeyMaterial(account: string): Promise<void>;
  /** The locked set, or null when the slot is not locked. */
  lockedSet(account: string): Promise<readonly LockedRecord[] | null>;
  /**
   * THE UNLOCK'S COMMIT, one transaction: the plaintext custody back (the
   * actor key re-imported from the seed, the seed retained) and the locked
   * set removed. A slot that is not locked is left as it is.
   */
  commitUnlock(account: string, custody: UnlockedCustody): Promise<void>;
  /**
   * DELETES A LOCKED SET THE SERVER CAN NO LONGER OPEN — the one deletion of
   * key material this engine makes (PR-62: complete the sign-in, delete the
   * dead ciphertext, say so once). The lock's id goes with it.
   */
  deleteDeadLockedSet(account: string): Promise<void>;
  /** Every account whose slot is locked or holds an unfinished lock. */
  lockSlots(): Promise<string[]>;
};

/**
 * The custody database cannot be opened because another tab holds an older
 * version of it open.
 *
 * Its own type, because the caller's answer is a sentence no other fault
 * deserves — "close the other CoGra tab" — and because a blocked open that
 * simply never settles takes every later custody call down with it.
 */
export class CustodyBlockedError extends Error {
  constructor() {
    super("another tab is holding an older version of the custody database open");
    this.name = "CustodyBlockedError";
  }
}

function asPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * A transaction's OUTCOME, not its requests'.
 *
 * A successful request says only that the store accepted the operation; the
 * durable fact is the COMMIT. A transaction can still abort after every
 * request in it succeeded — quota exhaustion at commit time, or an abort
 * raised from elsewhere — and IndexedDB reports that on the transaction
 * (`abort`), which nothing listening to requests alone ever sees. Custody is
 * precisely the data that must not be reported as written when it was not: a
 * `saveActor` that resolves without landing attaches a public key this device
 * cannot sign with, and a `saveHandshake` that resolves without landing
 * submits a pre-commitment whose material is gone on the next page load.
 */
function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("custody transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("custody transaction failed"));
  });
}

function openDb(factory: IDBFactory, onLost: () => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    let settled = false;
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ACTOR)) db.createObjectStore(ACTOR);
      if (!db.objectStoreNames.contains(BACKUP)) db.createObjectStore(BACKUP);
      if (!db.objectStoreNames.contains(HANDSHAKE)) db.createObjectStore(HANDSHAKE);
      if (!db.objectStoreNames.contains(UX)) db.createObjectStore(UX);
      if (!db.objectStoreNames.contains(LOCK_KEY)) db.createObjectStore(LOCK_KEY);
      if (!db.objectStoreNames.contains(LOCKED)) db.createObjectStore(LOCKED);
    };
    // WITHOUT THIS HANDLER A VERSION BUMP HANGS CUSTODY FOR GOOD. `blocked`
    // fires when an older connection — another tab — is still open, and when
    // it does, neither `success` nor `error` follows until that tab yields. A
    // memoized open promise then never settles and every custody call after it
    // awaits forever. Rejecting instead makes the next call retry, by which
    // time the `versionchange` handler below has usually closed the other tab's
    // connection.
    req.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new CustodyBlockedError());
    };
    req.onsuccess = () => {
      const db = req.result;
      if (settled) {
        // The block cleared after we gave up on it; nobody holds this
        // connection, and leaving it open would block the next upgrade.
        db.close();
        return;
      }
      settled = true;
      // The other half of the same problem: this tab must yield to a NEWER
      // version rather than block it. Closing here drops the cached
      // connection, so the next call re-opens at the new version.
      db.onversionchange = () => {
        db.close();
        onLost();
      };
      db.onclose = onLost;
      resolve(db);
    };
    req.onerror = () => {
      if (settled) return;
      settled = true;
      reject(req.error);
    };
  });
}

export function createIdentityStore(deps: {
  /** The signed-in account custody resolves to — per call, never captured. */
  activeAccountId: () => string | null;
  /**
   * The IndexedDB implementation, read per open. Injectable so a test can
   * hand in a factory that fails — the recovery paths below are otherwise
   * unreachable from a suite.
   */
  idb?: () => IDBFactory;
}): IdentityStore {
  const { activeAccountId } = deps;
  const idb = deps.idb ?? (() => indexedDB);
  let dbPromise: Promise<IDBDatabase> | null = null;
  const adoptions = new Map<string, Promise<void>>();

  function db(): Promise<IDBDatabase> {
    dbPromise ??= openDb(idb(), () => {
      dbPromise = null;
    }).catch((e: unknown) => {
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
    const landed = committed(tx);
    tx.objectStore(store).put(value, key);
    await landed;
  }

  async function remove(store: string, key: IDBValidKey): Promise<void> {
    const tx = (await db()).transaction(store, "readwrite");
    const landed = committed(tx);
    tx.objectStore(store).delete(key);
    await landed;
  }

  /**
   * Read and write in ONE transaction.
   *
   * A read in one transaction and the write it decides in the next is a lost
   * update the moment two callers overlap — and the two ux flags are written
   * by separate handlers over the same record. The follow-up request is issued
   * from inside the read's `success` handler, which is where the transaction is
   * still active by construction.
   */
  async function updateRecord<T>(
    store: string,
    key: IDBValidKey,
    update: (current: T | null) => T | null,
  ): Promise<void> {
    const tx = (await db()).transaction(store, "readwrite");
    const landed = committed(tx);
    const objectStore = tx.objectStore(store);
    const current = objectStore.get(key);
    current.onsuccess = () => {
      const next = update((current.result as T | undefined) ?? null);
      if (next !== null) objectStore.put(next, key);
    };
    await landed;
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
  function adoptSlot(objectStore: IDBObjectStore, account: string): void {
    const legacy = objectStore.get(LEGACY_SINGLETON_KEY);
    legacy.onsuccess = () => {
      if (legacy.result === undefined) return;
      const target = objectStore.get(account);
      target.onsuccess = () => {
        // An occupied slot keeps its own record; the legacy one stays put
        // for a later account whose slot is still empty.
        if (target.result !== undefined) return;
        objectStore.put(legacy.result, account);
        objectStore.delete(LEGACY_SINGLETON_KEY);
      };
    };
  }

  /**
   * Drops the legacy device-local vouch-back dismissal. The dismissal is
   * account state now (`User.vouchBackDismissed`), so the bit has nothing
   * left to carry and no account to adopt it.
   */
  function dropLegacyUx(objectStore: IDBObjectStore): void {
    objectStore.delete(LEGACY_RECIPROCATION_KEY);
  }

  function adoptHandshakes(objectStore: IDBObjectStore, account: string): void {
    const keys = objectStore.getAllKeys();
    keys.onsuccess = () => {
      const bare = keys.result.map(String).filter((key) => !key.includes(KEY_SEPARATOR));
      for (const stagedWriteId of bare) {
        const record = objectStore.get(stagedWriteId);
        record.onsuccess = () => {
          if (record.result === undefined) return;
          const target = handshakeKey(account, stagedWriteId);
          const existing = objectStore.get(target);
          existing.onsuccess = () => {
            if (existing.result !== undefined) return;
            objectStore.put(record.result, target);
            objectStore.delete(stagedWriteId);
          };
        };
      }
    };
  }

  /**
   * The whole migration, in ONE transaction.
   *
   * Written as four transactions it was four chances to half-finish: a crash
   * between the write into the account's slot and the removal of the legacy
   * key left the record in BOTH, and the next account adopted the leftover.
   * Every read and write here lands together or not at all, so the legacy key
   * is gone exactly when its record has a new home.
   */
  async function runAdoption(account: string): Promise<void> {
    const tx = (await db()).transaction([ACTOR, BACKUP, HANDSHAKE, UX], "readwrite");
    const landed = committed(tx);
    adoptSlot(tx.objectStore(ACTOR), account);
    adoptSlot(tx.objectStore(BACKUP), account);
    dropLegacyUx(tx.objectStore(UX));
    adoptHandshakes(tx.objectStore(HANDSHAKE), account);
    await landed;
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
      await updateRecord<ActorRecord>(ACTOR, account, (record) =>
        record === null || record.seed === null ? null : { ...record, seed: null },
      );
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

    async setEphemeral(value) {
      const account = await forWrite();
      await updateRecord<UxRecord>(UX, account, (ux) => ({
        ...(ux ?? EMPTY_UX),
        ephemeral: value,
      }));
    },

    async isEphemeral() {
      const account = await forRead();
      if (account === null) return false;
      return (await read<UxRecord>(UX, account))?.ephemeral ?? false;
    },

    async clearHandshakes() {
      const account = await forWrite();
      const tx = (await db()).transaction(HANDSHAKE, "readwrite");
      const landed = committed(tx);
      const objectStore = tx.objectStore(HANDSHAKE);
      const keys = objectStore.getAllKeys();
      keys.onsuccess = () => {
        const prefix = account + KEY_SEPARATOR;
        for (const key of keys.result.map(String)) {
          if (key.startsWith(prefix)) objectStore.delete(key);
        }
      };
      await landed;
    },

    /**
     * One transaction, because a half-purge is the worst outcome available:
     * the ephemeral promise is that nothing of this account stays behind, and
     * a crash between two of five removals leaves exactly the records the
     * reader asked not to keep.
     */
    async purgeIfEphemeral() {
      const account = await forRead();
      if (account === null) return;
      const tx = (await db()).transaction([ACTOR, BACKUP, HANDSHAKE, UX, LOCK_KEY], "readwrite");
      const landed = committed(tx);
      const ux = tx.objectStore(UX).get(account);
      ux.onsuccess = () => {
        const record = (ux.result as UxRecord | undefined) ?? null;
        if (record === null || !record.ephemeral) return;
        tx.objectStore(ACTOR).delete(account);
        tx.objectStore(BACKUP).delete(account);
        tx.objectStore(UX).delete(account);
        // The held lock's local half goes with the slot it guarded; the
        // caller discards the server half first (sign-out-custody §3.3,
        // "living until it is discarded"). A locked set is never in this
        // transaction — a purge runs while signed in, and no signed-in
        // slot is locked.
        tx.objectStore(LOCK_KEY).delete(account);
        const handshakes = tx.objectStore(HANDSHAKE);
        const keys = handshakes.getAllKeys();
        keys.onsuccess = () => {
          const prefix = account + KEY_SEPARATOR;
          for (const key of keys.result.map(String)) {
            if (key.startsWith(prefix)) handshakes.delete(key);
          }
        };
      };
      await landed;
    },

    // ---------------------------------------------------------- device lock

    async isEphemeralFor(account) {
      await adopted(account);
      return (await read<UxRecord>(UX, account))?.ephemeral ?? false;
    },

    async lockIdOf(account) {
      return (await read<UxRecord>(UX, account))?.lock ?? null;
    },

    async heldLock(account) {
      const tx = (await db()).transaction([UX, LOCK_KEY], "readonly");
      const ux = asPromise(tx.objectStore(UX).get(account) as IDBRequest<UxRecord | undefined>);
      const key = asPromise(tx.objectStore(LOCK_KEY).get(account) as IDBRequest<CryptoKey | undefined>);
      const [record, held] = await Promise.all([ux, key]);
      const id = record?.lock;
      return id === undefined || held === undefined ? null : { id, key: held };
    },

    async holdLock(account, lock) {
      const tx = (await db()).transaction([UX, LOCK_KEY], "readwrite");
      const landed = committed(tx);
      const ux = tx.objectStore(UX);
      const current = ux.get(account);
      let replaced: string | null = null;
      current.onsuccess = () => {
        const record = (current.result as UxRecord | undefined) ?? EMPTY_UX;
        if (record.lock !== undefined && record.lock !== lock.id) replaced = record.lock;
        ux.put({ ...record, lock: lock.id } satisfies UxRecord, account);
        tx.objectStore(LOCK_KEY).put(lock.key, account);
      };
      await landed;
      return replaced;
    },

    async dropLock(account) {
      const tx = (await db()).transaction([UX, LOCK_KEY], "readwrite");
      const landed = committed(tx);
      const ux = tx.objectStore(UX);
      const current = ux.get(account);
      current.onsuccess = () => {
        const record = (current.result as UxRecord | undefined) ?? null;
        if (record !== null && record.lock !== undefined) {
          const next: UxRecord = { ...record };
          delete next.lock;
          ux.put(next, account);
        }
        tx.objectStore(LOCK_KEY).delete(account);
      };
      await landed;
    },

    async setLockPending(account, pending) {
      await updateRecord<UxRecord>(UX, account, (ux) => {
        const record = ux ?? EMPTY_UX;
        if (pending) return { ...record, lockPending: true };
        if (ux === null || ux.lockPending === undefined) return null;
        const next: UxRecord = { ...record };
        delete next.lockPending;
        return next;
      });
    },

    async isLockPending(account) {
      return (await read<UxRecord>(UX, account))?.lockPending ?? false;
    },

    async custodyOf(account) {
      await adopted(account);
      const tx = (await db()).transaction([ACTOR, BACKUP, HANDSHAKE], "readonly");
      const actor = asPromise(tx.objectStore(ACTOR).get(account) as IDBRequest<ActorRecord | undefined>);
      const backup = asPromise(tx.objectStore(BACKUP).get(account) as IDBRequest<Uint8Array | undefined>);
      const handshakeStore = tx.objectStore(HANDSHAKE);
      const prefix = account + KEY_SEPARATOR;
      const range = IDBKeyRange.bound(prefix, prefix + "￿");
      const keys = asPromise(handshakeStore.getAllKeys(range));
      const values = asPromise(handshakeStore.getAll(range) as IDBRequest<HandshakeRecord[]>);
      const [actorRecord, blob, handshakeKeys, handshakeValues] = await Promise.all([
        actor,
        backup,
        keys,
        values,
      ]);
      return {
        seed: actorRecord?.seed ?? null,
        hasActor: actorRecord !== undefined,
        backupBlob: blob ?? null,
        handshakes: handshakeKeys.map((key, i) => ({
          id: String(key).slice(prefix.length),
          record: handshakeValues[i]!,
        })),
      };
    },

    async commitLock(account, locked) {
      const stores = [ACTOR, BACKUP, HANDSHAKE, LOCK_KEY, LOCKED];
      const tx = (await db()).transaction(stores, "readwrite");
      const landed = committed(tx);
      const lockedStore = tx.objectStore(LOCKED);
      const keyStore = tx.objectStore(LOCK_KEY);
      let done = false;
      const key = keyStore.get(account);
      key.onsuccess = () => {
        if (key.result === undefined) return;
        const existing = lockedStore.get(account);
        existing.onsuccess = () => {
          if (existing.result !== undefined) return;
          lockedStore.put(
            locked.map((r) => ({ kind: r.kind, key: r.key, record: r.record.slice() })),
            account,
          );
          tx.objectStore(ACTOR).delete(account);
          tx.objectStore(BACKUP).delete(account);
          keyStore.delete(account);
          const prefix = account + KEY_SEPARATOR;
          tx.objectStore(HANDSHAKE).delete(IDBKeyRange.bound(prefix, prefix + "￿"));
          done = true;
        };
      };
      await landed;
      return done;
    },

    async purgeBackedKeyMaterial(account) {
      const tx = (await db()).transaction([ACTOR, BACKUP, HANDSHAKE], "readwrite");
      const landed = committed(tx);
      const actor = tx.objectStore(ACTOR).get(account);
      actor.onsuccess = () => {
        const record = (actor.result as ActorRecord | undefined) ?? null;
        // Decided INSIDE the transaction, by the one fact that proves a
        // backup (`actorSeed`: the seed is wiped only after an upload). A
        // slot without that proof keeps everything — an unbacked key is the
        // only copy, and this is never the call that destroys it.
        if (record === null || record.seed !== null) return;
        tx.objectStore(ACTOR).delete(account);
        tx.objectStore(BACKUP).delete(account);
        const prefix = account + KEY_SEPARATOR;
        tx.objectStore(HANDSHAKE).delete(IDBKeyRange.bound(prefix, prefix + "￿"));
      };
      await landed;
    },

    async lockedSet(account) {
      return read<LockedRecord[]>(LOCKED, account);
    },

    async commitUnlock(account, custody) {
      // Imported BEFORE the transaction opens: an await on crypto inside it
      // would let IndexedDB auto-commit it early (the in-transaction rule
      // `updateRecord` documents).
      const pair = custody.seed === null ? null : await importActorKeyPair(custody.seed);
      const tx = (await db()).transaction([ACTOR, BACKUP, HANDSHAKE, LOCKED], "readwrite");
      const landed = committed(tx);
      const lockedStore = tx.objectStore(LOCKED);
      const present = lockedStore.get(account);
      present.onsuccess = () => {
        if (present.result === undefined) return;
        if (pair !== null && custody.seed !== null) {
          tx.objectStore(ACTOR).put(
            {
              privateKey: pair.privateKey,
              publicKey: pair.publicKey,
              // A locked key is an unbacked key, and an unbacked key keeps its
              // seed (web.md "Key custody"): it is what made the lock possible.
              seed: custody.seed.slice(),
            } satisfies ActorRecord,
            account,
          );
        }
        if (custody.backupBlob !== null) {
          tx.objectStore(BACKUP).put(custody.backupBlob.slice(), account);
        }
        const handshakes = tx.objectStore(HANDSHAKE);
        for (const { id, record } of custody.handshakes) {
          handshakes.put(record, handshakeKey(account, id));
        }
        lockedStore.delete(account);
      };
      await landed;
    },

    async deleteDeadLockedSet(account) {
      const tx = (await db()).transaction([UX, LOCKED], "readwrite");
      const landed = committed(tx);
      tx.objectStore(LOCKED).delete(account);
      const ux = tx.objectStore(UX);
      const current = ux.get(account);
      current.onsuccess = () => {
        const record = (current.result as UxRecord | undefined) ?? null;
        if (record === null) return;
        const next: UxRecord = { ...record };
        delete next.lock;
        delete next.lockPending;
        ux.put(next, account);
      };
      await landed;
    },

    async lockSlots() {
      const tx = (await db()).transaction([UX, LOCKED], "readonly");
      const uxStore = tx.objectStore(UX);
      const [locked, uxKeys, uxValues] = await Promise.all([
        asPromise(tx.objectStore(LOCKED).getAllKeys()),
        asPromise(uxStore.getAllKeys()),
        asPromise(uxStore.getAll() as IDBRequest<UxRecord[]>),
      ]);
      const accounts = new Set(locked.map(String));
      uxKeys.forEach((key, i) => {
        if (uxValues[i]?.lockPending === true) accounts.add(String(key));
      });
      return [...accounts];
    },
  };
}

/** The one custody store of the running page, scoped to the active session's account. */
export const identityStore: IdentityStore = createIdentityStore({
  activeAccountId: () => tokenStore.activeAccountId(),
});
