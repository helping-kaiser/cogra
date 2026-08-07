"use client";

// The signed-in shell (Android's Home, cards land with later PRs). The
// guarded Me read exercises the refresh-and-replay path; a refused read
// means a dead session — the phase flip handles it, the shell just stops
// loading (screens never self-navigate on auth failure).

import { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchMe, type MeUser } from "@/lib/api/auth-api";
import { useAuthGuard } from "@/lib/session/runtime";

export function HomeShell() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [transportFailed, setTransportFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void guard
      .run(() => fetchMe(client))
      .then((outcome) => {
        if (cancelled) return;
        setLoading(false);
        if (outcome.kind === "success") setMe(outcome.value);
        else if (outcome.kind === "failed") setTransportFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [client, guard]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">CoGra</h1>
      {loading && (
        <p role="status" data-testid="home_loading" className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading…
        </p>
      )}
      {me !== null && (
        <p data-testid="home_greeting" className="text-lg">
          Hello, @{me.handle}
        </p>
      )}
      {transportFailed && (
        <p
          role="alert"
          data-testid="home_transport_error"
          className="text-sm text-red-600 dark:text-red-400"
        >
          Can&apos;t reach the server. Check your connection and try again.
        </p>
      )}
    </main>
  );
}
