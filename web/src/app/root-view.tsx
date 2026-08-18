"use client";

// "/" is a pure switch: a signed-in arrival lands on the feed tab —
// the shell's root (design.md §6) — and a signed-out one on the
// login screen, the signed-out entry. Nothing renders here.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthPhase } from "@/lib/session/provider";

export function RootView() {
  const phase = useAuthPhase();
  const router = useRouter();
  useEffect(() => {
    if (phase === "signedIn") router.replace("/feed");
    if (phase === "signedOut") router.replace("/login");
  }, [phase, router]);
  return null;
}
