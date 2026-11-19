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
import { fetchHeldOpinions, type HeldOpinionView } from "@/lib/api/opinions-api";
import { fetchCitingArtifacts, type CitingArtifactView } from "@/lib/api/references-api";
import { withRemoval } from "@/lib/api/removal-api";
import { sendReport } from "@/lib/api/report-api";
import { hideRow, hiddenPersonOf } from "@/lib/hidden/hide-row";
import { useHiddenSet } from "@/lib/hidden/provider";
import type { License } from "@/lib/license";
import { useSavedWrites } from "@/lib/saved/provider";
import { saveRow, type Notify } from "@/lib/saved/save-row";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { POST_LOCKED, useReaderIsApplicant } from "@/lib/session/reader-state";
import { useAuthGuard } from "@/lib/session/runtime";
import type { DataNode } from "@/lib/ui/data-node";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { payloadIsRedacted } from "@/lib/ui/post-media";
import { useNarrowShare } from "@/lib/ui/narrow-share";
import { LINK_COPIED, shareLink } from "@/lib/ui/share";
import { useShareCapable } from "@/lib/ui/share-button";
import { CitedBySheet } from "./cited-by-sheet";
import { LicenseSheet } from "./license-sheet";
import { OpinionsSheet } from "./opinions-sheet";
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

/**
 * THE TWO READINGS' SHEETS ARE ONE PAIR ON EVERY HOST (CitedBy.md:3-5,
 * PostOpinions.md:3-5): `postDetail.citedBySheet` and `postDetail.opinionsSheet`,
 * over the detail or over the list the card stands in. Each is mounted only
 * while it is up, so the one registered node names one open sheet.
 */
const CITED_BY_SHEET: DataNode = { path: "postDetail.citedBySheet" };
const OPINIONS_SHEET: DataNode = { path: "postDetail.opinionsSheet" };

/**
 * The detail's own doors into the two sheets its count lines raise: there the
 * menu's rows open those very sheets, reading the lists the lines count, never
 * a second copy (CitedBy.md:3, PostOpinions.md:3).
 */
export type PostReadings = {
  openCitedBy: () => void;
  openOpinions: () => void;
};

export function PostMenuHost({
  post,
  open,
  onClose,
  nodes = {},
  testId,
  notify,
  onRemoved,
  readings,
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
  /**
   * The host's own doors into the post's two readings — the detail's. Absent,
   * the host raises its own pair over itself, read when asked.
   */
  readings?: PostReadings;
}) {
  const router = useRouter();
  const client = useApolloClient();
  const guard = useAuthGuard();
  const phase = useAuthPhase();
  const viewerId = useActiveAccountId();
  const applicant = useReaderIsApplicant();
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
  // The two readings over a list, each null until raised and its rows null
  // while the read is out — so the empty line never shows before the answer.
  const [citedBy, setCitedBy] = useState<{
    readonly node: string;
    readonly artifacts: readonly CitingArtifactView[] | null;
  } | null>(null);
  const [opinions, setOpinions] = useState<{
    readonly node: string;
    readonly opinions: readonly HeldOpinionView[] | null;
  } | null>(null);

  const openCitedBy = (nodeId: string) => {
    setCitedBy({ node: nodeId, artifacts: null });
    void fetchCitingArtifacts(client, nodeId).then((outcome) => {
      if (outcome.kind !== "success") return;
      // Another card's row may have raised another post's list meanwhile.
      setCitedBy((current) =>
        current?.node === nodeId ? { node: nodeId, artifacts: outcome.value } : current,
      );
    });
  };
  const openOpinions = (nodeId: string) => {
    setOpinions({ node: nodeId, opinions: null });
    void fetchHeldOpinions(client, nodeId).then((outcome) => {
      if (outcome.kind !== "success") return;
      setOpinions((current) =>
        current?.node === nodeId ? { node: nodeId, opinions: outcome.value } : current,
      );
    });
  };

  const href = post === null ? null : `/posts/${post.id}`;
  const items =
    post === null || href === null
      ? []
      : postMenuItems({
          postId: post.id,
          own: viewerId !== null && post.author?.id === viewerId,
          removed: payloadIsRedacted(post),
          handle: post.author?.handle ?? null,
          license: post.license,
          navigate: (route) => router.push(route),
          openLicense: (license) => {
            setLicenseShown(license);
            setLicenseOpen(true);
          },
          // RemoveMenu.md:19 — the sheet closes and the think-twice dialog opens.
          openRemove: () => setRemoving(post),
          // ReaderPostMenu.md:31-33 — the menu closes (`MenuSheet` closes on
          // any row) and the reading comes up over the same surface.
          openCitedBy: readings?.openCitedBy ?? (() => openCitedBy(post.id)),
          openOpinions: readings?.openOpinions ?? (() => openOpinions(post.id)),
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
          // While the author is hidden the row reads Unhide and unhides
          // (ReaderPostMenu.md:19-21; round 41).
          hide:
            post.author == null
              ? undefined
              : hideRow({
                  set: hidden,
                  person: hiddenPersonOf(post.author),
                  origin: post.id,
                  notify,
                  onGuest: phase === "signedOut" ? () => setJoinOpen(true) : null,
                }),
          onGuest: phase === "signedOut" ? () => setJoinOpen(true) : null,
          onApplicant: applicant ? () => notify(POST_LOCKED) : null,
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
      {/* MOUNTED FROM THE FIRST ⋮ ON: a host whose page carries a menu of its
          own under the same registered node (the profile's `profile.menuSheet`)
          holds one such sheet until a card's menu is asked for. */}
      {post !== null && (
        <MenuSheet
          open={open}
          onClose={onClose}
          items={items}
          ariaLabel="Post actions"
          testId={`${testId}-sheet`}
          node={nodes.sheet}
        />
      )}
      {licenseShown !== null && (
        <LicenseSheet
          open={licenseOpen}
          onClose={() => setLicenseOpen(false)}
          license={licenseShown}
          testId={`${testId}-license-sheet`}
          node={nodes.licenseSheet}
        />
      )}
      {citedBy !== null && (
        <CitedBySheet
          open
          onClose={() => setCitedBy(null)}
          artifacts={citedBy.artifacts}
          node={CITED_BY_SHEET}
          testId={`${testId}-cited-by-sheet`}
        />
      )}
      {opinions !== null && (
        <OpinionsSheet
          open
          onClose={() => setOpinions(null)}
          on="post"
          opinions={opinions.opinions}
          node={OPINIONS_SHEET}
          testId={`${testId}-opinions-sheet`}
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
