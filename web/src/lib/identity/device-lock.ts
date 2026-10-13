// THE DEVICE LOCK ENGINE (sign-out-custody slice L1; auth.md "Device lock").
//
// A "don't remember" account keeps nothing usable in this browser once its
// session ends. With a backup, its key material is purged; without one, the
// browser holds the only copy of the key, so the custody is LOCKED instead:
// encrypted under a secret the server holds and releases only behind the
// account's current password, online (seam 035 conditions 1-3).
//
// What the engine does, by protocol (sign-out-custody §3.4-§3.6):
// - HOLD: a forget-on account holds a lock (id + non-extractable key) while
//   signed in, because neither a session ended elsewhere nor an offline
//   sign-out can fetch one at the moment it is needed.
// - LOCK: mark the slot pending, clear the tokens (so no tab writes custody
//   for the account again), read and encrypt the custody set, commit it in
//   ONE transaction that also removes the plaintext and the held key, then
//   remove the plaintext draft and clear the pending mark.
// - END LOCAL SESSION (a session ended elsewhere): forget off → nothing;
//   backup positively known → key material purged, the draft locked; else
//   the whole set locked. Never asks.
// - UNLOCK (the sign-in's leg): release the secret with the fresh session's
//   token and the password still in hand, decrypt, put everything back — all
//   before the tokens are committed, so no signed-in render reads a locked
//   slot.
// - RECOVER (every start): finish a lock a crash interrupted; delete a
//   plaintext draft a locked slot left behind.
//
// THE TWO RULED BRANCHES (seam 179 item 3):
// - PR-61 (SC-G1): a forget-on sign-in refuses to complete until the lock is
//   held (`ensureHeld` answers `failed`, the form keeps the session and says
//   it didn't send). A session ended elsewhere on a slot that still holds no
//   lock KEEPS its material — refused by the app (no custody read resolves to
//   a signed-out account), NEVER destroyed.
// - PR-62 (SC-G2): a lock the server can no longer open completes the
//   sign-in, deletes the dead ciphertext, and posts a one-time notice.
//
// WHAT THIS ENGINE NEVER DESTROYS: an unbacked key. The one deletion of
// locked material is PR-62's, behind a server answer that the lock is gone;
// the one purge of key material is a backed key's (`purgeBackedKeyMaterial`,
// decided inside its own transaction), and the lock's commit removes the
// plaintext only in the same transaction that writes its ciphertext.

import type { Outcome } from "@/lib/api/outcome";
import { hasCode } from "@/lib/api/outcome";
import type { IssuedLock } from "@/lib/api/device-lock-api";
import { importLockSecret, openLockRecord, sealLockRecord } from "@/lib/crypto/device-lock";
import {
  readDraftCustody,
  removeDraftCustody,
  restoreDraftCustody,
  type DraftRow,
} from "@/lib/compose/draft-custody";
import { decodeCustody, encodeCustody } from "./custody-codec";
import type {
  HandshakeRecord,
  HeldLock,
  IdentityStore,
  LockedRecord,
  UnlockedCustody,
} from "./store";

/** The record kinds a lock binds (the reference's `Binding.kind`). */
const KIND_IDENTITY = "identity";
const KIND_HANDSHAKE = "handshake";
const KIND_DRAFT = "draft";
const KEY_ACTOR = "actor";
const KEY_BACKUP = "pendingBackup";

/** The server calls the engine makes; each may carry an access token other than the tab's. */
export type DeviceLockApi = {
  issue(accessToken?: string): Promise<Outcome<IssuedLock>>;
  release(lock: string, password: string, accessToken?: string): Promise<Outcome<Uint8Array>>;
  discard(lock: string, accessToken?: string): Promise<Outcome<true>>;
};

