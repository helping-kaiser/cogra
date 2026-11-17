"use client";

// THE PASSWORD RESET (design/designs/canonical/screens/Reset.jsx, ResetNew.jsx,
// ResetExpired.jsx; their behavior sidecars). Three screens on one route:
//
// - RESET, at /reset: the email, `Send reset link`, and once the request
//   answers the status line that never says whether the email has an account
//   (no account enumeration).
// - RESET NEW, at /reset?token=: the mail's link lands here holding its own
//   secret — no field asks for it (ResetNew.md) — with the new password asked
//   twice and one commitment, no header and no back arrow.
// - RESET EXPIRED: a link spent or past its 15 minutes (the link's read-only
//   check before the form stands, or RESET_TOKEN_INVALID on
//   the press) — one screen for both, never saying which, and never whose.
//
// A taken reset revokes every session, this device's included, so it lands
// on the sign-in (auth.md "Password reset").

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { hasCode } from "@/lib/api/outcome";
import { checkPasswordResetLink, confirmPasswordReset, requestPasswordReset } from "@/lib/api/auth-api";
import { passwordLength } from "@/lib/onboarding/registration-rules";
import { mismatchAfterEdit, mismatchOnPress } from "@/lib/onboarding/repeat-password";
import { buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { FormPasswordField, FormTextField } from "@/lib/ui2/form-fields";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { NO_ANSWER, NOT_THROUGH, RATE_LIMITED_LINE, TaskPage } from "@/lib/ui2/task-page";
import { useSlowAnswer, WaitingCommit } from "@/lib/ui2/waiting-commit";

const SIGN_IN_ONLY =
  "This restores your sign-in only. Your key stays wherever it is — restoring the key is its own step, with your recovery code.";
const LENGTH_LINES = {
  short: "A password is at least 12 characters.",
  long: "A password is at most 128 characters.",
} as const;
const BREACHED = "That password has turned up in a data breach — pick another one.";

/** The reset family's registered prefix — Reset, ResetNew, ResetExpired (nodes.json `reset`, round 28). */
const RESET: DataNode = { path: "reset" };

export function ResetForm() {
  const token = useSearchParams().get("token");
  // Keyed by the link it answered, so leaving to /reset finds the request.
  const [expiredFor, setExpiredFor] = useState<string | null>(null);
  // The live link's account email, kept with the link it answered.
  const [live, setLive] = useState<{ token: string; email: string | null } | null>(null);
  const held = token !== null && token !== "" ? token : null;
  if (held !== null && expiredFor === held) return <ResetExpired />;
  if (held !== null && live?.token !== held) {
    return (
      <ResetCheck
        token={held}
        onAnswer={(answer) =>
          answer.live ? setLive({ token: held, email: answer.email }) : setExpiredFor(held)
        }
      />
    );
  }
  if (held !== null) return <ResetNew token={held} email={live?.email ?? null} onExpired={() => setExpiredFor(held)} />;
  return <ResetRequest />;
}

/**
 * THE LINK IS READ BEFORE THE FORM STANDS (ResetNew.md: a link already used
 * or past its time opens ResetExpired "AND NEVER ResetNew opens"), so while
 * the read-only check is out the page stands bare under no header, the way
 * every reset screen carries none — nothing is drawn that the answer could
 * take back. A check that gets no answer opens the form: the press itself
 * still meets a spent link with RESET_TOKEN_INVALID and opens ResetExpired.
 */
type LinkAnswer = { live: false } | { live: true; email: string | null };

function ResetCheck({ token, onAnswer }: { token: string; onAnswer: (answer: LinkAnswer) => void }) {
  const client = useApolloClient();
  // The answer lands through the newest callback, while the read runs once per
  // link (React docs, "Removing Effect Dependencies": an event read from a ref).
  const answer = useRef(onAnswer);
  useEffect(() => {
    answer.current = onAnswer;
  });
  useEffect(() => {
    let cancelled = false;
    void checkPasswordResetLink(client, token.trim()).then((outcome) => {
      if (cancelled) return;
      if (outcome.kind !== "success") answer.current({ live: true, email: null });
      else answer.current(outcome.value === null ? { live: false } : { live: true, email: outcome.value });
    });
    return () => {
      cancelled = true;
    };
  }, [client, token]);
  return <TaskPage>{null}</TaskPage>;
}

function ResetRequest() {
  const client = useApolloClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  // Reset.md: the ways out refuse a press from 200ms after the press until the answer.
  const held = useSlowAnswer(busy);

  const onRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || email === "") return;
    setBusy(true);
    setFault(null);
    const outcome = await requestPasswordReset(client, email.trim());
    setBusy(false);
    switch (outcome.kind) {
      case "success":
        setSent(true);
        return;
      case "refused":
        // The verb is silent by design (no userErrors — anti-enumeration),
        // so the only refusal here is the synthesized RATE_LIMITED backoff:
        // neither connectivity copy nor a claimed sent email fits it.
        setFault(hasCode(outcome, "RATE_LIMITED") ? RATE_LIMITED_LINE : NOT_THROUGH);
        return;
      case "failed":
        setFault(NO_ANSWER);
        return;
    }
  };

  return (
    <TaskPage
      node={RESET}
      backHref="/login"
      backLabel="Back"
      backHeld={held}
      title="Reset your password"
      lead="Resetting the password signs out every device."
    >
      <form onSubmit={onRequest} className="flex flex-col" noValidate>
        <div className="mt-8">
          <FormTextField
            label="Email"
            kind="email"
            enterKeyHint="go"
            value={email}
            onChange={setEmail}
            node={part(RESET, "email")}
          />
        </div>
        <div className="mt-6">
          <WaitingCommit
            label="Send reset link"
            busyLabel="Sending reset link…"
            reason="Waiting for your email"
            waiting={email === ""}
            busy={busy}
            fault={fault}
            node={part(RESET, "commit")}
          />
        </div>
        {sent && (
          <p role="status" data-testid="reset_requested" className="m-0 mt-4 text-body-medium text-on-surface-variant">
            If that email has an account, a reset link is on its way. The link works once and expires after 15 minutes.
          </p>
        )}
        <div className="mt-6">
          <QuietNote node={part(RESET, "note")}>{SIGN_IN_ONLY}</QuietNote>
        </div>
      </form>
    </TaskPage>
  );
}

