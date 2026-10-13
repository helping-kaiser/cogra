// The sealed copy: the draft a staged post was written from, held from the
// moment its signing is taken until the write LANDS or EXPIRES.
//
// WHY IT EXISTS (FC-G5, ruled "fix the BUILD, not the board"). Once a post's
// signing is taken the draft stops being a draft — jakob 2026-08-31, "once a
// post is sent its draft should be gone" — and the composer clears it. But
// "taken" is RELAYING, not LANDED: the write can still be collected unlanded
// epochs later, and ComposeExpired.md:3 promises that then "the draft is
// kept". Both rulings hold by keeping the copy OUT OF THE COMPOSER: it is
// never offered as a draft while its write is alive, it is purged when the
// write lands, and it becomes the kept draft when the write expires, so
// "Open the draft" leads with it (ComposeExpired.md:5).
//
// THE SAME TIER AS THE DRAFT, nothing stronger. It rides the draft's own
// IndexedDB store under its own keys, so it survives exactly what the draft
// survives (a reload, a closed tab) and is lost to exactly what loses the
// draft (eviction, a private window's end). A don't-remember sign-out
// clears it with the draft (Settings.md:145).
//
// ONE PER STAGED POST, not one per account. A second post can be staged —
// or a second draft started — while the first one's fate is still open, and
// a single slot would have the second seal overwrite the first.

import type { Outcome } from "@/lib/api/outcome";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { tokenStore } from "@/lib/session/token-store";
import {
  DRAFT_SCHEMA,
  STORE,
  open,
  restored,
  storedOf,
  type StoredDraft,
  type StoredState,
} from "./draft-store";
import type { WizardState } from "./wizard";

/** What became of one staged write, as far as this device can tell right now. */
export type StagedFate = "landed" | "expired" | "alive" | "unknown";

export type SealedDraft = {
  /** The node the staged post mints. */
  node: string;
  /** Every write of the staged batch, the post's record and its tags and references. */
  writes: readonly string[];
  sealedAt: string;
  state: WizardState;
};

export type SealedDraftStore = {
  /**
   * Seals the composed state for a staged batch AND clears the working draft,
   * in ONE transaction: either the copy exists and the draft is gone, or
   * nothing changed. There is no instant at which neither holds the post.
   */
  seal(state: WizardState, staged: { node: string; writes: readonly string[] }): Promise<void>;
  /** The copies still waiting on their writes, oldest first. */
  list(): Promise<SealedDraft[]>;
  /**
   * Asks after every waiting copy's writes. A landed batch purges its copy; an
   * expired one restores it as the kept draft; anything still open waits.
   */
  settle(fate: (writeId: string) => Promise<StagedFate>): Promise<void>;
  /** Drops every copy of this account (the don't-remember sign-out). */
  forget(): Promise<void>;
};

type SealedRecord = {
  schema: number;
  sealedAt: string;
  node: string;
  writes: readonly string[];
  state: StoredState;
};

const PREFIX = "sealed:";

function sealKey(account: string, firstWrite: string): string {
  return `${PREFIX}${account}:${firstWrite}`;
}

/** Every key of this account's copies, and nothing else in the store. */
export function accountRange(account: string): IDBKeyRange {
  return IDBKeyRange.bound(`${PREFIX}${account}:`, `${PREFIX}${account}:￿`);
}

/**
 * One transaction over the shared store, resolved only on COMPLETE — a
 * readwrite that aborts must reject, never report what it meant to do.
 */
function transact<T>(
  idb: IDBFactory,
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => () => T,
): Promise<T> {
  return open(idb).then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let result: () => T;
        try {
          const transaction = db.transaction(STORE, mode);
          result = body(transaction.objectStore(STORE));
          transaction.oncomplete = () => {
            db.close();
            resolve(result());
          };
          transaction.onabort = () => {
            db.close();
            reject(transaction.error ?? new Error("the sealed draft transaction aborted"));
          };
        } catch (e) {
          db.close();
          reject(e);
        }
      }),
  );
}

/**
 * The batch's verdict from its writes' fates. The post's batch lands together
 * or not at all, so ANY expired write means the post did not land — and on a
 * mixed answer the copy is restored rather than purged: a restored draft the
 * author does not need is one Discard away, a purged one is gone.
 */
function verdictOf(fates: readonly StagedFate[]): "restore" | "purge" | "wait" {
  if (fates.some((fate) => fate === "expired")) return "restore";
  if (fates.length > 0 && fates.every((fate) => fate === "landed")) return "purge";
  return "wait";
}

