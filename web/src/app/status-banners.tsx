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
import { ApplicantStatus } from "./applicant-status";
import { MemberStatus } from "./member-status";

function noticeDate(detectedAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(detectedAt));
}

export function StatusBanners({
  notices = securityNotices,
}: {
  /** Test injection. */
  notices?: SecurityNotices;
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
      {isApplicant && <ApplicantStatus progress={progress} />}
      {me?.accountState === "MEMBER" && <MemberStatus me={me} />}
      {transportFailed && <TransportError testId="home_transport_error" />}
    </section>
  );
}
