"use client";

// AN APPLICANT'S ADDRESS CHANGE (design/designs/canonical/screens/
// ApplicantEmail.jsx; behavior/ApplicantEmail.md). The address is not
// verified yet, so the new address is all a change needs: a fresh link goes
// there and the one sent before stops working — no code to the old address,
// and the seven days are never restarted nor spoken of.
//
// Opened from Settings, it RETURNS TO SETTINGS (G1, RULED: origin-return) —
// back and success alike, success with the drawn snackbar.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchSettingsAccount } from "@/lib/api/settings-api";
import { useAuthGuard } from "@/lib/session/runtime";
import type { DataNode } from "@/lib/ui/data-node";

import { TaskPage } from "../../task-page";
import { EmailRequestForm } from "../email-request-form";

const NODE: DataNode = { path: "changeEmail" };

export function ApplicantEmailView() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();
  const [onFile, setOnFile] = useState<string | undefined>(undefined);
  /** Where the standing link went: a pending change's address, else the one on file. */
  const [linkedTo, setLinkedTo] = useState<string | undefined>(undefined);

  useEffect(() => {
    void guard.run(() => fetchSettingsAccount(client)).then((outcome) => {
      if (outcome.kind !== "success") return;
      setOnFile(outcome.value.email ?? undefined);
      setLinkedTo(outcome.value.pendingEmailChange?.newEmail ?? outcome.value.email ?? undefined);
    });
  }, [client, guard]);

  return (
    <TaskPage
      node={NODE}
      backHref="/settings"
      backLabel="Back"
      title="Change your email"
      lead={
        linkedTo === undefined
          ? ""
          : `Your email isn't verified yet, so the new address is all a change needs. A fresh link goes there, and the one sent to ${linkedTo} stops working.`
      }
    >
      <EmailRequestForm
        root={NODE}
        account={onFile}
        faultKeys={false}
        onRequested={() => router.push("/settings?done=applicantSent")}
      />
    </TaskPage>
  );
}
