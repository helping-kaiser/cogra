"use client";

// Hands the surfaces the guard the browser client already carries. The guard
// is built with that client (`browser-guard.ts`) because the client's own
// request chain waits on it; this provider only puts it where a surface can
// reach it, and must therefore live below ApolloWrapper.

import { createContext, useContext, type ReactNode } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { DeviceLockEngine } from "@/lib/identity/device-lock";
import { deviceLockOf, guardOf } from "./browser-guard";
import type { AuthGuard } from "./guard";

const RuntimeContext = createContext<AuthGuard | null>(null);

export function AuthRuntimeProvider({ children }: { children: ReactNode }) {
  const guard = guardOf(useApolloClient());
  return <RuntimeContext.Provider value={guard}>{children}</RuntimeContext.Provider>;
}

export function useAuthGuard(): AuthGuard {
  const guard = useContext(RuntimeContext);
  if (guard === null) throw new Error("useAuthGuard requires an AuthRuntimeProvider");
  return guard;
}

/** The device-lock engine the browser client carries (auth.md "Device lock"). */
export function useDeviceLock(): DeviceLockEngine {
  return deviceLockOf(useApolloClient());
}
