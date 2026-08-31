// The local draft: one unpublished post, kept on this device.
//
// IndexedDB rather than localStorage, because the draft holds the picked
// pictures themselves and a `Blob` survives the structured clone IndexedDB uses
// while localStorage takes strings alone. The board says so in as many words —
// "2 pictures — kept on this device" — and it is the promise the expiry notice
// leans on: "nothing was spent, your draft is saved" is only true if the
// pictures are still there.
//
// ONE DRAFT, not a list. The wizard offers "Continue" or "Discard" over a single
// saved draft; a drafts inbox is a surface nobody has designed.

import type { PickedAsset, WizardState } from "./wizard";

const DB_NAME = "cogra.compose";
const DB_VERSION = 1;
const STORE = "draft";
const KEY = "current";

export type ComposeDraftStore = {
  save(state: WizardState): Promise<void>;
  load(): Promise<WizardState | null>;
  clear(): Promise<void>;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = act(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

/**
 * What actually goes to disk.
 *
 * The picture is stored as BYTES plus a type rather than as the `Blob` itself.
 * A Blob is structured-cloneable and a browser would take it, but writing the
 * bytes makes the stored shape explicit and inspectable, and it is the only
 * form that can be asserted in a test — the in-memory IndexedDB the suite runs
 * against does not clone Blobs. A draft that cannot be proven to come back is
 * exactly the draft the expiry notice must not promise.
 */
type StoredAsset = Omit<PickedAsset, "file"> & { bytes: ArrayBuffer; fileType: string };
type StoredDraft = {
  savedAt: string;
  state: Omit<WizardState, "assets"> & { assets: readonly StoredAsset[] };
};

/**
 * An upload in flight did not survive the reload that lost the tab, so it comes
 * back as something the composer will start again. An upload that FINISHED
 * keeps its id: an asset row is immutable once written (D3), so the bytes are
 * still there under the same id and re-uploading them would only orphan a copy.
 */
function afterReload(upload: PickedAsset["upload"]): PickedAsset["upload"] {
  return upload.kind === "done" ? upload : { kind: "waiting" };
}

/**
 * WHY A SAVE CAN OUTLIVE THE CLEAR THAT SHOULD HAVE BEATEN IT.
 *
 * `save` cannot write until it has read every picked blob back out, and with
 * ten pictures attached that read is genuinely slow. A save that started before
 * the post was signed is therefore still sitting in `arrayBuffer()` when
 * `clear` deletes the row — and when it finally lands it writes the draft back,
 * which is precisely the draft that survives a successful publish.
 *
 * Ordering the two transactions would not help: the stale save's write is
 * correctly ordered, it is simply no longer wanted. So each write carries the
 * generation it began in and `clear` bumps that generation — a save whose
 * generation is stale drops its write instead of resurrecting what was just
 * cleared. A save issued AFTER the clear starts in the new generation and is
 * kept, which is what lets the next compose session save normally.
 */
let generation = 0;

export const composeDraftStore: ComposeDraftStore = {
  async save(state) {
    const startedIn = generation;
    const assets: StoredAsset[] = await Promise.all(
      state.assets.map(async ({ file, ...rest }) => ({
        ...rest,
        bytes: await file.arrayBuffer(),
        fileType: file.type,
      })),
    );
    if (startedIn !== generation) return;
    const draft: StoredDraft = {
      savedAt: new Date().toISOString(),
      state: { ...state, assets },
    };
    await run("readwrite", (store) => store.put(draft, KEY));
  },

  async load() {
    const draft = await run<StoredDraft | undefined>("readonly", (store) => store.get(KEY));
    if (draft === undefined) return null;
    const { assets, ...rest } = draft.state;
    return {
      ...rest,
      assets: assets.map(({ bytes, fileType, ...asset }) => ({
        ...asset,
        file: new Blob([bytes], { type: fileType }),
        upload: afterReload(asset.upload),
      })),
    };
  },

  async clear() {
    generation += 1;
    await run("readwrite", (store) => store.delete(KEY));
  },
};

/** What the draft card says it is holding, without opening the whole wizard. */
export function draftSummary(state: WizardState): { title: string; detail: string } {
  const title =
    state.title.trim() !== ""
      ? state.title
      : state.mode === "words" && state.words.trim() !== ""
        ? state.words.trim().split("\n")[0]!
        : "Untitled";
  const count = state.assets.length;
  const detail =
    state.mode === "words"
      ? "Words — kept on this device"
      : count === 1
        ? "1 picture — kept on this device"
        : `${count} pictures — kept on this device`;
  return { title, detail };
}

/** Whether a restored draft holds anything worth offering back. */
export function draftIsWorthKeeping(state: WizardState): boolean {
  return (
    state.assets.length > 0 ||
    state.words.trim() !== "" ||
    state.title.trim() !== "" ||
    state.description.trim() !== "" ||
    state.tags.length > 0 ||
    state.references.length > 0
  );
}
