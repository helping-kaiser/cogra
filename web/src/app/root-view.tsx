"use client";

// The front door for anyone signed out; a signed-in arrival lands on
// the feed tab — the shell's root (design.md §6; the Android twin's
// phase flip).

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { FrontDoor } from "./front-door";
import { useAuthPhase } from "@/lib/session/provider";

export function RootView() {
  const phase = useAuthPhase();
  const router = useRouter();
  useEffect(() => {
    if (phase === "signedIn") router.replace("/feed");
  }, [phase, router]);
  if (phase !== "signedOut") return null;
  return <FrontDoor />;
}
