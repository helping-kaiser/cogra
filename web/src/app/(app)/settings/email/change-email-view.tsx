"use client";

// CHANGE YOUR EMAIL (design/designs/canonical/screens/ChangeEmail.jsx;
// behavior/ChangeEmail.md). The request names the current address and what
// goes where — a code to it, a link to the new one — and carries no code
// field. Success opens the confirmation; the Email row reads `Change pending`
// from then on.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchSettingsAccount } from "@/lib/api/settings-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { part, type DataNode } from "@/lib/ui/data-node";
import { QuietNote } from "@/lib/ui2/quiet-note";

import { TaskPage } from "../task-page";
import { EmailRequestForm } from "./email-request-form";

const NODE: DataNode = { path: "changeEmail" };

export function ChangeEmailView() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();
  const [email, setEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    void guard.run(() => fetchSettingsAccount(client)).then((outcome) => {
      if (outcome.kind === "success") setEmail(outcome.value.email ?? undefined);
    });
  }, [client, guard]);

  return (
    <TaskPage
      node={NODE}
      backHref="/settings"
      backLabel="Back to settings"
      title="Change your email"
      lead="Your email signs you in, and it is the only way back if you lose your password — so a change is proved from both ends."
    >
      <EmailRequestForm
        root={NODE}
        account={email}
        faultKeys
        onRequested={() => router.push("/settings/email/confirm")}
      />
      {email !== undefined && (
        <div className="mt-6">
          <QuietNote node={part(NODE, "note")}>
            {`A code goes to ${email} and a link to the new address. Your email is unchanged until both have been answered.`}
          </QuietNote>
        </div>
      )}
    </TaskPage>
  );
}
