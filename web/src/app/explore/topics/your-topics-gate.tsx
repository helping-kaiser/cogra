"use client";

// The held set is the viewer's own (`User.heldTopics` is viewer-only, and no
// guest can hold a topic — Explore.md:37 draws them no door), so the page is
// gated like Saved: a signed-out arrival lands on /login.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthPhase } from "@/lib/session/provider";
import { YourTopicsView } from "./your-topics-view";

export function YourTopicsGate({ from }: { from: string | null }) {
  const phase = useAuthPhase();
  const router = useRouter();
  useEffect(() => {
    if (phase === "signedOut") router.replace("/login");
  }, [phase, router]);
  if (phase !== "signedIn") return null;
  return <YourTopicsView from={from} />;
}