export type DeviceLockDeps = {
  identity: IdentityStore;
  /** The draft store whose in-flight saves a lock abandons. */
  drafts: { abandonPendingSaves(): void };
  /** The IndexedDB the draft lives in, read per call. */
  idb: () => IDBFactory;
  api: DeviceLockApi;
  /** Cross-tab mutual exclusion; the default is the Web Locks API where present. */
  exclusive?: <T>(account: string, fn: () => Promise<T>) => Promise<T>;
  /**
   * Drops one account's seen record and watermark (PR-69). The record is
   * NEVER part of the lock set — it is a cache of the server's view log,
   * which re-seeds it — so a forget-on session end clears it instead.
   */
  forgetSeen?: (account: string) => Promise<void>;
};

/** What a session ended elsewhere did to the account's custody. */
export type LocalSessionEnd =
  /** Not a "don't remember" account: nothing changed. */
  | "kept"
  /** The custody set is locked (key material purged first where a backup is known). */
  | "locked"
  /** No lock was held (PR-61's residual): everything stays, refused until the next sign-in. */
  | "refused";

export type UnlockOutcome =
  /** The slot was not locked. */
  | { readonly kind: "none" }
  /** Everything is back; `lock` is the released lock, for the caller to re-hold or discard. */
  | { readonly kind: "unlocked"; readonly lock: HeldLock }
  /** PR-62: the server could no longer open the lock; its ciphertext is deleted. */
  | { readonly kind: "dead" }
  /** No answer, or one that settles nothing: keep the session in hand and retry. */
  | { readonly kind: "failed" };

export type DeviceLockEngine = {
  /** HOLD (§3.4): a forget-on slot obtains a lock unless it holds one. */
  ensureHeld(account: string, accessToken?: string): Promise<"held" | "failed">;
  /** Ends the opt-in: the server half discarded (best effort), the local half dropped. */
  discard(account: string, accessToken?: string): Promise<void>;
  /** LOCK (§3.5). `clearTokens` is its step 2. Answers false when no lock was held. */
  lock(account: string, clearTokens: () => void): Promise<boolean>;
  /** The remote path (§3.6): runs where a refresh learns the session is dead. */
  endLocalSession(account: string, clearTokens: () => void): Promise<LocalSessionEnd>;
  /** UNLOCK (§3.5), the sign-in's leg. */
  unlock(account: string, password: string, accessToken: string): Promise<UnlockOutcome>;
  /**
   * The whole sign-in leg, run with the fresh session in hand and BEFORE its
   * tokens are committed: unlock, then the opt-in's lock — re-held or
   * obtained when `forget` is ticked (PR-61: the sign-in is `ready` only once
   * one is held), discarded when it is not. A `ready: false` keeps the
   * session for a retry without a second login; `lockLost` reports PR-62's
   * dead lock, which happens once and must be said once.
   */
  signIn(
    account: string,
    password: string,
    accessToken: string,
    forget: boolean,
  ): Promise<{ ready: boolean; lockLost: boolean }>;
  /** On every start: interrupted locks finished, leftover plaintext drafts of locked slots removed. */
  recover(): Promise<void>;
};

async function webLock<T>(account: string, fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks !== undefined) {
    return await navigator.locks.request(`cogra-device-lock:${account}`, fn);
  }
  return fn();
}

const encode = (value: unknown) => encodeCustody(value);

