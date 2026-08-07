"use client";

// Actor restore (auth.md "Key recovery"; Android's RestoreScreen): the
// recovery code fetches the newest blob and opens it on device. Success
// pokes the poll loop — a staged Registration may be waiting on this key
// — and returns home.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { identityStore } from "@/lib/identity/store";
import { restoreActor, type RestoreResult } from "@/lib/identity/restorer";
import { useAuthGuard } from "@/lib/session/runtime";
import { useRegistrationFlow } from "@/lib/signing/provider";

function restoreMessage(result: RestoreResult): string | null {
  switch (result.kind) {
    case "malformedCode":
      return "That doesn't look like a recovery code — check for missing characters.";
    case "wrongCode":
      return "That code doesn't open your backup. Check it and try again.";
    case "noBackup":
      return "This account has no key backup to restore from.";
    case "failed":
      return "Can't reach the server. Check your connection and try again.";
    case "restored":
      return null;
  }
}

export function RestoreForm() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const flow = useRegistrationFlow();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [inProgress, setInProgress] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);

  const canSubmit = code.trim() !== "" && !inProgress;
  const errorMessage = result === null ? null : restoreMessage(result);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setInProgress(true);
    setResult(null);
    const outcome = await restoreActor({ client, guard, store: identityStore }, code);
    setInProgress(false);
    setResult(outcome);
    if (outcome.kind === "restored") {
      flow.ensureAdvancing();
      router.replace("/");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Restore your key</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Enter your recovery code to bring your signing key onto this browser.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="restore-code" className="text-sm font-medium">
            Recovery code
          </label>
          <input
            id="restore-code"
            data-testid="restore_code"
            type="text"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setResult(null);
            }}
            autoComplete="off"
            spellCheck={false}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 font-mono dark:border-zinc-700"
          />
        </div>
        {errorMessage !== null && (
          <p role="alert" data-testid="restore_error" className="text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        )}
        {inProgress && (
          <p role="status" data-testid="restore_progress" className="text-sm text-zinc-600 dark:text-zinc-400">
            Restoring…
          </p>
        )}
        {result?.kind === "restored" && (
          <p role="status" data-testid="restore_success" className="text-sm">
            Your key is back on this browser.
          </p>
        )}
        <button
          type="submit"
          data-testid="restore_submit"
          disabled={!canSubmit}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-zinc-50 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Restore
        </button>
      </form>
    </main>
  );
}
