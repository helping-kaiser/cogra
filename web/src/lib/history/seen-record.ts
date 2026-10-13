// THE DEVICE'S SEEN RECORD — what the ranked feed's seen cut reads (ranked-
// feed packet §4.3, CD-10). It is the tracker's set made durable:
//
// - PERSISTENT PER ACCOUNT (PR-51). Every first seeing the queue takes is
//   written through to IndexedDB under the account it belongs to, so a reload
//   or a reopened tab keeps it. The key carries the account — the custody rule
//   (auth.md "Multi-account device custody"): one account's record is never
//   read for another, and switching back finds the first one where it was.
// - A CACHE OF THE SERVER'S VIEW LOG (PR-52). `markSeen` already writes every
//   device's seeing to `user_view_log`; `seen-sync.ts` pages the reader's own
//   `viewHistory` into this record past the WATERMARK it keeps here, so a
//   thing seen on the phone is cut on the desktop after its next open.
// - THE READER'S, NEVER THE VIEWER'S (§4.3). A borrowed view ranks the
//   lender's slice; the record cut from it is still the signed-in reader's.
// - NO SESSION, NO RECORD: with no account the record holds nothing, so the
//   cut deletes nothing (§4.3, history-surface F6).
// - THE OWN PROFILE NEVER ENTERS (PR-50): it is History's set, which keeps the
//   reader's own profile out; the record refuses it too.
//
// THE SAME TIER AS THE DRAFT (`compose/draft-store.ts`): IndexedDB, best
// effort. A store that cannot open (a private window, eviction) costs the
// durability, never the session: the in-memory set still serves the cut.
//
// Kept free of React, Apollo and the session, like the queue it sits behind,
// so the test setup can reset it ahead of each file's own mocks.

const DB_NAME = "cogra.seen";
const DB_VERSION = 1;
const STORE = "record";

const ID_PREFIX = "seen:";
const WATERMARK_PREFIX = "watermark:";

function idKey(account: string, id: string): string {
  return `${ID_PREFIX}${account}:${id}`;
}

function accountRange(account: string): IDBKeyRange {
  return IDBKeyRange.bound(`${ID_PREFIX}${account}:`, `${ID_PREFIX}${account}:￿`);
}

function open(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onblocked = () => reject(new Error("the seen record is blocked by another tab"));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** One transaction, resolved only on COMPLETE; the connection closes on every path. */
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
            reject(transaction.error ?? new Error("the seen record transaction aborted"));
          };
        } catch (e) {
          db.close();
          reject(e);
        }
      }),
  );
}

/**
 * The record of the account the device is reading as. One per tab.
 *
 * `use` keys it to an account and loads that account's ids; `has` answers
 * from memory, synchronously, which is what lets a derive read it as it
 * stands; `add` writes through.
 */
export class SeenRecord {
  private owner: string | null = null;
  private ids = new Set<string>();
  // Bumped on every change of hands, so a load that finishes after the next
  // `use` cannot fill the new account's set with the old account's ids.
  private era = 0;
  private loading: Promise<void> = Promise.resolve();

  constructor(private readonly idb: () => IDBFactory = () => indexedDB) {}

  /** The account whose record this is; null holds nothing. */
  get account(): string | null {
    return this.owner;
  }

  /**
   * Keys the record to `account` and loads its ids. Idempotent for the
   * account already held — the answer is the load already under way.
   */
  use(account: string | null): Promise<void> {
    if (account === this.owner) return this.loading;
    this.owner = account;
    this.ids = new Set();
    this.era += 1;
    const era = this.era;
    if (account === null) {
      this.loading = Promise.resolve();
      return this.loading;
    }
    this.loading = transact(this.idb(), "readonly", (store) => {
      const request = store.getAllKeys(accountRange(account));
      return () => request.result as IDBValidKey[];
    }).then(
      (keys) => {
        if (era !== this.era) return;
        const prefix = `${ID_PREFIX}${account}:`;
        for (const key of keys) {
          if (typeof key === "string") this.ids.add(key.slice(prefix.length));
        }
      },
      // A store that cannot be read is an empty record, not a broken feed.
      () => undefined,
    );
    return this.loading;
  }

  /** Whether `id` is in the record of the account held. */
  has(id: string): boolean {
    return this.ids.has(id);
  }

  /** How many ids the held account's record carries. */
  get size(): number {
    return this.ids.size;
  }

  /**
   * Records `ids` as seen by `account`: in memory when it is the account
   * held, and on disk either way. The reader's own profile is refused.
   */
  async add(account: string, ids: readonly string[]): Promise<void> {
    const fresh = ids.filter((id) => id !== account);
    if (fresh.length === 0) return;
    if (account === this.owner) for (const id of fresh) this.ids.add(id);
    await transact(this.idb(), "readwrite", (store) => {
      for (const id of fresh) store.put(1, idKey(account, id));
      return () => undefined;
    });
  }

  /** The newest `firstSeenAt` the sync has taken in for `account`, or null. */
  async watermark(account: string): Promise<string | null> {
    try {
      return await transact(this.idb(), "readonly", (store) => {
        const request = store.get(`${WATERMARK_PREFIX}${account}`);
        return () => (typeof request.result === "string" ? request.result : null);
      });
    } catch {
      return null;
    }
  }

  /** Moves `account`'s watermark to `at`. */
  async setWatermark(account: string, at: string): Promise<void> {
    await transact(this.idb(), "readwrite", (store) => {
      store.put(at, `${WATERMARK_PREFIX}${account}`);
      return () => undefined;
    });
  }
}

/** The tab's one record. */
export let seenRecord = new SeenRecord();

/**
 * A fresh record over `idb` — module state, and the store under it, must not
 * carry from one test to the next.
 */
export function resetSeenRecordForTests(idb?: () => IDBFactory): void {
  seenRecord = new SeenRecord(idb);
}
