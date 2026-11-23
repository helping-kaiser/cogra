"use client";

// SIGN IN (design/designs/canonical/screens/SignIn.jsx; behavior/SignIn.md,
// SignInError.md, SignInExpired.md, SignInLimited.md) on the task page's anatomy — Back to the
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
//
// OVER THE JOIN LAYER (SignIn.md:7-11, :87): opened from the join form that
// stands over a signed-in account, SignIn is a layer too — the signed-in visit
// does not send it away, its arrow brings the form back, and a sign-in taken
// here switches this device to that account exactly as Create account does.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { ErrorCode } from "@/__generated__/graphql";
import { APK_HREF, APK_LINE } from "@/lib/ui/apk-download";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { fallbackMessage } from "@/lib/ui/error-messages";
import { logIn, type LoginGrant } from "@/lib/api/auth-api";
import type { DeviceLockEngine } from "@/lib/identity/device-lock";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { deviceLabel } from "@/lib/session/device-label";
import { takeSessionEnded } from "@/lib/session/ended-session";
import { afterSignIn } from "@/lib/session/held-link";
import { useAuthPhase, useTokenStore } from "@/lib/session/provider";
import { useDeviceLock } from "@/lib/session/runtime";
import { securityNotices, type SecurityNotices } from "@/lib/session/security-notices";
import { Checkbox } from "@/lib/ui2/checkbox";
import { FormPasswordField, FormTextField } from "@/lib/ui2/form-fields";
import { LinkRow, LinkStack } from "@/lib/ui2/link-stack";
import { TaskPage } from "@/lib/ui2/task-page";
import { useSlowAnswer, WaitingCommit } from "@/lib/ui2/waiting-commit";

/** The sign-in family's registered prefix — SignIn, SignInError, SignInExpired, SignInLimited (nodes.json `signIn`, round 28). */
const SIGN_IN: DataNode = { path: "signIn" };

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
  joinLayer = null,
  identity = identityStore,
  notices = securityNotices,
  deviceLock,
}: {
  /** The join form's address when SignIn opened from it over the signed-in state. */
  joinLayer?: string | null;
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

  /** SignInExpired: this sign-in opened because the session ended mid-use. */
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    // THE RULE IS DISABLED DELIBERATELY: the mark lives in this tab's
    // sessionStorage, which the server render cannot read, so it is read
    // after hydration — React's documented pattern for content that differs
    // between server and client (react.dev, hydrateRoot, "Handling different
    // client and server content").
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (takeSessionEnded()) setSignedOut(true);
  }, []);

  useEffect(() => {
    // A sign-in begun from the email change's signed-out landing goes back
    // to it, where the held link's side applies (`held-link.ts`).
    if (phase === "signedIn" && joinLayer === null) router.replace(afterSignIn());
  }, [phase, router, joinLayer]);

  const canSubmit = email !== "" && password !== "" && !inProgress;
  const fault = error !== null ? loginMessage(error) : transportFailed ? NO_ANSWER : null;
  // SignIn.md: the ways out refuse a press from 200ms after the press until the answer.
  const exitsHeld = useSlowAnswer(inProgress);

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
    // Over the join layer the signed-in phase does not flip, so the switch
    // is done here: the cache read as the other account is emptied before
    // this one renders, nothing is revoked, and the app opens where app-open
    // lands (SignIn.md:11).
    if (joinLayer !== null) await client.clearStore();
    store.save(grant.auth);
    // Recorded per account, after save() sets the active account custody
    // resolves by — always written, so an unchecked login clears an
    // earlier flag (auth.md "Sign-out").
    await identity.setEphemeral(dontRemember);
    if (joinLayer !== null) router.replace("/");
  };

  return (
    <TaskPage
      node={SIGN_IN}
      backHref={joinLayer ?? "/feed"}
      backLabel="Back"
      backHeld={exitsHeld}
      title="Sign in to CoGra"
      lead={signedOut ? "You've been signed out." : undefined}
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
          node={part(SIGN_IN, "email")}
        />
        <FormPasswordField
          label="Password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            dropHeld();
          }}
          autoComplete="current-password"
          node={part(SIGN_IN, "password")}
        />
        <Checkbox
          label="Don't remember this account on this device"
          checked={dontRemember}
          onChange={setDontRemember}
          node={part(SIGN_IN, "forget")}
        />
        {/* THE ONE FAULT SLOT, right above Sign in (SignInError.jsx,
            SignInLimited.jsx `fault`): the refusal, the backoff and the
            no-answer line all stand here, each until the next press. */}
        {fault !== null && (
          <p role="alert" {...testAttributes(part(SIGN_IN, "fault"))} className="m-0 text-body-medium text-error">
            {fault}
          </p>
        )}
        <WaitingCommit
          label="Sign in"
          busyLabel="Signing in…"
          reason="Waiting for your email and password"
          waiting={email === "" || password === ""}
          busy={inProgress}
          node={part(SIGN_IN, "commit")}
        />
      </form>
      <LinkStack>
        <LinkRow href="/reset" node={part(SIGN_IN, "forgot")} held={exitsHeld}>
          Forgot password?
        </LinkRow>
        <LinkRow href="/join" node={part(SIGN_IN, "invite")} held={exitsHeld}>
          New here? Enter your invite
        </LinkRow>
        <LinkRow href="/feed" node={part(SIGN_IN, "browse")} held={exitsHeld}>
          Just looking? Browse the feed →
        </LinkRow>
        {/* A static file under public/, staged by `make web-apk` — a plain
            anchor, since it leaves the router entirely. */}
        <LinkRow href={APK_HREF} download node={part(SIGN_IN, "apk")} held={exitsHeld}>
          {APK_LINE}
        </LinkRow>
      </LinkStack>
    </TaskPage>
  );
}
