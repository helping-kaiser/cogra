// The local draft: one unpublished post per account, held on this device.
//
// IndexedDB rather than localStorage, because the draft holds the picked
// pictures themselves and a `Blob` survives the structured clone IndexedDB uses
// while localStorage takes strings alone. That is what the board's "2 pictures
// — saved on this device, for now" and the expiry notice's "nothing was spent"
// lean on. It is a BEST-EFFORT promise, not a durable one: a browser may evict
// its storage, a private window discards it at the end of the session, and a
// signed-out account's draft is cleared on purpose.
//
// PER ACCOUNT, not per browser. A single global record meant a reader who
// signed out left their unpublished words and pictures sitting in the composer
// for whoever signed in next; the key is the account id, and sign-out clears
// the account's own.
//
// ONE DRAFT, not a list. The wizard offers "Continue" or "Discard" over a single
// saved draft; a drafts inbox is a surface nobody has designed.

import { tokenStore } from "@/lib/session/token-store";
import { emptyWizard, kindOf, type CoverAsset, type PickedAsset, type WizardState } from "./wizard";

const DB_NAME = "cogra.compose";
const DB_VERSION = 1;
const STORE = "draft";
/**
 * The pre-multi-account record, which belonged to whoever was signed in when it
 * was written. It is DROPPED rather than adopted: nothing ties it to an
 * account, so handing it to the next reader to open the composer is exactly the
 * leak the per-account key exists to close.
 */
const LEGACY_SINGLETON_KEY = "current";

/**
 * The stored shape's version.
 *
 * A draft is a snapshot of a type that keeps growing — `cover` arrived with
 * video, `sensitive` three days after the store shipped — and a restore that
 * spreads an older payload back in hands the wizard `undefined` where its own
 * type promises a value, which turns a controlled input uncontrolled. The
 * version is what lets `load` say "not a shape this build reads" instead.
 */
const DRAFT_SCHEMA = 1;

export type ComposeDraftStore = {
  save(state: WizardState): Promise<void>;
  load(): Promise<WizardState | null>;
  clear(): Promise<void>;
};

