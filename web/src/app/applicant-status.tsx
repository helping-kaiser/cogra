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
import { Button, buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { rearmMessage as sharedRearmMessage } from "@/lib/ui/error-messages";
import { TransportError } from "@/lib/ui/transport-error";

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
        <TransportError
          testId="home_application_offline"
          message="Can't reach the server. Your application resumes when the connection is back."
        />
      );
    case "awaitingApproval": {
      const { emailVerified, keyAttached, keyOnDevice } = progress;
      return (
        <div className="flex flex-col gap-4">
          {!emailVerified && <VerifyCard />}
          {!keyAttached && !keyOnDevice && <CeremonyCard />}
          {!keyAttached && keyOnDevice && <KeyElsewhereCard />}
          {keyAttached && !keyOnDevice && <RestoreCard />}
          {keyAttached && keyOnDevice && emailVerified && !waitingHintDismissed && (
            <WaitingHint onDismiss={() => setWaitingHintDismissed(true)} />
          )}
        </div>
      );
    }
  }
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
        <Button
          type="submit"
          testId="verify_resend"
          variant="outline"
          size="sm"
          selfStart
          disabled={email.trim() === "" || resending}
        >
          Resend the link
        </Button>
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
        className={buttonClassName({ size: "sm", selfStart: true })}
      >
        Create the key
      </Link>
    </Card>
  );
}

function KeyElsewhereCard() {
  return (
    <Card>
      <h2 className="font-medium">This browser&apos;s key belongs to another account</h2>
      <p data-testid="home_key_elsewhere" className="text-sm text-zinc-600 dark:text-zinc-400">
        A signing key can only ever back one account, so this account needs its own. Creating a
        fresh key replaces the stored one — the other account&apos;s key stays restorable with its
        recovery code.
      </p>
      <Link
        href="/key"
        data-testid="home_fresh_key"
        className={buttonClassName({ size: "sm", selfStart: true })}
      >
        Create a fresh key
      </Link>
    </Card>
  );
}

export function RestoreCard() {
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
        className={buttonClassName({ size: "sm", selfStart: true })}
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
      <Button testId="home_waiting_dismiss" variant="outline" size="sm" selfStart onClick={onDismiss}>
        Got it
      </Button>
    </Card>
  );
}

function rearmMessage(code: ErrorCode | "MALFORMED"): string {
  if (code === "MALFORMED") {
    return "That doesn't look like an invite — paste the whole link or its code.";
  }
  return sharedRearmMessage(code);
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
        <Button
          type="submit"
          testId="rearm_submit"
          size="sm"
          selfStart
          disabled={input.trim() === "" || rearming}
        >
          Re-arm my application
        </Button>
      </form>
    </Card>
  );
}
