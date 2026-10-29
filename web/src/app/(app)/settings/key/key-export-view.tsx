"use client";

// YOUR KEY (design/designs/canonical/screens/YourKey.jsx, YourKeyGate.jsx,
// YourKeyAbsent.jsx; their behavior sidecars; auth.md "Key export";
// Android's KeyExportScreen): the browser shows the secret it holds, in two
// portable encodings, so the holder can act as their address without CoGra.
// Purely local — no upload, and the seed is never re-persisted.
//
// WHAT GATES IT IS CUSTODY, NOT A CHOICE (web.md "Key custody"):
// - the seed still retained → YOUR KEY opens with the key shown and nothing
//   asked first: it sits in this browser's store already, so a prompt would
//   prove nothing;
// - the seed sealed behind its backup → YOUR KEY GATE asks the current
//   recovery code before anything is shown;
// - no key here → YOUR KEY ABSENT: the notice leads, no key card is drawn,
//   and `Restore the key` stands only where a backup exists to restore from.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchSettingsAccount } from "@/lib/api/settings-api";
import { RecoveryCode as RecoveryCodeCodec } from "@/lib/crypto/key-backup";
import { fallbackMessage } from "@/lib/ui/error-messages";
import {
  createBackupManager,
  type BackupManager,
  type RevealResult,
} from "@/lib/identity/backup";
import type { ExportedSecret } from "@/lib/identity/key-export";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useAuthGuard } from "@/lib/session/runtime";
import { Card } from "@/lib/ui/card";
import { NO_BACKUP_LINE } from "@/lib/ui/key-absent-notice";
import { PageHeader } from "@/lib/ui/page-header";
import { Snackbar } from "@/lib/ui/snackbar";
import { FormTextField } from "@/lib/ui2/form-fields";
import { HelpDialog, HELP_TOPICS } from "@/lib/ui2/help-dialog";
import { InlineAction } from "@/lib/ui2/inline-action";
import { NoticeLine, NoticePanel } from "@/lib/ui2/notice-panel";
import { pillClassName } from "@/lib/ui2/pill-button";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { NO_ANSWER } from "@/lib/ui2/task-page";
import { WaitingCommit } from "@/lib/ui2/waiting-commit";

/** Retained seed, seed behind the blob, or no key on this browser. */
type Custody = "retained" | "sealed" | "none";

const SECRET_NAMES: Record<ExportedSecret["kind"], string> = {
  actorKey: "Your actor key",
};

const WRONG_CODE = "That code doesn't check out.";
const CODE_LENGTH = "A recovery code is 26 characters.";

/** Where a reveal that showed nothing says so: on the field, or above the commit. */
function revealLine(result: RevealResult): { field: string } | { fault: string } | null {
  switch (result.kind) {
    case "revealed":
      return null;
    case "malformedCode":
      return { field: CODE_LENGTH };
    case "wrongCode":
      return { field: WRONG_CODE };
    case "noSeed":
      return { fault: "This browser no longer holds your key." };
    case "noBackup":
      return { fault: "There's no backup on the server to open." };
    case "refused":
      return { fault: fallbackMessage(result.errors[0].code) };
    case "failed":
      return { fault: NO_ANSWER };
  }
}

