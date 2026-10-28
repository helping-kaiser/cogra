"use client";

// THE ASK LINK'S LANDING (VouchAsk, VouchAskPad, VouchAskInvalid,
// VouchAskUnusable; behavior/<board>.md; auth.md "The ask link"). A member or
// a guest who opens `/vouch/<id>` meets the person asking — named, wearing a
// monogram, with no reason given — and the stance affordance that vouches
// them in. Nothing is staged by the opening (VouchAsk.md:11).
//
// WHO OPENED IT DECIDES WHERE IT LANDS, in this order (VouchAsk.md:13-17,
// :49; VouchAskUnusable.md:5-7):
// - the ASKER, and any APPLICANT, land where app-open lands for them, with
//   their own snackbar — never this page, never VouchAskUnusable;
// - a member who already has the asker WAITING in their queue meets Invites
//   at that row, `@noor is already waiting in your invites.`;
// - an id resolving to nobody is VouchAskInvalid, signed in or not;
// - a landed asker is VouchAskUnusable, with the door to their profile;
// - every other member, and a guest, meets the ask.
//
// THE PAD IS THE APPROVAL PAD (VouchAskPad.md): the opinion pad at +0.10 /
// +0.10, `vouchesIn`, its two lines on every open, over the ask seam — Set
// stages the asker, then approves the staged row. An asker not fully
// registered is staged and the vouch KEPT, nothing signed, and Invites opens
// at their row (:33); a link that turned unusable since the ask opened shows
// the case for its new state (:27); a vouch taken opens Invites with the
// signed snackbar (:25). A guest's tap or hold raises the guest gate, and a
// sign-in from it brings the ask back (VouchAsk.md:21-23, :37).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { fetchMe } from "@/lib/api/auth-api";
import { checkAskLink, fetchMyApplication, type AskCheck } from "@/lib/api/invites-api";
import { carrySnackbar } from "@/lib/ui/carried-snackbar";
import {
  createAskStanceData,
  type ApprovalDetour,
} from "@/lib/invites/approval-stance-data";
import { carryToInvites } from "@/lib/invites/invites-notice";
import { keepApproval } from "@/lib/invites/kept-approvals";
import {
  HOW_VOUCHING_WORKS,
  HOW_VOUCHING_WORKS_HELP,
  approvePadNote,
} from "@/lib/invites/queue";
import { holdAskLink, releaseAskLink } from "@/lib/session/held-link";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import type { StancePair } from "@/lib/stance/model";
import { StanceDataProvider, useStanceData } from "@/lib/stance/provider";
import { MonogramAvatar } from "@/lib/ui/actor-chip";
import { buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { PageHeader } from "@/lib/ui/page-header";
import { StanceControl } from "@/lib/ui/stance-control";
import { TransportError } from "@/lib/ui/transport-error";

const ROOT: DataNode = { path: "vouchAsk" };
const ASK = part(ROOT, "ask");

export const ASK_TITLE = "A vouch, asked for";
/** The snackbars app-open says to readers who cannot vouch through the link (VouchAsk.md:13, :15). */
export const VOUCH_ONCE_IN = "You can vouch once you're in.";
export const YOUR_OWN_ASK_LINK = "That's your own ask link — send it to someone who's already in.";
export const NOT_NOW = "Not now";
export const INVALID_TITLE = "This ask link doesn't work";
export const INVALID_BODY =
  "Check that the whole link came through, or ask the person who sent it for it again.";
export const LANDED_BODY = "Someone has vouched them in already, so this ask has nothing left to do.";

export function askTitle(handle: string): string {
  return `${handle} is asking to be vouched in`;
}
export const ASK_BODY =
  "They have an account and can read; what they do not have yet is anyone standing for them. Your opinion is what brings them in.";

export function landedTitle(handle: string): string {
  return `${handle} is already in`;
}
export function profileDoor(handle: string): string {
  return `See ${handle}'s profile`;
}

/** What the page stands as once the reader and the link are known. */
type Landing =
  | { readonly kind: "reading" }
  | { readonly kind: "fault" }
  | { readonly kind: "invalid" }
  | { readonly kind: "landed"; readonly handle: string }
  | { readonly kind: "ask"; readonly handle: string };

/**
 * The back arrow and `Not now` return to the state the link opened over, and
 * a cold open — a link followed from outside, the ordinary case — to the
 * feed's root (VouchAsk.md:41-47).
 */
const BACK_HREF = "/";

export function VouchAskView({ id }: { id: string }) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();
  const phase = useAuthPhase();
  const [landing, setLanding] = useState<Landing>({ kind: "reading" });

  /** Lands the page on the link's state for this reader — `check` read fresh. */
  const settle = useCallback(
    (check: AskCheck | null, member: boolean) => {
      if (check === null) {
        setLanding({ kind: "invalid" });
        return;
      }
      const handle = `@${check.applicantHandle}`;
      if (member && check.reason === "WAITING_ON_VIEWER") {
        carryToInvites({ kind: "alreadyWaiting", handle: check.applicantHandle });
        router.replace("/invites");
        return;
      }
      if (check.reason === "LANDED") {
        setLanding({ kind: "landed", handle });
        return;
      }
      setLanding({ kind: "ask", handle });
    },
    [router],
  );

  useEffect(() => {
    if (phase === "resolving") return undefined;
    let live = true;
    void (async () => {
      if (phase !== "signedIn") {
        // A guest who raises the gate here comes back to this ask once
        // signed in (VouchAsk.md:23).
        holdAskLink(id);
        const check = await checkAskLink(client, id);
        if (!live) return;
        if (check.kind !== "success") setLanding({ kind: "fault" });
        else settle(check.value, false);
        return;
      }
      releaseAskLink();
      const [me, mine, check] = await Promise.all([
        guard.run(() => fetchMe(client)),
        guard.run(() => fetchMyApplication(client)),
        guard.run(() => checkAskLink(client, id)),
      ]);
      if (!live) return;
      // The reader's own case answers first, at app-open, whatever the
      // link's state (VouchAsk.md:13-15, :49).
      if (mine.kind === "success" && mine.value.askLink === id) {
        carrySnackbar(YOUR_OWN_ASK_LINK);
        router.replace("/");
        return;
      }
      if (me.kind === "success" && me.value.accountState !== "MEMBER") {
        carrySnackbar(VOUCH_ONCE_IN);
        router.replace("/");
        return;
      }
      if (me.kind !== "success" || check.kind !== "success") {
        setLanding({ kind: "fault" });
        return;
      }
      settle(check.value, true);
    })();
    return () => {
      live = false;
    };
  }, [phase, client, guard, id, router, settle]);

  /** Set found the link changed under the ask: show its new state (VouchAskPad.md:27). */
  const recheck = useCallback(async () => {
    const check = await guard.run(() => checkAskLink(client, id));
    if (check.kind !== "success") setLanding({ kind: "fault" });
    else settle(check.value, true);
  }, [client, guard, id, settle]);

  switch (landing.kind) {
    case "reading":
      return (
        <Frame title={ASK_TITLE}>
          <p role="status" aria-live="polite" data-testid="vouch-ask-loading" className="m-0 px-4 text-body-medium text-on-surface-variant">
            Loading…
          </p>
        </Frame>
      );
    case "fault":
      return (
        <Frame title={ASK_TITLE}>
          <div className="px-4">
            <TransportError testId="vouch-ask-error" />
          </div>
        </Frame>
      );
    case "invalid":
      // VOUCHASKINVALID: no cause named, no error colour, the back arrow the
      // only way out (VouchAskInvalid.md).
      return (
        <Frame>
          <Statement title={INVALID_TITLE} body={INVALID_BODY} />
        </Frame>
      );
    case "landed":
      // VOUCHASKUNUSABLE: the one case the link reaches now — the asker is in
      // — and the door to their profile (VouchAskUnusable.md:15-17).
      return (
        <Frame>
          <Statement title={landedTitle(landing.handle)} body={LANDED_BODY}>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => router.push(`/u/${landing.handle.slice(1)}`)}
                {...testAttributes(part(ROOT, "profileDoor"))}
                className={`w-full ${buttonClassName({ variant: "text" })}`}
              >
                {profileDoor(landing.handle)}
              </button>
            </div>
          </Statement>
        </Frame>
      );
    case "ask":
      return <AskCard askLink={id} handle={landing.handle} onUnusable={() => void recheck()} />;
  }
}

