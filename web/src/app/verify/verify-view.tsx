"use client";

// The verification result. One token outcome covers three realities —
// invalid link, expired token, and an expiry-reaped account ride the same
// VERIFICATION_TOKEN_INVALID (schema verifyEmail doc) — so the failure
// copy covers all of them, with the resend as the recovery path. A
// success pokes the poll loop when a session is live: the proof just
// changed server-side.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { resendVerificationEmail, verifyEmail } from "@/lib/api/onboarding-api";
import { hasCode } from "@/lib/api/outcome";
import { useRegistrationFlow } from "@/lib/signing/provider";
import { Button } from "@/lib/ui/button";
import { TextField } from "@/lib/ui/text-field";
import { TransportError } from "@/lib/ui/transport-error";

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
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
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

  const onResend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (resendEmail.trim() === "" || resending) return;
    setResending(true);
    await resendVerificationEmail(client, resendEmail.trim());
    setResending(false);
    // The silent verb never reports failure — doing so would reveal
    // whether an application exists.
    setResent(true);
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Email verification</h1>

      {state === "verifying" && (
        <p role="status" data-testid="verify_progress" className="text-sm text-zinc-600 dark:text-zinc-400">
          Verifying…
        </p>
      )}

      {state === "verified" && (
        <>
          <p role="status" data-testid="verify_success" className="text-sm">
            Your email is verified. Your application moves ahead as soon as your inviter approves.
          </p>
          <Link href="/" data-testid="verify_continue" className="text-sm underline">
            Go to CoGra
          </Link>
        </>
      )}

      {(state === "invalid" || state === "missingToken") && (
        <>
          <p role="alert" data-testid="verify_error" className="text-sm text-red-600 dark:text-red-400">
            This verification link doesn&apos;t work. It may have been used already, expired, or the
            application it belonged to ran out — unverified accounts last 24 hours. Enter your email
            and we&apos;ll send a fresh link; if the account is gone, register again with your invite.
          </p>
          <form onSubmit={onResend} className="flex flex-col gap-3" noValidate>
            <TextField
              label="Email"
              value={resendEmail}
              onChange={setResendEmail}
              type="email"
              autoComplete="email"
              testId="resend_email"
            />
            <Button
              type="submit"
              testId="verify_resend"
              disabled={resendEmail.trim() === "" || resending}
            >
              Send a fresh link
            </Button>
            {resent && (
              <p role="status" data-testid="verify_resent" className="text-sm text-zinc-600 dark:text-zinc-400">
                If that email has a pending application, a fresh link is on its way.
              </p>
            )}
          </form>
        </>
      )}

      {state === "rateLimited" && (
        <>
          <p
            role="alert"
            data-testid="verify_rate_limited"
            className="text-sm text-red-600 dark:text-red-400"
          >
            Too many attempts — wait a moment and try again.
          </p>
          <Button testId="verify_retry" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </>
      )}

      {state === "transportFailed" && (
        <>
          <TransportError testId="verify_transport_error" />
          <Button testId="verify_retry" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </>
      )}
    </main>
  );
}
