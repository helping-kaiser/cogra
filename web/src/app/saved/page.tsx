"use client";

// The reader's Saved list — private viewer state, so it is gated like the own
// profile it is reached from: a signed-out arrival lands on /login.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthPhase } from "@/lib/session/provider";
import { SavedScreen } from "./saved-view";

export default function SavedPage() {
  const phase = useAuthPhase();
  const router = useRouter();
  useEffect(() => {
    if (phase === "signedOut") router.replace("/login");
  }, [phase, router]);
  if (phase !== "signedIn") return null;
  return <SavedScreen />;
}
