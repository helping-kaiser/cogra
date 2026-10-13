"use client";

// The reader's notification list — private viewer state, gated like the own
// profile: a signed-out arrival lands on /login. `useSearchParams` reads the
// root the bell was tapped on, and needs a Suspense boundary on a page that
// is otherwise statically rendered (Next `use-search-params`).

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuthPhase } from "@/lib/session/provider";
import { NotificationsScreen } from "./notifications-view";

function Gate() {
  const phase = useAuthPhase();
  const router = useRouter();
  const from = useSearchParams().get("from");
  useEffect(() => {
    if (phase === "signedOut") router.replace("/login");
  }, [phase, router]);
  if (phase !== "signedIn") return null;
  return <NotificationsScreen from={from} />;
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  );
}
