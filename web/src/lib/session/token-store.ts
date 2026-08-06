// Session tokens per web.md § Session tokens in the browser: the rotating
// refresh token in persistent storage, the access token in per-tab memory —
// the accepted XSS blast radius is a session, never the actor key.
// localStorage is the persistent half because its `storage` event propagates
// sign-out and rotation to other tabs for free.

export type TokenPair = {
  readonly accessToken: string;
  readonly refreshToken: string;
};

export type TokenStore = {
  /** The persisted refresh token; null when signed out. */
  refreshToken(): string | null;
  /** This tab's in-memory access token; null until a save or refresh. */
  accessToken(): string | null;
  /** Token presence is the auth phase — no `me` bootstrap (Android parity). */
  hasSession(): boolean;
  /** Overwrite both halves; rotation replaces the stored refresh token. */
  save(pair: TokenPair): void;
  /** Sign-out: forget both halves. */
  clear(): void;
  subscribe(listener: () => void): () => void;
};

const REFRESH_KEY = "cogra.refreshToken";

export function createTokenStore(): TokenStore {
  let accessToken: string | null = null;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  const refreshToken = () => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  };

  if (typeof window !== "undefined") {
    // Fires only in *other* tabs; key === null means a wholesale clear.
    window.addEventListener("storage", (event) => {
      if (event.key !== REFRESH_KEY && event.key !== null) return;
      if (refreshToken() === null) accessToken = null;
      notify();
    });
  }

  return {
    refreshToken,
    accessToken: () => accessToken,
    hasSession: () => refreshToken() !== null,
    save(pair) {
      accessToken = pair.accessToken;
      window.localStorage.setItem(REFRESH_KEY, pair.refreshToken);
      notify();
    },
    clear() {
      accessToken = null;
      window.localStorage.removeItem(REFRESH_KEY);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const tokenStore: TokenStore = createTokenStore();
