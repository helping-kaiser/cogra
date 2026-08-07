"use client";

// Password reset (Android's PasswordResetScreens): request and confirm on
// one page. The request always reports success — no account enumeration.
// Web delta: /reset?token= pre-fills the token field (auth.md § Link URLs);
// the field stays editable because the dev mailer sends the bare token.
// Confirm routes to /login — a reset revoked every session.

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { ErrorCode } from "@/__generated__/graphql";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/api/auth-api";
import { PasswordField } from "@/lib/ui/password-field";

function resetMessage(code: ErrorCode): string {
  switch (code) {
    case "RESET_TOKEN_INVALID":
      return "The reset token is invalid or expired.";
    case "WEAK_PASSWORD":
      return "Passwords need at least 12 characters and can't be a known breached password.";
    case "RATE_LIMITED":
      return "Too many attempts — wait a moment and try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

export function ResetForm() {
  const client = useApolloClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [inProgress, setInProgress] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [transportFailed, setTransportFailed] = useState(false);

  const canRequest = email.trim() !== "" && !inProgress;
  const canConfirm = token.trim() !== "" && newPassword !== "" && !inProgress;

  const onRequest = async () => {
    if (!canRequest) return;
    setInProgress(true);
    setTransportFailed(false);
    const outcome = await requestPasswordReset(client, email.trim());
    setInProgress(false);
    // Success and refusal collapse to the same message — anti-enumeration.
    if (outcome.kind === "failed") setTransportFailed(true);
    else setRequested(true);
  };

  const onConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canConfirm) return;
    setInProgress(true);
    setError(null);
    setTransportFailed(false);
    const outcome = await confirmPasswordReset(client, token.trim(), newPassword);
    switch (outcome.kind) {
      case "success":
        router.replace("/login");
        return;
      case "refused":
        setError(outcome.errors[0].code);
        break;
      case "failed":
        setTransportFailed(true);
        break;
    }
    setInProgress(false);
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          data-testid="reset_email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          autoComplete="email"
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
      </div>
      <button
        type="button"
        data-testid="reset_request"
        disabled={!canRequest}
        onClick={onRequest}
        className="rounded-md border border-zinc-300 px-4 py-2 font-medium disabled:opacity-40 dark:border-zinc-700"
      >
        Email me a reset token
      </button>
      {requested && (
        <p role="status" data-testid="reset_requested" className="text-sm text-zinc-600 dark:text-zinc-400">
          If that address has an account, a reset token is on its way.
        </p>
      )}
      <form onSubmit={onConfirm} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="token" className="text-sm font-medium">
            Reset token
          </label>
          <input
            id="token"
            data-testid="reset_token"
            type="text"
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
              setError(null);
            }}
            autoComplete="off"
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </div>
        <PasswordField
          id="new-password"
          label="New password"
          value={newPassword}
          onChange={(value) => {
            setNewPassword(value);
            setError(null);
          }}
          autoComplete="new-password"
          testId="reset_password"
        />
        {error !== null && (
          <p role="alert" data-testid="reset_error" className="text-sm text-red-600 dark:text-red-400">
            {resetMessage(error)}
          </p>
        )}
        {transportFailed && (
          <p
            role="alert"
            data-testid="reset_transport_error"
            className="text-sm text-red-600 dark:text-red-400"
          >
            Can&apos;t reach the server. Check your connection and try again.
          </p>
        )}
        <button
          type="submit"
          data-testid="reset_confirm"
          disabled={!canConfirm}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-zinc-50 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Set new password
        </button>
      </form>
    </main>
  );
}