/**
 * A `stagedWrite(id)` read, as a fate.
 *
 * NULL READS AS EXPIRED. The server deletes a staged write in exactly one
 * place — the reap of rows that already expired (`reap_expired`,
 * postgres-store staged.rs) — so a write of this account that the server no
 * longer knows was collected unlanded. A read that did not answer says
 * nothing, and nothing is decided on it.
 */
export function fateOf(outcome: Outcome<StagedWriteView | null>): StagedFate {
  if (outcome.kind !== "success") return "unknown";
  if (outcome.value === null) return "expired";
  switch (outcome.value.state) {
    case "LANDED":
      return "landed";
    case "EXPIRED":
      return "expired";
    default:
      return "alive";
  }
}

export function createSealedDraftStore(deps: {
  /** The account the copies belong to — per call, never captured. */
  activeAccountId: () => string | null;
  /** Injectable for tests. */
  idb?: () => IDBFactory;
}): SealedDraftStore {
  const { activeAccountId } = deps;
  const factory = deps.idb ?? (() => indexedDB);

  async function records(account: string): Promise<{ key: IDBValidKey; record: SealedRecord }[]> {
    const found = await transact(factory(), "readonly", (store) => {
      const rows: { key: IDBValidKey; record: SealedRecord }[] = [];
      const cursor = store.openCursor(accountRange(account));
      cursor.onsuccess = () => {
        const at = cursor.result;
        if (at === null) return;
        rows.push({ key: at.primaryKey, record: at.value as SealedRecord });
        at.continue();
      };
      return () => rows;
    });
    // A shape this build does not read is left where it is rather than
    // guessed at — and never purged, since what it holds is someone's post.
    return found
      .filter(({ record }) => record.schema === DRAFT_SCHEMA)
      .sort((a, b) => a.record.sealedAt.localeCompare(b.record.sealedAt));
  }

  /**
   * Hands one copy back to the composer — ONLY into an empty draft slot.
   * The board keeps one draft per target (ComposeDraft.md:9), and a draft
   * the author started since is never overwritten: the copy waits, sealed,
   * until the slot is free again.
   */
  function restore(account: string, key: IDBValidKey, record: SealedRecord): Promise<boolean> {
    return transact(factory(), "readwrite", (store) => {
      let restoredIt = false;
      const current = store.get(account);
      current.onsuccess = () => {
        const held = current.result as StoredDraft | undefined;
        // A draft row this build cannot read is no draft (the store's own
        // `load` drops it), so it does not hold the slot.
        if (held !== undefined && held.schema === DRAFT_SCHEMA) return;
        const draft: StoredDraft = {
          schema: DRAFT_SCHEMA,
          savedAt: new Date().toISOString(),
          state: record.state,
        };
        store.put(draft, account);
        store.delete(key);
        restoredIt = true;
      };
      return () => restoredIt;
    });
  }

  return {
    async seal(state, staged) {
      const account = activeAccountId();
      if (account === null) return;
      const first = staged.writes[0];
      if (first === undefined) return;
      const record: SealedRecord = {
        schema: DRAFT_SCHEMA,
        sealedAt: new Date().toISOString(),
        node: staged.node,
        writes: [...staged.writes],
        state: await storedOf(state),
      };
      await transact(factory(), "readwrite", (store) => {
        store.put(record, sealKey(account, first));
        store.delete(account);
        return () => undefined;
      });
    },

    async list() {
      const account = activeAccountId();
      if (account === null) return [];
      return (await records(account)).map(({ record }) => ({
        node: record.node,
        writes: record.writes,
        sealedAt: record.sealedAt,
        state: restored(record.state),
      }));
    },

    async settle(fate) {
      const account = activeAccountId();
      if (account === null) return;
      for (const { key, record } of await records(account)) {
        const fates: StagedFate[] = [];
        for (const id of record.writes) fates.push(await fate(id));
        switch (verdictOf(fates)) {
          case "purge":
            await transact(factory(), "readwrite", (store) => {
              store.delete(key);
              return () => undefined;
            });
            break;
          case "restore":
            await restore(account, key, record);
            break;
          case "wait":
            break;
        }
      }
    },

    async forget() {
      const account = activeAccountId();
      if (account === null) return;
      await transact(factory(), "readwrite", (store) => {
        store.delete(accountRange(account));
        return () => undefined;
      });
    },
  };
}

/** The sealed copies of the running page, scoped to the active session's account. */
export const sealedDraftStore: SealedDraftStore = createSealedDraftStore({
  activeAccountId: () => tokenStore.activeAccountId(),
});
