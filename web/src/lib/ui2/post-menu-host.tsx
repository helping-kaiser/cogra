"use client";

// ONE POST MENU, HOSTED BY THE SURFACE IT RISES OVER (ruling 84;
// FeedPostMenu.jsx, ReaderPostMenu.jsx). The detail's sheet and the feed's are
// one sheet on two hosts: the rows are `postMenuItems`, and everything the rows
// raise — the license terms, the removal's think-twice dialog, the report's
// confirm, the guest's join prompt — rises over the same surface the menu was
// opened from. What differs per host is only what is registered there: the
// sheet's own node, which rows the board names, and whose snackbar carries the
// aftermath.
//
// THE POST OUTLIVES THE `open` FLAG, the way the license block always has: a
// sheet is still on screen through its own exit, and one whose post vanished
// mid-exit would blank out.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import type { PostView } from "@/lib/api/content-api";
import { withRemoval } from "@/lib/api/removal-api";
import { sendReport } from "@/lib/api/report-api";
import { hideAct, hiddenPersonOf } from "@/lib/hidden/hide-row";
import { useHiddenSet } from "@/lib/hidden/provider";
import type { License } from "@/lib/license";
import { useSavedWrites } from "@/lib/saved/provider";
import { saveRow, type Notify } from "@/lib/saved/save-row";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import type { DataNode } from "@/lib/ui/data-node";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { useNarrowShare } from "@/lib/ui/narrow-share";
import { LINK_COPIED, shareLink } from "@/lib/ui/share";
import { useShareCapable } from "@/lib/ui/share-button";
import { LicenseSheet } from "./license-sheet";
import { MenuSheet } from "./overflow-menu";
import { postMenuItems, type PostMenuRow } from "./post-menu";
import { RemoveConfirm } from "./remove-confirm";
import { ReportConfirm } from "./report-confirm";

/** The report went out (ReportConfirm.md:11). */
export const REPORTED = "Reported.";

/**
 * A report that was refused or got no answer (ReportConfirm.md:13-15; item 95's
 * shared no-answer line): the sheet stays, and this is the snackbar — never
 * `Reported.`.
 */
export const REPORT_NOT_SENT = "That didn't send. Try again.";

/** What one host registers of the shared menu. */
export type PostMenuHostNodes = {
  /** The sheet (`feed.menuSheet`, `postDetail.menuSheet`). */
  sheet?: DataNode;
  /** The rows the host's board names. */
  row?: (row: PostMenuRow) => DataNode | undefined;
  /** The report confirm (`postDetail.reportSheet`, `feed.reportSheet`). */
  reportSheet?: DataNode;
  /** The license terms (`feed.licenseSheet`, `postDetail.licenseSheet`). */
  licenseSheet?: DataNode;
  /** The removal's think-twice dialog, where its board names it. */
  removeDialog?: DataNode;
};

