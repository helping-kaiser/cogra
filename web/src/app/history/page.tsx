"use client";

// The reader's History — private viewer state, so it is gated like the own
// profile it is reached from: a signed-out arrival lands on /login. An
// applicant has History like a member (ProfileApplicant.md:42).

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthPhase } from "@/lib/session/provider";
import { HistoryScreen } from "./history-view";

export default function HistoryPage() {
  const phase = useAuthPhase();
  const router = useRouter();
  useEffect(() => {
    if (phase === "signedOut") router.replace("/login");
  }, [phase, router]);
  if (phase !== "signedIn") return null;
  return <HistoryScreen />;
}
