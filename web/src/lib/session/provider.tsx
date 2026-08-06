"use client";

// The app's coarse auth phase (Android's AuthPhase): derived from token
// presence alone, no `me` bootstrap. `resolving` covers the server render
// and hydration's first paint — tokens are client-held, so the server can
// never know the auth state.

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { tokenStore, type TokenStore } from "./token-store";

export type AuthPhase = "resolving" | "signedOut" | "signedIn";

type SessionContextValue = {
  readonly phase: AuthPhase;
  readonly store: TokenStore;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  store = tokenStore,
  children,
}: {
  store?: TokenStore;
  children: ReactNode;
}) {
  const hasSession = useSyncExternalStore(
    store.subscribe,
    () => store.hasSession(),
    () => null,
  );
  const value = useMemo<SessionContextValue>(
    () => ({
      phase: hasSession === null ? "resolving" : hasSession ? "signedIn" : "signedOut",
      store,
    }),
    [hasSession, store],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) throw new Error("useSession requires a SessionProvider");
  return value;
}

export function useAuthPhase(): AuthPhase {
  return useSession().phase;
}

export function useTokenStore(): TokenStore {
  return useSession().store;
}
