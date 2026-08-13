"use client";

// The inviter's surface (Android's InvitesScreen): issue and revoke
// links, work the approval queue — approving drives the full write
// handshake on this device (auth.md "Approval and landing"; the in-page
// applicant lock: web.md "Routes").

import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { ErrorCode } from "@/__generated__/graphql";
import { fallbackMessage } from "@/lib/ui/error-messages";
import { fetchMe, type MeUser } from "@/lib/api/auth-api";
import {
  approveApplicant,
  createInviteLink,
  fetchInviteLinks,
  revokeInviteLink,
  LINK_LIFETIME_MS,
  type ApplicationView,
  type InviteLinkView,
} from "@/lib/api/invites-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { Button } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { PageHeader } from "@/lib/ui/page-header";
import { StanceSlider } from "@/lib/ui/stance-slider";
import { TransportError } from "@/lib/ui/transport-error";

function invitesMessage(code: ErrorCode): string {
  switch (code) {
    case "WRITE_RULE_FAILED":
      return "Your account can't fund this approval right now.";
    case "BAD_INPUT":
      return "That didn't go through — the application or link may have expired or already been handled.";
    case "NOT_FOUND":
      return "That link is already gone.";
    default:
      return fallbackMessage(code);
  }
}

export function InvitesView() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();

  const [me, setMe] = useState<MeUser | null>(null);
  const [links, setLinks] = useState<readonly InviteLinkView[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [singleUse, setSingleUse] = useState(false);
  const [prefillPDirected, setPrefillPDirected] = useState(0.1);
  const [prefillPInterest, setPrefillPInterest] = useState(0.1);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [transportFailed, setTransportFailed] = useState(false);
  const [signIncomplete, setSignIncomplete] = useState(false);
  const [vouchSigned, setVouchSigned] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailedId, setCopyFailedId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    return guard
      .run(() => fetchMe(client))
      .then((meOutcome): Promise<void> | undefined => {
        if (meOutcome.kind !== "success") {
          setLoading(false);
          if (meOutcome.kind === "failed") setTransportFailed(true);
          return;
        }
        setMe(meOutcome.value);
        if (meOutcome.value.accountState !== "MEMBER") {
          setLoading(false);
          return;
        }
        return guard
          .run(() => fetchInviteLinks(client))
          .then((linksOutcome) => {
            setLoading(false);
            switch (linksOutcome.kind) {
              case "success":
                setLinks(linksOutcome.value);
                setTransportFailed(false);
                break;
              case "refused":
                setError(linksOutcome.errors[0].code);
                break;
              case "failed":
                setTransportFailed(true);
                break;
            }
          });
      });
  }, [client, guard]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);
    setTransportFailed(false);
    const outcome = await guard.run(() =>
      createInviteLink(client, {
        expiresAt: new Date(Date.now() + LINK_LIFETIME_MS).toISOString(),
        prefillPDirected,
        prefillPInterest,
        singleUse,
      }),
    );
    setCreating(false);
    switch (outcome.kind) {
      case "success":
        await refresh();
        break;
      case "refused":
        setError(outcome.errors[0].code);
        break;
      case "failed":
        setTransportFailed(true);
        break;
    }
  };

  const onRevoke = async (linkId: string) => {
    if (revokingId !== null) return;
    setRevokingId(linkId);
    setError(null);
    setTransportFailed(false);
    const outcome = await guard.run(() => revokeInviteLink(client, linkId));
    await refresh();
    setRevokingId(null);
    if (outcome.kind === "refused") setError(outcome.errors[0].code);
    if (outcome.kind === "failed") setTransportFailed(true);
  };

  const onShare = async (linkId: string) => {
    // writeText rejects on denied permission or a non-secure context —
    // silence would leave the Share button looking dead.
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${linkId}`);
      setCopiedId(linkId);
      setCopyFailedId(null);
    } catch {
      setCopiedId(null);
      setCopyFailedId(linkId);
    }
  };

  const onApprove = async (applicationId: string, pDirected: number, pInterest: number) => {
    if (approvingId !== null) return;
    setApprovingId(applicationId);
    setError(null);
    setTransportFailed(false);
    setSignIncomplete(false);
    setVouchSigned(false);
    const prepared = await guard.run(() =>
      approveApplicant(client, applicationId, pDirected, pInterest),
    );
    if (prepared.kind === "refused") {
      setApprovingId(null);
      setError(prepared.errors[0].code);
      return;
    }
    if (prepared.kind === "failed") {
      setApprovingId(null);
      setTransportFailed(true);
      return;
    }
    const results = [];
    for (const staged of prepared.value) {
      results.push(await signer.signStaged(staged));
    }
    if (results.every((result) => result.kind === "done")) {
      setVouchSigned(true);
    } else {
      // The approval itself went through; the parked material resumes
      // from Home — say so instead of failing silently.
      setSignIncomplete(true);
    }
    setApprovingId(null);
    await refresh();
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-12">
      <PageHeader
        title="Invites"
        backHref="/"
        backLabel="Back to home"
        backTestId="invites_back"
      />

      {loading && (
        <p role="status" data-testid="invites_loading" className="text-body-medium text-on-surface-variant">
          Loading…
        </p>
      )}

      {me !== null && me.accountState !== "MEMBER" && (
        <Card testId="invites_locked">
          <h2 className="text-title-medium">Locked until your inviter approves you</h2>
          <p className="text-body-medium text-on-surface-variant">
            Inviting unlocks once your inviter approves you.
          </p>
        </Card>
      )}

      {transportFailed && <TransportError testId="invites_error" />}
      {!transportFailed && error !== null && (
        <p role="alert" data-testid="invites_error" className="text-body-medium text-error">
          {invitesMessage(error)}
        </p>
      )}
      {vouchSigned && (
        <p role="status" data-testid="invites_vouch_signed" className="text-body-medium">
          Approved — your vouch is signed and on its way.
        </p>
      )}
      {signIncomplete && (
        <p role="alert" data-testid="invites_sign_incomplete" className="text-body-medium text-error">
          The approval went through, but the vouch didn&apos;t finish signing. It&apos;s saved on
          this device — resume it from Home.
        </p>
      )}

      {me?.accountState === "MEMBER" && (
        <>
          <Card>
            <h2 className="text-title-medium">Invite someone you know</h2>
            <p className="text-body-medium text-on-surface-variant">
              The stance values are a pre-filled suggestion — you commit them at approval, and
              approving is your priced vouch.
            </p>
            <form onSubmit={onCreate} className="flex flex-col gap-3" noValidate>
              <label className="flex items-center gap-2 text-label-large">
                <input
                  type="checkbox"
                  data-testid="invites_single_use"
                  className="accent-primary"
                  checked={singleUse}
                  onChange={(event) => setSingleUse(event.target.checked)}
                />
                Single-use
              </label>
              <StanceSlider
                label="Directed weight"
                value={prefillPDirected}
                onChange={setPrefillPDirected}
                testId="invites_p_directed"
              />
              <StanceSlider
                label="Interest weight"
                value={prefillPInterest}
                onChange={setPrefillPInterest}
                testId="invites_p_interest"
              />
              <Button type="submit" testId="invites_create" size="sm" selfStart disabled={creating}>
                Create link
              </Button>
            </form>
          </Card>

          {links.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              approvingId={approvingId}
              revoking={revokingId !== null}
              copied={copiedId === link.id}
              copyFailed={copyFailedId === link.id}
              onShare={onShare}
              onRevoke={onRevoke}
              onApprove={onApprove}
            />
          ))}
        </>
      )}
    </main>
  );
}

function LinkCard({
  link,
  approvingId,
  revoking,
  copied,
  copyFailed,
  onShare,
  onRevoke,
  onApprove,
}: {
  link: InviteLinkView;
  approvingId: string | null;
  revoking: boolean;
  copied: boolean;
  copyFailed: boolean;
  onShare: (linkId: string) => void;
  onRevoke: (linkId: string) => void;
  onApprove: (applicationId: string, pDirected: number, pInterest: number) => void;
}) {
  const revoked = link.revokedAt !== null;
  return (
    <Card testId={`link_${link.id}`}>
      <p className="font-mono text-body-small text-on-surface-variant">{link.id}</p>
      <p className="text-body-medium">{revoked ? "Revoked" : link.singleUse ? "Single-use" : "Multi-use"}</p>
      {!revoked && (
        <div className="flex items-center gap-3">
          <Button testId={`share_${link.id}`} variant="outline" size="sm" onClick={() => onShare(link.id)}>
            Share
          </Button>
          <button
            type="button"
            data-testid={`revoke_${link.id}`}
            onClick={() => onRevoke(link.id)}
            disabled={revoking}
            className="text-label-large text-on-surface-variant underline disabled:opacity-40"
          >
            Revoke
          </button>
          {copied && (
            <p role="status" data-testid={`copied_${link.id}`} className="text-body-medium text-on-surface-variant">
              Copied
            </p>
          )}
          {copyFailed && (
            <p role="alert" data-testid={`copy_failed_${link.id}`} className="text-body-medium text-error">
              Couldn&apos;t copy — copy the page address instead.
            </p>
          )}
        </div>
      )}
      {link.applications.edges.map(({ node: application }) => (
        <ApplicationRow
          key={application.id}
          application={application}
          prefillPDirected={link.prefillPDirected}
          prefillPInterest={link.prefillPInterest}
          approvingId={approvingId}
          onApprove={onApprove}
        />
      ))}
    </Card>
  );
}

function applicantStatus(application: ApplicationView): string {
  const handle = `@${application.handle}`;
  if (application.landedAt !== null) return `${handle} is a member.`;
  if (application.approvedAt !== null) {
    return `${handle} approved — waiting for their signature and landing.`;
  }
  if (!application.emailVerified && !application.keyAttached) {
    return `${handle} applied; waiting on their email verification and device key.`;
  }
  if (!application.emailVerified) return `${handle} applied; waiting on their email verification.`;
  if (!application.keyAttached) return `${handle} applied; waiting on their device key.`;
  return `${handle} applied and proved their email and key — ready for your approval.`;
}

function ApplicationRow({
  application,
  prefillPDirected,
  prefillPInterest,
  approvingId,
  onApprove,
}: {
  application: ApplicationView;
  prefillPDirected: number;
  prefillPInterest: number;
  approvingId: string | null;
  onApprove: (applicationId: string, pDirected: number, pInterest: number) => void;
}) {
  // The link's prefill seeds the form; the commitment happens at
  // approval (schema: ApplicationApprovalInput).
  const [pDirected, setPDirected] = useState(prefillPDirected);
  const [pInterest, setPInterest] = useState(prefillPInterest);

  const approvable = application.emailVerified && application.keyAttached;
  return (
    <div className="flex flex-col gap-2 border-t border-outline-variant pt-3">
      <p data-testid={`application_${application.id}`} className="text-body-medium">
        {applicantStatus(application)}
      </p>
      {application.approvedAt === null && approvable && (
        <>
          <StanceSlider
            label="Directed weight"
            value={pDirected}
            onChange={setPDirected}
            testId={`approve_p_directed_${application.id}`}
          />
          <StanceSlider
            label="Interest weight"
            value={pInterest}
            onChange={setPInterest}
            testId={`approve_p_interest_${application.id}`}
          />
          <Button
            testId={`approve_${application.id}`}
            size="sm"
            selfStart
            onClick={() => onApprove(application.id, pDirected, pInterest)}
            disabled={approvingId !== null}
          >
            Approve and vouch
          </Button>
        </>
      )}
    </div>
  );
}
