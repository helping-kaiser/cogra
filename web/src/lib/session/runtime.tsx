"use client";

// Wires the guard to the browser Apollo client. Lives below ApolloWrapper
// (it needs the client) and below SessionProvider (it needs the store).

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useApolloClient } from "@apollo/client/react";

import { refreshExecutor } from "@/lib/api/auth-api";
import { identityStore } from "@/lib/identity/store";
import { createGuard, type AuthGuard } from "./guard";
import { createRefresher } from "./refresher";
import { useTokenStore } from "./provider";

const RuntimeContext = createContext<AuthGuard | null>(null);

export function AuthRuntimeProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient();
  const store = useTokenStore();
  const guard = useMemo(
    () =>
      createGuard(
        store,
        // An invalidated session runs the "don't remember me" purge for
        // its account before the tokens clear (auth.md "Sign-out").
        createRefresher(store, refreshExecutor(client), () => identityStore.purgeIfEphemeral()),
      ),
    [client, store],
  );
  return <RuntimeContext.Provider value={guard}>{children}</RuntimeContext.Provider>;
}

export function useAuthGuard(): AuthGuard {
  const guard = useContext(RuntimeContext);
  if (guard === null) throw new Error("useAuthGuard requires an AuthRuntimeProvider");
  return guard;
}
