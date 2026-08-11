// Session tokens per web.md § Session tokens in the browser: the rotating
// refresh token in persistent storage, the access token in per-tab memory —
// the accepted XSS blast radius is a session, never the actor key.
// localStorage is the persistent half because its `storage` event propagates
// sign-out and rotation to other tabs for free. The signed-in account's id
// is stored beside the refresh token: custody is account-keyed
// (roadmap.md slice 1.1), so the device must know whose session this is.

export type SessionAuth = {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** The account the pair authenticates — `AuthSession.user.id`. */
  readonly accountId: string;
};

export type TokenStore = {
  /** The persisted refresh token; null when signed out. */
  refreshToken(): string | null;
  /** This tab's in-memory access token; null until a save or refresh. */
  accessToken(): string | null;
  /** The signed-in account's id; null when signed out. */
  activeAccountId(): string | null;
  /** Token presence is the auth phase — no `me` bootstrap (Android parity). */
  hasSession(): boolean;
  /** Overwrite everything; rotation replaces the stored refresh token. */
  save(auth: SessionAuth): void;
  /** Sign-out: forget the tokens and the active account. */
  clear(): void;
  subscribe(listener: () => void): () => void;
};

const REFRESH_KEY = "cogra.refreshToken";
const ACCOUNT_KEY = "cogra.activeAccount";

export function createTokenStore(): TokenStore {
  let accessToken: string | null = null;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  const stored = (key: string) => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  };

  if (typeof window !== "undefined") {
    // A refresh token stored before custody was account-keyed carries no
    // account id and is treated as absent — one re-login is the accepted
    // migration cost. IndexedDB records are untouched here; the identity
    // store adopts them once an account signs in.
    if (stored(REFRESH_KEY) !== null && stored(ACCOUNT_KEY) === null) {
      window.localStorage.removeItem(REFRESH_KEY);
    }
    if (stored(REFRESH_KEY) === null && stored(ACCOUNT_KEY) !== null) {
      window.localStorage.removeItem(ACCOUNT_KEY);
    }
    // Fires only in *other* tabs; key === null means a wholesale clear.
    window.addEventListener("storage", (event) => {
      if (event.key !== REFRESH_KEY && event.key !== ACCOUNT_KEY && event.key !== null) return;
      if (stored(REFRESH_KEY) === null) accessToken = null;
      notify();
    });
  }

  return {
    refreshToken: () => stored(REFRESH_KEY),
    accessToken: () => accessToken,
    activeAccountId: () => stored(ACCOUNT_KEY),
    hasSession: () => stored(REFRESH_KEY) !== null,
    save(auth) {
      accessToken = auth.accessToken;
      // Account first: no observer window ever sees a refresh token
      // without the account it belongs to.
      window.localStorage.setItem(ACCOUNT_KEY, auth.accountId);
      window.localStorage.setItem(REFRESH_KEY, auth.refreshToken);
      notify();
    },
    clear() {
      accessToken = null;
      window.localStorage.removeItem(REFRESH_KEY);
      window.localStorage.removeItem(ACCOUNT_KEY);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const tokenStore: TokenStore = createTokenStore();
