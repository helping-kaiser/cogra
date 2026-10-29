"use client";

// JOIN (design/designs/canonical/screens/Join.jsx, JoinErrors.jsx; behavior/
// Join.md, JoinErrors.md): the invite link's check, then the application form
// under its inviter's face — Android's InviteEntry/Apply folded into the link
// route, since the route carries the id (web.md "Routes").
//
// A LINK THAT CANNOT BE USED reads JoinInvalid: the invite door's own field
// and ways out under its heading (`InviteEntry invalid`), so a different link
// can be pasted right there.
//
// THE FIELDS ANSWER ON THE PRESS. Typing never marks a field before the next
// press of Create account; a press checks the handle's, the email's and the
// password's shape here, and only a well-formed form goes out. A local format
// line re-checks as the text changes once it stands; a line the server
// answered (a taken handle or email, a breached password, no answer) stands
// until the next press.
//
// WHAT WAS TYPED OUTLIVES A WAY OUT (Join.md): leaving by the "?", Sign in or
// the back arrow and coming back in the same session finds the handle and the
// email as they were and the password empty; a cold start finds nothing. The
// memory is this module's, so it lives exactly as long as the loaded app.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { AccountState, ErrorCode } from "@/__generated__/graphql";
import { fetchMe } from "@/lib/api/auth-api";
import { checkInviteLink, register, type InviteCheck } from "@/lib/api/onboarding-api";
import { extractInviteId } from "@/lib/onboarding/invite-input";
import { emailValid, handleValid, passwordLength } from "@/lib/onboarding/registration-rules";
import { deviceLabel } from "@/lib/session/device-label";
import { useAuthPhase, useTokenStore } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { LINK_ROW } from "@/lib/ui2/link-stack";
import { FormPasswordField, FormTextField } from "@/lib/ui2/form-fields";
import { HelpDot } from "@/lib/ui2/help-dot";
import { MonogramAvatar } from "@/lib/ui2/monogram-avatar";
import { NO_ANSWER, NOT_THROUGH, RATE_LIMITED_LINE, TaskPage } from "@/lib/ui2/task-page";
import { WaitingCommit } from "@/lib/ui2/waiting-commit";
import { buttonClassName } from "@/lib/ui/button";
import { TransportError } from "@/lib/ui/transport-error";

import { InviteEntry } from "../invite-entry";

const HANDLE_SHAPE = "A handle is 3–30 characters: a–z, 0–9, _.";
const EMAIL_SHAPE = "That doesn't look like an email address.";
const LENGTH_LINES = {
  short: "A password is at least 12 characters.",
  long: "A password is at most 128 characters.",
} as const;
const HANDLE_TAKEN = "That handle is taken.";
const EMAIL_IN_USE = "That email already has an account.";
const BREACHED = "That password has turned up in a data breach — pick another one.";

/** The form's handle and email, kept across a way out within the session. */
const typed = { handle: "", email: "" };

/** Drops what the form kept — on an account made, and between tests. */
export function forgetTyped() {
  typed.handle = "";
  typed.email = "";
}

type CheckState =
  | { status: "checking" }
  | { status: "found"; check: InviteCheck }
  | { status: "notFound" }
  | { status: "transportFailed" };

