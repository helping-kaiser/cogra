// Browser storage that never throws.
//
// `window.localStorage` is not a property that always exists: with site data
// blocked, or in some private windows, the GETTER throws a `SecurityError`
// (MDN, "Window: localStorage property" — "Exceptions: SecurityError"), and a
// full or disabled store throws from `setItem` (`QuotaExceededError`). A module
// that touches it at import — the token store does — would take the whole page
// down with it.
//
// So reads and writes go through here. What the browser will not keep falls to
// a per-page memory map: a blocked tab still works for as long as it stays
// open, and forgets on reload, which is the honest degradation.
//
// ON THE SERVER THERE IS NO STORAGE AND NO MEMORY EITHER: a module-level map
// there would be shared by every request, so a write would leak one reader's
// value into the next one's render. Reads answer null and writes do nothing.

export type SafeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "clear"> & {
  readonly length: number;
};

export type StorageKind = "local" | "session";

// What the browser would not persist, per kind. Shared by every `safeStorage`
// call so one module's write is another's read.
const memory: Record<StorageKind, Map<string, string>> = {
  local: new Map(),
  session: new Map(),
};

function backing(kind: StorageKind): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** `localStorage` (or `sessionStorage`) as a store that cannot throw. */
export function safeStorage(kind: StorageKind = "local"): SafeStorage {
  const kept = memory[kind];
  const inBrowser = () => typeof window !== "undefined";

  const keys = (): string[] => {
    const real = backing(kind);
    const names = new Set<string>();
    if (real !== null) {
      try {
        for (let i = 0; i < real.length; i += 1) {
          const name = real.key(i);
          if (name !== null) names.add(name);
        }
      } catch {
        // Whatever could not be listed is not ours to clear either.
      }
    }
    for (const name of kept.keys()) names.add(name);
    return [...names];
  };

  return {
    getItem(key) {
      if (!inBrowser()) return null;
      try {
        const stored = backing(kind)?.getItem(key) ?? null;
        if (stored !== null) return stored;
      } catch {
        // Fall through to what this page kept in memory.
      }
      return kept.get(key) ?? null;
    },
    setItem(key, value) {
      if (!inBrowser()) return;
      try {
        const real = backing(kind);
        if (real !== null) {
          real.setItem(key, value);
          // Persisted: a stale in-memory copy must not shadow it later.
          kept.delete(key);
          return;
        }
      } catch {
        // Quota or a store that refuses writes: keep it for this page.
      }
      kept.set(key, value);
    },
    removeItem(key) {
      if (!inBrowser()) return;
      kept.delete(key);
      try {
        backing(kind)?.removeItem(key);
      } catch {
        // Nothing persisted that this could remove.
      }
    },
    key: (index) => keys()[index] ?? null,
    get length() {
      return keys().length;
    },
    clear() {
      if (!inBrowser()) return;
      kept.clear();
      try {
        backing(kind)?.clear();
      } catch {
        // As above.
      }
    },
  };
}
