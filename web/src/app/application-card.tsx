"use client";

// THE APPLICANT'S OWN APPLICATION CARD (ApplicantWaiting, ApplicantRejected,
// ProfileApplicant; behavior/<board>.md; copy-voice *The reject extension's
// lines*). Read-only: it says how the application stands and holds the ask
// link — the one thing the applicant can hand out — and acts on nothing else.
//
// ONE APPLICATION, BY PRECEDENCE (design digest item 66): `User.application`
// answers the approved-not-landed row, else the newest waiting, else the
// newest closed — and the card names THAT row's approver, never the role
// "inviter" (ApplicantWaiting.md:5, ProfileApplicant.md:7).
//
// - WAITING: the feed's card once every owed step is done — `All set —
//   waiting on @mira` — with the ask link and `Got it`, which puts it away on
//   this device (ApplicantWaiting.md:3, :15). The profile's card rides above
//   the header — `Waiting on @mira` — and is never put away
//   (ProfileApplicant.md:5, :14).
// - CLOSED: the account-notice olive, titled by the member who closed it,
//   with the ask link labelled by what to do with it; never put away
//   (ApplicantRejected.md:3-9, ProfileApplicant.md:11-13).
// - The ask link stands whole; its copy lands it on the clipboard with `Link
//   copied` (ApplicantWaiting.md:13).

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchMyApplication, type MyApplication } from "@/lib/api/invites-api";
import { askUrl, copyLink, LINK_COPIED } from "@/lib/invites/queue";
import { useActiveAccountId } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Snackbar } from "@/lib/ui/snackbar";
import { AddressCard } from "@/lib/ui2/address-card";
import { TaskCard } from "@/lib/ui2/task-card";

export const COPY_YOUR_ASK_LINK = "Copy your ask link";
export const YOUR_ASK_LINK = "Your ask link";
export const ASK_SOMEONE = "Ask someone you know to vouch for you";
export const ASK_SOMEONE_CAPTION =
  "Send it to anyone who is already in. It does not expire, and it works however many people you send it to.";
export const GOT_IT = "Got it";

export function closedTitle(handle: string): string {
  return `${handle} closed your application`;
}
export function closedBody(handle: string): string {
  return `That was ${handle}'s call, and it is the only thing it decides. Your account stays exactly as it is, you can keep reading, and any member you know can vouch you in instead.`;
}

/** Each surface's words for the waiting card (the closed card's are one). */
const WAITING = {
  feed: {
    title: (handle: string) => `All set — waiting on ${handle}`,
    body: "Their approval brings you in. Nothing else is needed from you.",
    caption: "It does not expire.",
  },
  profile: {
    title: (handle: string) => `Waiting on ${handle}`,
    body: "Their approval brings you in. Until then, you can read everything.",
    caption: "It does not expire. Anyone who holds your ask can let you in — the first vouch lands it.",
  },
} as const;

export type ApplicationSurface = keyof typeof WAITING;

// THE PUT-AWAY IS THIS DEVICE'S (ApplicantWaiting.md:15): kept per account in
// localStorage, so it survives a restart and never crosses to another device.
const PUT_AWAY = "cogra.applicationPutAway.";
const putAwayListeners = new Set<() => void>();

function putAwayOf(account: string | null): boolean {
  if (account === null || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PUT_AWAY + account) !== null;
  } catch {
    return false;
  }
}

function putAway(account: string | null): void {
  if (account === null) return;
  try {
    window.localStorage.setItem(PUT_AWAY + account, "1");
  } catch {
    // Not kept: the card steps aside for this visit only.
  }
  for (const listener of putAwayListeners) listener();
}

function subscribePutAway(listener: () => void): () => void {
  putAwayListeners.add(listener);
  return () => putAwayListeners.delete(listener);
}

/** Which card stands, from the application the account reads. */
export function cardOf(
  mine: MyApplication | null,
): { readonly state: "waiting" | "closed"; readonly approver: string; readonly askLink: string } | null {
  const application = mine?.application;
  if (mine === null || application === null || application === undefined) return null;
  if (mine.askLink === null || application.approver === null || application.approver === undefined) return null;
  // Approved-not-landed is the landing card's, and landed is the vouch card's.
  if (application.approvedAt !== null || application.landedAt !== null) return null;
  return {
    state: application.rejectedAt !== null ? "closed" : "waiting",
    approver: `@${application.approver.handle}`,
    askLink: mine.askLink,
  };
}

export function ApplicationCard({
  surface,
  stepsDone = true,
  refreshKey,
}: {
  surface: ApplicationSurface;
  /**
   * Every owed step is done — the waiting card's condition on the feed
   * (ApplicantWaiting.md:3). The closed card stands regardless.
   */
  stepsDone?: boolean;
  /** Changes whenever the host's own read moves, so the card flips in place. */
  refreshKey?: unknown;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const account = useActiveAccountId();
  const [mine, setMine] = useState<MyApplication | null>(null);
  const [copied, setCopied] = useState<{ token: number } | null>(null);
  const away = useSyncExternalStore(
    subscribePutAway,
    () => putAwayOf(account),
    () => false,
  );

  useEffect(() => {
    let live = true;
    void guard.run(() => fetchMyApplication(client)).then((outcome) => {
      if (live && outcome.kind === "success") setMine(outcome.value);
    });
    return () => {
      live = false;
    };
  }, [client, guard, refreshKey]);

  const dismissCopied = useCallback(() => setCopied(null), []);

  const card = cardOf(mine);
  if (card === null) return null;
  const closed = card.state === "closed";
  if (!closed && surface === "feed" && (!stepsDone || away)) return null;

  const node: DataNode = { path: `${surface}.application` };
  const url = askUrl(window.location.origin, card.askLink);
  const words = WAITING[surface];

  return (
    <TaskCard
      tone={closed ? "notice" : undefined}
      title={closed ? closedTitle(card.approver) : words.title(card.approver)}
      body={closed ? closedBody(card.approver) : words.body}
      node={node}
    >
      <AddressCard
        bare
        address={url}
        label={closed ? ASK_SOMEONE : YOUR_ASK_LINK}
        copyLabel={COPY_YOUR_ASK_LINK}
        onCopy={() =>
          void copyLink(url).then((ok) => ok && setCopied((c) => ({ token: (c?.token ?? 0) + 1 })))
        }
        caption={closed ? ASK_SOMEONE_CAPTION : words.caption}
        node={part(node, "link")}
      />
      {!closed && surface === "feed" && (
        <button
          type="button"
          onClick={() => putAway(account)}
          {...testAttributes(part(node, "dismiss"))}
          className={`self-start ${buttonClassName({ variant: "outline" })}`}
        >
          {GOT_IT}
        </button>
      )}
      <Snackbar
        testId={`${surface}-application-snackbar`}
        message={copied === null ? null : LINK_COPIED}
        token={copied?.token}
        onDismiss={dismissCopied}
      />
    </TaskCard>
  );
}
