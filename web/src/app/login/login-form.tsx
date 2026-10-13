"use client";

// Login (Android's LoginScreen/LoginViewModel). Success only writes the
// token store (phase flips navigate: web.md "Routes") — the signed-in
// redirect below covers a fresh login and an already-signed-in visit.
//
// THE DEVICE LOCK'S LEG RIDES INSIDE THE PRESS (sign-out-custody §3.5). The
// fresh session is held, NOT committed, while the leg runs: a locked slot of
// this account is released with the password still in hand and put back,
// and a ticked "don't remember" obtains its lock — the sign-in refuses to
// complete until one is held (PR-61). Only then are the tokens committed, so
// no signed-in render ever reads a locked slot. A leg that gets no answer
// keeps the session and says the drawn no-answer line; the retry press runs
// the leg again without a second login (SignIn.md:71).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { ErrorCode } from "@/__generated__/graphql";
import { fallbackMessage } from "@/lib/ui/error-messages";
import { logIn, type LoginGrant } from "@/lib/api/auth-api";
import type { DeviceLockEngine } from "@/lib/identity/device-lock";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { deviceLabel } from "@/lib/session/device-label";
import { afterSignIn } from "@/lib/session/held-link";
import { useAuthPhase, useTokenStore } from "@/lib/session/provider";
import { useDeviceLock } from "@/lib/session/runtime";
import { securityNotices, type SecurityNotices } from "@/lib/session/security-notices";
import { Button } from "@/lib/ui/button";
import { PasswordField } from "@/lib/ui/password-field";
import { TextField } from "@/lib/ui/text-field";
import { TransportError } from "@/lib/ui/transport-error";

// Where `make web-apk` stages the Android debug APK (development.md
// "Reaching the web dev server from the phone").
const APK_HREF = "/downloads/app-debug.apk";

/** SignIn.md:71 — the drawn line when no answer reaches the device. */
const NO_ANSWER = "That didn't send. Try again.";

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
  deviceLock,
}: {
  /** Test injection. */
  identity?: IdentityStore;
  notices?: SecurityNotices;
  deviceLock?: DeviceLockEngine;
} = {}) {
  const client = useApolloClient();
  const store = useTokenStore();
  const phase = useAuthPhase();
  const router = useRouter();
  const clientLock = useDeviceLock();
  const lock = deviceLock ?? clientLock;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dontRemember, setDontRemember] = useState(false);
  const [inProgress, setInProgress] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [transportFailed, setTransportFailed] = useState(false);
  /** A session the leg did not finish with — the retry runs the leg again on it. */
  const held = useRef<LoginGrant | null>(null);
  /** PR-62's dead lock, seen on an earlier press of this sign-in and not yet said. */
  const lockLost = useRef(false);

  useEffect(() => {
    // A sign-in begun from the email change's signed-out landing goes back
    // to it, where the held link's side applies (`held-link.ts`).
    if (phase === "signedIn") router.replace(afterSignIn());
  }, [phase, router]);

  const canSubmit = email.trim() !== "" && password !== "" && !inProgress;

  const clearErrors = () => {
    setError(null);
    setTransportFailed(false);
  };

  /** Credentials changed: a session held for the old ones is not this sign-in's. */
  const dropHeld = () => {
    held.current = null;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setInProgress(true);
    clearErrors();
    let grant = held.current;
    if (grant === null) {
      const outcome = await logIn(client, email.trim(), password, deviceLabel());
      if (outcome.kind !== "success") {
        setInProgress(false);
        if (outcome.kind === "refused") setError(outcome.errors[0].code);
        else setTransportFailed(true);
        return;
      }
      grant = outcome.value;
    }
    const { accountId, accessToken } = grant.auth;
    let leg: { ready: boolean; lockLost: boolean };
    try {
      leg = await lock.signIn(accountId, password, accessToken, dontRemember);
    } catch {
      leg = { ready: false, lockLost: false };
    }
    if (leg.lockLost) lockLost.current = true;
    if (!leg.ready) {
      held.current = grant;
      setInProgress(false);
      setTransportFailed(true);
      return;
    }
    held.current = null;
    setInProgress(false);
    // The notices post before the token save: saving flips the auth phase
    // and this form unmounts on the redirect, so the shell's banner must
    // already be pending (auth.md "Reuse detection" — delivered exactly
    // once, a dropped notice never comes back).
    if (grant.reuseDetectedAt !== null) notices.post(grant.reuseDetectedAt);
    if (lockLost.current) {
      lockLost.current = false;
      notices.postLockLost();
    }
    store.save(grant.auth);
    // Recorded per account, after save() sets the active account custody
    // resolves by — always written, so an unchecked login clears an
    // earlier flag (auth.md "Sign-out").
    await identity.setEphemeral(dontRemember);
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
            dropHeld();
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
            dropHeld();
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
        {transportFailed && <TransportError testId="login_transport_error" message={NO_ANSWER} />}
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
      <Link
        href="/join"
        data-testid="login_join"
        className="text-body-medium text-on-surface-variant underline"
      >
        New here? Enter your invite
      </Link>
      <Link
        href="/feed"
        data-testid="login_browse"
        className="text-body-medium text-on-surface-variant underline"
      >
        Just looking? Browse the feed →
      </Link>
      {/* A static file under public/, staged by `make web-apk` — a plain
          anchor, not next/link, since it leaves the router entirely. */}
      <a
        href={APK_HREF}
        download
        data-testid="login_android_apk"
        className="text-body-medium text-on-surface-variant underline"
      >
        On Android? Download the app (APK)
      </a>
    </main>
  );
}
