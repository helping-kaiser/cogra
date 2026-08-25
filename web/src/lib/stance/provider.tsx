"use client";

// One `StanceData` for the whole app, so a post card, a comment, and a
// profile header all reach the same seam without threading it through
// every surface. The default is the stand-in: until the wiring follow-up
// implements `StanceData` over Apollo, that is what the app runs on.

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { StanceData } from "./stance-data";
import { createStubStanceData } from "./stub-stance-data";

const StanceDataContext = createContext<StanceData | null>(null);

export function StanceDataProvider({
  data,
  children,
}: {
  /** Injected by tests and, once it lands, by the Apollo implementation. */
  data?: StanceData;
  children: ReactNode;
}) {
  const value = useMemo(() => data ?? createStubStanceData(), [data]);
  return <StanceDataContext.Provider value={value}>{children}</StanceDataContext.Provider>;
}

export function useStanceData(): StanceData {
  const data = useContext(StanceDataContext);
  if (data === null) {
    throw new Error("useStanceData outside a StanceDataProvider");
  }
  return data;
}
