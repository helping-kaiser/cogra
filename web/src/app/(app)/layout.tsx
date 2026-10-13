"use client";

// The gate for member-shell routes — client-side, because auth state is
// client-held (session/provider.tsx): a signed-out visit is replaced to
// /login, and a phase flip tears the shell down the same way (Android
// parity: phase flips replace all navigation state).
//
// ONE SIGN-OUT LANDS ELSEWHERE: an applicant who just deleted their account
// goes to the bare view with its snackbar, never the sign-in screen
// (DeleteAccount.md:29), and the deletion's provider takes them there.

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useLeavingDeleted } from "@/lib/deletion/deletion-status";
import { useAuthPhase } from "@/lib/session/provider";

export default function AppLayout({ children }: { children: ReactNode }) {
  const phase = useAuthPhase();
  const leaving = useLeavingDeleted();
  const router = useRouter();

  useEffect(() => {
    if (phase === "signedOut" && !leaving) router.replace("/login");
  }, [phase, leaving, router]);

  if (phase !== "signedIn") return null;
  return <>{children}</>;
}
