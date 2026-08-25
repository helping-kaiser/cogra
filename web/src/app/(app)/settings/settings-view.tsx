"use client";

// Account management (Android's SettingsScreen), never gated on account
// state (auth.md "The applicant experience"; backup modes: web.md "Key
// custody"). One global busy mutex, one feedback line at a time,
// cleared when the next action starts.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { ErrorCode } from "@/__generated__/graphql";
import { fallbackMessage } from "@/lib/ui/error-messages";
import type { Outcome } from "@/lib/api/outcome";
import {
  changeHandle,
  changePassword,
  confirmEmailChange,
  fetchSessions,
  requestEmailChange,
  revokeOtherSessions,
  revokeSession,
  type SessionView,
} from "@/lib/api/settings-api";
import { createBackupManager, type BackupManager } from "@/lib/identity/backup";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { RestoreCard } from "@/app/applicant-status";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import { useTokenStore } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { Button } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { PageHeader } from "@/lib/ui/page-header";
import { PasswordField } from "@/lib/ui/password-field";
import { RecoveryCode } from "@/lib/ui/recovery-code";
import { StanceInputSetting } from "@/lib/ui/stance-input-setting";
import { TextField } from "@/lib/ui/text-field";

type SettingsAction =
  | "passwordChanged"
  | "handleChanged"
  | "emailChangeRequested"
  | "emailConfirmed"
  | "sessionRevoked"
  | "othersRevoked";

/** Where a feedback line renders — beside the controls that acted. */
type Section = "backup" | "sessions" | "password" | "handle" | "email";

type Feedback = { section: Section } & (
  | { kind: "done"; action: SettingsAction }
  | { kind: "refused"; code: ErrorCode }
  | { kind: "backup"; result: "malformedCode" | "wrongCode" | "noBackup" }
  | { kind: "transport" }
);

/** Enable-late from the retained seed, replace via the current code, or nothing to back up here. */
type BackupMode = "create" | "rekey" | "none";

function doneMessage(action: SettingsAction): string {
  switch (action) {
    case "passwordChanged":
      return "Password changed. Other sessions were signed out.";
    case "handleChanged":
      return "Handle changed.";
    case "emailChangeRequested":
      return "Confirmation codes sent — check both inboxes.";
    case "emailConfirmed":
      return "Email updated.";
    case "sessionRevoked":
      // Revocation kills the refresh token; the access token cannot be
      // invalidated mid-TTL (auth.md "Sessions") — say so.
      return "Session revoked. That device may stay signed in for up to 15 minutes.";
    case "othersRevoked":
      return "All other sessions signed out. Devices may stay signed in for up to 15 minutes.";
  }
}

function refusedMessage(code: ErrorCode): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "Your current password didn't match.";
    case "WEAK_PASSWORD":
      return "Passwords need at least 12 characters and can't be a known breached password.";
    case "HANDLE_TAKEN":
      return "That handle is taken.";
    case "BAD_INPUT":
      return "Check the entered value.";
    default:
      return fallbackMessage(code);
  }
}

