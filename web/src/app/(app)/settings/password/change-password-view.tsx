"use client";

// CHANGE YOUR PASSWORD (design/designs/canonical/screens/ChangePassword.jsx;
// behavior/ChangePassword.md; copy-voice *The settings subpages*).
//
// The form opens at rest and typing never marks a field before the next
// press. A press checks the new password's length here — the client knows
// 12 and 128 — and only a well-formed pair goes out; the server's own
// WEAK_PASSWORD past those checks is the breach. The length line re-checks
// live once it stands; a wrong current password and the breach line stand
// until the next press. A run of wrong current passwords answers the
// account's re-authentication budget, said in the whole-act slot above the
// commit (B7's line, ruled PR-4), as does a press that gets no answer.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { hasCode } from "@/lib/api/outcome";
import { changePassword, fetchSettingsAccount } from "@/lib/api/settings-api";
import { passwordLength } from "@/lib/onboarding/registration-rules";
import { useAuthGuard } from "@/lib/session/runtime";
import { part, type DataNode } from "@/lib/ui/data-node";
import { FormPasswordField } from "@/lib/ui2/form-fields";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { WaitingCommit } from "@/lib/ui2/waiting-commit";

import { NO_ANSWER, NOT_THROUGH, RATE_LIMITED_LINE, TaskPage } from "../task-page";

const NODE: DataNode = { path: "changePassword" };

const LENGTH_LINES = {
  short: "A password is at least 12 characters.",
  long: "A password is at most 128 characters.",
} as const;
const WRONG_CURRENT = "That password isn't right.";
const BREACHED = "That password has turned up in a data breach — pick another one.";

export function ChangePasswordView() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();

  const [account, setAccount] = useState<string | undefined>(undefined);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [currentError, setCurrentError] = useState<string | null>(null);
  /** `length` re-checks live; `breach` stands until the next press. */
  const [nextError, setNextError] = useState<{ kind: "length" | "breach"; line: string } | null>(null);
  const [fault, setFault] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The account's address, for the hidden username a password manager reads.
  useEffect(() => {
    void guard.run(() => fetchSettingsAccount(client)).then((outcome) => {
      if (outcome.kind === "success") setAccount(outcome.value.email ?? undefined);
    });
  }, [client, guard]);

  const onNext = (value: string) => {
    setNext(value);
    if (nextError?.kind === "length") {
      const length = passwordLength(value);
      setNextError(length === "ok" ? null : { kind: "length", line: LENGTH_LINES[length] });
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || current === "" || next === "") return;
    setCurrentError(null);
    setNextError(null);
    setFault(null);
    const length = passwordLength(next);
    if (length !== "ok") {
      setNextError({ kind: "length", line: LENGTH_LINES[length] });
      return;
    }
    setBusy(true);
    const outcome = await guard.run(() => changePassword(client, current, next));
    setBusy(false);
    if (outcome.kind === "success") {
      router.push("/settings?done=password");
      return;
    }
    if (hasCode(outcome, "INVALID_CREDENTIALS")) setCurrentError(WRONG_CURRENT);
    else if (hasCode(outcome, "WEAK_PASSWORD")) setNextError({ kind: "breach", line: BREACHED });
    else if (hasCode(outcome, "RATE_LIMITED")) setFault(RATE_LIMITED_LINE);
    else setFault(outcome.kind === "failed" ? NO_ANSWER : NOT_THROUGH);
  };

  return (
    <TaskPage
      node={NODE}
      backHref="/settings"
      backLabel="Back to settings"
      title="Change your password"
      lead="Changing your password signs out every other device. This one stays signed in."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col">
        <div className="mt-8">
          <FormPasswordField
            label="Current password"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
            account={account}
            enterKeyHint="next"
            error={currentError}
            node={part(NODE, "current")}
          />
        </div>
        <div className="mt-6">
          <FormPasswordField
            label="New password"
            value={next}
            onChange={onNext}
            autoComplete="new-password"
            hint="At least 12 characters."
            error={nextError?.line ?? null}
            node={part(NODE, "password")}
          />
        </div>
        <div className="mt-6">
          <WaitingCommit
            label="Change password"
            busyLabel="Changing password…"
            reason="Waiting for both passwords"
            waiting={current === "" || next === ""}
            busy={busy}
            fault={fault}
            node={part(NODE, "commit")}
          />
        </div>
        <div className="mt-6">
          <QuietNote node={part(NODE, "note")}>
            Your current password is asked for even though you are signed in: a live session is not
            proof enough to change the credential behind it.
          </QuietNote>
        </div>
      </form>
    </TaskPage>
  );
}
