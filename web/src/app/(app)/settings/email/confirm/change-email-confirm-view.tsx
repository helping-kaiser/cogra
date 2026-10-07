"use client";

// CONFIRM THE CHANGE (design/designs/canonical/screens/ChangeEmailConfirm.jsx;
// behavior/ChangeEmailConfirm.md; copy-voice *The change in flight, and its
// ends*). Two errands, drawn as a pair under `Both have to land` — the code
// at the current address, the link at the new one, each side reading `still
// waiting` until it lands and `confirmed` once it has. The account keeps its
// address until both land, in either order.
//
// THE COMMIT SAYS WHAT IT DOES: `Confirm the code` (S12, seam 055.5) — not
// `Confirm email change`, which a reader would have believed applied it.
//
// ONCE THE CODE'S SIDE LANDED the field and the commit go (G3, RULED): a page
// shows only the errand still owed — the pair reads `Code — confirmed`, and
// Resend mails the link alone.
//
// RESEND IS ONE-SIDED (EC ruling B3): it mails only what is still owed, and
// its snackbar names that inbox — chosen from the sides owed before the press.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { hasCode } from "@/lib/api/outcome";
import {
  cancelEmailChange,
  confirmEmailChange,
  fetchSettingsAccount,
  resendEmailChange,
  type PendingEmailChange,
} from "@/lib/api/settings-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Snackbar } from "@/lib/ui/snackbar";
import { FormTextField } from "@/lib/ui2/form-fields";
import { InlineAction } from "@/lib/ui2/inline-action";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { WaitingCommit } from "@/lib/ui2/waiting-commit";

import { NO_ANSWER, NOT_THROUGH, RATE_LIMITED_LINE, TaskPage } from "../../task-page";

const NODE: DataNode = { path: "changeEmail" };
const node = (tail: string) => part(NODE, tail);

const WRONG_CODE = "That code doesn't check out.";
const CODE_DISABLED =
  "Too many tries — for safety we have disabled your current code. Resend sends a fresh one.";
const RAN_OUT =
  "This change ran out before both sides landed. Your email stays as it is — start again from settings.";
const TAKEN =
  "That address now belongs to another account. Your email stays as it is — if the address frees up before the change runs out, confirming again applies it.";

/** The Resend snackbar, by which sides were owed before the press. */
export function resendMessage(email: string, pending: PendingEmailChange): string {
  const codeOwed = pending.requiresCode && !pending.codeConfirmed;
  const linkOwed = !pending.linkConfirmed;
  if (codeOwed && linkOwed) return "Sent again — check both inboxes.";
  if (codeOwed) return `Sent again — the code is on its way to ${email}.`;
  return `Sent again — the link is on its way to ${pending.newEmail}.`;
}

