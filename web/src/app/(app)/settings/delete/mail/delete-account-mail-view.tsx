"use client";

// DELETE ACCOUNT · CHECK YOUR MAIL (design/designs/canonical/screens/
// DeleteAccountMail.jsx; DeleteAccountMail.md). Where the request lands: the
// confirmation is the mailed link, so the one thing this screen owes the reader
// is that nothing is scheduled yet. THE ADDRESS IS NAMED, NOT DESCRIBED — read
// from the account, never carried in the URL — and no expiry is claimed.
//
// `Resend the link` re-calls the request with the choice the request screen
// recorded (`?content=`, client memory of its checkbox — the erasure packet's
// reading); the new request supersedes the earlier one. No band stands here:
// nothing is confirmed. Back and closing change nothing.

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { requestAccountDeletion } from "@/lib/api/deletion-api";
import { fetchSettingsAccount } from "@/lib/api/settings-api";
import { DeletionCommit } from "@/lib/deletion/deletion-commit";
import { mailBody, NO_ANSWER } from "@/lib/deletion/deletion-copy";
import { useAccountDeletion } from "@/lib/deletion/deletion-status";
import { useAuthGuard } from "@/lib/session/runtime";
import { part, type DataNode } from "@/lib/ui/data-node";
import { Snackbar } from "@/lib/ui/snackbar";
import { TransportError } from "@/lib/ui/transport-error";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { useSlowAnswer } from "@/lib/ui2/waiting-commit";

import { NOT_THROUGH, TaskPage } from "../../task-page";

const NODE: DataNode = { path: "deleteAccount" };
const node = (tail: string) => part(NODE, tail);

export function DeleteAccountMailView() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();
  const status = useAccountDeletion();
  const includeContent = useSearchParams().get("content") === "1";

  const [email, setEmail] = useState<string | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [resending, setResending] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const slow = useSlowAnswer(resending);
  const dismiss = useCallback(() => setSnackbar(null), []);

  useEffect(() => {
    void guard.run(() => fetchSettingsAccount(client)).then((outcome) => {
      if (outcome.kind === "success") setEmail(outcome.value.email ?? null);
      else setReadFailed(true);
    });
  }, [client, guard]);

  const onResend = async () => {
    if (resending) return;
    setResending(true);
    const outcome = await guard.run(() => requestAccountDeletion(client, includeContent));
    setResending(false);
    if (outcome.kind === "success") {
      if (outcome.value !== null) {
        // Confirmed meanwhile: the request changed nothing, and the grace page is where it stands.
        status.setDeletion(outcome.value);
        router.replace("/settings/delete/pending");
      }
      return;
    }
    // Offline, the network error answers (DeleteAccountMail.md:25).
    setSnackbar(outcome.kind === "failed" ? NO_ANSWER : NOT_THROUGH);
  };

  return (
    <TaskPage
      node={NODE}
      backHref="/settings"
      backLabel="Back to settings"
      title="Check your mail"
      lead={email === null ? undefined : mailBody(email)}
    >
      {readFailed && email === null && <TransportError testId="delete-account-mail-read-failed" />}
      <div className="mt-6">
        <QuietNote node={node("note")}>
          Until you open it nothing is scheduled and nothing has changed. Closing this screen changes nothing either —
          the link is the whole of it.
        </QuietNote>
      </div>
      <DeletionCommit
        label="Resend the link"
        busyLabel={slow ? "Resending the link…" : undefined}
        busy={resending}
        fault={null}
        onCommit={() => void onResend()}
        node={node("resend")}
        variant="outline"
      />
      <Snackbar testId="delete-account-mail-snackbar" message={snackbar} onDismiss={dismiss} />
    </TaskPage>
  );
}
