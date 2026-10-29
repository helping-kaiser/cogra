"use client";

// THE VERIFICATION LINK'S LANDING (design/designs/canonical/screens/
// Verified.jsx and VerifyExpired.jsx; their behavior sidecars). The link is
// the proof: it verifies whether or not this browser holds a session, and the
// landing carries no header and no back arrow — the platform's own Back
// leaves to wherever the mail was opened from.
//
// ONE TOKEN OUTCOME COVERS THREE REALITIES — a used link, an expired token and
// an expiry-reaped account all ride VERIFICATION_TOKEN_INVALID (schema
// verifyEmail doc) — so VerifyExpired answers all of them, never saying which,
// and promises the fresh link only to an account still waiting on its email.
// Its resend goes to the account's own address given a session; without one,
// the first press opens an Email field in place and the next sends to it.
// The silent verb never reports failure — that would reveal whether an
// application exists — so both answers are shaped like Reset's.
//
// A success pokes the poll loop when a session is live: the proof just
// changed server-side.

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { resendVerificationEmail, verifyEmail } from "@/lib/api/onboarding-api";
import { hasCode } from "@/lib/api/outcome";
import { fetchSettingsAccount } from "@/lib/api/settings-api";
import { useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { useRegistrationFlow } from "@/lib/signing/provider";
import { Button, buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";
import { TransportError } from "@/lib/ui/transport-error";
import { FormTextField } from "@/lib/ui2/form-fields";
import { NO_ANSWER, TaskPage } from "@/lib/ui2/task-page";
import { useSlowAnswer } from "@/lib/ui2/waiting-commit";

/** VerifyExpired's registration (`nodes.json`, prefix `verify`). */
const NODE: DataNode = { path: "verify" };

type VerifyState =
  | "missingToken"
  | "verifying"
  | "verified"
  | "invalid"
  | "rateLimited"
  | "transportFailed";

export function VerifyView() {
  const client = useApolloClient();
  const flow = useRegistrationFlow();
  const token = useSearchParams().get("token");

  const [state, setState] = useState<VerifyState>(token === null ? "missingToken" : "verifying");
  const [attempt, setAttempt] = useState(0);
  // A verification token is consumed by its first use; the ref keeps
  // React's double-invoked dev effects from burning it twice.
  const fired = useRef<string | null>(null);

  useEffect(() => {
    if (token === null) return;
    const attemptKey = `${token}:${attempt}`;
    if (fired.current === attemptKey) return;
    fired.current = attemptKey;
    let cancelled = false;
    setState("verifying");
    void verifyEmail(client, token).then((outcome) => {
      if (cancelled) return;
      if (outcome.kind === "success") {
        setState("verified");
        flow.ensureAdvancing();
      } else if (outcome.kind === "refused") {
        // A backoff is neither an invalid link nor a connectivity
        // failure — the token may still be good on a later retry.
        setState(hasCode(outcome, "RATE_LIMITED") ? "rateLimited" : "invalid");
      } else {
        setState("transportFailed");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, token, attempt, flow]);

  if (state === "verified") return <Verified />;
  if (state === "invalid" || state === "missingToken") return <VerifyExpired />;

  // The check in flight, a backoff and no answer are not drawn: they stand
  // in the landing's own column with the shared lines.
  return (
    <TaskPage>
      {state === "verifying" && (
        <p role="status" data-testid="verify_progress" className="m-0 text-body-medium text-on-surface-variant">
          Verifying…
        </p>
      )}
      {state === "rateLimited" && (
        <p role="alert" data-testid="verify_rate_limited" className="m-0 text-body-medium text-error">
          Too many tries. Wait a little, then try again.
        </p>
      )}
      {state === "transportFailed" && <TransportError testId="verify_transport_error" />}
      {(state === "rateLimited" || state === "transportFailed") && (
        <div className="mt-6">
          <Button testId="verify_retry" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}
    </TaskPage>
  );
}

/** Verified.jsx: the mark, the heading and the line centred, one text button on. */
function Verified() {
  const router = useRouter();
  const phase = useAuthPhase();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="inline-flex text-primary" aria-hidden="true">
        <Icon name="mark" size={56} />
      </span>
      <h1 data-testid="verify_success" className="m-0 mt-6 text-headline-small">
        Email verified
      </h1>
      <p className="m-0 mt-2 max-w-[300px] text-body-medium text-on-surface-variant">
        Your application moved a step. You can go back to the app — it already knows.
      </p>
      <div className="mt-6">
        <button
          type="button"
          data-testid="verify_continue"
          onClick={() => router.replace(phase === "signedIn" ? "/" : "/login")}
          className={buttonClassName({ variant: "text" })}
        >
          Back to CoGra
        </button>
      </div>
    </main>
  );
}

function VerifyExpired() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();
  const phase = useAuthPhase();
  const signedIn = phase === "signedIn";

  /** The account's own address, read once given a session. */
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    void guard.run(() => fetchSettingsAccount(client)).then((outcome) => {
      if (outcome.kind === "success") setAddress(outcome.value.email ?? null);
    });
  }, [client, guard, signedIn]);

  const [fieldOpen, setFieldOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [fault, setFault] = useState<string | null>(null);
  const slow = useSlowAnswer(busy);

  const onResend = async () => {
    if (busy) return;
    if (!signedIn && !fieldOpen) {
      // The first press asks where to send, and sends nothing yet.
      setFieldOpen(true);
      return;
    }
    if (!signedIn && typed.trim() === "") return;
    setBusy(true);
    setFault(null);
    // A press before the address was read reads it now.
    let to = signedIn ? address : typed.trim();
    if (signedIn && to === null) {
      const read = await guard.run(() => fetchSettingsAccount(client));
      to = read.kind === "success" ? (read.value.email ?? null) : null;
    }
    if (to === null || to === "") {
      setBusy(false);
      setFault(NO_ANSWER);
      return;
    }
    const outcome = await resendVerificationEmail(client, to);
    setBusy(false);
    if (outcome.kind === "failed") {
      setFault(NO_ANSWER);
      return;
    }
    setSent(
      signedIn
        ? `If your account is still waiting on its email, a fresh link is on its way to ${to}.`
        : "If that address has an account still waiting on its email, a fresh link is on its way.",
    );
  };

  return (
    <TaskPage
      node={NODE}
      title="This link doesn't work anymore"
      lead="It may have expired or already been used. Send yourself a fresh one — if your account is still waiting on its email, the new link picks it back up."
    >
      {fieldOpen && (
        <div className="mt-6">
          <FormTextField
            label="Email"
            kind="email"
            enterKeyHint="go"
            value={typed}
            onChange={setTyped}
            testId="resend_email"
          />
        </div>
      )}
      <div className="mt-6 flex flex-col gap-2">
        {fault !== null && (
          <p role="alert" className="m-0 text-body-medium text-error" data-testid="verify_resend_fault">
            {fault}
          </p>
        )}
        <button
          type="button"
          onClick={() => void onResend()}
          aria-busy={busy || undefined}
          aria-disabled={busy || undefined}
          className={`${buttonClassName({ variant: "outline" })} w-full`}
          {...testAttributes(part(NODE, "resend"))}
        >
          {slow ? "Resending the link…" : "Resend the link"}
        </button>
        <button
          type="button"
          onClick={() => router.replace(signedIn ? "/" : "/login")}
          className={`${buttonClassName({ variant: "text" })} w-full`}
          {...testAttributes(part(NODE, "onward"))}
        >
          {signedIn ? "Go to the feed" : "Sign in"}
        </button>
      </div>
      {sent !== null && (
        <p role="status" data-testid="verify_resent" className="m-0 mt-4 text-body-medium text-on-surface-variant">
          {sent}
        </p>
      )}
    </TaskPage>
  );
}
