"use client";

// THE RECOVERY CODE, MADE LATE OR REPLACED — an interim home.
//
// DRIFT (the YourKey-and-backup-replacement packet): the drawn destinations
// of Settings' `Recovery code` row are `SettingsBackup` and
// `SettingsBackupNone`, built by that packet. Until they are, this page holds
// the flows that used to stand inline on the settings page — create from the
// retained seed, replace with the current code, or nothing to back up here —
// moved off the page unchanged so the rows can be the drawn rows without
// taking the only way to make a code away.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { createBackupManager, type BackupManager } from "@/lib/identity/backup";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useAuthGuard } from "@/lib/session/runtime";
import { Button } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { fallbackMessage } from "@/lib/ui/error-messages";
import { PageHeader } from "@/lib/ui/page-header";
import { RecoveryCode } from "@/lib/ui/recovery-code";

/** Enable-late from the retained seed, replace via the current code, or nothing to back up here. */
type BackupMode = "create" | "rekey" | "none";

type Feedback =
  | { kind: "backup"; result: "malformedCode" | "wrongCode" | "noBackup" }
  | { kind: "refused"; message: string }
  | { kind: "transport" };

function feedbackMessage(feedback: Feedback): string {
  switch (feedback.kind) {
    case "refused":
      return feedback.message;
    case "transport":
      return "Can't reach the server. Check your connection and try again.";
    case "backup":
      switch (feedback.result) {
        case "malformedCode":
          return "A recovery code is 26 letters and digits — check for missing ones.";
        case "wrongCode":
          return "That code doesn't open your backup. Check it and try again.";
        case "noBackup":
          return "There's no backup on the server to replace.";
      }
  }
}

export function BackupView({
  store = identityStore,
  backup: injectedBackup,
}: {
  /** Test injection. */
  store?: IdentityStore;
  backup?: BackupManager;
} = {}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const [builtBackup] = useState<BackupManager>(() => createBackupManager({ client, guard, store }));
  const backup = injectedBackup ?? builtBackup;

  const [mode, setMode] = useState<BackupMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [rekeyCode, setRekeyCode] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const readCustody = useCallback(() => {
    return Promise.all([store.actorSeed(), store.actorKey()]).then(([seed, key]) => {
      setMode(seed !== null ? "create" : key !== null ? "rekey" : "none");
    });
  }, [store]);

  useEffect(() => {
    void readCustody();
  }, [readCustody]);

  const onCreate = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    const result = await backup.enable();
    setBusy(false);
    if (result.kind === "created") {
      setNewCode(result.code);
    } else if (result.kind === "refused") {
      setFeedback({ kind: "refused", message: fallbackMessage(result.errors[0].code) });
    } else {
      // noSeed means custody moved under us; re-reading flips the mode.
      setFeedback({ kind: "transport" });
      await readCustody();
    }
  };

  const onRekey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || rekeyCode.trim() === "") return;
    setBusy(true);
    setFeedback(null);
    const result = await backup.rekey(rekeyCode);
    setBusy(false);
    switch (result.kind) {
      case "created":
        setNewCode(result.code);
        setRekeyCode("");
        break;
      case "malformedCode":
      case "wrongCode":
      case "noBackup":
        setFeedback({ kind: "backup", result: result.kind });
        break;
      case "refused":
        setFeedback({ kind: "refused", message: fallbackMessage(result.errors[0].code) });
        break;
      default:
        setFeedback({ kind: "transport" });
        break;
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 pb-12 pt-3">
      <PageHeader title="Recovery code" backHref="/settings" backLabel="Back to settings" />
      <Card testId="settings_backup_card">
        {newCode !== null ? (
          <RecoveryCode
            testId="settings_backup_code"
            code={newCode}
            explainer="Write this code down somewhere safe. It is shown only this once; any older code stops working."
            onConfirmed={async () => {
              setNewCode(null);
              await readCustody();
            }}
          />
        ) : mode === "create" ? (
          <>
            <p className="text-body-medium text-on-surface-variant">
              Create your recovery code. It re-encrypts your key on this browser and backs it up —
              without one, losing this browser loses the actor.
            </p>
            <Button testId="settings_backup_create" size="sm" selfStart onClick={onCreate} disabled={busy}>
              Create a recovery code
            </Button>
          </>
        ) : mode === "rekey" ? (
          <form onSubmit={onRekey} className="flex flex-col gap-3" noValidate>
            <p className="text-body-medium text-on-surface-variant">
              A new code re-encrypts your key and replaces the old backup — recovery always uses
              the newest one. Enter your current code to replace it.
            </p>
            <div className="flex flex-col gap-1">
              <label htmlFor="rekey-code" className="text-label-large">
                Current recovery code
              </label>
              <input
                id="rekey-code"
                data-testid="settings_rekey_code"
                type="text"
                value={rekeyCode}
                onChange={(event) => setRekeyCode(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="rounded-extra-small border border-outline bg-transparent px-3 py-2 font-mono"
              />
            </div>
            <Button
              type="submit"
              testId="settings_backup_rekey"
              size="sm"
              selfStart
              disabled={rekeyCode.trim() === "" || busy}
            >
              Replace the recovery code
            </Button>
          </form>
        ) : mode === "none" ? (
          <>
            <p data-testid="settings_backup_no_actor" className="text-body-medium text-on-surface-variant">
              Your actor key isn&apos;t on this browser, so there&apos;s nothing to back up. Restore it
              first with your recovery code.
            </p>
            <Link
              href="/restore"
              data-testid="settings_backup_restore"
              className="self-start text-body-medium text-on-surface-variant underline"
            >
              Restore the key
            </Link>
          </>
        ) : null}
        {feedback !== null && (
          <p role="alert" data-testid="settings_feedback" className="text-body-medium text-error">
            {feedbackMessage(feedback)}
          </p>
        )}
      </Card>
    </main>
  );
}