function open(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    // A blocked open never settles on its own; rejecting lets the next call
    // retry rather than leaving the composer waiting forever.
    request.onblocked = () => reject(new Error("the draft database is blocked by another tab"));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(
  idb: IDBFactory,
  mode: IDBTransactionMode,
  act: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open(idb).then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        // CLOSED ON EVERY PATH, not only on completion. A connection left open
        // by an aborted transaction is what blocks a later version bump, and
        // the failure paths are exactly the ones that used to leak it.
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          db.close();
        };
        const transaction = db.transaction(STORE, mode);
        const request = act(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          close();
          reject(request.error);
        };
        transaction.oncomplete = close;
        transaction.onabort = () => {
          close();
          reject(transaction.error ?? new Error("the draft transaction aborted"));
        };
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
/** The video's face travels the same way, and for the same reason. */
type StoredCover = Omit<CoverAsset, "file"> & { bytes: ArrayBuffer; fileType: string };
type StoredState = Omit<WizardState, "assets" | "cover"> & {
  assets: readonly StoredAsset[];
  cover: StoredCover | null;
};

type StoredDraft = {
  schema: number;
  savedAt: string;
  state: StoredState;
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
/**
 * The stored payload READ RATHER THAN CAST.
 *
 * Every field is taken through the empty wizard's own value, so a field added
 * after this draft was written comes back as its default instead of the
 * `undefined` the declared type promises will never be there — the difference
 * between a toggle that reads "off" and a controlled input that silently turns
 * uncontrolled.
 */
function restored(stored: StoredState): WizardState {
  const base = emptyWizard();
  const take = <K extends keyof WizardState>(key: K): WizardState[K] => {
    const value = (stored as Partial<WizardState>)[key];
    return value === undefined ? base[key] : (value as WizardState[K]);
  };
  return {
    step: take("step"),
    mode: take("mode"),
    words: take("words"),
    assets: (stored.assets ?? []).map(({ bytes, fileType, ...asset }) => ({
      ...asset,
      file: new Blob([bytes], { type: fileType }),
      upload: afterReload(asset.upload),
    })),
    cover:
      stored.cover == null
        ? null
        : {
            ...stored.cover,
            file: new Blob([stored.cover.bytes], { type: stored.cover.fileType }),
            upload: afterReload(stored.cover.upload),
          },
    shape: take("shape"),
    focused: take("focused"),
    title: take("title"),
    description: take("description"),
    tags: take("tags"),
    references: take("references"),
    license: take("license"),
    sensitive: take("sensitive"),
    sensitiveReason: take("sensitiveReason"),
    pDirected: take("pDirected"),
  };
}

export function createComposeDraftStore(deps: {
  /** The account the draft belongs to — per call, never captured. */
  activeAccountId: () => string | null;
  /** Injectable for tests. */
  idb?: () => IDBFactory;
}): ComposeDraftStore {
  const { activeAccountId } = deps;
  const factory = deps.idb ?? (() => indexedDB);
  // Per store rather than per module, so a suite can drive one wizard's
  // generation without every other instance in the process seeing it.
  let generation = 0;
  let droppedLegacy = false;

  /** Drops the pre-multi-account record once per store, on first access. */
  async function forgetLegacy(): Promise<void> {
    if (droppedLegacy) return;
    droppedLegacy = true;
    await run(factory(), "readwrite", (store) => store.delete(LEGACY_SINGLETON_KEY));
  }

  return {
    async save(state) {
      const account = activeAccountId();
      // Nothing to key it under, and the composer is a member surface — so
      // there is no case where this drops a draft a reader could see again.
      if (account === null) return;
      await forgetLegacy();
      const startedIn = generation;
      const assets: StoredAsset[] = await Promise.all(
        state.assets.map(async ({ file, ...rest }) => ({
          ...rest,
          bytes: await file.arrayBuffer(),
          fileType: file.type,
        })),
      );
      const cover: StoredCover | null =
        state.cover === null
          ? null
          : {
              ...state.cover,
              bytes: await state.cover.file.arrayBuffer(),
              fileType: state.cover.file.type,
            };
      if (startedIn !== generation) return;
      const draft: StoredDraft = {
        schema: DRAFT_SCHEMA,
        savedAt: new Date().toISOString(),
        state: { ...state, assets, cover },
      };
      await run(factory(), "readwrite", (store) => store.put(draft, account));
    },

    async load() {
      const account = activeAccountId();
      if (account === null) return null;
      await forgetLegacy();
      const draft = await run<StoredDraft | undefined>(factory(), "readonly", (store) =>
        store.get(account),
      );
      if (draft === undefined) return null;
      // A shape this build does not read is DROPPED, not guessed at. Offering
      // back a draft assembled out of a payload we cannot vouch for is worse
      // than offering none: the reader would seal it believing it is what they
      // wrote.
      if (draft.schema !== DRAFT_SCHEMA) return null;
      return restored(draft.state);
    },

    async clear() {
      const account = activeAccountId();
      generation += 1;
      if (account === null) return;
      await run(factory(), "readwrite", (store) => store.delete(account));
    },
  };
}

/** The one draft store of the running page, scoped to the active session's account. */
export const composeDraftStore: ComposeDraftStore = createComposeDraftStore({
  activeAccountId: () => tokenStore.activeAccountId(),
});

/** What the draft card says it is holding, without opening the whole wizard. */
export function draftSummary(state: WizardState): { title: string; detail: string } {
  const title =
    state.title.trim() !== ""
      ? state.title
      : state.mode === "words" && state.words.trim() !== ""
        ? state.words.trim().split("\n")[0]!
        : "Untitled";
  const count = state.assets.length;
  const first = state.assets[0];
  const detail =
    state.mode === "words"
      ? "Words — saved on this device, for now"
      : first !== undefined && kindOf(first) === "video"
        ? "1 video — saved on this device, for now"
        : count === 1
          ? "1 picture — saved on this device, for now"
          : `${count} pictures — saved on this device, for now`;
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
