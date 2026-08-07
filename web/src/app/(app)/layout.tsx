"use client";

// The gate for member-shell routes. Tokens are client-held, so the server
// never knows the auth state — gating is client-side: a signed-out visit
// is replaced to /login, and a phase flip tears the shell down the same
// way (Android parity: phase flips replace all navigation state).

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuthPhase } from "@/lib/session/provider";

export default function AppLayout({ children }: { children: ReactNode }) {
  const phase = useAuthPhase();
  const router = useRouter();

  useEffect(() => {
    if (phase === "signedOut") router.replace("/login");
  }, [phase, router]);

  if (phase !== "signedIn") return null;
  return <>{children}</>;
}