export function ChangeEmailConfirmView() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingEmailChange | null>(null);
  const [code, setCode] = useState("");
  /** `wrong` stands until the next press; `disabled` until a fresh code is sent. */
  const [fieldError, setFieldError] = useState<{ kind: "wrong" | "disabled"; line: string } | null>(null);
  const [fault, setFault] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const dismiss = useCallback(() => setSnackbar(null), []);

  /** Nothing pending any more — the settings row is where that reads. */
  const [gone, setGone] = useState(false);

  // One read on arrival.
  useEffect(() => {
    void guard.run(() => fetchSettingsAccount(client)).then((outcome) => {
      if (outcome.kind !== "success") return;
      if (outcome.value.pendingEmailChange == null) {
        setGone(true);
        return;
      }
      setEmail(outcome.value.email ?? null);
      setPending(outcome.value.pendingEmailChange);
    });
  }, [client, guard]);

  // Applied, canceled or run out elsewhere: settings says which.
  useEffect(() => {
    if (gone) router.replace("/settings");
  }, [gone, router]);

  const codeOwed = pending !== null && pending.requiresCode && !pending.codeConfirmed;

  const onConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || code === "") return;
    setFault(null);
    if (fieldError?.kind === "wrong") setFieldError(null);
    setBusy(true);
    const outcome = await guard.run(() => confirmEmailChange(client, code));
    setBusy(false);
    if (outcome.kind === "success") {
      if (outcome.value.pending === null) {
        router.push("/settings?done=email");
        return;
      }
      setPending(outcome.value.pending);
      setCode("");
      setFieldError(null);
      return;
    }
    if (hasCode(outcome, "EMAIL_CHANGE_CODE_DISABLED")) {
      setFieldError({ kind: "disabled", line: CODE_DISABLED });
    } else if (hasCode(outcome, "VERIFICATION_TOKEN_INVALID")) {
      setFieldError({ kind: "wrong", line: WRONG_CODE });
    } else if (hasCode(outcome, "EMAIL_CHANGE_EXPIRED")) {
      setFault(RAN_OUT);
    } else if (hasCode(outcome, "EMAIL_IN_USE")) {
      setFault(TAKEN);
    } else if (hasCode(outcome, "RATE_LIMITED")) {
      setFault(RATE_LIMITED_LINE);
    } else {
      setFault(outcome.kind === "failed" ? NO_ANSWER : NOT_THROUGH);
    }
  };

  const onResend = async () => {
    if (resending || pending === null || email === null) return;
    const message = resendMessage(email, pending);
    setResending(true);
    const outcome = await guard.run(() => resendEmailChange(client));
    setResending(false);
    if (outcome.kind === "success") {
      setPending(outcome.value);
      setFault(null);
      // A fresh code re-arms the cap, so the disabled line goes.
      if (fieldError?.kind === "disabled") setFieldError(null);
      setSnackbar(message);
      return;
    }
    if (hasCode(outcome, "RATE_LIMITED")) {
      setFault(RATE_LIMITED_LINE);
    } else if (hasCode(outcome, "NOT_FOUND")) {
      // The change ended elsewhere; the settings row says how.
      router.replace("/settings");
    } else {
      setSnackbar(NO_ANSWER);
    }
  };

  const onCancel = async () => {
    if (canceling) return;
    setCanceling(true);
    const outcome = await guard.run(() => cancelEmailChange(client));
    setCanceling(false);
    if (outcome.kind === "success") {
      router.push("/settings?done=canceled");
      return;
    }
    setSnackbar(NO_ANSWER);
  };

  const side = (landed: boolean) => (landed ? "confirmed" : "still waiting");

  return (
    <TaskPage
      node={NODE}
      backHref="/settings"
      backLabel="Back to settings"
      title="Confirm the change"
      lead="Two messages, two different errands — a code to type here, and a link to open at the new address. Your email moves when both have been answered, in either order."
    >
      {pending !== null && email !== null && (
        <>
          <div
            className="mt-6 flex flex-col gap-2 rounded-medium border border-outline-variant p-3"
            {...testAttributes(node("pair"))}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-label-small text-on-surface-variant" {...testAttributes(node("pair.label"))}>
                Both have to land
              </span>
              <InlineAction size="sm" onClick={() => void onResend()} busy={resending} node={node("pair.resend")}>
                Resend
              </InlineAction>
            </div>
            <div className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-1 text-body-small">
              {pending.requiresCode && (
                <>
                  <span className="text-on-surface-variant" {...testAttributes(node("pair.codeLabel"))}>
                    Code
                  </span>
                  <span {...testAttributes(node("pair.codeSide"))}>
                    {`${email} — ${side(pending.codeConfirmed)}`}
                  </span>
                </>
              )}
              <span className="text-on-surface-variant" {...testAttributes(node("pair.linkLabel"))}>
                Link
              </span>
              <span {...testAttributes(node("pair.linkSide"))}>
                {`${pending.newEmail} — ${side(pending.linkConfirmed)}`}
              </span>
            </div>
          </div>

          {codeOwed ? (
            <form onSubmit={onConfirm} noValidate className="flex flex-col">
              <div className="mt-6">
                <FormTextField
                  label="Confirmation code"
                  kind="digits"
                  mono
                  enterKeyHint="go"
                  value={code}
                  onChange={setCode}
                  hint={`From the message to ${email}.`}
                  error={fieldError?.line ?? null}
                  node={node("code")}
                />
              </div>
              <div className="mt-6">
                <WaitingCommit
                  label="Confirm the code"
                  busyLabel="Confirming the code…"
                  reason="Waiting for the code"
                  waiting={code === ""}
                  busy={busy}
                  fault={fault}
                  node={node("commit")}
                />
              </div>
            </form>
          ) : (
            fault !== null && (
              <p role="alert" className="m-0 mt-6 text-body-medium text-error" data-testid="commit-fault">
                {fault}
              </p>
            )
          )}

          <div className="mt-6">
            <QuietNote node={node("note")}>
              Until both sides land your account keeps the address it has, and a reset still goes there.
            </QuietNote>
          </div>
          <div className="mt-4 flex">
            <InlineAction size="sm" onClick={() => void onCancel()} busy={canceling} node={node("cancel")}>
              Cancel the change
            </InlineAction>
          </div>
        </>
      )}
      <Snackbar testId="change-email-snackbar" message={snackbar} onDismiss={dismiss} />
    </TaskPage>
  );
}
