"use client";

// The key ceremony (auth.md "Application" step 3; Android's
// KeyCeremonyScreen).

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useRegistrationFlow, useKeyCeremony, useRegistrationProgress } from "@/lib/signing/provider";
import { Button } from "@/lib/ui/button";
import { TransportError } from "@/lib/ui/transport-error";

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
          <p className="text-sm text-on-surface-variant">
            Your posts, relationships, and standing belong to a signing key that lives only on your
            devices — CoGra never holds it. A recovery code lets you restore that key if this
            browser is lost. We recommend creating one now.
          </p>
          {attachError === "network" && <TransportError testId="ceremony_attach_error" />}
          {attachError === "keyInUse" && (
            <p
              role="alert"
              data-testid="ceremony_key_in_use"
              className="text-sm text-error"
            >
              This device&apos;s signing key already belongs to another account. Sign in to that
              account to use it — a key can only ever back one account.
            </p>
          )}
          {inProgress && (
            <p role="status" data-testid="backup_progress" className="text-sm text-on-surface-variant">
              Working…
            </p>
          )}
          {!confirmingDecline && (
            <>
              <Button testId="backup_accept" onClick={onAccept} disabled={inProgress}>
                Create my recovery code
              </Button>
              <Button
                testId="backup_decline"
                variant="outline"
                onClick={() => setConfirmingDecline(true)}
                disabled={inProgress}
              >
                Not now
              </Button>
            </>
          )}
          {confirmingDecline && (
            <div
              role="alertdialog"
              aria-labelledby="decline-title"
              aria-describedby="decline-consequence"
              className="flex flex-col gap-3 rounded-md border border-outline-variant p-4"
            >
              <h2 id="decline-title" className="font-medium">
                Continue without a backup?
              </h2>
              <p
                id="decline-consequence"
                data-testid="backup_decline_consequence"
                className="text-sm text-on-surface-variant"
              >
                If this browser&apos;s data is lost, your posts, relationships, and standing are
                permanently lost with it. Your login would survive, but the actor behind it can
                never be restored. You can create a backup later in Settings.
              </p>
              <Button testId="backup_decline_confirm" onClick={onConfirmDecline}>
                I accept the risk
              </Button>
              <Button
                testId="backup_decline_cancel"
                variant="outline"
                onClick={() => setConfirmingDecline(false)}
              >
                Go back
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <p
            data-testid="backup_code"
            className="rounded-md border border-outline-variant p-4 text-center font-mono text-lg tracking-wider"
          >
            {recoveryCode}
          </p>
          <p className="text-sm text-on-surface-variant">
            Write this code down and keep it somewhere safe. It is shown only this once — CoGra
            cannot recover it for you.
          </p>
          <Button testId="backup_code_saved" onClick={finish}>
            I&apos;ve written it down
          </Button>
        </>
      )}
    </main>
  );
}
