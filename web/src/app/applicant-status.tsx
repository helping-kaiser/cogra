"use client";

// The applicant's cards in the member shell (auth.md "The applicant
// experience": the application rides along as cards and dismissible
// hints — waiting is never a wall). Rendering mirrors Android's
// ApplicantStatus: per progress state, the one thing that moves the
// application forward.

import Link from "next/link";
import { useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { ErrorCode } from "@/__generated__/graphql";
import { applyWithInvite, resendVerificationEmail } from "@/lib/api/onboarding-api";
import { extractInviteId } from "@/lib/onboarding/invite-input";
import { useAuthGuard } from "@/lib/session/runtime";
import { useRegistrationFlow } from "@/lib/signing/provider";
import type { RegistrationProgress } from "@/lib/signing/registration-signer";

export function ApplicantStatus({ progress }: { progress: RegistrationProgress | null }) {
  const [waitingHintDismissed, setWaitingHintDismissed] = useState(false);

  if (progress === null) {
    return (
      <p role="status" data-testid="home_status_loading" className="text-sm text-zinc-600 dark:text-zinc-400">
        Checking your application…
      </p>
    );
  }

  switch (progress.kind) {
    case "member":
      return null;
    case "awaitingLanding":
      return (
        <p role="status" data-testid="home_landing" className="text-sm">
          Approved! Your registration is landing — this usually takes a moment.
        </p>
      );
    case "awaitingSigningKey":
      return <RestoreCard />;
    case "needsInvite":
      return <RearmCard />;
    case "rejectedByDevice":
      return (
        <p role="alert" data-testid="home_application_rejected" className="text-sm text-red-600 dark:text-red-400">
          This device refused to sign your registration — the server returned something it never
          agreed to. Sign out and back in to retry once the application re-stages.
        </p>
      );
    case "refused":
      return (
        <p role="alert" data-testid="home_application_refused" className="text-sm text-red-600 dark:text-red-400">
          Something went wrong with your application. Try again later.
        </p>
      );
    case "failed":
      return (
        <p role="alert" data-testid="home_application_offline" className="text-sm text-red-600 dark:text-red-400">
          Can&apos;t reach the server. Your application resumes when the connection is back.
        </p>
      );
    case "awaitingApproval": {
      const { emailVerified, keyAttached, keyOnDevice } = progress;
      return (
        <div className="flex flex-col gap-4">
          {!emailVerified && <VerifyCard />}
          {!keyAttached && !keyOnDevice && <CeremonyCard />}
          {keyAttached && !keyOnDevice && <RestoreCard />}
          {keyAttached && keyOnDevice && emailVerified && !waitingHintDismissed && (
            <WaitingHint onDismiss={() => setWaitingHintDismissed(true)} />
          )}
        </div>
      );
    }
  }
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-zinc-300 p-4 dark:border-zinc-700">
      {children}
    </section>
  );
}

function VerifyCard() {
  const client = useApolloClient();
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const onResend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (email.trim() === "" || resending) return;
    setResending(true);
    await resendVerificationEmail(client, email.trim());
    setResending(false);
    setResent(true);
  };

  return (
    <Card>
      <h2 className="font-medium">Verify your email</h2>
      <p data-testid="home_verify" className="text-sm text-zinc-600 dark:text-zinc-400">
        We sent you a verification link — open it to prove this email is yours. Unverified
        applications expire after 24 hours.
      </p>
      <form onSubmit={onResend} className="flex flex-col gap-2" noValidate>
        <label htmlFor="resend-email" className="text-sm font-medium">
          Didn&apos;t get it? Your email
        </label>
        <input
          id="resend-email"
          data-testid="resend_email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
        <button
          type="submit"
          data-testid="verify_resend"
          disabled={email.trim() === "" || resending}
          className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
        >
          Resend the link
        </button>
        {resent && (
          <p role="status" data-testid="verify_resent" className="text-sm text-zinc-600 dark:text-zinc-400">
            If that email has a pending application, a fresh link is on its way.
          </p>
        )}
      </form>
    </Card>
  );
}

function CeremonyCard() {
  return (
    <Card>
      <h2 className="font-medium">Create your key</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Your actor needs a signing key on this browser before your inviter can approve you.
      </p>
      <Link
        href="/key"
        data-testid="home_create_key"
        className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Create the key
      </Link>
    </Card>
  );
}

function RestoreCard() {
  return (
    <Card>
      <h2 className="font-medium">Your key isn&apos;t on this browser</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Your account exists, but its signing key lives elsewhere. Restore it with your recovery code
        to continue here.
      </p>
      <Link
        href="/restore"
        data-testid="home_restore"
        className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Restore the key
      </Link>
    </Card>
  );
}

function WaitingHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Card>
      <h2 data-testid="home_waiting" className="font-medium">
        All set — waiting on your inviter
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Both proofs are in. Your inviter approves your application next; meanwhile, look around.
      </p>
      <button
        type="button"
        data-testid="home_waiting_dismiss"
        onClick={onDismiss}
        className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700"
      >
        Got it
      </button>
    </Card>
  );
}

function rearmMessage(code: ErrorCode | "MALFORMED"): string {
  switch (code) {
    case "MALFORMED":
      return "That doesn't look like an invite — paste the whole link or its code.";
    case "INVITE_UNUSABLE":
      return "This invite can't be used — it may have expired or been revoked.";
    case "BAD_INPUT":
      return "Your application is still live — it doesn't need a fresh invite.";
    default:
      return "Something went wrong. Try again.";
  }
}

function RearmCard() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const flow = useRegistrationFlow();

  const [input, setInput] = useState("");
  const [rearming, setRearming] = useState(false);
  const [error, setError] = useState<ErrorCode | "MALFORMED" | null>(null);

  const onRearm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (input.trim() === "" || rearming) return;
    const id = extractInviteId(input);
    if (id === null) {
      setError("MALFORMED");
      return;
    }
    setRearming(true);
    setError(null);
    const outcome = await guard.run(() => applyWithInvite(client, id));
    setRearming(false);
    switch (outcome.kind) {
      case "success":
        setInput("");
        flow.ensureAdvancing();
        break;
      case "refused":
        setError(outcome.errors[0].code);
        break;
      case "failed":
        setError("INTERNAL");
        break;
    }
  };

  return (
    <Card>
      <h2 data-testid="home_rearm" className="font-medium">
        Your application needs a fresh invite
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        The invite behind your application ran out before approval. Paste a fresh one to re-arm it —
        your account, email verification, and key carry over.
      </p>
      <form onSubmit={onRearm} className="flex flex-col gap-2" noValidate>
        <label htmlFor="rearm-input" className="text-sm font-medium">
          Invite link
        </label>
        <input
          id="rearm-input"
          data-testid="rearm_input"
          type="text"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setError(null);
          }}
          autoComplete="off"
          spellCheck={false}
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
        {error !== null && (
          <p role="alert" data-testid="rearm_error" className="text-sm text-red-600 dark:text-red-400">
            {rearmMessage(error)}
          </p>
        )}
        {rearming && (
          <p role="status" data-testid="rearm_progress" className="text-sm text-zinc-600 dark:text-zinc-400">
            Applying the invite…
          </p>
        )}
        <button
          type="submit"
          data-testid="rearm_submit"
          disabled={input.trim() === "" || rearming}
          className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-50 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Re-arm my application
        </button>
      </form>
    </Card>
  );
}
