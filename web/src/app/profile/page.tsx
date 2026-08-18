"use client";

// The viewer's own profile — the shell's profile tab. Client-gated
// like the (app) group: a signed-out arrival lands on /login.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthPhase } from "@/lib/session/provider";
import { ProfileScreen } from "@/app/u/[handle]/profile-view";

export default function OwnProfilePage() {
  const phase = useAuthPhase();
  const router = useRouter();
  useEffect(() => {
    if (phase === "signedOut") router.replace("/login");
  }, [phase, router]);
  if (phase !== "signedIn") return null;
  return <ProfileScreen handle={null} />;
}
