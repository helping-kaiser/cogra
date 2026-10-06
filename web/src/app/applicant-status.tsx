"use client";

// The applicant's cards in the member shell (auth.md "The applicant
// experience"; Android's ApplicantStatus): per progress state, the one
// thing that moves the application forward.

import Link from "next/link";
import { useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { resendVerificationEmail } from "@/lib/api/onboarding-api";
import type { RegistrationProgress } from "@/lib/signing/registration-signer";
import { Button, buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { TransportError } from "@/lib/ui/transport-error";

export function ApplicantStatus({ progress }: { progress: RegistrationProgress | null }) {
  const [waitingHintDismissed, setWaitingHintDismissed] = useState(false);

  if (progress === null) {
    return (
      <p role="status" data-testid="home_status_loading" className="text-body-medium text-on-surface-variant">
        Checking your application…
      </p>
    );
  }

  switch (progress.kind) {
    case "member":
      return null;
    case "awaitingLanding":
      return (
        <p role="status" data-testid="home_landing" className="text-body-medium">
          Approved! Your registration is landing — this usually takes a moment.
        </p>
      );
    case "awaitingSigningKey":
      // The restore card rides the screen's collapsing top (the
      // keyless read from the identity store covers this state).
      return null;
    case "rejectedByDevice":
      return (
        <p role="alert" data-testid="home_application_rejected" className="text-body-medium text-error">
          This device refused to sign your registration — the server returned something it never
          agreed to. Sign out and back in to retry once the application re-stages.
        </p>
      );
    case "refused":
      return (
        <p role="alert" data-testid="home_application_refused" className="text-body-medium text-error">
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
          {/* keyAttached && !keyOnDevice: the restore ask rides the
              screen's collapsing top, not this stack. */}
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
      <h2 className="text-title-medium">Verify your email</h2>
      <p data-testid="home_verify" className="text-body-medium text-on-surface-variant">
        We sent you a verification link — open it to prove this email is yours. An account left
        unverified for seven days is removed — joining again then starts over.
      </p>
      <form onSubmit={onResend} className="flex flex-col gap-2" noValidate>
        <label htmlFor="resend-email" className="text-label-large">
          Didn&apos;t get it? Your email
        </label>
        <input
          id="resend-email"
          data-testid="resend_email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          className="rounded-extra-small border border-outline bg-transparent px-3 py-2"
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
          <p role="status" data-testid="verify_resent" className="text-body-medium text-on-surface-variant">
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
      <h2 className="text-title-medium">Create your key</h2>
      <p className="text-body-medium text-on-surface-variant">
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
      <h2 className="text-title-medium">This browser&apos;s key belongs to another account</h2>
      <p data-testid="home_key_elsewhere" className="text-body-medium text-on-surface-variant">
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
      <h2 className="text-title-medium">Your key isn&apos;t on this browser</h2>
      <p className="text-body-medium text-on-surface-variant">
        Restore it with your recovery code to post, vouch, and act.
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
      <h2 data-testid="home_waiting" className="text-title-medium">
        All set — waiting on your inviter
      </h2>
      <p className="text-body-medium text-on-surface-variant">
        Both proofs are in. Your inviter approves your application next; meanwhile, look around.
      </p>
      <Button testId="home_waiting_dismiss" variant="outline" size="sm" selfStart onClick={onDismiss}>
        Got it
      </Button>
    </Card>
  );
}

