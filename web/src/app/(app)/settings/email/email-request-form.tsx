"use client";

// THE TWO EMAIL-CHANGE REQUESTS' SHARED FORM (ChangeEmail.jsx,
// ApplicantEmail.jsx; their sidecars). Both ask for the new address and the
// current password, in that order, and refuse the same ways: a malformed
// address on its field at the press (then re-checked live), a wrong password
// on its field until the next press, a spent mail budget or a run of wrong
// passwords in the whole-act slot above the commit, and a press that gets no
// answer there too, the fields keeping what was typed. An address another
// account holds is never said.
//
// `faultKeys` keys the request's nodes by the drawn `fault` chip
// (`none` / `password` / `malformed`, seam 075's chip-key convention) — the
// member's board draws one state per value; the applicant's draws none.

import { useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { hasCode } from "@/lib/api/outcome";
import { requestEmailChange, type PendingEmailChange } from "@/lib/api/settings-api";
import { emailValid } from "@/lib/onboarding/registration-rules";
import { useAuthGuard } from "@/lib/session/runtime";
import type { DataNode } from "@/lib/ui/data-node";
import { FormPasswordField, FormTextField } from "@/lib/ui2/form-fields";
import { WaitingCommit } from "@/lib/ui2/waiting-commit";

import { NO_ANSWER, NOT_THROUGH, RATE_LIMITED_LINE } from "../task-page";

const MALFORMED = "That doesn't look like an email address.";
const WRONG_PASSWORD = "That password isn't right.";

type Fault = "none" | "password" | "malformed";

export function EmailRequestForm({
  root,
  account,
  faultKeys,
  onRequested,
}: {
  /** The screen's prefix (`changeEmail`). */
  root: DataNode;
  /** The address on file, for the hidden username. */
  account: string | undefined;
  faultKeys: boolean;
  onRequested: (pending: PendingEmailChange) => void;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fault, setFault] = useState<Fault>("none");
  const [actLine, setActLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const at = (tail: string): DataNode => ({
    path: `${root.path}.${tail}`,
    key: faultKeys ? fault : undefined,
  });

  const onEmail = (next: string) => {
    setEmail(next);
    if (fault === "malformed" && emailValid(next.trim())) setFault("none");
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || email === "" || password === "") return;
    setActLine(null);
    if (!emailValid(email.trim())) {
      setFault("malformed");
      return;
    }
    setFault("none");
    setBusy(true);
    const outcome = await guard.run(() => requestEmailChange(client, email.trim(), password));
    setBusy(false);
    if (outcome.kind === "success") {
      onRequested(outcome.value);
      return;
    }
    if (hasCode(outcome, "INVALID_CREDENTIALS")) setFault("password");
    else if (hasCode(outcome, "BAD_INPUT")) setFault("malformed");
    else if (hasCode(outcome, "RATE_LIMITED")) setActLine(RATE_LIMITED_LINE);
    else setActLine(outcome.kind === "failed" ? NO_ANSWER : NOT_THROUGH);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col">
      <div className="mt-8">
        <FormTextField
          label="New email"
          kind="email"
          value={email}
          onChange={onEmail}
          error={fault === "malformed" ? MALFORMED : null}
          node={at("email")}
        />
      </div>
      <div className="mt-6">
        <FormPasswordField
          label="Current password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          account={account}
          error={fault === "password" ? WRONG_PASSWORD : null}
          node={at("current")}
        />
      </div>
      <div className="mt-6">
        <WaitingCommit
          label="Change email"
          busyLabel="Changing email…"
          reason="Waiting for a new email and your password"
          waiting={email === "" || password === ""}
          busy={busy}
          fault={actLine}
          node={at("commit")}
        />
      </div>
    </form>
  );
}