/** The page's header and column: a plain `Back`, no origin noun (VouchAsk.md:39). */
function Frame({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-8">
      <PageHeader title={title} backHref={BACK_HREF} backLabel="Back" node={part(ROOT, "header")} />
      {children}
    </main>
  );
}

/** The headline and paragraph of the two dead ends, in the error-free voice. */
function Statement({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col px-6 pb-8 pt-2">
      <h1 {...testAttributes(part(ROOT, "title"))} className="m-0 text-headline-small">
        {title}
      </h1>
      <p {...testAttributes(part(ROOT, "body"))} className="m-0 mt-2 text-body-medium text-on-surface-variant">
        {body}
      </p>
      {children}
    </div>
  );
}

function AskCard({
  askLink,
  handle,
  onUnusable,
}: {
  askLink: string;
  handle: string;
  onUnusable: () => void;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const router = useRouter();
  const account = useActiveAccountId();
  const base = useStanceData();
  const detour = useRef<ApprovalDetour | null>(null);
  const data = useMemo(
    () =>
      createAskStanceData({ client, guard, signer, base }, askLink, (taken) => {
        detour.current = taken;
      }),
    [client, guard, signer, base, askLink],
  );
  const bare = handle.slice(1);


  const onTaken = (landed: StancePair) => {
    const took = detour.current;
    detour.current = null;
    if (took?.kind === "unusable") {
      onUnusable();
      return;
    }
    if (took?.kind === "notRegistered") {
      // Staged, the vouch kept, nothing signed or spent (VouchAskPad.md:33).
      void keepApproval(account, took.application.id, landed);
      carryToInvites({ kind: "notRegistered", handle: bare });
      router.push("/invites");
      return;
    }
    carryToInvites({ kind: "signed", handle: bare, landing: landed });
    router.push("/invites");
  };

  // THE KEY IS ELSEWHERE (VouchAskPad.md:29): `Keep it pending` stages the
  // asker first, so the kept vouch waits on Invites as its own row.
  const keep = (pick: StancePair) => {
    void data.stage().then((staged) => {
      if (staged.kind === "success") void keepApproval(account, staged.value.id, pick);
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-8">
      <PageHeader title={ASK_TITLE} backHref={BACK_HREF} backLabel="Back" node={part(ROOT, "header")} />
      <div className="flex flex-col gap-3 px-4 pt-2">
        <Card node={ASK}>
          <div className="flex items-center gap-3">
            <MonogramAvatar name={bare} size="lg" node={part(ASK, "avatar")} />
            <h2 {...testAttributes(part(ASK, "title"))} className="m-0 text-title-medium">
              {askTitle(handle)}
            </h2>
          </div>
          <p {...testAttributes(part(ASK, "body"))} className="m-0 text-body-medium text-on-surface-variant">
            {ASK_BODY}
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => router.push(BACK_HREF)}
              {...testAttributes(part(ASK, "later"))}
              className={buttonClassName({ variant: "text" })}
            >
              {NOT_NOW}
            </button>
            <StanceDataProvider data={data}>
              <StanceControl
                // The asker has no node anyone has stanced; the seam target
                // is the ask link itself until the take-up stages a row.
                target={{ kind: "profile", id: askLink, label: handle }}
                testIdPrefix="vouch-ask"
                node={part(ASK, "stance")}
                vouchesIn
                variant={{
                  helpLabel: HOW_VOUCHING_WORKS,
                  help: HOW_VOUCHING_WORKS_HELP,
                  note: approvePadNote(handle),
                  onTaken,
                  keep,
                  padNode: part(ASK, "stance.pad"),
                }}
              />
            </StanceDataProvider>
          </div>
        </Card>
      </div>
    </main>
  );
}
