// ERASE EVERYTHING FROM THIS BROWSER (Settings.md "Clearing data";
// EraseConfirm.md:21). What CoGra keeps in this browser, gone for good: the
// key and its custody material (`cogra.identity`), the draft and the sealed
// copies (`cogra.compose`), the seen list's copy with its sync watermark
// (`cogra.seen`), and every `cogra.`-named value in local and session storage
// — the choices kept on this device, the refresh token and the account it
// names, so the sign-in that follows offers no account.
//
// THE SEEN RECORD AND ITS WATERMARK GO TOGETHER (seam 171): both live in the
// one `cogra.seen` database, so deleting it resets the watermark with the
// cache, and the next sign-in re-seeds the record from the server's view log
// from the top. The server's log itself is untouched — the wipe touches no
// wire.
//
// Nothing here talks to the server, and nothing here knows a session; the
// caller revokes first and ends the session after.

/** CoGra's databases in this browser, named where each store opens them. */
export const COGRA_DATABASES = ["cogra.identity", "cogra.compose", "cogra.seen"] as const;

const PREFIX = "cogra.";

/** Deletes one database. A tab still holding it is asked to close (`versionchange`); the delete completes then. */
function deleteDatabase(idb: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = idb.deleteDatabase(name);
    request.onsuccess = () => resolve();
    // An error or a block never keeps the reader signed in: the delete is
    // queued either way, and the session ends regardless.
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

/** Every `cogra.` database this browser reports, plus the named ones it may not list. */
async function databaseNames(idb: IDBFactory): Promise<string[]> {
  const names = new Set<string>(COGRA_DATABASES);
  try {
    const listed = typeof idb.databases === "function" ? await idb.databases() : [];
    for (const { name } of listed) if (name?.startsWith(PREFIX)) names.add(name);
  } catch {
    // A browser that cannot list still gets the named ones.
  }
  return [...names];
}

function clearPrefixed(storage: Storage | undefined): void {
  if (storage === undefined) return;
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(PREFIX)) doomed.push(key);
  }
  for (const key of doomed) storage.removeItem(key);
}

export async function eraseEverything({
  idb = typeof indexedDB === "undefined" ? undefined : indexedDB,
  local = typeof window === "undefined" ? undefined : window.localStorage,
  session = typeof window === "undefined" ? undefined : window.sessionStorage,
}: {
  idb?: IDBFactory;
  local?: Storage;
  session?: Storage;
} = {}): Promise<void> {
  if (idb !== undefined) {
    const names = await databaseNames(idb);
    await Promise.all(names.map((name) => deleteDatabase(idb, name)));
  }
  clearPrefixed(local);
  clearPrefixed(session);
}
