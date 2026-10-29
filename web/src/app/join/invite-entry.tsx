"use client";

// THE INVITE DOOR (design/designs/canonical/screens/InviteEntry.jsx,
// InviteEntryError.jsx, JoinInvalid.jsx; their behavior sidecars): paste an
// invite (auth.md "Link URLs") to start an application — reached from the
// sign-in screen's "New here?" row and by the bare /join landing. The
// /join/<id> route does the actual check; this screen only finds the id.
//
// ONE DOOR, TWO HEADS. A link read and refused as unusable brings the same
// field and the same ways out back under JoinInvalid's heading and paragraph
// (`invalid`), so a different link can be pasted right there.
//
// The local format line answers on the press and, once it stands, re-checks
// as the text changes — it goes the moment the text reads as a link
// (InviteEntryError.md). The word token never reaches the screen.

import { useRouter } from "next/navigation";
import { useState } from "react";

import { extractInviteId } from "@/lib/onboarding/invite-input";
import { FormTextField } from "@/lib/ui2/form-fields";
import { LinkRow, LinkStack } from "@/lib/ui2/link-stack";
import { TaskPage } from "@/lib/ui2/task-page";
import { WaitingCommit } from "@/lib/ui2/waiting-commit";

const NOT_A_LINK = "That doesn't look like an invite link.";

export function InviteEntry({ invalid = false }: { invalid?: boolean } = {}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [malformed, setMalformed] = useState(false);

  const onContinue = (event: React.FormEvent) => {
    event.preventDefault();
    if (input === "") return;
    const id = extractInviteId(input);
    if (id === null) {
      setMalformed(true);
      return;
    }
    router.push(`/join/${id}`);
  };

  return (
    <TaskPage
      backHref="/feed"
      backLabel="Back"
      title={invalid ? "This invite can't be used anymore" : "Enter your invite"}
      lead={
        invalid
          ? "It may have expired or already been used. Ask the person who invited you for a new link."
          : "CoGra is invite-only. Paste your invite link to get started."
      }
    >
      <form onSubmit={onContinue} className="flex flex-col" noValidate>
        <div className="mt-8">
          <FormTextField
            label="Invite link"
            kind="url"
            enterKeyHint="go"
            value={input}
            onChange={(value) => {
              setInput(value);
              if (malformed) setMalformed(extractInviteId(value) === null);
            }}
            error={malformed ? NOT_A_LINK : null}
            testId="invite_input"
          />
        </div>
        <div className="mt-6">
          <WaitingCommit
            label="Continue"
            busyLabel="Continuing…"
            reason="Waiting for your invite link"
            waiting={input === ""}
            testId="invite_continue"
          />
        </div>
      </form>
      <LinkStack>
        <LinkRow href="/login" testId="invite_login">
          Already have an account? Sign in
        </LinkRow>
        <LinkRow href="/feed" testId="invite_browse">
          Just looking? Browse the feed →
        </LinkRow>
      </LinkStack>
    </TaskPage>
  );
}
