"use client";

// SIGN IN (design/designs/canonical/screens/SignIn.jsx; behavior/SignIn.md,
// SignInError.md, SignInLimited.md) on the task page's anatomy — Back to the
// bare view, the welcome lead, the fields, the commit that waits, and the link
// stack flush with the gutter (Android's LoginScreen/LoginViewModel). Success
// only writes the token store (phase flips navigate: web.md "Routes") — the
// signed-in redirect below covers a fresh login and an already-signed-in
// visit.
//
// THE DEVICE LOCK'S LEG RIDES INSIDE THE PRESS (sign-out-custody §3.5). The
// fresh session is held, NOT committed, while the leg runs: a locked slot of
// this account is released with the password still in hand and put back,
// and a ticked "don't remember" obtains its lock — the sign-in refuses to
// complete until one is held (PR-61). Only then are the tokens committed, so
// no signed-in render ever reads a locked slot. A leg that gets no answer
// keeps the session and says the drawn no-answer line; the retry press runs
// the leg again without a second login (SignIn.md:71).

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
import { Checkbox } from "@/lib/ui2/checkbox";
import { FormPasswordField, FormTextField } from "@/lib/ui2/form-fields";
import { LinkRow, LinkStack } from "@/lib/ui2/link-stack";
import { TaskPage } from "@/lib/ui2/task-page";
import { WaitingCommit } from "@/lib/ui2/waiting-commit";

// Where `make web-apk` stages the Android debug APK (development.md
// "Reaching the web dev server from the phone").
const APK_HREF = "/downloads/app-debug.apk";

/** SignIn.md:71 — the drawn line when no answer reaches the device. */
const NO_ANSWER = "That didn't send. Try again.";

function loginMessage(code: ErrorCode): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "That email and password don't match.";
    // The login backoff (SignInLimited.md): no figure, no countdown, the same
    // whether or not the email has an account.
    case "RATE_LIMITED":
      return "Too many tries in a row. Wait a moment, then try again.";
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

  const canSubmit = email !== "" && password !== "" && !inProgress;

  /** Credentials changed: a session held for the old ones is not this sign-in's. */
  const dropHeld = () => {
    held.current = null;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setInProgress(true);
    // A line the server answered stands until this press, never cleared by
    // typing (SignIn.md: only a local format line re-checks live).
    setError(null);
    setTransportFailed(false);
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
    <TaskPage
      backHref="/feed"
      backLabel="Back"
      title="Sign in to CoGra"
      lead="Welcome back — your feed is where you left it."
    >
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <FormTextField
          label="Email"
          kind="email"
          autoComplete="username"
          value={email}
          onChange={(value) => {
            setEmail(value);
            dropHeld();
          }}
          testId="login_email"
        />
        <FormPasswordField
          label="Password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            dropHeld();
          }}
          autoComplete="current-password"
          testId="login_password"
        />
        <Checkbox
          label="Don't remember this account on this device"
          checked={dontRemember}
          onChange={setDontRemember}
          testId="login_dont_remember"
        />
        {/* THE ONE FAULT SLOT, right above Sign in (SignInError.jsx): the
            refusal, the backoff and the no-answer line all stand here, each
            until the next press. */}
        {error !== null && (
          <p role="alert" data-testid="login_error" className="m-0 text-body-medium text-error">
            {loginMessage(error)}
          </p>
        )}
        {transportFailed && (
          <p role="alert" data-testid="login_transport_error" className="m-0 text-body-medium text-error">
            {NO_ANSWER}
          </p>
        )}
        <WaitingCommit
          label="Sign in"
          busyLabel="Signing in…"
          reason="Waiting for your email and password"
          waiting={email === "" || password === ""}
          busy={inProgress}
          testId="login_submit"
        />
      </form>
      <LinkStack>
        <LinkRow href="/reset" testId="login_forgot">
          Forgot password?
        </LinkRow>
        <LinkRow href="/join" testId="login_join">
          New here? Enter your invite
        </LinkRow>
        <LinkRow href="/feed" testId="login_browse">
          Just looking? Browse the feed →
        </LinkRow>
        {/* A static file under public/, staged by `make web-apk` — a plain
            anchor, since it leaves the router entirely. */}
        <LinkRow href={APK_HREF} download testId="login_android_apk">
          On Android? Download the app (APK)
        </LinkRow>
      </LinkStack>
    </TaskPage>
  );
}
