"use client";

// Scopes the registration flow above routing (auth.md: the poll/sign
// loop is app-scoped, above any one screen): one flow for the app's
// lifetime, reset on sign-out so the next session starts clean. The
// loop still starts lazily — the shell calls ensureAdvancing() when it
// sees an applicant.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useApolloClient } from "@apollo/client/react";

import { createKeyCeremony, type KeyCeremony } from "@/lib/identity/key-ceremony";
import { identityStore } from "@/lib/identity/store";
import { useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { createRegistrationFlow, type RegistrationFlow } from "./registration-flow";
import {
  createRegistrationSigner,
  type RegistrationProgress,
} from "./registration-signer";
import { createWriteSigner } from "./write-signer";

type RegistrationRuntime = {
  flow: RegistrationFlow;
  ceremony: KeyCeremony;
};

const RegistrationContext = createContext<RegistrationRuntime | null>(null);

export function RegistrationProvider({
  children,
  ceremony: injectedCeremony,
  flow: injectedFlow,
}: {
  children: ReactNode;
  /** Test injection, as SessionProvider's store. */
  ceremony?: KeyCeremony;
  flow?: RegistrationFlow;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const phase = useAuthPhase();

  const builtCeremony = useMemo(
    () => createKeyCeremony({ client, guard, store: identityStore }),
    [client, guard],
  );
  const ceremony = injectedCeremony ?? builtCeremony;

  // One flow per provider mount; deps are app-stable (the Apollo client
  // and guard never change identity within a session).
  const [builtFlow] = useState(() => {
    const writeSigner = createWriteSigner({ client, guard, store: identityStore });
    const signer = createRegistrationSigner({
      client,
      guard,
      store: identityStore,
      ceremony,
      writeSigner,
    });
    return createRegistrationFlow({ signer });
  });
  const flow = injectedFlow ?? builtFlow;

  useEffect(() => {
    if (phase === "signedOut") flow.reset();
  }, [phase, flow]);

  const value = useMemo(() => ({ flow, ceremony }), [flow, ceremony]);
  return <RegistrationContext.Provider value={value}>{children}</RegistrationContext.Provider>;
}

function useRegistrationRuntime(): RegistrationRuntime {
  const runtime = useContext(RegistrationContext);
  if (runtime === null) {
    throw new Error("useRegistrationRuntime requires a RegistrationProvider");
  }
  return runtime;
}

export function useRegistrationFlow(): RegistrationFlow {
  return useRegistrationRuntime().flow;
}

export function useKeyCeremony(): KeyCeremony {
  return useRegistrationRuntime().ceremony;
}

/** The loop's latest report, live — null until the first pass. */
export function useRegistrationProgress(): RegistrationProgress | null {
  const flow = useRegistrationFlow();
  return useSyncExternalStore(flow.subscribe, flow.progress, () => null);
}