export function createDeviceLockEngine(deps: DeviceLockDeps): DeviceLockEngine {
  const { identity, drafts, idb, api } = deps;
  const exclusive = deps.exclusive ?? webLock;

  /**
   * Steps 3-4: read the custody set, encrypt it, commit it. The backup is
   * positively known only when an actor record exists without its seed (the
   * seed is wiped only after an upload, `store.ts`); then the key material is
   * purged and only the draft is locked. Anything else — a retained seed, no
   * key here at all — locks everything it finds: a lock is reversible, a
   * purge is not.
   */
  async function sealAndCommit(account: string, key: CryptoKey): Promise<boolean> {
    const custody = await identity.custodyOf(account);
    const backedKnown = custody.hasActor && custody.seed === null;
    const plain: { kind: string; key: string; bytes: Uint8Array }[] = [];
    if (!backedKnown) {
      if (custody.seed !== null) plain.push({ kind: KIND_IDENTITY, key: KEY_ACTOR, bytes: custody.seed });
      if (custody.backupBlob !== null) {
        plain.push({ kind: KIND_IDENTITY, key: KEY_BACKUP, bytes: custody.backupBlob });
      }
      for (const { id, record } of custody.handshakes) {
        plain.push({ kind: KIND_HANDSHAKE, key: id, bytes: encode(record) });
      }
    }
    for (const row of await readDraftCustody(idb(), account)) {
      plain.push({ kind: KIND_DRAFT, key: row.key, bytes: encode(row.value) });
    }
    // Encrypted BEFORE the commit's transaction opens (IndexedDB auto-commits
    // a transaction across an await on anything but its own requests).
    const locked: LockedRecord[] = [];
    for (const p of plain) {
      locked.push({
        kind: p.kind,
        key: p.key,
        record: await sealLockRecord(key, { account, kind: p.kind, key: p.key }, p.bytes),
      });
    }
    return identity.commitLock(account, locked);
  }

  /** The plaintext draft goes only through an abandoned save generation, never a raw delete alone. */
  async function removePlaintextDraft(account: string): Promise<void> {
    drafts.abandonPendingSaves();
    await removeDraftCustody(idb(), account);
  }

  async function lockHeld(account: string, held: HeldLock, clearTokens: () => void): Promise<void> {
    await identity.setLockPending(account, true);
    clearTokens();
    drafts.abandonPendingSaves();
    await sealAndCommit(account, held.key);
    // Only a slot that IS locked loses its plaintext draft: a commit that
    // found its key already gone (a racing discard) locked nothing, and the
    // draft is then the only copy.
    if ((await identity.lockedSet(account)) !== null) await removePlaintextDraft(account);
    await identity.setLockPending(account, false);
  }

  async function discardServerHalf(lock: string, accessToken?: string): Promise<void> {
    try {
      await api.discard(lock, accessToken);
    } catch {
      // best effort: an orphaned row opens nothing without this device's
      // ciphertext, and it dies with the account
    }
  }

  const engine: DeviceLockEngine = {
    async signIn(account, password, accessToken, forget) {
      const unlocked = await engine.unlock(account, password, accessToken);
      if (unlocked.kind === "failed") return { ready: false, lockLost: false };
      const lockLost = unlocked.kind === "dead";
      if (unlocked.kind === "unlocked" && forget) {
        // The released lock stays this slot's lock: it is held again, and no
        // new one is minted (§3.5 UNLOCK step 3).
        const replaced = await identity.holdLock(account, unlocked.lock);
        if (replaced !== null) await discardServerHalf(replaced, accessToken);
        return { ready: true, lockLost };
      }
      if (forget) {
        return { ready: (await engine.ensureHeld(account, accessToken)) === "held", lockLost };
      }
      await engine.discard(account, accessToken);
      return { ready: true, lockLost };
    },

    async ensureHeld(account, accessToken) {
      if ((await identity.heldLock(account)) !== null) return "held";
      // A slot that is locked is never re-keyed: a fresh lock there would
      // leave the locked set with no id to release it by.
      if ((await identity.lockedSet(account)) !== null) return "failed";
      const issued = await api.issue(accessToken);
      if (issued.kind !== "success") return "failed";
      const key = await importLockSecret(issued.value.secret);
      issued.value.secret.fill(0);
      const replaced = await identity.holdLock(account, { id: issued.value.id, key });
      if (replaced !== null) await discardServerHalf(replaced, accessToken);
      return "held";
    },

    async discard(account, accessToken) {
      const id = await identity.lockIdOf(account);
      if (id === null) return;
      // NEVER while locked: the server half is then the only way back to the
      // locked set, and discarding it would erase the key.
      if ((await identity.lockedSet(account)) !== null) return;
      await identity.dropLock(account);
      await discardServerHalf(id, accessToken);
    },

    lock(account, clearTokens) {
      return exclusive(account, async () => {
        const held = await identity.heldLock(account);
        if (held === null) {
          clearTokens();
          return false;
        }
        await lockHeld(account, held, clearTokens);
        return true;
      });
    },

    endLocalSession(account, clearTokens) {
      return exclusive(account, async (): Promise<LocalSessionEnd> => {
        if (!(await identity.isEphemeralFor(account))) {
          clearTokens();
          return "kept";
        }
        const held = await identity.heldLock(account);
        let end: LocalSessionEnd;
        if (held !== null) {
          await lockHeld(account, held, clearTokens);
          end = "locked";
        } else {
          // PR-61's residual: no lock to lock with. A backed key is purged
          // as it always was (it survives in its backup); everything else —
          // an unbacked key, the draft — stays, unreachable to the app until
          // this account signs in here again.
          clearTokens();
          await identity.purgeBackedKeyMaterial(account);
          end = "refused";
        }
        // The seen record is never locked: a forget-on end drops it either
        // way, as the explicit don't-remember sign-out does (PR-69).
        try {
          await deps.forgetSeen?.(account);
        } catch {
          // a cache; the custody step above is what must not fail
        }
        return end;
      });
    },

    unlock(account, password, accessToken) {
      return exclusive(account, async (): Promise<UnlockOutcome> => {
        const locked = await identity.lockedSet(account);
        if (locked === null) return { kind: "none" };
        const lockId = await identity.lockIdOf(account);
        const released =
          lockId === null ? null : await api.release(lockId, password, accessToken);
        if (released !== null && released.kind !== "success") {
          return hasCode(released, "NOT_FOUND") ? dead(account) : { kind: "failed" };
        }
        if (released === null || lockId === null) return dead(account);
        const key = await importLockSecret(released.value);
        released.value.fill(0);
        let opened: { kind: string; key: string; bytes: Uint8Array }[];
        try {
          opened = await Promise.all(
            locked.map(async (r) => ({
              kind: r.kind,
              key: r.key,
              bytes: await openLockRecord(key, r.record, { account, kind: r.kind, key: r.key }),
            })),
          );
        } catch {
          // The server released its secret and the ciphertext still does not
          // open under it: nothing can open this set any more.
          return dead(account);
        }
        const custody: {
          seed: Uint8Array | null;
          backupBlob: Uint8Array | null;
          handshakes: { id: string; record: HandshakeRecord }[];
        } = { seed: null, backupBlob: null, handshakes: [] };
        const draftRows: DraftRow[] = [];
        for (const o of opened) {
          if (o.kind === KIND_IDENTITY && o.key === KEY_ACTOR) custody.seed = o.bytes;
          else if (o.kind === KIND_IDENTITY && o.key === KEY_BACKUP) custody.backupBlob = o.bytes;
          else if (o.kind === KIND_HANDSHAKE) {
            custody.handshakes.push({ id: o.key, record: decodeCustody<HandshakeRecord>(o.bytes) });
          } else if (o.kind === KIND_DRAFT) draftRows.push({ key: o.key, value: decodeCustody(o.bytes) });
        }
        // The draft first: a crash between the two leaves the locked set in
        // place (and the next unlock restores again), never a set removed
        // with its draft not yet back.
        await restoreDraftCustody(idb(), account, draftRows);
        await identity.commitUnlock(account, custody satisfies UnlockedCustody);
        return { kind: "unlocked", lock: { id: lockId, key } };
      });
    },

    async recover() {
      for (const account of await identity.lockSlots()) {
        await exclusive(account, async () => {
          if ((await identity.isLockPending(account)) && (await identity.lockedSet(account)) === null) {
            const held = await identity.heldLock(account);
            // The pending mark is written while the key is held, and the key
            // goes only in the commit — so a pending, unlocked slot still
            // holds it, and the lock finishes with it.
            if (held !== null) await sealAndCommit(account, held.key);
          }
          if ((await identity.lockedSet(account)) !== null) await removePlaintextDraft(account);
          await identity.setLockPending(account, false);
        });
      }
    },
  };
  return engine;

  async function dead(account: string): Promise<UnlockOutcome> {
    await identity.deleteDeadLockedSet(account);
    return { kind: "dead" };
  }
}
