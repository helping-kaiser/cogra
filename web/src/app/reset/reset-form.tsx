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
import { fallbackMessage } from "@/lib/ui/error-messages";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/api/auth-api";
import { Button } from "@/lib/ui/button";
import { PasswordField } from "@/lib/ui/password-field";
import { TextField } from "@/lib/ui/text-field";
import { TransportError } from "@/lib/ui/transport-error";

function resetMessage(code: ErrorCode): string {
  switch (code) {
    case "RESET_TOKEN_INVALID":
      return "The reset token is invalid or expired.";
    case "WEAK_PASSWORD":
      return "Passwords need at least 12 characters and can't be a known breached password.";
    default:
      return fallbackMessage(code);
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
    setError(null);
    setTransportFailed(false);
    const outcome = await requestPasswordReset(client, email.trim());
    setInProgress(false);
    switch (outcome.kind) {
      case "success":
        setRequested(true);
        break;
      case "refused":
        // The verb is silent by design (no userErrors — anti-enumeration),
        // so the only refusal here is the synthesized RATE_LIMITED backoff:
        // neither connectivity copy nor a claimed sent email fits it.
        setError(outcome.errors[0].code);
        break;
      case "failed":
        setTransportFailed(true);
        break;
    }
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
      <TextField
        label="Email"
        value={email}
        onChange={(value) => {
          setEmail(value);
          setError(null);
        }}
        type="email"
        autoComplete="email"
        testId="reset_email"
      />
      <Button testId="reset_request" variant="outline" disabled={!canRequest} onClick={onRequest}>
        Email me a reset token
      </Button>
      {requested && (
        <p role="status" data-testid="reset_requested" className="text-sm text-on-surface-variant">
          If that address has an account, a reset token is on its way.
        </p>
      )}
      <form onSubmit={onConfirm} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Reset token"
          value={token}
          onChange={(value) => {
            setToken(value);
            setError(null);
          }}
          autoComplete="off"
          testId="reset_token"
        />
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
          <p role="alert" data-testid="reset_error" className="text-sm text-error">
            {resetMessage(error)}
          </p>
        )}
        {transportFailed && <TransportError testId="reset_transport_error" />}
        <Button type="submit" testId="reset_confirm" disabled={!canConfirm}>
          Set new password
        </Button>
      </form>
    </main>
  );
}