function ResetNew({ token, email, onExpired }: { token: string; email: string | null; onExpired: () => void }) {
  const client = useApolloClient();
  const router = useRouter();
  const [password, setPassword] = useState("");
  /** `length` re-checks live; `breach` stands until the next press. */
  const [line, setLine] = useState<{ kind: "length" | "breach"; text: string } | null>(null);
  const [repeat, setRepeat] = useState("");
  const [repeatLine, setRepeatLine] = useState<string | null>(null);
  const [fault, setFault] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onPassword = (value: string) => {
    setPassword(value);
    if (line?.kind === "length") {
      const length = passwordLength(value);
      setLine(length === "ok" ? null : { kind: "length", text: LENGTH_LINES[length] });
    }
    setRepeatLine(mismatchAfterEdit(repeatLine, value, repeat));
  };
  const onRepeat = (value: string) => {
    setRepeat(value);
    setRepeatLine(mismatchAfterEdit(repeatLine, password, value));
  };

  const onConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || password === "" || repeat === "") return;
    setFault(null);
    const length = passwordLength(password);
    const mismatch = mismatchOnPress(password, repeat);
    setLine(length === "ok" ? null : { kind: "length", text: LENGTH_LINES[length] });
    setRepeatLine(mismatch);
    if (length !== "ok" || mismatch !== null) return;
    setBusy(true);
    const outcome = await confirmPasswordReset(client, token.trim(), password);
    setBusy(false);
    if (outcome.kind === "success") {
      router.replace("/login");
      return;
    }
    if (hasCode(outcome, "RESET_TOKEN_INVALID")) onExpired();
    else if (hasCode(outcome, "WEAK_PASSWORD")) setLine({ kind: "breach", text: BREACHED });
    else if (hasCode(outcome, "RATE_LIMITED")) setFault(RATE_LIMITED_LINE);
    else setFault(outcome.kind === "failed" ? NO_ANSWER : NOT_THROUGH);
  };

  return (
    <TaskPage
      node={RESET}
      title="Set a new password"
      lead="Setting a new password signs out every device."
    >
      <form onSubmit={onConfirm} className="flex flex-col" noValidate>
        {email !== null && (
          // The account the new password is filed under (Chromium, "Create Amazing
          // Password Forms": use hidden fields for implicit information). Never
          // shown, focused or announced; the value never leaves this form's DOM.
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={email}
            readOnly
            hidden
            tabIndex={-1}
            aria-hidden="true"
          />
        )}
        <div className="mt-8">
          <FormPasswordField
            label="New password"
            value={password}
            onChange={onPassword}
            autoComplete="new-password"
            enterKeyHint="next"
            hint="At least 12 characters."
            error={line?.text ?? null}
            node={part(RESET, "password")}
          />
        </div>
        <div className="mt-6">
          <FormPasswordField
            label="Repeat password"
            value={repeat}
            onChange={onRepeat}
            autoComplete="new-password"
            error={repeatLine}
            node={part(RESET, "confirm")}
          />
        </div>
        <div className="mt-6">
          <WaitingCommit
            label="Set the new password"
            busyLabel="Setting the new password…"
            reason="Waiting for a new password"
            waiting={password === "" || repeat === ""}
            busy={busy}
            fault={fault}
            node={part(RESET, "commit")}
          />
        </div>
        <div className="mt-6">
          <QuietNote node={part(RESET, "note")}>{SIGN_IN_ONLY}</QuietNote>
        </div>
      </form>
    </TaskPage>
  );
}

function ResetExpired() {
  const router = useRouter();
  return (
    <TaskPage
      node={RESET}
      title="This link doesn't work anymore"
      lead="A reset link works once and expires after 15 minutes."
    >
      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          {...testAttributes(part(RESET, "again"))}
          onClick={() => router.replace("/reset")}
          className={`${buttonClassName({ variant: "outline" })} w-full`}
        >
          Reset your password
        </button>
        <button
          type="button"
          {...testAttributes(part(RESET, "onward"))}
          onClick={() => router.replace("/login")}
          className={`${buttonClassName({ variant: "text" })} w-full`}
        >
          Sign in
        </button>
      </div>
    </TaskPage>
  );
}
