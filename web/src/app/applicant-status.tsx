"use client";

// The applicant's cards in the member shell (auth.md "The applicant
// experience"; Android's ApplicantStatus): per progress state, the one
// thing that moves the application forward.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { resendVerificationEmail } from "@/lib/api/onboarding-api";
import { ApplicationCard, type ApplicationSurface } from "./application-card";
import type { RegistrationProgress } from "@/lib/signing/registration-signer";
import { Button, buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { TransportError } from "@/lib/ui/transport-error";
import { NO_BACKUP_LINE } from "@/lib/ui/key-absent-notice";
import { Icon } from "@/lib/ui/icons";
import { pillClassName } from "@/lib/ui2/pill-button";
import { useOptionalStanceData } from "@/lib/stance/provider";

export function ApplicantStatus({
  progress,
  surface = "feed",
}: {
  progress: RegistrationProgress | null;
  /** Which screen the stack rides: the feed, or the reader's own profile. */
  surface?: ApplicationSurface;
}) {
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
          {/* THE APPLICATION CARD (ApplicantWaiting, ApplicantRejected): waiting
              once every owed step is done, closed whatever they are. */}
          <ApplicationCard
            surface={surface}
            stepsDone={keyAttached && keyOnDevice && emailVerified}
            refreshKey={progress}
          />
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

/**
 * THE KEY CARD (KeyElsewhere.md, KeyElsewhereNoBackup.md; `TaskCard`'s
 * `tone="notice"`): the account-notice register — the olive ground under the
 * task ring, the mark in the corner, and `Restore the key` filled in inverse.
 * It stands at the head of the feed until the key is restored here.
 *
 * WITH NO BACKUP there is nothing to restore from: the body says so and the
 * card carries no control. Which one stands is read once, as the card mounts
 * (the card never changes while the feed stands loaded); an unread answer
 * keeps the restore on offer.
 */
export function RestoreCard() {
  const data = useOptionalStanceData();
  const [backedUp, setBackedUp] = useState<boolean | null>(null);
  useEffect(() => {
    if (data === null) return undefined;
    let live = true;
    void data.keyBackedUp().then((backed) => {
      if (live) setBackedUp(backed);
    });
    return () => {
      live = false;
    };
  }, [data]);
  const noBackup = backedUp === false;
  return (
    <section
      data-testid={noBackup ? "home_key_no_backup" : "home_key_elsewhere_card"}
      className="cg-task-ring-notice flex flex-none flex-col gap-3 rounded-medium p-4 text-on-tertiary-container"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 text-title-medium">Your key isn&apos;t on this browser</h2>
        <span className="flex-none text-on-tertiary-container">
          <Icon name="mark" size={20} pickColor="var(--primary-container)" />
        </span>
      </div>
      <p className="m-0 text-body-medium">
        {noBackup
          ? NO_BACKUP_LINE
          : "Restore it with your recovery code to post, vouch, and act. Until then, anything you sign waits as pending."}
      </p>
      {!noBackup && (
        <div className="flex">
          <Link
            href="/restore"
            data-testid="home_restore"
            className={pillClassName({ variant: "inverse", size: "sm" })}
          >
            Restore the key
          </Link>
        </div>
      )}
    </section>
  );
}
