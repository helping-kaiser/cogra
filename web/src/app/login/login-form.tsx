"use client";

// Login (Android's LoginScreen/LoginViewModel). Success only writes the
// token store (phase flips navigate: web.md "Routes") — the signed-in
// redirect below covers a fresh login and an already-signed-in visit.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { ErrorCode } from "@/__generated__/graphql";
import { fallbackMessage } from "@/lib/ui/error-messages";
import { logIn } from "@/lib/api/auth-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { deviceLabel } from "@/lib/session/device-label";
import { useAuthPhase, useTokenStore } from "@/lib/session/provider";
import { securityNotices, type SecurityNotices } from "@/lib/session/security-notices";
import { Button } from "@/lib/ui/button";
import { PasswordField } from "@/lib/ui/password-field";
import { TextField } from "@/lib/ui/text-field";
import { TransportError } from "@/lib/ui/transport-error";

function loginMessage(code: ErrorCode): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "That email and password don't match.";
    default:
      return fallbackMessage(code);
  }
}

export function LoginForm({
  identity = identityStore,
  notices = securityNotices,
}: {
  /** Test injection. */
  identity?: IdentityStore;
  notices?: SecurityNotices;
} = {}) {
  const client = useApolloClient();
  const store = useTokenStore();
  const phase = useAuthPhase();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dontRemember, setDontRemember] = useState(false);
  const [inProgress, setInProgress] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [transportFailed, setTransportFailed] = useState(false);

  useEffect(() => {
    if (phase === "signedIn") router.replace("/");
  }, [phase, router]);

  const canSubmit = email.trim() !== "" && password !== "" && !inProgress;

  const clearErrors = () => {
    setError(null);
    setTransportFailed(false);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setInProgress(true);
    clearErrors();
    const outcome = await logIn(client, email.trim(), password, deviceLabel());
    setInProgress(false);
    switch (outcome.kind) {
      case "success":
        // The notice posts before the token save: saving flips the auth
        // phase and this form unmounts on the redirect, so the shell's
        // banner must already be pending (auth.md "Reuse detection" —
        // delivered exactly once, a dropped notice never comes back).
        if (outcome.value.reuseDetectedAt !== null) {
          notices.post(outcome.value.reuseDetectedAt);
        }
        store.save(outcome.value.auth);
        // Recorded per account, after save() sets the active account
        // custody resolves by — always written, so an unchecked login
        // clears an earlier flag (auth.md "Sign-out").
        await identity.setEphemeral(dontRemember);
        break;
      case "refused":
        setError(outcome.errors[0].code);
        break;
      case "failed":
        setTransportFailed(true);
        break;
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-headline-small">Sign in to CoGra</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            clearErrors();
          }}
          type="email"
          autoComplete="email"
          testId="login_email"
        />
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            clearErrors();
          }}
          autoComplete="current-password"
          testId="login_password"
        />
        <label htmlFor="dont-remember" className="flex items-center gap-2 text-body-medium">
          <input
            id="dont-remember"
            data-testid="login_dont_remember"
            type="checkbox"
            checked={dontRemember}
            onChange={(event) => setDontRemember(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Don&apos;t remember this account on this device
        </label>
        {error !== null && (
          <p role="alert" data-testid="login_error" className="text-body-medium text-error">
            {loginMessage(error)}
          </p>
        )}
        {transportFailed && <TransportError testId="login_transport_error" />}
        {inProgress && (
          <p role="status" data-testid="login_progress" className="text-body-medium text-on-surface-variant">
            Signing in…
          </p>
        )}
        <Button type="submit" testId="login_submit" disabled={!canSubmit}>
          Sign in
        </Button>
      </form>
      <Link
        href="/reset"
        data-testid="login_forgot"
        className="text-body-medium text-on-surface-variant underline"
      >
        Forgot password?
      </Link>
    </main>
  );
}