function feedbackMessage(feedback: Feedback): string {
  switch (feedback.kind) {
    case "done":
      return doneMessage(feedback.action);
    case "refused":
      return refusedMessage(feedback.code);
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

export function SettingsView({
  store = identityStore,
  backup: injectedBackup,
}: {
  /** Test injection. */
  store?: IdentityStore;
  backup?: BackupManager;
} = {}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const tokens = useTokenStore();
  const keyOnDevice = useKeyOnDevice(store);

  const [builtBackup] = useState<BackupManager>(() =>
    createBackupManager({ client, guard, store }),
  );
  const backup = injectedBackup ?? builtBackup;

  const [sessions, setSessions] = useState<readonly SessionView[]>([]);
  const [backupMode, setBackupMode] = useState<BackupMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [newBackupCode, setNewBackupCode] = useState<string | null>(null);
  const [rekeyCode, setRekeyCode] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailChangePassword, setEmailChangePassword] = useState("");
  const [emailChangeCode, setEmailChangeCode] = useState("");
  const [emailChangeRequested, setEmailChangeRequested] = useState(false);

  const readCustody = useCallback(() => {
    return Promise.all([store.actorSeed(), store.actorKey()]).then(([seed, key]) => {
      setBackupMode(seed !== null ? "create" : key !== null ? "rekey" : "none");
    });
  }, [store]);

  const refresh = useCallback(() => {
    return readCustody().then(() =>
      // A failed sessions read keeps the old list — the section has no
      // error state of its own (Android parity); actions surface theirs.
      guard.run(() => fetchSessions(client)).then((outcome) => {
        if (outcome.kind === "success") setSessions(outcome.value);
      }),
    );
  }, [client, guard, readCustody]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** The one busy mutex: runs the call, maps the outcome, clears fields on success. */
  const act = async (
    section: Section,
    call: () => Promise<Outcome<unknown>>,
    action: SettingsAction,
    onSuccess?: () => void,
  ): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setFeedback(null);
    const outcome = await guard.run(call);
    setBusy(false);
    switch (outcome.kind) {
      case "success":
        setFeedback({ section, kind: "done", action });
        onSuccess?.();
        return true;
      case "refused":
        setFeedback({ section, kind: "refused", code: outcome.errors[0].code });
        return false;
      case "failed":
        setFeedback({ section, kind: "transport" });
        return false;
    }
  };

  /** The section's feedback line, rendered beside the controls that acted. */
  const feedbackLine = (section: Section) =>
    feedback !== null && feedback.section === section ? (
      <p
        role={feedback.kind === "done" ? "status" : "alert"}
        data-testid="settings_feedback"
        className={feedback.kind === "done" ? "text-body-medium" : "text-body-medium text-error"}
      >
        {feedbackMessage(feedback)}
      </p>
    ) : null;

  const onCreateBackup = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    const result = await backup.enable();
    setBusy(false);
    if (result.kind === "created") {
      setNewBackupCode(result.code);
    } else if (result.kind === "refused") {
      setFeedback({ section: "backup", kind: "refused", code: result.errors[0].code });
    } else if (result.kind === "failed" || result.kind === "noSeed") {
      // noSeed means custody moved under us; re-reading flips the mode.
      setFeedback({ section: "backup", kind: "transport" });
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
        setNewBackupCode(result.code);
        setRekeyCode("");
        break;
      case "malformedCode":
      case "wrongCode":
      case "noBackup":
        setFeedback({ section: "backup", kind: "backup", result: result.kind });
        break;
      case "refused":
        setFeedback({ section: "backup", kind: "refused", code: result.errors[0].code });
        break;
      default:
        setFeedback({ section: "backup", kind: "transport" });
        break;
    }
  };

  const onBackupCodeSaved = async () => {
    setNewBackupCode(null);
    await readCustody();
  };

  const onRevokeSession = async (id: string) => {
    await act("sessions", () => revokeSession(client, id), "sessionRevoked");
    await refresh();
  };

  const onRevokeOthers = async () => {
    await act("sessions", () => revokeOtherSessions(client), "othersRevoked");
    await refresh();
  };

  const onChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    await act(
      "password",
      () => changePassword(client, currentPassword, newPassword),
      "passwordChanged",
      () => {
        setCurrentPassword("");
        setNewPassword("");
      },
    );
  };

  const onChangeHandle = async (event: React.FormEvent) => {
    event.preventDefault();
    await act("handle", () => changeHandle(client, newHandle.trim()), "handleChanged", () => {
      setNewHandle("");
    });
  };

  const onRequestEmailChange = async (event: React.FormEvent) => {
    event.preventDefault();
    const requested = await act(
      "email",
      () => requestEmailChange(client, newEmail.trim(), emailChangePassword),
      "emailChangeRequested",
      () => setEmailChangePassword(""),
    );
    if (requested) setEmailChangeRequested(true);
  };

  const onConfirmEmailChange = async (event: React.FormEvent) => {
    event.preventDefault();
    await act("email", () => confirmEmailChange(client, emailChangeCode), "emailConfirmed", () => {
      setNewEmail("");
      setEmailChangeCode("");
      setEmailChangeRequested(false);
    });
  };

  const onSignOut = async () => {
    if (busy) return;
    setBusy(true);
    // Best-effort self-revocation: an unreachable server never blocks
    // signing out (auth.md "Sign-out"). Clearing tokens flips the
    // phase; the (app) gate replaces the location.
    await guard.run(() => revokeSession(client, null));
    // The "don't remember me" purge runs before the clear removes the
    // active account the custody store resolves by; a failed purge
    // must never block signing out.
    try {
      await store.purgeIfEphemeral();
    } catch {
      // sign-out proceeds regardless
    }
    tokens.clear();
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 pb-12 pt-3">
      <CollapsingTop>
        <PageHeader
          title="Settings"
          backHref="/profile"
          backLabel="Back to profile"
          backTestId="settings_back"
        />
        {/* The key banner rides the collapsing top on every main
            surface (design.md §6). */}
        {keyOnDevice === false && <RestoreCard />}
      </CollapsingTop>

      <Card testId="settings_backup_card">
        <h2 className="text-title-medium">Key backup</h2>
        {newBackupCode !== null ? (
          <>
            <RecoveryCode
              testId="settings_backup_code"
              code={newBackupCode}
              explainer="Write this code down somewhere safe. It is shown only this once; any older code stops working."
              onConfirmed={onBackupCodeSaved}
            />
          </>
        ) : backupMode === "create" ? (
          <>
            <p className="text-body-medium text-on-surface-variant">
              Create your recovery code. It re-encrypts your key on this browser and backs it up —
              without one, losing this browser loses the actor.
            </p>
            <Button testId="settings_backup_create" size="sm" selfStart onClick={onCreateBackup} disabled={busy}>
              Create a recovery code
            </Button>
          </>
        ) : backupMode === "rekey" ? (
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
        ) : backupMode === "none" ? (
          <>
            <p data-testid="settings_backup_no_actor" className="text-body-medium text-on-surface-variant">
              Your actor key isn&apos;t on this browser, so there&apos;s nothing to back up.
              Restore it first with your recovery code.
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
        {/* Not while a fresh code is on screen — that surface has one job. */}
        {newBackupCode === null && backupMode !== null && backupMode !== "none" && (
          <Link
            href="/settings/key"
            data-testid="settings_export_key"
            className="self-start text-body-medium text-on-surface-variant underline"
          >
            Show my key
          </Link>
        )}
        {feedbackLine("backup")}
      </Card>

      <StanceInputSetting />

      <Card testId="settings_sessions_card">
        <h2 className="text-title-medium">Sessions</h2>
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              data-testid={`session_${session.id}`}
              className="flex items-center justify-between gap-3 text-body-medium"
            >
              <span>
                {session.deviceLabel ?? "Unnamed device"}
                {session.isCurrent && " (this browser)"}
              </span>
              {!session.isCurrent && (
                <Button
                  testId={`revoke_${session.id}`}
                  variant="text"
                  size="sm"
                  disabled={busy}
                  onClick={() => onRevokeSession(session.id)}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Button
          testId="settings_revoke_others"
          variant="outline"
          size="sm"
          selfStart
          onClick={onRevokeOthers}
          disabled={busy}
        >
          Sign out everywhere else
        </Button>
        {feedbackLine("sessions")}
      </Card>

      <Card testId="settings_credentials_card">
        <h2 className="text-title-medium">Credentials</h2>
        <form onSubmit={onChangePassword} className="flex flex-col gap-3" noValidate>
          <PasswordField
            id="settings-current-password"
            label="Current password"
            value={currentPassword}
            onChange={(value) => {
              setCurrentPassword(value);
              setFeedback(null);
            }}
            autoComplete="current-password"
            testId="settings_current_password"
          />
          <PasswordField
            id="settings-new-password"
            label="New password"
            value={newPassword}
            onChange={(value) => {
              setNewPassword(value);
              setFeedback(null);
            }}
            autoComplete="new-password"
            testId="settings_new_password"
          />
          {feedbackLine("password")}
          <Button
            type="submit"
            testId="settings_change_password"
            size="sm"
            selfStart
            disabled={currentPassword === "" || newPassword === "" || busy}
          >
            Change password
          </Button>
        </form>

        <form onSubmit={onChangeHandle} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="settings-new-handle" className="text-label-large">
              New handle
            </label>
            <input
              id="settings-new-handle"
              data-testid="settings_new_handle"
              type="text"
              value={newHandle}
              onChange={(event) => {
                setNewHandle(event.target.value.toLowerCase());
                setFeedback(null);
              }}
              autoComplete="off"
              spellCheck={false}
              className="rounded-extra-small border border-outline bg-transparent px-3 py-2"
            />
          </div>
          {feedbackLine("handle")}
          <Button
            type="submit"
            testId="settings_change_handle"
            size="sm"
            selfStart
            disabled={newHandle.trim().length < 3 || busy}
          >
            Change handle
          </Button>
        </form>

        <form onSubmit={onRequestEmailChange} className="flex flex-col gap-3" noValidate>
          <TextField
            label="New email"
            value={newEmail}
            onChange={(value) => {
              setNewEmail(value);
              setFeedback(null);
            }}
            type="email"
            autoComplete="email"
            testId="settings_new_email"
          />
          <PasswordField
            id="settings-email-password"
            label="Current password"
            value={emailChangePassword}
            onChange={(value) => {
              setEmailChangePassword(value);
              setFeedback(null);
            }}
            autoComplete="current-password"
            testId="settings_email_password"
          />
          {feedbackLine("email")}
          <Button
            type="submit"
            testId="settings_request_email"
            size="sm"
            selfStart
            disabled={!newEmail.includes("@") || emailChangePassword === "" || busy}
          >
            Change email
          </Button>
        </form>

        {emailChangeRequested && (
          <form onSubmit={onConfirmEmailChange} className="flex flex-col gap-3" noValidate>
            <p data-testid="settings_email_requested" className="text-body-medium text-on-surface-variant">
              Check both inboxes — either message&apos;s code confirms the change.
            </p>
            <div className="flex flex-col gap-1">
              <label htmlFor="settings-email-code" className="text-label-large">
                Confirmation code
              </label>
              <input
                id="settings-email-code"
                data-testid="settings_email_code"
                type="text"
                value={emailChangeCode}
                onChange={(event) => {
                  setEmailChangeCode(event.target.value);
                  setFeedback(null);
                }}
                autoComplete="off"
                spellCheck={false}
                className="rounded-extra-small border border-outline bg-transparent px-3 py-2 font-mono"
              />
            </div>
            <Button
              type="submit"
              testId="settings_confirm_email"
              size="sm"
              selfStart
              disabled={emailChangeCode.trim() === "" || busy}
            >
              Confirm email change
            </Button>
          </form>
        )}
      </Card>

      <Button testId="settings_sign_out" variant="outline" onClick={onSignOut} disabled={busy}>
        Sign out
      </Button>
    </main>
  );
}
