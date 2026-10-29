"use client";

// DELETE ACCOUNT — the explain-and-request screen
// (design/designs/canonical/screens/DeleteAccount.jsx; DeleteAccount.md;
// copy-voice.md "Deleting the account"). The task-flow column: heading, the
// consequence, the one choice, one commitment, the thing to know last.
//
// THE BODY KEYS ON THE SERVER'S `deletionPath` (OS-15), never on
// `application.*`. BY_LINK draws the member's case — what goes and what stays
// as a pair, the content sweep as a CHECKBOX (nothing takes effect until the
// mailed link is opened, so it is a form control, not a switch), and
// `Send the confirmation link`, which says what the press does. IMMEDIATE draws
// the reader chip's applicant case — one sentence and `Delete my account`,
// which deletes at once and lands the reader signed out on the bare view.
// LOCKED has no request screen (the row says why), and a deletion already in
// its grace has its own page, so either one leaves for where it belongs.
//
// NO TYPED CONFIRMATION, NO PASSWORD, NO ARE-YOU-SURE (DeleteAccount.md:13):
// the friction is the mailed link.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { deleteApplicantAccount, requestAccountDeletion } from "@/lib/api/deletion-api";
import { hasCode, type Outcome } from "@/lib/api/outcome";
import { DeletionCommit as Commit } from "@/lib/deletion/deletion-commit";
import { NO_ANSWER, SWEEP_HINT, SWEEP_LABEL } from "@/lib/deletion/deletion-copy";
import { useAccountDeletion } from "@/lib/deletion/deletion-status";
import { useAuthGuard } from "@/lib/session/runtime";
import { instance, part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Checkbox } from "@/lib/ui2/checkbox";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { useSlowAnswer } from "@/lib/ui2/waiting-commit";

import { NOT_THROUGH, RATE_LIMITED_LINE, TaskPage } from "@/lib/ui2/task-page";

const NODE: DataNode = { path: "deleteAccount" };
const node = (tail: string) => part(NODE, tail);

const MEMBER_BODY =
  "This takes your name off CoGra. What you signed stays on the graph, because it is other people's record as much as yours — what goes is everything that says it was you.";
const APPLICANT_BODY = "Nothing has landed yet — deleting removes your application and your account right away.";

/** Where the mail screen lands, carrying the request's sweep choice for its Resend. */
export function mailRoute(includeContent: boolean): string {
  return `/settings/delete/mail?content=${includeContent ? "1" : "0"}`;
}

/**
 * The whole-act line a press that did not land says above its commit
 * (copy-voice *Faults by code*). A spent deletion mail budget is its own
 * drawn line, the commit staying and nothing mailed (DeleteAccount.md:23).
 */
function faultOf(outcome: Outcome<unknown>): string {
  if (outcome.kind === "failed") return NO_ANSWER;
  return hasCode(outcome, "RATE_LIMITED") ? RATE_LIMITED_LINE : NOT_THROUGH;
}

export function DeleteAccountView() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();
  const status = useAccountDeletion();
  const refresh = status.refresh;

  const [sweep, setSweep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const slow = useSlowAnswer(busy);

  // The screen reads what stands now: the path can change under an open
  // settings tab (an approval funds the address; a link confirms elsewhere).
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const path = status.standing?.path ?? null;
  const grace = status.standing?.deletion ?? null;

  useEffect(() => {
    if (grace !== null) router.replace("/settings/delete/pending");
    else if (path === "LOCKED") router.replace("/settings");
  }, [grace, path, router]);

  const onSend = async () => {
    if (busy) return;
    setBusy(true);
    setFault(null);
    const outcome = await guard.run(() => requestAccountDeletion(client, sweep));
    setBusy(false);
    if (outcome.kind === "success") {
      // A request raced into a confirmed grace answers that deletion and
      // changes nothing; its page is the grace page.
      if (outcome.value !== null) {
        status.setDeletion(outcome.value);
        router.replace("/settings/delete/pending");
        return;
      }
      router.push(mailRoute(sweep));
      return;
    }
    // The choice stays as it was, and the commit is the retry (DeleteAccount.md:21).
    setFault(faultOf(outcome));
    if (outcome.kind === "refused") void refresh();
  };

  const onDelete = async () => {
    if (busy) return;
    setBusy(true);
    setFault(null);
    const outcome = await guard.run(() => deleteApplicantAccount(client));
    setBusy(false);
    if (outcome.kind === "success") {
      status.leaveDeleted();
      return;
    }
    setFault(faultOf(outcome));
    if (outcome.kind === "refused") void refresh();
  };

  return (
    <TaskPage
      node={NODE}
      backHref="/settings"
      backLabel="Back to settings"
      title="Delete account"
      lead={path === "BY_LINK" ? MEMBER_BODY : path === "IMMEDIATE" ? APPLICANT_BODY : undefined}
    >
      {path === "BY_LINK" && (
        <>
          <Inset label="What goes" node={node("goes")}>
            <Line>Your profile — display name, bio and picture.</Line>
            <Line>The link between you and this account. Nothing left here points back to you.</Line>
            <Line>
              Your sessions, and what this account kept for you alone: saved items, hidden accounts, what you have
              read.
            </Line>
          </Inset>
          <Inset label="What stays" node={node("stays")}>
            <Line>
              Everything you signed, and everything others signed about you. Your posts still route and still credit
              their author; what is removed leaves a mark saying so.
            </Line>
          </Inset>

          <div className="mt-6">
            <Checkbox label={SWEEP_LABEL} checked={sweep} onChange={setSweep} node={node("sweep")} />
            <p
              className="m-0 mt-1 pl-[30px] text-body-small text-on-surface-variant"
              {...testAttributes(node("sweepHint"))}
            >
              {SWEEP_HINT}
            </p>
          </div>

          <Commit
            label="Send the confirmation link"
            busyLabel={slow ? "Sending the confirmation link…" : undefined}
            busy={busy}
            fault={fault}
            onCommit={() => void onSend()}
            node={instance(NODE, "commit", "member")}
          />

          <div className="mt-6">
            <QuietNote node={node("note")}>
              Nothing is deleted until you open that link. After that it runs in seven days, and you can cancel from
              any device until it does.
            </QuietNote>
          </div>
        </>
      )}

      {path === "IMMEDIATE" && (
        <Commit
          label="Delete my account"
          busyLabel={slow ? "Deleting my account…" : undefined}
          busy={busy}
          fault={fault}
          onCommit={() => void onDelete()}
          node={instance(NODE, "commit", "applicant")}
        />
      )}
    </TaskPage>
  );
}

function Inset({ label, node, children }: { label: string; node: DataNode; children: React.ReactNode }) {
  return (
    <div className="mt-6 flex flex-col gap-2 rounded-medium border border-outline-variant p-3" {...testAttributes(node)}>
      <span className="text-label-small text-on-surface-variant" {...testAttributes(part(node, "label"))}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-body-small">{children}</p>;
}