export function KeyExportView({
  store = identityStore,
  backup: injectedBackup,
}: {
  /** Test injection. */
  store?: IdentityStore;
  backup?: BackupManager;
} = {}) {
  const client = useApolloClient();
  const guard = useAuthGuard();

  const [builtBackup] = useState<BackupManager>(() =>
    createBackupManager({ client, guard, store }),
  );
  const backup = injectedBackup ?? builtBackup;

  const [custody, setCustody] = useState<Custody | null>(null);
  const [backedUp, setBackedUp] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [secrets, setSecrets] = useState<readonly ExportedSecret[] | null>(null);
  /** `length` re-checks live; `wrong` stands until the next press. */
  const [fieldLine, setFieldLine] = useState<{ kind: "length" | "wrong"; text: string } | null>(null);
  const [fault, setFault] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [copied, setCopied] = useState<{ token: number } | null>(null);

  const reveal = useCallback(
    async (run: () => Promise<RevealResult>) => {
      setBusy(true);
      setFieldLine(null);
      setFault(null);
      const result = await run();
      setBusy(false);
      if (result.kind === "revealed") {
        setSecrets(result.secrets);
        // The code has done its work; it does not linger in the form.
        setCode("");
        return;
      }
      const line = revealLine(result);
      if (line !== null && "field" in line) {
        setFieldLine({ kind: line.field === CODE_LENGTH ? "length" : "wrong", text: line.field });
      } else if (line !== null) {
        setFault(line.fault);
      }
      if (result.kind === "noSeed") {
        const [seed, key] = await Promise.all([store.actorSeed(), store.actorKey()]);
        setCustody(seed !== null ? "retained" : key !== null ? "sealed" : "none");
      }
    },
    [store],
  );

  useEffect(() => {
    let live = true;
    void Promise.all([store.actorSeed(), store.actorKey()]).then(([seed, key]) => {
      if (!live) return;
      const read: Custody = seed !== null ? "retained" : key !== null ? "sealed" : "none";
      setCustody(read);
      // YourKey.md: a browser that still keeps the seed asks nothing first.
      if (read === "retained") void reveal(() => backup.revealRetained());
    });
    return () => {
      live = false;
    };
  }, [store, backup, reveal]);

  useEffect(() => {
    void guard.run(() => fetchSettingsAccount(client)).then((outcome) => {
      if (outcome.kind === "success") setBackedUp(outcome.value.keyBackupCreatedAt != null);
    });
  }, [client, guard]);

  const onCode = (value: string) => {
    setCode(value);
    if (fieldLine?.kind === "length" && RecoveryCodeCodec.normalize(value).length === 26) setFieldLine(null);
  };

  const onRevealFromBackup = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || code === "") return;
    if (RecoveryCodeCodec.normalize(code).length !== 26) {
      setFault(null);
      setFieldLine({ kind: "length", text: CODE_LENGTH });
      return;
    }
    void reveal(() => backup.revealFromBackup(code));
  };

  const onCopy = (value: string) => {
    void navigator.clipboard?.writeText(value).then(
      () => setCopied((c) => ({ token: (c?.token ?? 0) + 1 })),
      () => {},
    );
  };

  const absent = custody === "none";
  const noBackup = absent && backedUp === false;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <PageHeader title="Your key" backHref="/settings" backLabel="Back to settings" backTestId="key_export_back" />
      <div className="flex flex-col gap-4 px-6 pb-8 pt-2">
        {absent && (
          <NoticePanel
            title="Your key isn't on this browser"
            help={{ label: "Your key", onOpen: () => setHelpOpen(true) }}
            corner="large"
            testId="key_export_no_actor"
          >
            <NoticeLine>{noBackup ? NO_BACKUP_LINE : "There is no key on this browser to show."}</NoticeLine>
            {!noBackup && (
              <Link
                href="/restore"
                data-testid="key_export_restore"
                className={pillClassName({ variant: "inverse", full: true })}
              >
                Restore the key
              </Link>
            )}
          </NoticePanel>
        )}

        {custody !== null && (
          <p className="m-0 text-body-medium text-on-surface-variant">
            {custody === "sealed" && secrets === null
              ? "On this browser your key is sealed inside its backup. Enter your recovery code to open it and see the key."
              : absent
                ? "This key signs everything you publish, and it lives only on the device it was made on. Store a copy somewhere safe and you keep it whatever happens to CoGra. Anyone who has a copy can act as you."
                : "This key signs everything you publish, and it lives only in this browser. Store a copy somewhere safe and you keep it whatever happens to CoGra. Anyone who has a copy can act as you."}
          </p>
        )}

        {secrets !== null && (
          <>
            {secrets.map((secret) => (
              <SecretCard key={secret.kind} secret={secret} onCopy={onCopy} />
            ))}
            <QuietNote>Nothing here is sent anywhere — the key is read from this browser and shown.</QuietNote>
          </>
        )}

        {secrets === null && custody === "retained" && fault !== null && (
          <p role="alert" data-testid="key_export_error" className="m-0 text-body-medium text-error">
            {fault}
          </p>
        )}

        {secrets === null && custody === "sealed" && (
          <form onSubmit={onRevealFromBackup} className="flex flex-col" noValidate>
            <div className="mt-4">
              <FormTextField
                label="Current recovery code"
                kind="code"
                mono
                enterKeyHint="go"
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX"
                value={code}
                onChange={onCode}
                error={fieldLine?.text ?? null}
                testId="key_export_code"
              />
            </div>
            <div className="mt-4">
              <WaitingCommit
                label="Show my key"
                busyLabel="Showing my key…"
                reason="Waiting for your recovery code"
                waiting={code === ""}
                busy={busy}
                fault={fault}
                testId="key_export_reveal"
              />
            </div>
          </form>
        )}
      </div>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} topic={HELP_TOPICS.yourKey} />
      <Snackbar
        testId="key-export-snackbar"
        message={copied === null ? null : "Copied"}
        token={copied?.token}
        onDismiss={() => setCopied(null)}
      />
    </main>
  );
}

/**
 * One secret, both encodings, in its card. The labels name the formats
 * exactly — an export nobody can feed to another tool is not an export
 * (design.md §7 keeps implementation vocabulary out of copy elsewhere; here
 * the format IS the content).
 */
function SecretCard({ secret, onCopy }: { secret: ExportedSecret; onCopy: (value: string) => void }) {
  return (
    <section aria-labelledby={`secret-${secret.kind}`}>
      <Card>
        <h2 id={`secret-${secret.kind}`} className="m-0 text-title-medium">
          {SECRET_NAMES[secret.kind]}
        </h2>
        <SecretBlock
          label="PEM (PKCS#8)"
          copyLabel="Copy the PEM block"
          value={secret.pem}
          testId="key_export_pem"
          onCopy={onCopy}
        />
        <SecretBlock
          label="Raw hex — Ed25519 private key"
          copyLabel="Copy the raw hex"
          value={secret.hex}
          testId="key_export_hex"
          onCopy={onCopy}
        />
      </Card>
    </section>
  );
}

function SecretBlock({
  label,
  copyLabel,
  value,
  testId,
  onCopy,
}: {
  label: string;
  copyLabel: string;
  value: string;
  testId: string;
  onCopy: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-label-large">{label}</span>
        <InlineAction ariaLabel={copyLabel} onClick={() => onCopy(value)}>
          Copy
        </InlineAction>
      </div>
      <p
        data-testid={testId}
        className="m-0 whitespace-pre-wrap rounded-extra-small border border-outline p-3 font-mono text-body-small [overflow-wrap:anywhere]"
      >
        {value}
      </p>
    </div>
  );
}
