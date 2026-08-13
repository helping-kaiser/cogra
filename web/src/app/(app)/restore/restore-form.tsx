"use client";

// Actor restore (auth.md "Key recovery"; Android's RestoreScreen): the
// recovery code fetches the newest blob and opens it on device. Success
// pokes the poll loop — a staged Registration may be waiting on this key
// — and returns home.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { restoreActor, type RestoreResult } from "@/lib/identity/restorer";
import { useAuthGuard } from "@/lib/session/runtime";
import { useRegistrationFlow } from "@/lib/signing/provider";
import { Button } from "@/lib/ui/button";

function restoreMessage(result: RestoreResult): string | null {
  switch (result.kind) {
    case "malformedCode":
      return "That doesn't look like a recovery code — check for missing characters.";
    case "wrongCode":
      return "That code doesn't open your backup. Check it and try again.";
    case "noBackup":
      return "This account has no key backup to restore from.";
    case "rateLimited":
      return "Too many attempts — wait a moment and try again.";
    case "failed":
      return "Can't reach the server. Check your connection and try again.";
    case "restored":
      return null;
  }
}

export function RestoreForm({
  store = identityStore,
}: {
  /** Test injection. */
  store?: IdentityStore;
} = {}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const flow = useRegistrationFlow();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [dontRemember, setDontRemember] = useState(false);
  const [inProgress, setInProgress] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);

  const canSubmit = code.trim() !== "" && !inProgress;
  const errorMessage = result === null ? null : restoreMessage(result);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setInProgress(true);
    setResult(null);
    const outcome = await restoreActor({ client, guard, store }, code);
    if (outcome.kind === "restored") {
      // The restore offers the same "don't remember me" opt-in as login
      // (auth.md "Sign-out") — always written, so an unchecked restore
      // clears an earlier flag.
      await store.setEphemeral(dontRemember);
    }
    setInProgress(false);
    setResult(outcome);
    if (outcome.kind === "restored") {
      flow.ensureAdvancing();
      router.replace("/");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-headline-small">Restore your key</h1>
      <p className="text-body-medium text-on-surface-variant">
        Enter your recovery code to bring your signing key onto this browser.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="restore-code" className="text-label-large">
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
            className="rounded-md border border-outline bg-transparent px-3 py-2 font-mono"
          />
        </div>
        <label htmlFor="restore-dont-remember" className="flex items-center gap-2 text-body-medium">
          <input
            id="restore-dont-remember"
            data-testid="restore_dont_remember"
            type="checkbox"
            checked={dontRemember}
            onChange={(event) => setDontRemember(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Don&apos;t remember this account on this device
        </label>
        {errorMessage !== null && (
          <p role="alert" data-testid="restore_error" className="text-body-medium text-error">
            {errorMessage}
          </p>
        )}
        {inProgress && (
          <p role="status" data-testid="restore_progress" className="text-body-medium text-on-surface-variant">
            Restoring…
          </p>
        )}
        {result?.kind === "restored" && (
          <p role="status" data-testid="restore_success" className="text-body-medium">
            Your key is back on this browser.
          </p>
        )}
        <Button type="submit" testId="restore_submit" disabled={!canSubmit}>
          Restore
        </Button>
      </form>
    </main>
  );
}
