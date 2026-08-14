"use client";

// Key export (auth.md "Key export"; Android's KeyExportScreen): the
// browser shows the secrets it holds, each in a portable encoding, so
// the holder can act as their L0 address without CoGra. Purely local —
// no upload, and the seed is never re-persisted.
//
// What gates it is custody, not a choice (web.md "Key custody"): while
// the seed is still retained it sits in this browser's store already,
// so a prompt would prove nothing; once a blob exists the seed is gone
// and only the current recovery code brings it back.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fallbackMessage } from "@/lib/ui/error-messages";
import {
  createBackupManager,
  type BackupManager,
  type RevealResult,
} from "@/lib/identity/backup";
import type { ExportedSecret } from "@/lib/identity/key-export";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useAuthGuard } from "@/lib/session/runtime";
import { Button } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { PageHeader } from "@/lib/ui/page-header";

/** Retained seed, seed behind the blob, or no key on this browser. */
type Custody = "retained" | "sealed" | "none";

const SECRET_NAMES: Record<ExportedSecret["kind"], string> = {
  actorKey: "Your actor key",
};

function revealMessage(result: RevealResult): string | null {
  switch (result.kind) {
    case "revealed":
      return null;
    case "noSeed":
      return "This browser no longer holds your key.";
    case "malformedCode":
      return "That doesn't look like a recovery code — check for missing characters.";
    case "wrongCode":
      return "That code doesn't open your backup. Check it and try again.";
    case "noBackup":
      return "There's no backup on the server to open.";
    case "refused":
      return fallbackMessage(result.errors[0].code);
    case "failed":
      return "Can't reach the server. Check your connection and try again.";
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
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [secrets, setSecrets] = useState<readonly ExportedSecret[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readCustody = useCallback(() => {
    return Promise.all([store.actorSeed(), store.actorKey()]).then(([seed, key]) => {
      setCustody(seed !== null ? "retained" : key !== null ? "sealed" : "none");
    });
  }, [store]);

  useEffect(() => {
    void readCustody();
  }, [readCustody]);

  const reveal = async (run: () => Promise<RevealResult>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await run();
    setBusy(false);
    if (result.kind === "revealed") {
      setSecrets(result.secrets);
      // The code has done its work; it does not linger in the form.
      setCode("");
    } else {
      setError(revealMessage(result));
      if (result.kind === "noSeed") await readCustody();
    }
  };

  const onRevealRetained = () => reveal(() => backup.revealRetained());

  const onRevealFromBackup = (event: React.FormEvent) => {
    event.preventDefault();
    return reveal(() => backup.revealFromBackup(code));
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-12">
      <PageHeader
        title="Your key"
        backHref="/settings"
        backLabel="Back to settings"
        backTestId="key_export_back"
      />

      <Card testId="key_export_card">
        <p className="text-body-medium text-on-surface-variant">
          This key is what signs everything you publish, and it lives only in this browser. Store a
          copy somewhere safe and you keep it whatever happens to CoGra. Anyone who has a copy can
          act as you.
        </p>

        {secrets !== null ? (
          secrets.map((secret) => <SecretBlocks key={secret.kind} secret={secret} />)
        ) : custody === "retained" ? (
          <Button testId="key_export_reveal" size="sm" selfStart onClick={onRevealRetained} disabled={busy}>
            Show my key
          </Button>
        ) : custody === "sealed" ? (
          <form onSubmit={onRevealFromBackup} className="flex flex-col gap-3" noValidate>
            <p className="text-body-medium text-on-surface-variant">
              Your key is stored encrypted, so this browser needs your current recovery code to
              open it.
            </p>
            <div className="flex flex-col gap-1">
              <label htmlFor="export-code" className="text-label-large">
                Current recovery code
              </label>
              <input
                id="export-code"
                data-testid="key_export_code"
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="rounded-extra-small border border-outline bg-transparent px-3 py-2 font-mono"
              />
            </div>
            <Button
              type="submit"
              testId="key_export_reveal"
              size="sm"
              selfStart
              disabled={code.trim() === "" || busy}
            >
              Show my key
            </Button>
          </form>
        ) : custody === "none" ? (
          <>
            <p data-testid="key_export_no_actor" className="text-body-medium text-on-surface-variant">
              Your actor key isn&apos;t on this browser, so there&apos;s nothing to show. Restore it
              first with your recovery code.
            </p>
            <Link
              href="/restore"
              data-testid="key_export_restore"
              className="self-start text-body-medium text-on-surface-variant underline"
            >
              Restore the key
            </Link>
          </>
        ) : null}

        {error !== null && (
          <p role="alert" data-testid="key_export_error" className="text-body-medium text-error">
            {error}
          </p>
        )}
      </Card>
    </main>
  );
}

/**
 * One secret, both encodings. The labels name the formats exactly — an
 * export nobody can feed to another tool is not an export (design.md §7
 * keeps implementation vocabulary out of copy elsewhere; here the
 * format IS the content).
 */
function SecretBlocks({ secret }: { secret: ExportedSecret }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`secret-${secret.kind}`}>
      <h2 id={`secret-${secret.kind}`} className="text-title-medium">
        {SECRET_NAMES[secret.kind]}
      </h2>
      <SecretBlock label="PEM (PKCS#8)" value={secret.pem} testId="key_export_pem" />
      <SecretBlock label="Raw hex — Ed25519 private key" value={secret.hex} testId="key_export_hex" />
    </section>
  );
}

function SecretBlock({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label-large">{label}</span>
      <pre
        data-testid={testId}
        className="overflow-x-auto rounded-extra-small border border-outline p-3 font-mono text-body-small"
      >
        {value}
      </pre>
    </div>
  );
}
