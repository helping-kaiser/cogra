"use client";

// INVITES (the `Invites` board family: Invites, InvitesEmpty, InviteNew,
// InviteCreated, InviteExpiry, ApprovePad, RejectConfirm, RejectAllConfirm;
// behavior/<board>.md; copy-voice *The invites round*). Six boards, one page:
// the create sheet, the expiry chooser, the fresh link, the approval pad and
// the two closing dialogs are all drawn over this same page.
//
// APPLICATIONS LEAD, LIVE LINKS FOLLOW (Invites.md:7). The queue is the one
// read spanning both ends of the funnel (`approvalQueue`): rows taken up
// through the reader's ask-link door head the list, every other row stands
// grouped by the link it came through, by age and never by readiness
// (`layoutQueue`). Each row carries its own close; a group carries `Close
// all` past one waiting. Both halves stand whenever one holds something, an
// empty half keeping its label over `No applications waiting.` or `No live
// links.` (:9-15); a copy that did not go through says `That didn't go
// through.` with Retry as the link card's last line (:59-61).
//
// APPROVING IS VOUCHING (ApprovePad.md:5): a ready row's tap blooms the
// ordinary opinion pad from an anchor that takes the close's slot, over the
// approval seam (`approval-stance-data.ts`) — `vouchesIn`, so a (0, 0) Set
// raises the empty sign's vouch-in ask and `Set it anyway` IS the act. A
// not-ready row answers with a snackbar and never opens the pad (:39).
//
// NO BOTTOM BAR (Invites.md:3): a task flow takes the back arrow, which names
// the door it came through (:95-97).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApolloClient } from "@apollo/client/react";
import { useRouter } from "next/navigation";

