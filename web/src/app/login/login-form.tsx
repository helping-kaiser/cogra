"use client";

// Login (Android's LoginScreen/LoginViewModel). Success only writes the
// token store; the phase flip navigates — the signed-in redirect below
// covers both a fresh login and an already-signed-in visit.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { ErrorCode } from "@/__generated__/graphql";
import { logIn } from "@/lib/api/auth-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { deviceLabel } from "@/lib/session/device-label";
import { useAuthPhase, useTokenStore } from "@/lib/session/provider";
import { PasswordField } from "@/lib/ui/password-field";

function loginMessage(code: ErrorCode): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "That email and password don't match.";
    case "RATE_LIMITED":
      return "Too many attempts — wait a moment and try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

export function LoginForm({
  identity = identityStore,
}: {
  /** Test injection, as SessionProvider's store. */
  identity?: IdentityStore;
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
        store.save(outcome.value);
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
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to CoGra</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            data-testid="login_email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearErrors();
            }}
            autoComplete="email"
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </div>
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
        <label htmlFor="dont-remember" className="flex items-center gap-2 text-sm">
          <input
            id="dont-remember"
            data-testid="login_dont_remember"
            type="checkbox"
            checked={dontRemember}
            onChange={(event) => setDontRemember(event.target.checked)}
            className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
          />
          Don&apos;t remember this account on this device
        </label>
        {error !== null && (
          <p role="alert" data-testid="login_error" className="text-sm text-red-600 dark:text-red-400">
            {loginMessage(error)}
          </p>
        )}
        {transportFailed && (
          <p
            role="alert"
            data-testid="login_transport_error"
            className="text-sm text-red-600 dark:text-red-400"
          >
            Can&apos;t reach the server. Check your connection and try again.
          </p>
        )}
        {inProgress && (
          <p role="status" data-testid="login_progress" className="text-sm text-zinc-600 dark:text-zinc-400">
            Signing in…
          </p>
        )}
        <button
          type="submit"
          data-testid="login_submit"
          disabled={!canSubmit}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-zinc-50 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Sign in
        </button>
      </form>
      <Link
        href="/reset"
        data-testid="login_forgot"
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        Forgot password?
      </Link>
    </main>
  );
}
