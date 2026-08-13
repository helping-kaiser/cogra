"use client";

// Invite check + apply (Android's InviteEntry/Apply folded into the
// link route — the route carries the id, so the paste box lives on the
// front door; auth.md "Expiry", web.md "Routes").

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { AccountState, ErrorCode } from "@/__generated__/graphql";
import { fetchMe } from "@/lib/api/auth-api";
import {
  applyWithInvite,
  checkInviteLink,
  register,
  type InviteCheck,
} from "@/lib/api/onboarding-api";
import { extractInviteId } from "@/lib/onboarding/invite-input";
import { deviceLabel } from "@/lib/session/device-label";
import { useAuthPhase, useTokenStore } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { useRegistrationFlow } from "@/lib/signing/provider";
import { Button } from "@/lib/ui/button";
import { fallbackMessage, rearmMessage } from "@/lib/ui/error-messages";
import { PasswordField } from "@/lib/ui/password-field";
import { TransportError } from "@/lib/ui/transport-error";

function applyMessage(code: ErrorCode): string {
  switch (code) {
    case "INVITE_UNUSABLE":
      return "This invite can't be used — it may have expired or been revoked.";
    case "HANDLE_TAKEN":
      return "That handle is taken.";
    case "EMAIL_IN_USE":
      return "That email already has an account.";
    case "WEAK_PASSWORD":
      return "That password is too easy to guess — pick a longer or less common one.";
    case "BAD_INPUT":
      return "Check the highlighted field.";
    default:
      return fallbackMessage(code);
  }
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
  const usable = check?.usable === true;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Join CoGra</h1>
      <p className="text-sm text-on-surface-variant">
        CoGra is invite-only: a member vouches for you, and their approval brings you in.
      </p>

      {inviteId === null && (
        <p role="alert" data-testid="invite_error" className="text-sm text-error">
          This isn&apos;t an invite link.
        </p>
      )}
      {inviteId !== null && checkState.status === "notFound" && (
        <p role="alert" data-testid="invite_error" className="text-sm text-error">
          This invite doesn&apos;t exist. Ask your inviter for a fresh link.
        </p>
      )}
      {check !== null && !check.usable && (
        <p role="alert" data-testid="invite_error" className="text-sm text-error">
          This invite can&apos;t be used — it may have expired or been revoked.
        </p>
      )}
      {checkState.status === "transportFailed" && (
        <TransportError testId="invite_transport_error" />
      )}
      {inviteId !== null && checkState.status === "checking" && (
        <p role="status" data-testid="invite_progress" className="text-sm text-on-surface-variant">
          Checking the invite…
        </p>
      )}

      {usable && (
        <p data-testid="invite_inviter" className="text-sm">
          @{check?.inviterHandle} is vouching for you.
        </p>
      )}

      {usable && inviteId !== null && phase === "signedOut" && <ApplyForm inviteId={inviteId} />}
      {usable && inviteId !== null && phase === "signedIn" && accountState === "APPLICANT" && (
        <RearmPanel inviteId={inviteId} />
      )}
      {phase === "signedIn" && accountState === "MEMBER" && (
        <>
          <p data-testid="join_member_note" className="text-sm">
            You&apos;re already a member, so this invite isn&apos;t for you — it brings someone new
            in.
          </p>
          <Link
            href="/invites"
            data-testid="join_member_invites"
            className="text-sm text-on-surface-variant underline"
          >
            Invite someone from your own Invites page
          </Link>
        </>
      )}

      {phase === "signedOut" && (
        <Link
          href="/login"
          data-testid="invite_login"
          className="text-sm text-on-surface-variant underline"
        >
          Already a member? Sign in
        </Link>
      )}
    </main>
  );
}

function ApplyForm({ inviteId }: { inviteId: string }) {
  const client = useApolloClient();
  const store = useTokenStore();
  const router = useRouter();

  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inProgress, setInProgress] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const [transportFailed, setTransportFailed] = useState(false);

  const formValid = handle.length >= 3 && email.includes("@") && password.length >= 12;
  const canSubmit = formValid && !inProgress;

  const clearErrors = () => {
    setError(null);
    setErrorField(null);
    setTransportFailed(false);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setInProgress(true);
    clearErrors();
    const outcome = await register(client, {
      inviteLink: inviteId,
      handle: handle.trim(),
      email: email.trim(),
      password,
      deviceLabel: deviceLabel(),
    });
    setInProgress(false);
    switch (outcome.kind) {
      case "success":
        store.save(outcome.value);
        router.replace("/");
        break;
      case "refused": {
        setError(outcome.errors[0].code);
        setErrorField(outcome.errors[0].field?.at(-1) ?? null);
        break;
      }
      case "failed":
        setTransportFailed(true);
        break;
    }
  };

  const fieldClass = (name: string) =>
    `rounded-md border bg-transparent px-3 py-2 ${
      errorField === name
        ? "border-error"
        : "border-outline"
    }`;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="handle" className="text-sm font-medium">
          Handle
        </label>
        <input
          id="handle"
          data-testid="apply_handle"
          type="text"
          value={handle}
          onChange={(event) => {
            setHandle(event.target.value.toLowerCase());
            clearErrors();
          }}
          autoComplete="username"
          className={fieldClass("handle")}
          aria-describedby="handle-rules"
        />
        <p id="handle-rules" className="text-xs text-on-surface-variant">
          3–30 characters: a–z, 0–9, _
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          data-testid="apply_email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearErrors();
          }}
          autoComplete="email"
          className={fieldClass("email")}
        />
      </div>
      <div className="flex flex-col gap-1">
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            clearErrors();
          }}
          autoComplete="new-password"
          testId="apply_password"
        />
        <p className="text-xs text-on-surface-variant">At least 12 characters.</p>
      </div>
      {error !== null && (
        <p role="alert" data-testid="apply_error" className="text-sm text-error">
          {applyMessage(error)}
        </p>
      )}
      {transportFailed && <TransportError testId="apply_transport_error" />}
      {inProgress && (
        <p role="status" data-testid="apply_progress" className="text-sm text-on-surface-variant">
          Creating your account…
        </p>
      )}
      <Button type="submit" testId="apply_continue" disabled={!canSubmit}>
        Create account
      </Button>
    </form>
  );
}

function RearmPanel({ inviteId }: { inviteId: string }) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const flow = useRegistrationFlow();
  const router = useRouter();

  const [inProgress, setInProgress] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [transportFailed, setTransportFailed] = useState(false);

  const onRearm = async () => {
    if (inProgress) return;
    setInProgress(true);
    setError(null);
    setTransportFailed(false);
    const outcome = await guard.run(() => applyWithInvite(client, inviteId));
    setInProgress(false);
    switch (outcome.kind) {
      case "success":
        flow.ensureAdvancing();
        router.replace("/");
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
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        You&apos;re signed in. If your application expired, this invite re-arms it.
      </p>
      {error !== null && (
        <p role="alert" data-testid="rearm_error" className="text-sm text-error">
          {rearmMessage(error)}
        </p>
      )}
      {transportFailed && <TransportError testId="rearm_transport_error" />}
      {inProgress && (
        <p role="status" data-testid="rearm_progress" className="text-sm text-on-surface-variant">
          Applying the invite…
        </p>
      )}
      <Button testId="rearm_submit" onClick={onRearm} disabled={inProgress}>
        Use this invite
      </Button>
    </div>
  );
}
