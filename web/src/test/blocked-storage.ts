// A browser that refuses storage: the property GETTER throws, which is what
// Chrome and Safari do with site data blocked ("Access to storage is not
// allowed from this context" — a `SecurityError`). A mere `setItem` that throws
// is a different failure (quota); this is the one that fires on first touch.

type StorageKind = "localStorage" | "sessionStorage";

/** Makes `window[kind]` throw `SecurityError` on access; returns the undo. */
export function blockStorage(...kinds: StorageKind[]): () => void {
  const originals = kinds.map((kind) => Object.getOwnPropertyDescriptor(window, kind));
  for (const kind of kinds) {
    Object.defineProperty(window, kind, {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
  }
  return () => {
    kinds.forEach((kind, i) => {
      const original = originals[i];
      if (original === undefined) delete (window as unknown as Record<string, unknown>)[kind];
      else Object.defineProperty(window, kind, original);
    });
  };
}
