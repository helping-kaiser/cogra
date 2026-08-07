"use client";

// The verification result. One token outcome covers three realities —
// invalid link, expired token, and a 24h-reaped account ride the same
// VERIFICATION_TOKEN_INVALID (schema verifyEmail doc) — so the failure
// copy covers all of them, with the resend as the recovery path. A
// success pokes the poll loop when a session is live: the proof just
// changed server-side.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { resendVerificationEmail, verifyEmail } from "@/lib/api/onboarding-api";
import { useRegistrationFlow } from "@/lib/signing/provider";

type VerifyState = "missingToken" | "verifying" | "verified" | "invalid" | "transportFailed";

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
        setState("invalid");
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
            <div className="flex flex-col gap-1">
              <label htmlFor="resend-email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="resend-email"
                data-testid="resend_email"
                type="email"
                value={resendEmail}
                onChange={(event) => setResendEmail(event.target.value)}
                autoComplete="email"
                className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              />
            </div>
            <button
              type="submit"
              data-testid="verify_resend"
              disabled={resendEmail.trim() === "" || resending}
              className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-zinc-50 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Send a fresh link
            </button>
            {resent && (
              <p role="status" data-testid="verify_resent" className="text-sm text-zinc-600 dark:text-zinc-400">
                If that email has a pending application, a fresh link is on its way.
              </p>
            )}
          </form>
        </>
      )}

      {state === "transportFailed" && (
        <>
          <p
            role="alert"
            data-testid="verify_transport_error"
            className="text-sm text-red-600 dark:text-red-400"
          >
            Can&apos;t reach the server. Check your connection and try again.
          </p>
          <button
            type="button"
            data-testid="verify_retry"
            onClick={() => setAttempt((n) => n + 1)}
            className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Try again
          </button>
        </>
      )}
    </main>
  );
}
