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
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useApolloClient } from "@apollo/client/react";

import { createKeyCeremony, type KeyCeremony } from "@/lib/identity/key-ceremony";
import { identityStore } from "@/lib/identity/store";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { createRegistrationFlow, type RegistrationFlow } from "./registration-flow";
import {
  createRegistrationSigner,
  type RegistrationProgress,
} from "./registration-signer";
import { createWriteSigner, type WriteSigner } from "./write-signer";

type RegistrationRuntime = {
  flow: RegistrationFlow;
  ceremony: KeyCeremony;
  writeSigner: WriteSigner;
};

const RegistrationContext = createContext<RegistrationRuntime | null>(null);

export function RegistrationProvider({
  children,
  ceremony: injectedCeremony,
  flow: injectedFlow,
  writeSigner: injectedWriteSigner,
}: {
  children: ReactNode;
  /** Test injection, as SessionProvider's store. */
  ceremony?: KeyCeremony;
  flow?: RegistrationFlow;
  writeSigner?: WriteSigner;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const phase = useAuthPhase();
  const accountId = useActiveAccountId();

  const builtCeremony = useMemo(
    () => createKeyCeremony({ client, guard, store: identityStore }),
    [client, guard],
  );
  const ceremony = injectedCeremony ?? builtCeremony;

  // One flow and one signer per provider mount; deps are app-stable
  // (the Apollo client and guard never change identity within a
  // session, and the custody store resolves the active account per
  // call — an account switch never leaves a signer holding stale
  // key material). The signer is shared app-wide because resume()
  // spans every persisted handshake, whichever surface started it.
  const [built] = useState(() => {
    const writeSigner = createWriteSigner({ client, guard, store: identityStore });
    const signer = createRegistrationSigner({
      client,
      guard,
      store: identityStore,
      ceremony,
      writeSigner,
    });
    return { writeSigner, flow: createRegistrationFlow({ signer }) };
  });
  const flow = injectedFlow ?? built.flow;
  const writeSigner = injectedWriteSigner ?? built.writeSigner;

  useEffect(() => {
    if (phase === "signedOut") flow.reset();
  }, [phase, flow]);

  // The flow's progress belongs to the account whose poll produced it.
  // A cross-tab account switch can skip the signedOut phase entirely,
  // so any change of the active account also tears the loop down; the
  // next ensureAdvancing() polls as the new account.
  const lastAccount = useRef(accountId);
  useEffect(() => {
    if (lastAccount.current === accountId) return;
    lastAccount.current = accountId;
    flow.reset();
  }, [accountId, flow]);

  const value = useMemo(
    () => ({ flow, ceremony, writeSigner }),
    [flow, ceremony, writeSigner],
  );
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

/** The app's one write signer — member surfaces sign through it. */
export function useWriteSigner(): WriteSigner {
  return useRegistrationRuntime().writeSigner;
}

/** The loop's latest report, live — null until the first pass. */
export function useRegistrationProgress(): RegistrationProgress | null {
  const flow = useRegistrationFlow();
  return useSyncExternalStore(flow.subscribe, flow.progress, () => null);
}