export function JoinView({ linkId }: { linkId: string }) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const phase = useAuthPhase();

  const inviteId = extractInviteId(linkId);

  // Acting is gated on the live account state, client-side (api-spec.md
  // "Errors are tiered": a FORBIDDEN from an ungated call is a client
  // bug). Null while signed out, resolving, or unreachable — no action
  // renders until the state is known.
  const [accountState, setAccountState] = useState<AccountState | null>(null);
  useEffect(() => {
    if (phase !== "signedIn") return;
    let cancelled = false;
    void guard
      .run(() => fetchMe(client))
      .then((outcome) => {
        if (!cancelled && outcome.kind === "success") {
          setAccountState(outcome.value.accountState);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [phase, client, guard]);

  const [checkState, setCheckState] = useState<CheckState>({ status: "checking" });
  // Reset during render when the route param changes — the App Router
  // reuses this component across /join/<id> navigations.
  const [checkedId, setCheckedId] = useState(inviteId);
  if (checkedId !== inviteId) {
    setCheckedId(inviteId);
    setCheckState({ status: "checking" });
  }
  // A registration refused as INVITE_UNUSABLE turns the form into the door.
  const [spent, setSpent] = useState(false);

  useEffect(() => {
    if (inviteId === null) return;
    let cancelled = false;
    void checkInviteLink(client, inviteId).then((outcome) => {
      if (cancelled) return;
      if (outcome.kind === "success") {
        setCheckState(outcome.value === null ? { status: "notFound" } : { status: "found", check: outcome.value });
      } else if (outcome.kind === "failed") {
        setCheckState({ status: "transportFailed" });
      } else {
        setCheckState({ status: "notFound" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, inviteId]);

  const check = checkState.status === "found" ? checkState.check : null;
  const unusable =
    inviteId === null || checkState.status === "notFound" || (check !== null && !check.usable) || spent;

  if (unusable) return <InviteEntry invalid />;

  if (check === null || inviteId === null) {
    // The check in flight, or unanswered — neither is drawn; the page stands
    // bare under its header with the shared lines.
    return (
      <TaskPage backHref="/join" backLabel="Back">
        {checkState.status === "transportFailed" ? (
          <TransportError testId="invite_transport_error" />
        ) : (
          <p role="status" data-testid="invite_progress" className="m-0 text-body-medium text-on-surface-variant">
            Checking the invite…
          </p>
        )}
      </TaskPage>
    );
  }

  return (
    <JoinPage inviteId={inviteId} inviter={check.inviterHandle}>
      {phase === "signedOut" && <ApplyForm inviteId={inviteId} onSpent={() => setSpent(true)} />}
      {phase === "signedIn" && accountState === "MEMBER" && (
        <div className="mt-8 flex flex-col gap-2">
          <p data-testid="join_member_note" className="m-0 text-body-medium">
            You&apos;re already a member, so this invite isn&apos;t for you — it brings someone new in.
          </p>
          <Link href="/invites" data-testid="join_member_invites" className={LINK_ROW}>
            Invite someone from your own Invites page
          </Link>
        </div>
      )}
    </JoinPage>
  );
}

/** The header with its "?", and the inviter's face and name over the form. */
function JoinPage({ inviteId, inviter, children }: { inviteId: string; inviter: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <TaskPage
      backHref="/join"
      backLabel="Back"
      headerAction={
        <HelpDot
          ariaLabel="About CoGra"
          onOpen={() => router.push(`/about?from=join&invite=${inviteId}`)}
          testId="join_help"
        />
      }
    >
      <div className="flex flex-col items-center text-center">
        <MonogramAvatar name={inviter} size={64} />
        <h1 data-testid="invite_inviter" className="m-0 mt-4 text-headline-small">
          @{inviter} invited you
        </h1>
        <p className="m-0 mt-2 text-body-medium text-on-surface-variant">
          CoGra is invite-only — a member vouches for you, and @{inviter}&apos;s approval brings you in.
        </p>
      </div>
      {children}
    </TaskPage>
  );
}

type FieldLines = { handle: string | null; email: string | null; password: string | null };
const NO_LINES: FieldLines = { handle: null, email: null, password: null };

/** The local format lines a press says, by field — null where a field is well-formed. */
function shapeLines(handle: string, email: string, password: string): FieldLines {
  const length = passwordLength(password);
  return {
    handle: handleValid(handle) ? null : HANDLE_SHAPE,
    email: emailValid(email) ? null : EMAIL_SHAPE,
    password: length === "ok" ? null : LENGTH_LINES[length],
  };
}

function refusalLine(code: ErrorCode): { field: keyof FieldLines; line: string } | { fault: string } | "spent" {
  switch (code) {
    case "HANDLE_TAKEN":
      return { field: "handle", line: HANDLE_TAKEN };
    case "EMAIL_IN_USE":
      return { field: "email", line: EMAIL_IN_USE };
    case "WEAK_PASSWORD":
      return { field: "password", line: BREACHED };
    case "INVITE_UNUSABLE":
      return "spent";
    case "RATE_LIMITED":
      return { fault: RATE_LIMITED_LINE };
    default:
      return { fault: NOT_THROUGH };
  }
}

function ApplyForm({ inviteId, onSpent }: { inviteId: string; onSpent: () => void }) {
  const client = useApolloClient();
  const store = useTokenStore();
  const router = useRouter();

  const [handle, setHandleState] = useState(typed.handle);
  const [email, setEmailState] = useState(typed.email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  /** Lines a press's own check said — they re-check as the text changes. */
  const [local, setLocal] = useState<FieldLines>(NO_LINES);
  /** Lines the server answered — they stand until the next press. */
  const [answered, setAnswered] = useState<FieldLines>(NO_LINES);
  const [fault, setFault] = useState<string | null>(null);

  const setHandle = (value: string) => {
    const next = value.toLowerCase();
    typed.handle = next;
    setHandleState(next);
    if (local.handle !== null) setLocal({ ...local, handle: handleValid(next) ? null : HANDLE_SHAPE });
  };
  const setEmail = (value: string) => {
    typed.email = value;
    setEmailState(value);
    if (local.email !== null) setLocal({ ...local, email: emailValid(value) ? null : EMAIL_SHAPE });
  };
  const onPassword = (value: string) => {
    setPassword(value);
    if (local.password !== null) {
      const length = passwordLength(value);
      setLocal({ ...local, password: length === "ok" ? null : LENGTH_LINES[length] });
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || handle === "" || email === "" || password === "") return;
    setAnswered(NO_LINES);
    setFault(null);
    const lines = shapeLines(handle.trim(), email.trim(), password);
    setLocal(lines);
    if (lines.handle !== null || lines.email !== null || lines.password !== null) return;
    setBusy(true);
    const outcome = await register(client, {
      inviteLink: inviteId,
      handle: handle.trim(),
      email: email.trim(),
      password,
      deviceLabel: deviceLabel(),
    });
    setBusy(false);
    switch (outcome.kind) {
      case "success":
        forgetTyped();
        store.save(outcome.value);
        router.replace("/");
        return;
      case "refused": {
        const refusal = refusalLine(outcome.errors[0].code);
        if (refusal === "spent") onSpent();
        else if ("fault" in refusal) setFault(refusal.fault);
        else setAnswered({ ...NO_LINES, [refusal.field]: refusal.line });
        return;
      }
      case "failed":
        setFault(NO_ANSWER);
        return;
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col" noValidate>
      <div className="mt-8 flex flex-col gap-4">
        <FormTextField
          label="Handle"
          kind="handle"
          value={handle}
          onChange={setHandle}
          hint="3–30 characters: a–z, 0–9, _"
          error={answered.handle ?? local.handle}
          testId="apply_handle"
        />
        <FormTextField
          label="Email"
          kind="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
          error={answered.email ?? local.email}
          testId="apply_email"
        />
        <FormPasswordField
          label="Password"
          value={password}
          onChange={onPassword}
          autoComplete="new-password"
          hint="At least 12 characters."
          error={answered.password ?? local.password}
          testId="apply_password"
        />
      </div>
      <div className="mt-6 flex flex-col gap-2">
        {fault !== null && (
          <p role="alert" data-testid="apply_error" className="m-0 text-body-medium text-error">
            {fault}
          </p>
        )}
        {/* THE TERMS ARE ACCEPTED BY THE PRESS (Join.md: no checkbox): the
            line stands directly above Create account. The documents are not
            written yet, so their doors open nothing (Settings' Privacy and
            Terms rows, the same drift). */}
        <p className="m-0 text-center text-body-small text-on-surface-variant">
          By creating your account you accept the{" "}
          <button type="button" className="cg-focus border-0 bg-transparent p-0 text-primary underline" data-testid="join_terms">
            Terms
          </button>
          .
        </p>
        <WaitingCommit
          label="Create account"
          busyLabel="Creating account…"
          reason="Waiting for a handle, your email and a password"
          waiting={handle === "" || email === "" || password === ""}
          busy={busy}
          testId="apply_continue"
        />
        <Link href="/login" data-testid="invite_login" className={`${buttonClassName({ variant: "text" })} w-full`}>
          Already have an account? Sign in
        </Link>
        <p className="m-0 text-center text-body-small text-on-surface-variant">
          How CoGra handles your data: the{" "}
          <button type="button" className="cg-focus border-0 bg-transparent p-0 text-primary underline" data-testid="join_privacy">
            Privacy Policy
          </button>
          .
        </p>
      </div>
    </form>
  );
}
