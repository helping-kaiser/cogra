// The draft's share of an account's custody set (sign-out-custody §3.2): the
// working draft and its sealed copies, which live in `cogra.compose` beside
// every other account's. A device lock reads them out, encrypts them into the
// identity database, and removes the plaintext; an unlock puts them back.
//
// THE SEALED COPIES AND THE CARRIED EXPECTATIONS JOIN THE DRAFT. A sealed copy
// is the draft a staged post was written from (`sealed-draft.ts`), cleared
// with the draft by a don't-remember sign-out (Settings.md:145) — so what that
// sign-out clears, a lock locks. A carried write's prepare-time expectation
// (`signing/carried.ts`) is the same tier by ruling (content-integrity §9:
// "locked or purged with the draft"), so it rides the same reads. So do the
// kept picks (`stance/kept-picks.ts`; auth.md "Sign-out": a backed account's
// "draft and kept picks are locked, since they are the only copies of
// unpublished content").
//
// Every call names its account: a lock runs after the tokens were cleared,
// an unlock before the fresh session is committed.

import { carriedRange } from "@/lib/signing/carried";
import { keptRange } from "@/lib/stance/kept-picks";
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

/** The account's draft row, sealed copies and carried expectations, raw, in one read. */
export function readDraftCustody(idb: IDBFactory, account: string): Promise<DraftRow[]> {
  return transact(idb, "readonly", (store) => {
    const rows: DraftRow[] = [];
    const draft = store.get(account);
    draft.onsuccess = () => {
      if (draft.result !== undefined) rows.unshift({ key: account, value: draft.result });
    };
    for (const range of [accountRange(account), carriedRange(account), keptRange(account)]) {
      const cursor = store.openCursor(range);
      cursor.onsuccess = () => {
        const at = cursor.result;
        if (at === null) return;
        rows.push({ key: String(at.primaryKey), value: at.value });
        at.continue();
      };
    }
    return () => rows;
  });
}

/** Whether any plaintext draft or sealed copy of the account is in the store. */
export async function hasDraftCustody(idb: IDBFactory, account: string): Promise<boolean> {
  return (await readDraftCustody(idb, account)).length > 0;
}

/** Removes the account's draft, sealed copies and carried expectations in one transaction. */
export function removeDraftCustody(idb: IDBFactory, account: string): Promise<void> {
  return transact(idb, "readwrite", (store) => {
    store.delete(account);
    store.delete(accountRange(account));
    store.delete(carriedRange(account));
    store.delete(keptRange(account));
    return () => undefined;
  });
}

/**
 * Puts the rows back in one transaction. Only rows that belong to the account
 * are written — the draft's own key, a sealed copy's or a carried
 * expectation's — so an unlock can never plant a row in another account's
 * place.
 */
export function restoreDraftCustody(
  idb: IDBFactory,
  account: string,
  rows: readonly DraftRow[],
): Promise<void> {
  const ranges = [accountRange(account), carriedRange(account), keptRange(account)];
  return transact(idb, "readwrite", (store) => {
    for (const row of rows) {
      const owned = row.key === account || ranges.some((range) => range.includes(row.key));
      if (owned) store.put(row.value, row.key);
    }
    return () => undefined;
  });
}