export function PostMenuHost({
  post,
  open,
  onClose,
  nodes = {},
  testId,
  notify,
  onRemoved,
}: {
  /** The post whose menu is up, or was last; null before any. */
  post: PostView | null;
  open: boolean;
  onClose: () => void;
  nodes?: PostMenuHostNodes;
  /** Ids of the parts no board registers derive from this. */
  testId: string;
  /** The host's own snackbar, which carries the menu's aftermath. */
  notify: Notify;
  /**
   * The author's Remove was taken (RemoveConfirm.md:11). The host swaps the
   * post it holds for `removed` — the same post wearing its mark — so the card
   * or the detail stands as its mark in place, never leaving without one
   * (RM-G9's build word on the hosts off the detail).
   */
  onRemoved: (removed: PostView) => void;
}) {
  const router = useRouter();
  const client = useApolloClient();
  const guard = useAuthGuard();
  const phase = useAuthPhase();
  const viewerId = useActiveAccountId();
  const writes = useSavedWrites();
  const hidden = useHiddenSet();
  // THE NARROW-SHARE FOLD (design/readme.md, jakob 2026-09-17, sharpened
  // 2026-09-22 — PR #794): strictly below 360px the card's row sheds Share and
  // the reader's menu leads with it instead. Capability gated the same way the
  // button is — a browser with no share door never grows a dead row.
  const narrow = useNarrowShare();
  const shareCapable = useShareCapable();
  const [licenseShown, setLicenseShown] = useState<License | null>(null);
  const [licenseOpen, setLicenseOpen] = useState(false);
  // THE POST THE DIALOG REMOVES, held from the moment its row was tapped: the
  // menu's own post may move on (another card's ⋮) while the dialog is up.
  const [removing, setRemoving] = useState<PostView | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const href = post === null ? null : `/posts/${post.id}`;
  const items =
    post === null || href === null
      ? []
      : postMenuItems({
          postId: post.id,
          own: viewerId !== null && post.author?.id === viewerId,
          handle: post.author?.handle ?? null,
          license: post.license,
          navigate: (route) => router.push(route),
          openLicense: (license) => {
            setLicenseShown(license);
            setLicenseOpen(true);
          },
          // RemoveMenu.md:19 — the sheet closes and the think-twice dialog opens.
          openRemove: () => setRemoving(post),
          // A GUEST IS ASKED TO JOIN, never shown a sheet whose commit the
          // server would refuse (ReportConfirm.md:21).
          openReport: () => (phase === "signedOut" ? setJoinOpen(true) : setReportOpen(true)),
          shareRow:
            narrow && shareCapable
              ? {
                  label: "Share",
                  onSelect: () => {
                    void shareLink(new URL(href, window.location.href).toString()).then(
                      (outcome) => {
                        if (outcome === "copied") notify(LINK_COPIED);
                      },
                    );
                  },
                  testId: `${testId}-share`,
                }
              : null,
          // A GUEST IS ASKED TO JOIN before anything is kept (GuestGate.md:5).
          save: saveRow({
            writes,
            node: post.id,
            server: post.viewerBookmarkedAt ?? null,
            notify,
            onGuest: phase === "signedOut" ? () => setJoinOpen(true) : null,
            testId: `${testId}-save`,
          }),
          // HIDING NAMES ITS PERSON AND ASKS NOTHING (FeedHidden.md:3): the
          // host's rows take the person out, and its snackbar offers Undo.
          hide:
            post.author == null
              ? undefined
              : hideAct({
                  set: hidden,
                  person: hiddenPersonOf(post.author),
                  origin: post.id,
                  notify,
                  onGuest: phase === "signedOut" ? () => setJoinOpen(true) : null,
                }),
          testIdPrefix: testId,
          rowNode: nodes.row,
        });

  // THE COMMIT SENDS THE MAIL (ruling 75). Gone through: the sheet closes and
  // the snackbar says so. Refused — the day's reports spent, the thing gone —
  // or unanswered: the sheet stays so the reader can try again, and the
  // snackbar never claims a report that did not go out (FC-G15).
  const report = async () => {
    if (post === null || sending) return;
    setSending(true);
    const outcome = await guard.run(() => sendReport(client, post.id));
    setSending(false);
    if (outcome.kind === "success") {
      setReportOpen(false);
      notify(REPORTED);
    } else {
      notify(REPORT_NOT_SENT);
    }
  };

  return (
    <>
      <MenuSheet
        open={open}
        onClose={onClose}
        items={items}
        ariaLabel="More on this post"
        testId={`${testId}-sheet`}
        node={nodes.sheet}
      />
      {licenseShown !== null && (
        <LicenseSheet
          open={licenseOpen}
          onClose={() => setLicenseOpen(false)}
          license={licenseShown}
          testId={`${testId}-license-sheet`}
          node={nodes.licenseSheet}
        />
      )}
      {/* THE THINK-TWICE DIALOG, over the surface the menu rose from. Mounted
          only while it is up: the dialog is the removal's own surface, and its
          in-flight and failed states belong to one asking. */}
      {removing !== null && (
        <RemoveConfirm
          kind="post"
          nodeId={removing.id}
          record={removing.genesisRecordId}
          onClose={() => setRemoving(null)}
          onRemoved={(removal) => onRemoved(withRemoval(removing, removal))}
          node={nodes.removeDialog}
          testId={`${testId}-remove-confirm`}
        />
      )}
      <ReportConfirm
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onReport={() => void report()}
        sending={sending}
        node={nodes.reportSheet}
        testId={`${testId}-report-sheet`}
      />
      {/* Conditionally mounted: `JoinPrompt` always draws its own test id,
          and a card's stance gate may already have one in the tree. */}
      {joinOpen && <JoinPrompt open onClose={() => setJoinOpen(false)} />}
    </>
  );
}
