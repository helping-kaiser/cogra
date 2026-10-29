"use client";

// DELETE ACCOUNT · CONFIRMED — what the mailed link opens
// (design/designs/canonical/screens/DeleteAccountConfirmed.jsx;
// DeleteAccountConfirmed.md; copy-voice.md "Deleting the account"). The link
// is `/delete-account?token=…` on the web origin (auth.md "Link URLs"), and
// OPENING IT IS THE CONFIRMATION: the landing calls `confirmAccountDeletion`
// with the token and no session — the link is the proof — which is why it
// stands outside the member shell's gate.
//
// It states what that started: the deadline in the band's own sentence (its
// count on the first day), the date under it, and that nothing changes until
// then. Opened again inside the grace, the same landing counts the days left;
// the server never moves the deadline. When the request left the content
// sweep off, the landing offers it once more in the request screen's own
// words, committed with `Add it to the deletion`; it is never offered the
// other way. No back arrow — a mail link has no previous screen of ours.
//
// A LINK THAT NO LONGER WORKS (DELETION_TOKEN_INVALID, or no token at all)
// opens the dead-link family's one landing (DeleteLinkExpired.md; ER-G1): the
// family's heading, a body that never says which happened, names no address
// and claims no expiry, and one way on — `Back to settings` with a session,
// where the deletion's state reads as it stands, or `Sign in` without, which
// holds no link. No mark, no arrow, no Resend: nothing is scheduled and
// nothing is deleted.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { confirmAccountDeletion, type AccountDeletion } from "@/lib/api/deletion-api";
import { hasCode, type Outcome } from "@/lib/api/outcome";
import { DeletionCommit } from "@/lib/deletion/deletion-commit";
import {
  confirmedBody,
  deletionSentence,
  LINK_WAS_THE_PROOF,
  NO_ANSWER,
  SWEEP_ADDED,
  SWEEP_HINT,
  SWEEP_LABEL,
} from "@/lib/deletion/deletion-copy";
import { useAccountDeletion } from "@/lib/deletion/deletion-status";
import { useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Snackbar } from "@/lib/ui/snackbar";
import { TransportError } from "@/lib/ui/transport-error";
import { Checkbox } from "@/lib/ui2/checkbox";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { useSlowAnswer } from "@/lib/ui2/waiting-commit";

const NODE: DataNode = { path: "deleteAccount" };
const node = (tail: string) => part(NODE, tail);

/** copy-voice *Faults by code*: the token confirms' visible budget line, and the server's answered no. */
const RATE_LIMITED_LINE = "Too many tries. Wait a little, then try again.";
const NOT_THROUGH = "That didn't go through. Try again.";
/**
 * No answer reached the device: the house fault's noun form for a confirm
 * (DeleteAccountConfirmed.md:11; copy-voice *Faults by code*, round 25) — the
 * long line never stands beside a control that tries again.
 */
const UNREACHABLE_LINE = "Can't reach the server — the deletion can't be confirmed right now.";

type Landing =
  | { kind: "confirming" }
  | { kind: "confirmed"; deletion: AccountDeletion }
  | { kind: "rateLimited" }
  | { kind: "unreachable" }
  /** Used, replaced, canceled or never known: DeleteLinkExpired. */
  | { kind: "dead" };

/** DeleteLinkExpired's words (`DeleteLinkExpired.jsx:46`, `:58-59`; copy-voice "The dead deletion link"). */
const DEAD_TITLE = "This link doesn't work anymore";
const DEAD_BODY =
  "It may have been used already, or a newer request replaced it. If you still mean to delete your account, ask again from settings.";

function landingOf(outcome: Outcome<AccountDeletion>): Landing {
  if (outcome.kind === "success") return { kind: "confirmed", deletion: outcome.value };
  if (hasCode(outcome, "DELETION_TOKEN_INVALID")) return { kind: "dead" };
  if (hasCode(outcome, "RATE_LIMITED")) return { kind: "rateLimited" };
  return { kind: "unreachable" };
}

