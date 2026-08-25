"use client";

// One `StanceData` for the whole app, so a post card, a comment, and a
// profile header all reach the same seam without threading it through
// every surface. The default is the Apollo implementation, built from
// the same client, guard, and signer every other write path uses; tests
// inject the stand-in instead.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useApolloClient } from "@apollo/client/react";

import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { createApolloStanceData } from "./apollo-stance-data";
import type { StanceData } from "./stance-data";

const StanceDataContext = createContext<StanceData | null>(null);

export function StanceDataProvider({
  data,
  children,
}: {
  /** Injected by tests; production builds the Apollo implementation. */
  data?: StanceData;
  children: ReactNode;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const value = useMemo(
    () => data ?? createApolloStanceData({ client, guard, signer }),
    [data, client, guard, signer],
  );
  return <StanceDataContext.Provider value={value}>{children}</StanceDataContext.Provider>;
}

export function useStanceData(): StanceData {
  const data = useContext(StanceDataContext);
  if (data === null) {
    throw new Error("useStanceData outside a StanceDataProvider");
  }
  return data;
}
