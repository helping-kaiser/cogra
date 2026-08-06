"use client";

import { FrontDoor } from "./front-door";
import { HomeShell } from "./home-shell";
import { useAuthPhase } from "@/lib/session/provider";

export function RootView() {
  const phase = useAuthPhase();
  if (phase === "resolving") return null;
  return phase === "signedIn" ? <HomeShell /> : <FrontDoor />;
}
