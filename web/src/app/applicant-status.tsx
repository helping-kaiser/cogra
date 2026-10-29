"use client";

// THE APPLICANT'S CARDS IN THE MEMBER SHELL (design/designs/canonical/screens/
// ApplicantFeed.jsx, ApplicantLanding.jsx; their behavior sidecars; auth.md
// "The applicant experience"; Android's ApplicantStatus): per progress state,
// the one thing that moves the application forward, riding the feed as task
// cards above the posts.
//
// - `feed.verifyCard` while the email is not verified: it PRINTS THE ADDRESS
//   the link went to, beside `Wrong address?` (the applicant's own address
//   change), says the seven-day consequence once, and resends to that
//   address with the sent-shape snackbar naming it.
// - `feed.keyCard` while no key is attached: `Create my key` in `inverse` on
//   the account-notice olive, its body naming the approver.
// - `feed.application` once approved and landing — the landing card, no
//   control while the key is here.
// - the waiting and closed cards are `ApplicationCard`'s.
//
// The approver's handle and the account's address come from the two reads
// the cards already share (`MyApplication`, `SettingsAccount`); a card whose
// words need one waits for it rather than printing a placeholder.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchMyApplication } from "@/lib/api/invites-api";
import { resendVerificationEmail } from "@/lib/api/onboarding-api";
import { fetchSettingsAccount } from "@/lib/api/settings-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { ApplicationCard, type ApplicationSurface } from "./application-card";
import type { RegistrationProgress } from "@/lib/signing/registration-signer";
import { buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { TransportError } from "@/lib/ui/transport-error";
import { NO_BACKUP_LINE } from "@/lib/ui/key-absent-notice";
import { Icon } from "@/lib/ui/icons";
import { Snackbar } from "@/lib/ui/snackbar";
import { pillClassName } from "@/lib/ui2/pill-button";
import { TaskCard } from "@/lib/ui2/task-card";
import { NO_ANSWER } from "@/lib/ui2/task-page";
import { useOptionalStanceData } from "@/lib/stance/provider";

const VERIFY: DataNode = { path: "feed.verifyCard" };
const KEY: DataNode = { path: "feed.keyCard" };
const LANDING: DataNode = { path: "feed.application" };

/** The approver's `@handle`, read once from the application the cards share. */
function useApprover(refreshKey: unknown): string | null {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const [approver, setApprover] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void guard.run(() => fetchMyApplication(client)).then((outcome) => {
      const handle = outcome.kind === "success" ? outcome.value.application?.approver?.handle : undefined;
      if (live && handle !== undefined) setApprover(`@${handle}`);
    });
    return () => {
      live = false;
    };
  }, [client, guard, refreshKey]);
  return approver;
}