import { fetchMe } from "@/lib/api/auth-api";
import type { Outcome } from "@/lib/api/outcome";
import {
  fetchInvites,
  rejectApplication,
  rejectLinkApplications,
  revokeInviteLink,
  type ApplicationView,
  type InviteLinkView,
  type InvitesRead,
} from "@/lib/api/invites-api";
import { createApprovalStanceData } from "@/lib/invites/approval-stance-data";
import {
  peekInvitesNotice,
  takeInvitesNotice,
  type InvitesNotice,
} from "@/lib/invites/invites-notice";
import {
  approvalTarget,
  dropKeptApprovals,
  useKeptApproval,
} from "@/lib/invites/kept-approvals";
import {
  APPLICATIONS_LABEL,
  CLOSE_ALL,
  CLOSE_IT,
  CLOSE_THEM,
  CLOSING_IT,
  CLOSING_THEM,
  COPY_THE_LINK,
  CREATE_INVITE,
  HOW_VOUCHING_WORKS,
  HOW_VOUCHING_WORKS_HELP,
  INVITES_EMPTY,
  INVITES_TITLE,
  INVITE_REVOKED,
  KEEP_IT,
  KEEP_THEM,
  LINK_COPIED,
  LIVE_LINKS_LABEL,
  NO_APPLICATIONS_WAITING,
  NO_LIVE_LINKS,
  NEW_INVITE,
  REVOKE,
  REVOKING,
  alreadyWaiting,
  approvable,
  approvePadNote,
  closeAllLabel,
  closeApplicationLabel,
  copyLink,
  finishRegistering,
  groupClosesAll,
  groupLabel,
  handleOf,
  invitesOrigin,
  joinUrl,
  layoutQueue,
  linkCaption,
  linkLabel,
  liveLinks,
  rejectAllBody,
  rejectAllTitle,
  rejectBody,
  rejectTitle,
  secondLine,
  type ApplicationGroup,
} from "@/lib/invites/queue";
import { useActiveAccountId } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { StanceDataProvider, useStanceData } from "@/lib/stance/provider";
import { buttonClassName } from "@/lib/ui/button";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import { instance, part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { EmptyState } from "@/lib/ui/empty-state";
import { Icon } from "@/lib/ui/icons";
import { PageHeader } from "@/lib/ui/page-header";
import { usePullToRefresh } from "@/lib/ui/pull-to-refresh";
import { RowLine } from "@/lib/ui/row-line";
import { useScrollHost } from "@/lib/ui/scroll-host";
import { Snackbar } from "@/lib/ui/snackbar";
import { StanceControl } from "@/lib/ui/stance-control";
import { signedLine } from "@/lib/ui/stance-readout";
import { ladderAge } from "@/lib/ui/timestamp";
import { TransportError } from "@/lib/ui/transport-error";
import { AddressCard } from "@/lib/ui2/address-card";
import { ContentRow } from "@/lib/ui2/content-row";

import { CloseDialog } from "./close-dialog";
import { InviteSheet } from "./invite-sheet";

const ROOT: DataNode = { path: "invites" };

/** How long a revoke may stay unanswered before it says it is still working (Invites.md:51). */
export const REVOKING_AFTER_MS = 200;

/** Which closing dialog stands, and over what. */
type Closing =
  | { readonly kind: "one"; readonly application: ApplicationView }
  | { readonly kind: "all"; readonly group: ApplicationGroup };

/** Where focus goes once a row or a card removes itself (Invites.md:61). */
type FocusAfter = { readonly section: "application" | "link"; readonly index: number };

function noticeMessage(notice: InvitesNotice): ReactNode {
  const handle = `@${notice.handle}`;
  switch (notice.kind) {
    case "alreadyWaiting":
      return alreadyWaiting(handle);
    case "notRegistered":
      return finishRegistering(handle);
    case "signed":
      return signedLine(notice.landing, 1, false, handle);
  }
}

export function InvitesView({
  from,
  now = Date.now,
}: {
  /** The door Invites was opened from (`?from=`), for the back arrow's words. */
  from: string | null;
  /** Test injection: the clock captions and ages are read against. */
  now?: () => number;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();
  const account = useActiveAccountId();
  const host = useScrollHost();
  const origin = invitesOrigin(from);

  const [read, setRead] = useState<InvitesRead | null>(null);
  const [fault, setFault] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [closing, setClosing] = useState<Closing | null>(null);
  const [revoking, setRevoking] = useState<{ id: string; slow: boolean } | null>(null);
  const [revokeFailed, setRevokeFailed] = useState(false);
  // The link whose copy did not go through: its card carries the line (Invites.md:59).
  const [copyFailed, setCopyFailed] = useState<string | null>(null);
  // What an ask link handed over on the way here: its snackbar, and the row
  // to stand at (VouchAsk.md:17, :27, :31). Read in the first render, taken
  // once the page stands.
  const [arrival] = useState(peekInvitesNotice);
  const [snack, setSnack] = useState<{ message: ReactNode; token: number } | null>(() =>
    arrival === null ? null : { message: noticeMessage(arrival), token: 0 },
  );
  const tokens = useRef(0);
  const focusAfter = useRef<FocusAfter | null>(null);
  const standAt = useRef<string | null>(
    arrival !== null && arrival.kind !== "signed" ? arrival.handle : null,
  );
  useEffect(() => {
    takeInvitesNotice();
  }, []);
  const opener = useRef<HTMLElement | null>(null);

  const notify = useCallback((message: ReactNode) => {
    tokens.current += 1;
    setSnack({ message, token: tokens.current });
  }, []);
  const dismissSnack = useCallback(() => setSnack(null), []);

  /** What a read answered: the page, or the fault line beside what it shows. */
  const apply = useCallback((outcome: Outcome<InvitesRead>) => {
    if (outcome.kind === "success") {
      setRead(outcome.value);
      setFault(false);
    } else {
      setFault(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    apply(await guard.run(() => fetchInvites(client)));
  }, [client, guard, apply]);

  // AN APPLICANT NEVER STANDS HERE (ProfileApplicant.md:18: their Invites
  // answers with a snackbar and never opens). A reader who is not a member
  // and reaches the address anyway lands where app-open lands for them.
  useEffect(() => {
    let live = true;
    void guard.run(() => fetchMe(client)).then((me) => {
      if (live && me.kind === "success" && me.value.accountState !== "MEMBER") router.replace("/");
    });
    return () => {
      live = false;
    };
  }, [client, guard, router]);

  useEffect(() => {
    let live = true;
    void guard.run(() => fetchInvites(client)).then((outcome) => {
      if (live) apply(outcome);
    });
    return () => {
      live = false;
    };
  }, [client, guard, apply]);

  const onPull = useCallback(() => void refresh(), [refresh]);
  usePullToRefresh({ host, onPull, enabled: !sheetOpen && closing === null && approving === null });

  const layout = useMemo(() => layoutQueue(read?.queue ?? []), [read]);
  const links = useMemo(() => liveLinks(read?.links ?? []), [read]);
  const empty =
    read !== null && layout.head.length === 0 && layout.groups.length === 0 && links.length === 0;

  // FOCUS FOLLOWS A REMOVAL (Invites.md:61): the next row, else the previous,
  // else the empty state. And an ask link's arrival stands at its row.
  useEffect(() => {
    if (read === null) return;
    const wanted = focusAfter.current;
    focusAfter.current = null;
    if (wanted !== null) {
      const path = wanted.section === "application" ? "invites.application" : "invites.link";
      const items = [...document.querySelectorAll<HTMLElement>(`[data-testid="${path}"]`)];
      const target = items[Math.min(wanted.index, items.length - 1)];
      const focusable =
        target?.querySelector<HTMLElement>("button, a") ??
        document.querySelector<HTMLElement>('[data-testid="invites.empty.create"], [data-testid="invites.create"]');
      focusable?.focus();
    }
    const at = standAt.current;
    if (at !== null) {
      standAt.current = null;
      document
        .querySelector<HTMLElement>(`[data-testid="invites.application"][data-testid-key="${at}"]`)
        ?.scrollIntoView?.({ block: "center" });
    }
  }, [read]);

  const indexOfApplication = (id: string): number => {
    const order = [...layout.head, ...layout.groups.flatMap((g) => g.rows)];
    return Math.max(0, order.findIndex((a) => a.id === id));
  };

  const openSheet = (event: React.MouseEvent<HTMLElement>) => {
    opener.current = event.currentTarget;
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    // Focus returns to the control that opened it (InviteNew.md:27).
    opener.current?.focus();
  };

  const onRevoke = async (link: InviteLinkView, index: number) => {
    if (revoking !== null) return;
    setRevokeFailed(false);
    setRevoking({ id: link.id, slow: false });
    const timer = setTimeout(
      () => setRevoking((current) => (current?.id === link.id ? { id: link.id, slow: true } : current)),
      REVOKING_AFTER_MS,
    );
    const outcome = await guard.run(() => revokeInviteLink(client, link.id));
    clearTimeout(timer);
    if (outcome.kind === "success") {
      focusAfter.current = { section: "link", index };
      await refresh();
      setRevoking(null);
      notify(INVITE_REVOKED);
    } else {
      // The card stays (:59).
      setRevoking(null);
      setRevokeFailed(true);
    }
  };

  const commitClose = async (asked: Closing): Promise<boolean> => {
    const outcome =
      asked.kind === "one"
        ? await guard.run(() => rejectApplication(client, asked.application.id))
        : await guard.run(() => rejectLinkApplications(client, asked.group.linkId));
    if (outcome.kind !== "success") return false;
    // A kept approval's close drops the kept vouch; nothing is signed
    // (RejectConfirm.md:7, Invites.md:89).
    const closed = asked.kind === "one" ? [asked.application] : asked.group.rows;
    await dropKeptApprovals(
      account,
      closed.map((application) => application.id),
    );
    const first = asked.kind === "one" ? asked.application : asked.group.rows[0];
    focusAfter.current = { section: "application", index: indexOfApplication(first.id) };
    setClosing(null);
    await refresh();
    return true;
  };

  const rowFor = (application: ApplicationView) => (
    <ApplicationRow
      key={application.id}
      application={application}
      now={now()}
      approving={approving === application.id}
      onApprove={() => setApproving(application.id)}
      onApproveEnd={() => setApproving(null)}
      onTaken={(landing) => {
        setApproving(null);
        focusAfter.current = { section: "application", index: indexOfApplication(application.id) };
        notify(signedLine(landing, 1, false, handleOf(application)));
        void refresh();
      }}
      onNotReady={() => notify(finishRegistering(handleOf(application)))}
      onClose={() => setClosing({ kind: "one", application })}
    />
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col pb-8">
      <CollapsingTop flush>
        <PageHeader
          title={INVITES_TITLE}
          backHref={origin.href}
          backLabel={origin.label}
          backScroll={false}
          node={part(ROOT, "header")}
        />
      </CollapsingTop>

      {read === null && !fault && (
        <p role="status" aria-live="polite" data-testid="invites-loading" className="px-6 pt-2 text-body-medium text-on-surface-variant">
          Loading…
        </p>
      )}
      {fault && <div className="px-6 pt-2"><TransportError testId="invites-error" /></div>}

      {empty && (
        // INVITESEMPTY (InvitesEmpty.md): the calm line, and the page's one
        // committing control under it at the column's full width — no error
        // colour, no bar.
        <div className="flex flex-col px-6 pb-8 pt-4">
          <EmptyState
            title={INVITES_EMPTY}
            testId="invites-empty-state"
            node={part(ROOT, "empty")}
            action={
              <button
                type="button"
                {...testAttributes(part(ROOT, "empty.create"))}
                onClick={openSheet}
                className={`w-full ${buttonClassName({ variant: "primary" })}`}
              >
                {CREATE_INVITE}
              </button>
            }
          />
        </div>
      )}

      {read !== null && !empty && (
        <div className="flex flex-col pt-2">
          <div className="px-4">
            <button
              type="button"
              onClick={openSheet}
              {...testAttributes(part(ROOT, "create"))}
              className={`w-full ${buttonClassName({ variant: "primary" })}`}
            >
              {NEW_INVITE}
            </button>
          </div>

          {/* BOTH HALVES STAND WHENEVER ONE HOLDS SOMETHING (Invites.md:9): a
              half with nothing in it keeps its label and says so in one quiet
              line (:11, :13, :15) — only both empty is InvitesEmpty. */}
          <SectionLabel node={part(ROOT, "applicationsLabel")}>{APPLICATIONS_LABEL}</SectionLabel>
          {layout.head.length === 0 && layout.groups.length === 0 && (
            <EmptyHalf node={part(ROOT, "applicationsEmpty")}>{NO_APPLICATIONS_WAITING}</EmptyHalf>
          )}
          {layout.head.length > 0 && (
            <div className="flex flex-col gap-2 px-4 pb-2">{layout.head.map(rowFor)}</div>
          )}
          {layout.groups.length > 0 && (
            <div className="flex flex-col gap-2 px-4">
              {layout.groups.map((group) => (
                <GroupBlock
                  key={group.linkId}
                  group={group}
                  onCloseAll={() => setClosing({ kind: "all", group })}
                >
                  {group.rows.map(rowFor)}
                </GroupBlock>
              ))}
            </div>
          )}

          <SectionLabel node={part(ROOT, "linksLabel")}>{LIVE_LINKS_LABEL}</SectionLabel>
          {links.length === 0 && <EmptyHalf node={part(ROOT, "linksEmpty")}>{NO_LIVE_LINKS}</EmptyHalf>}
          {links.length > 0 && (
            <div className="flex flex-col gap-2 px-4">
              {links.map((link, index) => {
                const url = joinUrl(window.location.origin, link.id);
                const card = instance(ROOT, "link", link.id);
                const copy = () =>
                  void copyLink(url).then((copied) => {
                    if (copied) {
                      setCopyFailed((current) => (current === link.id ? null : current));
                      notify(LINK_COPIED);
                    } else {
                      // Invites.md:59 — the comfort's line on the link's own
                      // card, never `Link copied`, never a dialog.
                      setCopyFailed(link.id);
                    }
                  });
                return (
                  <AddressCard
                    key={link.id}
                    address={url}
                    label={linkLabel(link)}
                    copyLabel={COPY_THE_LINK}
                    onCopy={copy}
                    action={{
                      label: REVOKE,
                      busyLabel: REVOKING,
                      // Inert from the press, `Revoking…` past 200ms,
                      // never dimmed and never a spinner (:49-51).
                      busy: revoking?.id === link.id && revoking.slow,
                      onClick: () => void onRevoke(link, index),
                    }}
                    caption={linkCaption(link, now())}
                    node={card}
                  >
                    {copyFailed === link.id && (
                      <div {...testAttributes(part(card, "copyFault"))}>
                        <RowLine state={{ kind: "didntGoThrough", onRetry: copy }} testId="invites-copy-fault" />
                      </div>
                    )}
                  </AddressCard>
                );
              })}
            </div>
          )}
          {revokeFailed && (
            <div className="px-6 pt-2">
              <TransportError testId="invites-revoke-failed" />
            </div>
          )}
        </div>
      )}

      <InviteSheet
        open={sheetOpen}
        onClose={closeSheet}
        onCreated={() => void refresh()}
        notify={notify}
        now={now}
      />

      {closing !== null &&
        (closing.kind === "one" ? (
          <CloseDialog
            title={rejectTitle(handleOf(closing.application))}
            body={rejectBody(handleOf(closing.application))}
            commitLabel={CLOSE_IT}
            busyLabel={CLOSING_IT}
            keepLabel={KEEP_IT}
            onCommit={() => commitClose(closing)}
            onDismiss={() => setClosing(null)}
          />
        ) : (
          <CloseDialog
            title={rejectAllTitle(closing.group.rows.length)}
            body={rejectAllBody(closing.group.rows.length)}
            commitLabel={CLOSE_THEM}
            busyLabel={CLOSING_THEM}
            keepLabel={KEEP_THEM}
            onCommit={() => commitClose(closing)}
            onDismiss={() => setClosing(null)}
          />
        ))}

      <Snackbar
        testId="invites-snackbar"
        message={snack?.message ?? null}
        token={snack?.token}
        onDismiss={dismissSnack}
      />
    </main>
  );
}

/**
 * An empty half's one line (`INVITES_EMPTY_LINE`: body-medium, secondary,
 * 0 24px 8px) — the empty list's calm register, never the error colour.
 */
function EmptyHalf({ children, node }: { children: string; node: DataNode }) {
  return (
    <p {...testAttributes(node)} className="m-0 px-6 pb-2 text-body-medium text-on-surface-variant">
      {children}
    </p>
  );
}

/** A quiet section caption (`SectionLabel.jsx`): label-small, secondary ink. */
function SectionLabel({ children, node }: { children: string; node: DataNode }) {
  return (
    <span
      {...testAttributes(node)}
      className="block px-6 pb-1 pt-3 text-label-small text-on-surface-variant"
    >
      {children}
    </span>
  );
}

/**
 * A link's group (the board's `ApplicationGroup`): its label and waiting
 * count, `Close all` past one waiting, then its rows by age.
 */
function GroupBlock({
  group,
  onCloseAll,
  children,
}: {
  group: ApplicationGroup;
  onCloseAll: () => void;
  children: ReactNode;
}) {
  const node = instance(ROOT, "group", group.linkId);
  return (
    <>
      <div {...testAttributes(node)} className="flex items-center justify-between gap-3 px-1 pt-1">
        <span {...testAttributes(part(node, "label"))} className="text-label-medium text-on-surface-variant">
          {groupLabel(group)}
        </span>
        {groupClosesAll(group) && (
          <button
            type="button"
            aria-label={closeAllLabel(group.rows.length)}
            onClick={onCloseAll}
            {...testAttributes(part(node, "close"))}
            className={buttonClassName({ variant: "text", size: "sm" })}
          >
            {CLOSE_ALL}
          </button>
        )}
      </div>
      {children}
    </>
  );
}

/**
 * One application (the board's `ContentRow` in its chronicle variant): the
 * monogram from the handle, the handle alone, the reader's fact, the age, and
 * the row's own close — or, while its pad is up, the stance anchor the pad
 * bloomed from in the close's slot (ApprovePad.md:15).
 */
function ApplicationRow({
  application,
  now,
  approving,
  onApprove,
  onApproveEnd,
  onTaken,
  onNotReady,
  onClose,
}: {
  application: ApplicationView;
  now: number;
  approving: boolean;
  onApprove: () => void;
  onApproveEnd: () => void;
  onTaken: (landing: { pDirected: number; pInterest: number }) => void;
  onNotReady: () => void;
  onClose: () => void;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const base = useStanceData();
  const kept = useKeptApproval(application.id);
  const data = useMemo(
    () => createApprovalStanceData({ client, guard, signer, base }, application),
    [client, guard, signer, base, application],
  );
  const handle = handleOf(application);
  const node = instance(ROOT, "application", application.handle);
  const ready = approvable(application);

  return (
    <ContentRow
      variant="chronicle"
      title={handle}
      second={secondLine(application, kept.keyElsewhere)}
      trailing={ladderAge(application.createdAt, now)}
      disc={{ kind: "monogram", name: application.handle }}
      // A kept approval whose key is elsewhere meets the key notice, as a
      // kept pick's face does (:79) — the pad carries it in its place.
      onOpen={ready || kept.keyElsewhere ? onApprove : onNotReady}
      node={node}
      testId={`invites-application-${application.id}`}
      action={
        approving ? (
          <StanceDataProvider data={data}>
            <StanceControl
              target={{ ...approvalTarget(application.id), label: handle }}
              testIdPrefix={`invites-approve-${application.id}`}
              node={part(node, "stance")}
              vouchesIn
              padOnly={{ onClose: onApproveEnd, keepAnchor: true }}
              variant={{
                helpLabel: HOW_VOUCHING_WORKS,
                help: HOW_VOUCHING_WORKS_HELP,
                note: approvePadNote(handle),
                onTaken,
                padNode: part(node, "stance.pad"),
              }}
            />
          </StanceDataProvider>
        ) : (
          <button
            type="button"
            aria-label={closeApplicationLabel(handle)}
            onClick={onClose}
            {...testAttributes(part(node, "close"))}
            className="cg-state cg-focus cg-hit grid size-10 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-on-surface-variant"
          >
            <Icon name="close" size={20} />
          </button>
        )
      }
    />
  );
}
