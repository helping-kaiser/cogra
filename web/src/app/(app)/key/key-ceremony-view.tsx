"use client";

// The key ceremony (auth.md "Application" step 3; Android's
// KeyCeremonyScreen): accept mints, attaches, seals and uploads the
// backup, then shows the recovery code exactly once; decline still mints
// and attaches — it only skips the backup, after an explicit
// confirmation of the stated price. A key already attached redirects
// home (web.md routes table).

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useRegistrationFlow, useKeyCeremony, useRegistrationProgress } from "@/lib/signing/provider";

export function KeyCeremonyView() {
  const ceremony = useKeyCeremony();
  const flow = useRegistrationFlow();
  const progress = useRegistrationProgress();
  const router = useRouter();

  const [inProgress, setInProgress] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [attachError, setAttachError] = useState<"network" | "keyInUse" | null>(null);

  // Already attached and not mid-ceremony: nothing to do here.
  const attached = progress?.kind === "awaitingApproval" && progress.keyAttached;
  useEffect(() => {
    if (attached && recoveryCode === null && !inProgress) router.replace("/");
  }, [attached, recoveryCode, inProgress, router]);

  const finish = () => {
    // The proof just changed server-side: poll now, not in 30 seconds.
    flow.ensureAdvancing();
    router.replace("/");
  };

  const mintAndAttach = async (): Promise<boolean> => {
    setInProgress(true);
    setAttachError(null);
    await ceremony.createActorKey();
    const outcome = await ceremony.attachActorKey();
    if (outcome.kind !== "success") {
      setInProgress(false);
      setAttachError(
        outcome.kind === "refused" && outcome.errors.some((e) => e.code === "ACTOR_KEY_IN_USE")
          ? "keyInUse"
          : "network",
      );
      return false;
    }
    return true;
  };

  const onAccept = async () => {
    if (inProgress || recoveryCode !== null) return;
    if (!(await mintAndAttach())) return;
    const code = await ceremony.createPendingBackup();
    // The code shows even when the upload fails — the blob stays parked
    // and every poll pass retries.
    await ceremony.uploadPendingBackup();
    setInProgress(false);
    setRecoveryCode(code);
  };

  const onConfirmDecline = async () => {
    if (inProgress) return;
    setConfirmingDecline(false);
    if (!(await mintAndAttach())) return;
    setInProgress(false);
    finish();
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Your key, your actor</h1>

      {recoveryCode === null ? (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your posts, relationships, and standing belong to a signing key that lives only on your
            devices — CoGra never holds it. A recovery code lets you restore that key if this
            browser is lost. We recommend creating one now.
          </p>
          {attachError === "network" && (
            <p
              role="alert"
              data-testid="ceremony_attach_error"
              className="text-sm text-red-600 dark:text-red-400"
            >
              Can&apos;t reach the server. Check your connection and try again.
            </p>
          )}
          {attachError === "keyInUse" && (
            <p
              role="alert"
              data-testid="ceremony_key_in_use"
              className="text-sm text-red-600 dark:text-red-400"
            >
              This device&apos;s signing key already belongs to another account. Sign in to that
              account to use it — a key can only ever back one account.
            </p>
          )}
          {inProgress && (
            <p role="status" data-testid="backup_progress" className="text-sm text-zinc-600 dark:text-zinc-400">
              Working…
            </p>
          )}
          {!confirmingDecline && (
            <>
              <button
                type="button"
                data-testid="backup_accept"
                onClick={onAccept}
                disabled={inProgress}
                className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-zinc-50 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Create my recovery code
              </button>
              <button
                type="button"
                data-testid="backup_decline"
                onClick={() => setConfirmingDecline(true)}
                disabled={inProgress}
                className="rounded-md border border-zinc-300 px-4 py-2 font-medium disabled:opacity-40 dark:border-zinc-700"
              >
                Not now
              </button>
            </>
          )}
          {confirmingDecline && (
            <div
              role="alertdialog"
              aria-labelledby="decline-title"
              aria-describedby="decline-consequence"
              className="flex flex-col gap-3 rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
            >
              <h2 id="decline-title" className="font-medium">
                Continue without a backup?
              </h2>
              <p
                id="decline-consequence"
                data-testid="backup_decline_consequence"
                className="text-sm text-zinc-600 dark:text-zinc-400"
              >
                If this browser&apos;s data is lost, your posts, relationships, and standing are
                permanently lost with it. Your login would survive, but the actor behind it can
                never be restored. You can create a backup later in Settings.
              </p>
              <button
                type="button"
                data-testid="backup_decline_confirm"
                onClick={onConfirmDecline}
                className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                I accept the risk
              </button>
              <button
                type="button"
                data-testid="backup_decline_cancel"
                onClick={() => setConfirmingDecline(false)}
                className="rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700"
              >
                Go back
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p
            data-testid="backup_code"
            className="rounded-md border border-zinc-300 p-4 text-center font-mono text-lg tracking-wider dark:border-zinc-700"
          >
            {recoveryCode}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Write this code down and keep it somewhere safe. It is shown only this once — CoGra
            cannot recover it for you.
          </p>
          <button
            type="button"
            data-testid="backup_code_saved"
            onClick={finish}
            className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            I&apos;ve written it down
          </button>
        </>
      )}
    </main>
  );
}
