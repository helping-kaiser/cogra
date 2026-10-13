// The draft's share of an account's custody set (sign-out-custody §3.2): the
// working draft and its sealed copies, which live in `cogra.compose` beside
// every other account's. A device lock reads them out, encrypts them into the
// identity database, and removes the plaintext; an unlock puts them back.
//
// THE SEALED COPIES JOIN THE DRAFT. A sealed copy is the draft a staged post
// was written from (`sealed-draft.ts`), cleared with the draft by a
// don't-remember sign-out (Settings.md:145) — so what that sign-out clears, a
// lock locks.
//
// Every call names its account: a lock runs after the tokens were cleared,
// an unlock before the fresh session is committed.

import { accountRange } from "./sealed-draft";
import { open, STORE } from "./draft-store";

/** One raw row: its key in the store and its stored value, untouched. */
export type DraftRow = { readonly key: string; readonly value: unknown };

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
            reject(transaction.error ?? new Error("the draft custody transaction aborted"));
          };
        } catch (e) {
          db.close();
          reject(e);
        }
      }),
  );
}

/** The account's draft row and sealed copies, raw, in one read. */
export function readDraftCustody(idb: IDBFactory, account: string): Promise<DraftRow[]> {
  return transact(idb, "readonly", (store) => {
    const rows: DraftRow[] = [];
    const draft = store.get(account);
    draft.onsuccess = () => {
      if (draft.result !== undefined) rows.unshift({ key: account, value: draft.result });
    };
    const cursor = store.openCursor(accountRange(account));
    cursor.onsuccess = () => {
      const at = cursor.result;
      if (at === null) return;
      rows.push({ key: String(at.primaryKey), value: at.value });
      at.continue();
    };
    return () => rows;
  });
}

/** Whether any plaintext draft or sealed copy of the account is in the store. */
export async function hasDraftCustody(idb: IDBFactory, account: string): Promise<boolean> {
  return (await readDraftCustody(idb, account)).length > 0;
}

/** Removes the account's draft and sealed copies in one transaction. */
export function removeDraftCustody(idb: IDBFactory, account: string): Promise<void> {
  return transact(idb, "readwrite", (store) => {
    store.delete(account);
    store.delete(accountRange(account));
    return () => undefined;
  });
}

/**
 * Puts the rows back in one transaction. Only rows that belong to the account
 * are written — the draft's own key or a sealed copy's — so an unlock can never
 * plant a row in another account's place.
 */
export function restoreDraftCustody(
  idb: IDBFactory,
  account: string,
  rows: readonly DraftRow[],
): Promise<void> {
  const range = accountRange(account);
  return transact(idb, "readwrite", (store) => {
    for (const row of rows) {
      if (row.key === account || range.includes(row.key)) store.put(row.value, row.key);
    }
    return () => undefined;
  });
}
