// THE CARRIED BRANCH OF THE INTENT CHECK (PR-88, CI-G5 ruled (a)+(a1);
// Android mirror: Carried.kt).
//
// An applicant's once-each post, Opinion and Affinity are CARRIED: the
// prepare stages them, and the device signs them only at the landing, days or
// weeks later, without a prompt (auth.md "Application"). The landing holds no
// form. So the check runs where the form exists — at the prepare, on the
// preparing device, through the ordinary batch check (`write-signer.ts`
// `sign`) — and what it verified is kept here, in device custody, keyed by
// the staged write's id: a DIGEST of the verified proposal EXCLUDING its
// dependencies. The landing appends the ruled dependency completion
// (`[admission Registration, winning vouch]`), so a digest over the body and
// the payload alone is what stays equal; the device signs the released write
// only when the served proposal still digests to it.
//
// A landing seen on a device that holds no expectation for an Opinion — the
// write was prepared on another device — signs it under the second named
// exemption, `CARRIED_AT_LANDING_EXEMPTION` (intent.ts): the act WAS checked
// once, where it was ordered. That is also what a device that held the
// expectation and lost it (purged with the draft at a don't-remember
// sign-out) does: custody absent is custody absent. The exemption holds for
// an Opinion alone (PR-105); any other family without an expectation refuses
// the whole released batch.
//
// THE SAME TIER AS THE DRAFT (content-integrity §9, "join the draft/handshake
// custody set … locked or purged with the draft"). The record rides the
// compose draft's own store under its own keys, beside the sealed copies, so a
// device lock locks it with the draft and an unlock puts it back
// (`draft-custody.ts`), and the don't-remember sign-out drops it with the
// draft.

import { open, STORE } from "@/lib/compose/draft-store";
import { sha256Tagged } from "@/lib/crypto/hashing";
import type { Proposal } from "@/lib/crypto/handshake";
import { tokenStore } from "@/lib/session/token-store";
import type { StagedWriteView } from "@/lib/api/writes-api";

/**
 * The digest's domain tag. Device-local — the digest never leaves the device
 * and nothing else verifies it — but tagged like every other hash here, so it
 * can never stand in for one of them.
 */
export const CARRIED_EXPECTATION_TAG = "cogra-client:carried-expectation:v1";

/**
 * The verified proposal's digest, its dependencies excluded: the canonical
 * structural body (identity, endpoints, both parameters, license, asserted
 * parents) and the payload bytes, each length-framed.
 */
export function carriedDigest(proposal: Proposal): Promise<Uint8Array> {
  return sha256Tagged(CARRIED_EXPECTATION_TAG, [proposal.body.canonicalBytes(), proposal.payload]);
}

/** The persisted prepare-time expectations, one per carried write. */
export type CarriedExpectationStore = {
  save(stagedWriteId: string, digest: Uint8Array): Promise<void>;
  /** The digest this device verified at the prepare, or null when it holds none. */
  get(stagedWriteId: string): Promise<Uint8Array | null>;
  clear(stagedWriteId: string): Promise<void>;
  /** Drops every expectation of this account (the don't-remember sign-out). */
  forget(): Promise<void>;
};

const PREFIX = "carried:";

function carriedKey(account: string, stagedWriteId: string): string {
  return `${PREFIX}${account}:${stagedWriteId}`;
}

/** Every key of this account's carried expectations, and nothing else in the store. */
export function carriedRange(account: string): IDBKeyRange {
  return IDBKeyRange.bound(`${PREFIX}${account}:`, `${PREFIX}${account}:￿`);
}

type CarriedRecord = { digest: Uint8Array };

function transact<T>(
  idb: IDBFactory,
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => () => T,
): Promise<T> {
  return open(idb).then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        try {
          const transaction = db.transaction(STORE, mode);
          const result = body(transaction.objectStore(STORE));
          transaction.oncomplete = () => {
            db.close();
            resolve(result());
          };
          transaction.onabort = () => {
            db.close();
            reject(transaction.error ?? new Error("the carried expectation transaction aborted"));
          };
        } catch (e) {
          db.close();
          reject(e);
        }
      }),
  );
}

export function createCarriedExpectationStore(deps: {
  /** The signed-in account custody resolves to — per call, never captured. */
  activeAccountId: () => string | null;
  idb?: () => IDBFactory;
}): CarriedExpectationStore {
  const { activeAccountId } = deps;
  const factory = deps.idb ?? (() => indexedDB);

  function writer(): string {
    const account = activeAccountId();
    if (account === null) throw new Error("custody write without an active account");
    return account;
  }

  return {
    async save(stagedWriteId, digest) {
      const account = writer();
      await transact(factory(), "readwrite", (store) => {
        store.put({ digest: digest.slice() } satisfies CarriedRecord, carriedKey(account, stagedWriteId));
        return () => undefined;
      });
    },

    async get(stagedWriteId) {
      const account = activeAccountId();
      if (account === null) return null;
      return transact(factory(), "readonly", (store) => {
        const request = store.get(carriedKey(account, stagedWriteId));
        return () => {
          const digest = (request.result as CarriedRecord | undefined)?.digest;
          // By view, not by `instanceof`: a structured clone may come back
          // from another realm's typed-array constructor.
          return digest !== undefined && ArrayBuffer.isView(digest)
            ? new Uint8Array(digest.buffer, digest.byteOffset, digest.byteLength)
            : null;
        };
      });
    },

    async clear(stagedWriteId) {
      const account = activeAccountId();
      if (account === null) return;
      await transact(factory(), "readwrite", (store) => {
        store.delete(carriedKey(account, stagedWriteId));
        return () => undefined;
      });
    },

    async forget() {
      const account = activeAccountId();
      if (account === null) return;
      await transact(factory(), "readwrite", (store) => {
        store.delete(carriedRange(account));
        return () => undefined;
      });
    },
  };
}

/** The carried expectations of the running page, scoped to the active session's account. */
export const carriedExpectationStore: CarriedExpectationStore = createCarriedExpectationStore({
  activeAccountId: () => tokenStore.activeAccountId(),
});

// ---- the landing's precondition seam (PR-89(iii)) ---------------------------

/** Whether the released batch may sign now. */
export type CarriedLandingReadiness =
  | { readonly kind: "ready" }
  /** Not yet: nothing is signed and nothing is spent; the next poll asks again. */
  | { readonly kind: "notReady"; readonly reason: string };

/**
 * THE CARRIED LANDING GATE — the one precondition the landing consults after
 * the batch passed its intent check and BEFORE its first pre-signature.
 *
 * PR-89(iii): a carried act's media waits in an author-only area until the
 * landing moves it to the public store, and the move is CONFIRMED GOOD before
 * the carried act signs ("so we dont run the risk of a broken post"); a failed
 * or unverified move refuses the sign, retryable. That verification is wired
 * in HERE, by the media-areas build. Until it is, the gate answers `ready`
 * ({@link CARRIED_LANDING_ALWAYS_READY}): the move does not exist yet, so
 * there is nothing to wait for.
 */
export type CarriedLandingGate = (
  batch: readonly StagedWriteView[],
) => Promise<CarriedLandingReadiness>;

/** The gate before any precondition is wired: nothing to wait for. */
export const CARRIED_LANDING_ALWAYS_READY: CarriedLandingGate = async () => ({ kind: "ready" });
