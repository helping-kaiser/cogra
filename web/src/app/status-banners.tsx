"use client";

// The account-status banners (Android's twin, design.md §6): the
// security notice, the application cards, and the member status —
// shell-scoped, riding above whichever tab is active until resolved
// (auth.md "The applicant experience": applicant vs member is cards,
// never navigation). The guarded Me read exercises refresh-and-replay;
// a refused read is a dead session — the phase flip handles it, the
// banners just stop loading.

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useApolloClient } from "@apollo/client/react";

import { fetchMe, type MeUser } from "@/lib/api/auth-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { securityNotices, type SecurityNotices } from "@/lib/session/security-notices";
import { useRegistrationFlow, useRegistrationProgress } from "@/lib/signing/provider";
import { TransportError } from "@/lib/ui/transport-error";
import { pillClassName } from "@/lib/ui2/pill-button";
import { TaskCard } from "@/lib/ui2/task-card";
import type { ApplicationSurface } from "./application-card";
import { ApplicantStatus } from "./applicant-status";
import { MemberStatus } from "./member-status";

/**
 * PR-62's one-time notice: the sign-in found this account's custody locked on
 * this browser, the server could no longer open the lock, and the locked copy
 * was deleted.
 *
 * PLACEHOLDER WORDS — ruled "words are design's" (seam 179 item 3; vehicle
 * ruled at seam 109 item 82) and not yet drawn. Held in this one constant so
 * the drawn sentence replaces it in one place.
 */
export const LOCK_LOST_NOTICE =
  "Your key was locked on this browser, but the lock can no longer be opened, so the locked copy is gone. If you made a recovery code, you can restore your key with it.";

/**
 * WHERE THE SECURITY NOTICE STANDS (FeedSecurityNotice.jsx: the card is
 * `FeedList`'s first child, full width, above the posts and above an
 * applicant's cards). A list that heads with it provides its head element
 * here and the card renders into it; without one (the profile) the card
 * stands where the banners are rendered.
 */
export const SecurityNoticeHead = createContext<HTMLElement | null>(null);

/**
 * THE SECURITY NOTICE (FeedSecurityNotice.jsx:36-44, FeedSecurityNotice.md):
 * the olive task card, in words that never name the token beneath a sign-in.
 * `Change password` (filled, the register's inverse) opens the credential
 * screen and leaves the notice standing; `Got it` (outlined) puts it away.
 */
function SecurityNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="alert" className="flex flex-col">
      <TaskCard
        tone="notice"
        title="We signed out every device"
        body="A sign-in this account had already replaced was used again, which can mean someone else had a copy. If your password might be known to anyone, change it."
        testId="security_notice"
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href="/settings/password"
            data-testid="security_notice_change_password"
            className={pillClassName({ variant: "inverse" })}
          >
            Change password
          </Link>
          <button
            type="button"
            data-testid="security_notice_dismiss"
            onClick={onDismiss}
            className={pillClassName({ variant: "outlined" })}
          >
            Got it
          </button>
        </div>
      </TaskCard>
    </div>
  );
}

export function StatusBanners({
  notices = securityNotices,
  surface = "feed",
}: {
  /** Test injection. */
  notices?: SecurityNotices;
  /** The screen the banners ride: the application card says it in that screen's words. */
  surface?: ApplicationSurface;
} = {}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const flow = useRegistrationFlow();
  const progress = useRegistrationProgress();

  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [transportFailed, setTransportFailed] = useState(false);
  const [welcome, setWelcome] = useState(false);

  const reuseDetectedAt = useSyncExternalStore(
    notices.subscribe,
    notices.reuseDetectedAt,
    () => null,
  );
  const lockLost = useSyncExternalStore(notices.subscribe, notices.lockLost, () => false);
  const noticeHead = useContext(SecurityNoticeHead);

  const refresh = useCallback(() => {
    let cancelled = false;
    void guard
      .run(() => fetchMe(client))
      .then((outcome) => {
        if (cancelled) return;
        setLoading(false);
        if (outcome.kind === "success") {
          setMe(outcome.value);
          setTransportFailed(false);
        } else if (outcome.kind === "failed") {
          setTransportFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, guard]);

  useEffect(() => refresh(), [refresh]);

  // The poll loop is an applicant-only mechanism: start (or poke) it
  // whenever the viewer turns out to be an applicant, never for a member.
  const isApplicant = me?.accountState === "APPLICANT";
  useEffect(() => {
    if (isApplicant) flow.ensureAdvancing();
  }, [isApplicant, flow]);

  // A landing watched live arrives as a flow notification: greet once
  // (consumeLanded is the one-shot filter — a cold open as member greets
  // nobody), then re-read the viewer, whose account state just flipped.
  useEffect(() => {
    return flow.subscribe(() => {
      if (flow.progress()?.kind !== "member") return;
      if (flow.consumeLanded()) setWelcome(true);
      refresh();
    });
  }, [flow, refresh]);

  return (
    <section aria-label="Account status" className="flex w-full flex-col gap-4">
      {reuseDetectedAt !== null &&
        (noticeHead === null ? (
          <SecurityNotice onDismiss={notices.dismiss} />
        ) : (
          createPortal(<SecurityNotice onDismiss={notices.dismiss} />, noticeHead)
        ))}
      {lockLost && (
        <div
          role="alert"
          data-testid="lock_lost_notice"
          className="flex flex-col gap-2 rounded-medium bg-error-container p-4 text-body-medium text-on-error-container"
        >
          <p>{LOCK_LOST_NOTICE}</p>
          <button
            type="button"
            data-testid="lock_lost_notice_dismiss"
            onClick={notices.dismissLockLost}
            className="self-start rounded-full px-3 py-1.5 text-label-large text-on-error-container"
          >
            Got it
          </button>
        </div>
      )}
      {loading && (
        <p role="status" data-testid="home_loading" className="text-body-medium text-on-surface-variant">
          Loading…
        </p>
      )}
      {welcome && (
        <p role="status" data-testid="home_welcome" className="text-body-medium">
          Welcome — you&apos;re in. Your registration landed.
        </p>
      )}
      {isApplicant && <ApplicantStatus progress={progress} surface={surface} />}
      {me?.accountState === "MEMBER" && <MemberStatus />}
      {transportFailed && <TransportError testId="home_transport_error" />}
    </section>
  );
}
