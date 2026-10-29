"use client";

// THE RECOVERY CODE, MADE LATE OR REPLACED (design/designs/canonical/screens/
// SettingsBackupNone.jsx, SettingsBackup.jsx, SettingsBackupError.jsx,
// SettingsBackupKeyAbsent.jsx; their behavior sidecars). Settings' `Recovery
// code` row opens one of three screens, by what this browser holds:
//
// - the retained seed and no code yet → MAKE A RECOVERY CODE: no code field,
//   because no current code exists to prove;
// - the key behind its backup → A NEW RECOVERY CODE: the current code proves
//   the replace, and the old one keeps working until the new one is typed
//   back;
// - no key here → the same heading under the key-absent notice, with no field
//   and no commit — making a code needs the key itself.
//
// A made code is shown once, behind its typed-back gate (`RecoveryCode`), and
// settings returns with `Your key is backed up with the new code.`

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchSettingsAccount } from "@/lib/api/settings-api";
import { RecoveryCode as RecoveryCodeCodec } from "@/lib/crypto/key-backup";
import { createBackupManager, type BackupManager } from "@/lib/identity/backup";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useAuthGuard } from "@/lib/session/runtime";
import { buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { fallbackMessage } from "@/lib/ui/error-messages";
import { RecoveryCode } from "@/lib/ui/recovery-code";
import { dateline } from "@/lib/ui/timestamp";
import { FormTextField } from "@/lib/ui2/form-fields";
import { HelpDialog, HELP_TOPICS } from "@/lib/ui2/help-dialog";
import { NoticeLine, NoticePanel } from "@/lib/ui2/notice-panel";
import { pillClassName } from "@/lib/ui2/pill-button";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { NO_ANSWER, TaskPage } from "@/lib/ui2/task-page";
import { WaitingCommit, useSlowAnswer } from "@/lib/ui2/waiting-commit";

/** Enable-late from the retained seed, replace via the current code, or no key here. */
type BackupMode = "create" | "rekey" | "none";

const WRONG_CODE = "That code doesn't check out.";
const CODE_LENGTH = "A recovery code is 26 characters.";
const NO_BACKUP = "There's no backup on the server to replace.";

/** The replace screen's lead, naming the day the current code was made once it is read. */
function replaceLead(madeAt: string | null): string {
  const lead =
    "A new code re-encrypts your key and replaces the old backup — recovery always uses the newest one.";
  return madeAt === null ? lead : `${lead} Your current code was made on ${dateline(madeAt)}.`;
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
  const router = useRouter();
  const [builtBackup] = useState<BackupManager>(() => createBackupManager({ client, guard, store }));
  const backup = injectedBackup ?? builtBackup;

  const [mode, setMode] = useState<BackupMode | null>(null);
  const [madeAt, setMadeAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  /** `length` re-checks live; `wrong` stands until the next press. */
  const [fieldLine, setFieldLine] = useState<{ kind: "length" | "wrong"; text: string } | null>(null);
  const [fault, setFault] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const slow = useSlowAnswer(busy);

  const readCustody = useCallback(() => {
    return Promise.all([store.actorSeed(), store.actorKey()]).then(([seed, key]) => {
      setMode(seed !== null ? "create" : key !== null ? "rekey" : "none");
    });
  }, [store]);

  useEffect(() => {
    void readCustody();
  }, [readCustody]);

  useEffect(() => {
    void guard.run(() => fetchSettingsAccount(client)).then((outcome) => {
      if (outcome.kind === "success") setMadeAt(outcome.value.keyBackupCreatedAt ?? null);
    });
  }, [client, guard]);

  const onCreate = async () => {
    if (busy) return;
    setBusy(true);
    setFault(null);
    const result = await backup.enable();
    setBusy(false);
    if (result.kind === "created") {
      setNewCode(result.code);
    } else if (result.kind === "refused") {
      setFault(fallbackMessage(result.errors[0].code));
    } else {
      // noSeed means custody moved under us; re-reading flips the mode.
      setFault(NO_ANSWER);
      await readCustody();
    }
  };

  const onCurrent = (value: string) => {
    setCurrent(value);
    if (fieldLine?.kind === "length" && RecoveryCodeCodec.normalize(value).length === 26) setFieldLine(null);
  };

  const onRekey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || current === "") return;
    setFieldLine(null);
    setFault(null);
    if (RecoveryCodeCodec.normalize(current).length !== 26) {
      setFieldLine({ kind: "length", text: CODE_LENGTH });
      return;
    }
    setBusy(true);
    const result = await backup.rekey(current);
    setBusy(false);
    switch (result.kind) {
      case "created":
        setNewCode(result.code);
        setCurrent("");
        break;
      case "malformedCode":
        setFieldLine({ kind: "length", text: CODE_LENGTH });
        break;
      case "wrongCode":
        setFieldLine({ kind: "wrong", text: WRONG_CODE });
        break;
      case "noBackup":
        setFault(NO_BACKUP);
        break;
      case "refused":
        setFault(fallbackMessage(result.errors[0].code));
        break;
      default:
        setFault(NO_ANSWER);
        break;
    }
  };

  if (newCode !== null) {
    return (
      <TaskPage bandOnly title="Your recovery code">
        <div className="mt-6">
          <Card>
            <RecoveryCode
              testId="settings_backup_code"
              code={newCode}
              explainer="This is the only way to restore your key. It is shown once and never stored — keep it offline, written down, somewhere safe."
              onConfirmed={() => {
                setNewCode(null);
                router.push("/settings?done=backup");
              }}
            />
          </Card>
        </div>
      </TaskPage>
    );
  }

  if (mode === "create") {
    return (
      <TaskPage
        backHref="/settings"
        backLabel="Back to settings"
        title="Make a recovery code"
        lead="Without a recovery code, losing this device means losing your key. Your sign-in survives, but no one — including CoGra — can bring the key back."
      >
        <div className="mt-8 flex flex-col gap-2">
          {fault !== null && (
            <p role="alert" data-testid="settings_feedback" className="m-0 text-body-medium text-error">
              {fault}
            </p>
          )}
          <button
            type="button"
            data-testid="settings_backup_create"
            onClick={() => void onCreate()}
            aria-busy={busy || undefined}
            aria-disabled={busy || undefined}
            className={`${buttonClassName({ variant: "primary" })} w-full`}
          >
            {slow ? "Creating your recovery code…" : "Create my recovery code"}
          </button>
        </div>
        <p className="m-0 mt-6 text-body-small text-on-surface-variant">
          The code is shown once and never stored. Have somewhere to write it down before you go on.
        </p>
      </TaskPage>
    );
  }

  if (mode === "none") {
    return (
      <TaskPage backHref="/settings" backLabel="Back to settings">
        <NoticePanel
          title="Your key isn't on this browser"
          help={{ label: "Your key", onOpen: () => setHelpOpen(true) }}
          corner="large"
          testId="settings_backup_no_actor"
        >
          <NoticeLine>Making a new code needs the key itself. Your current recovery code keeps working.</NoticeLine>
          <Link
            href="/restore"
            data-testid="settings_backup_restore"
            className={pillClassName({ variant: "inverse", full: true })}
          >
            Restore the key
          </Link>
        </NoticePanel>
        <h1 className="m-0 mt-6 text-headline-small">A new recovery code</h1>
        <p className="m-0 mt-2 text-body-medium text-on-surface-variant">{replaceLead(madeAt)}</p>
        <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} topic={HELP_TOPICS.yourKey} />
      </TaskPage>
    );
  }

  if (mode === "rekey") {
    return (
      <TaskPage
        backHref="/settings"
        backLabel="Back to settings"
        title="A new recovery code"
        lead={replaceLead(madeAt)}
      >
        <form onSubmit={onRekey} className="flex flex-col" noValidate>
          <div className="mt-8">
            <FormTextField
              label="Current recovery code"
              kind="code"
              mono
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX"
              enterKeyHint="go"
              value={current}
              onChange={onCurrent}
              error={fieldLine?.text ?? null}
              testId="settings_rekey_code"
            />
          </div>
          <div className="mt-2">
            <QuietNote>
              Lost it? This browser can&apos;t make a new code without the current one. If the Android app holds
              your key, make the new code there.
            </QuietNote>
          </div>
          <div className="mt-4">
            <WaitingCommit
              label="Create a new recovery code"
              busyLabel="Creating a new recovery code…"
              reason="Waiting for your current recovery code"
              waiting={current === ""}
              busy={busy}
              fault={fault}
              testId="settings_backup_rekey"
            />
          </div>
        </form>
        <p className="m-0 mt-6 text-body-small text-on-surface-variant">
          The new code is shown once and never stored. Have somewhere to write it down before you go on — the old
          code keeps working until the new one is confirmed.
        </p>
      </TaskPage>
    );
  }

  return <TaskPage backHref="/settings" backLabel="Back to settings">{null}</TaskPage>;
}