export function ApplicantStatus({
  progress,
  surface = "feed",
}: {
  progress: RegistrationProgress | null;
  /** Which screen the stack rides: the feed, or the reader's own profile. */
  surface?: ApplicationSurface;
}) {
  const approver = useApprover(progress?.kind);

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
      return approver === null ? null : (
        <TaskCard
          title="Approved — your registration is landing"
          body={`${approver} approved your application. Nothing is needed from you while it lands.`}
          node={LANDING}
          testId="home_landing"
        />
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
        <div className="flex flex-col gap-2">
          {!emailVerified && <VerifyCard />}
          {!keyAttached && !keyOnDevice && approver !== null && <CeremonyCard approver={approver} />}
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
  const guard = useAuthGuard();
  const [address, setAddress] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [snack, setSnack] = useState<{ message: string; token: number } | null>(null);

  useEffect(() => {
    let live = true;
    void guard.run(() => fetchSettingsAccount(client)).then((outcome) => {
      if (live && outcome.kind === "success") setAddress(outcome.value.email ?? null);
    });
    return () => {
      live = false;
    };
  }, [client, guard]);

  const say = (message: string) => setSnack((current) => ({ message, token: (current?.token ?? 0) + 1 }));

  const onResend = async () => {
    if (address === null || resending) return;
    setResending(true);
    const outcome = await resendVerificationEmail(client, address);
    setResending(false);
    say(outcome.kind === "failed" ? NO_ANSWER : `Sent — the link is on its way to ${address}.`);
  };

  return (
    <TaskCard
      tone="notice"
      title="Verify your email"
      body="We sent you a verification link — open it to prove this email is yours."
      node={VERIFY}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-body-medium [overflow-wrap:anywhere]" {...testAttributes(part(VERIFY, "address"))}>
          {address === null ? "" : `Sent to ${address}`}
        </span>
        <Link
          href="/settings/email/applicant"
          className="cg-state cg-focus cg-hit flex-none self-start font-sans text-label-small text-primary"
          {...testAttributes(part(VERIFY, "wrongAddress"))}
        >
          Wrong address?
        </Link>
      </div>
      <p className="m-0 text-body-small text-on-surface-variant" {...testAttributes(part(VERIFY, "note"))}>
        An account left unverified for seven days is removed — joining again then starts over.
      </p>
      <button
        type="button"
        onClick={() => void onResend()}
        aria-busy={resending || undefined}
        aria-disabled={resending || undefined}
        className={buttonClassName({ variant: "outline", selfStart: true })}
        {...testAttributes(part(VERIFY, "resend"), "verify_resend")}
      >
        Resend the link
      </button>
      <Snackbar
        testId="verify-card-snackbar"
        message={snack?.message ?? null}
        token={snack?.token}
        onDismiss={() => setSnack(null)}
      />
    </TaskCard>
  );
}

function CeremonyCard({ approver }: { approver: string }) {
  return (
    <TaskCard
      tone="notice"
      title="Create your key"
      body={`Your application needs a key on this browser before ${approver} can approve it.`}
      node={KEY}
    >
      <Link
        href="/key"
        className={`${pillClassName({ variant: "inverse" })} self-start`}
        {...testAttributes(part(KEY, "create"), "home_create_key")}
      >
        Create my key
      </Link>
    </TaskCard>
  );
}

/**
 * A key on this browser that belongs to another account — no board draws it.
 * The olive task card, in the words it has always had.
 */
function KeyElsewhereCard() {
  return (
    <TaskCard
      tone="notice"
      title="This browser's key belongs to another account"
      body="A signing key can only ever back one account, so this account needs its own. Creating a fresh key replaces the stored one — the other account's key stays restorable with its recovery code."
      testId="home_key_elsewhere"
    >
      <Link
        href="/key"
        data-testid="home_fresh_key"
        className={`${pillClassName({ variant: "inverse" })} self-start`}
      >
        Create a fresh key
      </Link>
    </TaskCard>
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
export function RestoreCard({ node }: { node?: DataNode } = {}) {
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
      // The registered card on the feed (`feed.keyCard`, KeyElsewhere and
      // KeyElsewhereNoBackup): one node in both readings, its `restore` only
      // where there is a backup to restore from.
      {...testAttributes(node, noBackup ? "home_key_no_backup" : "home_key_elsewhere_card")}
      className="cg-task-ring-notice flex flex-none flex-col gap-3 rounded-medium p-4 text-on-tertiary-container"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 text-title-medium" {...testAttributes(part(node, "title"))}>
          Your key isn&apos;t on this browser
        </h2>
        <span className="flex-none text-on-tertiary-container">
          <Icon name="mark" size={20} pickColor="var(--primary-container)" />
        </span>
      </div>
      <p className="m-0 text-body-medium" {...testAttributes(part(node, "body"))}>
        {noBackup
          ? NO_BACKUP_LINE
          : "Restore it with your recovery code to post, vouch, and act. Until then, anything you sign waits as pending."}
      </p>
      {!noBackup && (
        <div className="flex">
          <Link
            href="/restore"
            {...testAttributes(part(node, "restore"), "home_restore")}
            className={pillClassName({ variant: "inverse", size: "sm" })}
          >
            Restore the key
          </Link>
        </div>
      )}
    </section>
  );
}