export function DeleteAccountConfirmedView() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const phase = useAuthPhase();
  const router = useRouter();
  const status = useAccountDeletion();
  const refreshStanding = status.refresh;
  const token = useSearchParams().get("token");

  const [landing, setLanding] = useState<Landing>(token === null ? { kind: "dead" } : { kind: "confirming" });
  const [attempt, setAttempt] = useState(0);
  const [sweep, setSweep] = useState(false);
  const [adding, setAdding] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const slow = useSlowAnswer(adding);
  const dismiss = useCallback(() => setSnackbar(null), []);
  // A link is confirmed once per attempt; React's double-invoked dev effects
  // must not spend the per-IP budget twice.
  const fired = useRef<string | null>(null);

  useEffect(() => {
    if (token === null) return;
    const key = `${token}:${attempt}`;
    if (fired.current === key) return;
    fired.current = key;
    void guard.run(() => confirmAccountDeletion(client, token)).then((outcome) => {
      setLanding(landingOf(outcome));
      // Signed in here, the band now rides every surface: read it fresh.
      if (outcome.kind === "success") void refreshStanding();
    });
  }, [token, attempt, client, guard, refreshStanding]);

  const onAdd = async () => {
    if (adding || token === null) return;
    setAdding(true);
    setFault(null);
    // Ticked, the sweep joins; unticked, the re-call carries nothing and the
    // deletion stands account-only, exactly as the link left it (`:29`).
    const outcome = await guard.run(() => confirmAccountDeletion(client, token, sweep ? true : undefined));
    setAdding(false);
    if (outcome.kind === "success") {
      setLanding({ kind: "confirmed", deletion: outcome.value });
      if (outcome.value.includesContent) setSnackbar(SWEEP_ADDED);
      void refreshStanding();
      return;
    }
    // The box keeps its tick, and the commit is the retry (`:33`).
    setFault(
      outcome.kind === "failed" ? NO_ANSWER : hasCode(outcome, "RATE_LIMITED") ? RATE_LIMITED_LINE : NOT_THROUGH,
    );
  };

  const signedIn = phase === "signedIn";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      {landing.kind === "confirmed" && (
        <>
          <h1 className="m-0 text-headline-small" {...testAttributes(node("title"))}>
            {deletionSentence(landing.deletion)}
          </h1>
          <p className="m-0 mt-2 text-body-medium text-on-surface-variant" {...testAttributes(node("body"))}>
            {confirmedBody(landing.deletion)}
          </p>

          {!landing.deletion.includesContent && (
            <>
              <div className="mt-6">
                <Checkbox label={SWEEP_LABEL} checked={sweep} onChange={setSweep} node={node("sweep")} />
                <p
                  className="m-0 mt-1 pl-[30px] text-body-small text-on-surface-variant"
                  {...testAttributes(node("sweepHint"))}
                >
                  {SWEEP_HINT}
                </p>
              </div>
              <DeletionCommit
                className="mt-4"
                variant="outline"
                label="Add it to the deletion"
                busyLabel={slow ? "Adding it to the deletion…" : undefined}
                busy={adding}
                fault={fault}
                onCommit={() => void onAdd()}
                node={node("add")}
              />
            </>
          )}

          <div className="mt-6 flex flex-col gap-2">
            {phase === "signedOut" && <QuietNote testId="delete-account-signed-out">{LINK_WAS_THE_PROOF}</QuietNote>}
            {phase !== "resolving" && (
              <Link
                href={signedIn ? "/feed" : "/login"}
                onClick={(event) => {
                  if (!signedIn) return;
                  // The feed opens under the band (`:39`).
                  event.preventDefault();
                  void refreshStanding();
                  router.push("/feed");
                }}
                className={`${buttonClassName({ variant: "text" })} w-full`}
                {...testAttributes(node("onward"))}
              >
                {signedIn ? "Go to the feed" : "Sign in"}
              </Link>
            )}
          </div>
        </>
      )}

      {landing.kind === "dead" && (
        <>
          <h1 className="m-0 text-headline-small" {...testAttributes(node("title"))}>
            {DEAD_TITLE}
          </h1>
          <p className="m-0 mt-2 text-body-medium text-on-surface-variant" {...testAttributes(node("body"))}>
            {DEAD_BODY}
          </p>
          {phase !== "resolving" && (
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href={signedIn ? "/settings" : "/login"}
                className={`${buttonClassName({ variant: "text" })} w-full`}
                {...testAttributes(node("onward"))}
              >
                {signedIn ? "Back to settings" : "Sign in"}
              </Link>
            </div>
          )}
        </>
      )}

      {landing.kind === "rateLimited" && (
        <Retry onRetry={() => setAttempt((n) => n + 1)}>
          <p role="alert" className="m-0 text-body-medium text-error" data-testid="delete-account-rate-limited">
            {RATE_LIMITED_LINE}
          </p>
        </Retry>
      )}

      {landing.kind === "unreachable" && (
        <Retry onRetry={() => setAttempt((n) => n + 1)}>
          <TransportError testId="delete-account-unreachable" message={UNREACHABLE_LINE} />
        </Retry>
      )}

      <Snackbar testId="delete-account-snackbar" message={snackbar} onDismiss={dismiss} />
    </main>
  );
}

/** A confirm that got no usable answer: the line, and the same link tried again. */
function Retry({ children, onRetry }: { children: React.ReactNode; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      {children}
      <button
        type="button"
        onClick={onRetry}
        className={`${buttonClassName({ variant: "text" })} self-start`}
        data-testid="delete-account-retry"
      >
        Try again
      </button>
    </div>
  );
}
