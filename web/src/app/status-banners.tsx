"use client";

// The account-status banners (Android's twin, design.md §6): the
// security notice, the application cards, and the member status —
// shell-scoped, riding above whichever tab is active until resolved
// (auth.md "The applicant experience": applicant vs member is cards,
// never navigation). The guarded Me read exercises refresh-and-replay;
// a refused read is a dead session — the phase flip handles it, the
// banners just stop loading.

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchMe, type MeUser } from "@/lib/api/auth-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { securityNotices, type SecurityNotices } from "@/lib/session/security-notices";
import { useRegistrationFlow, useRegistrationProgress } from "@/lib/signing/provider";
import { TransportError } from "@/lib/ui/transport-error";
import { AppOpenSnackbar } from "@/lib/invites/app-open-notice";
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

function noticeDate(detectedAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(detectedAt));
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
      {reuseDetectedAt !== null && (
        <div
          role="alert"
          data-testid="security_notice"
          className="flex flex-col gap-2 rounded-medium bg-error-container p-4 text-body-medium text-on-error-container"
        >
          <p className="text-title-medium">Security notice</p>
          <p>
            A signed-out session token for your account was re-used on{" "}
            {noticeDate(reuseDetectedAt)} — likely token theft. All sessions were signed out
            as a precaution. If this wasn&apos;t you, consider changing your password.
          </p>
          <button
            type="button"
            data-testid="security_notice_dismiss"
            onClick={notices.dismiss}
            className="self-start rounded-full px-3 py-1.5 text-label-large text-on-error-container"
          >
            Got it
          </button>
        </div>
      )}
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
      {/* An ask link this reader cannot vouch through answers here (VouchAsk.md:13, :15). */}
      <AppOpenSnackbar />
    </section>
  );
}
