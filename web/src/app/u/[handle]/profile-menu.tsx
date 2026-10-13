"use client";

// THE PROFILE'S ⋮ AND THE THREE SHEETS IT OPENS (ProfileOwnMenu.md,
// ProfileMenu.md, ProfileDeletedMenu.md; `_shared.jsx` `ownProfileMenu`,
// `otherProfileMenu`, `deletedProfileMenu`). The dot closes the profile's
// actions row (`profile.identity.actionRow.menu`) on all three.
//
// - The reader's own profile: Saved, History, Share your profile — the
//   private state's one door. No Report row: the own menus' rule.
// - Another person's: Save or Unsave, Mention in a new post, Share this
//   profile, Hide @handle, and Report at the tail.
// - A deleted account's: Save or Unsave, Share this profile, Hide this
//   account, Report — no Mention row and no handle anywhere, the identity
//   having gone with the account.
//
// BUILT WHOLE, WIRED IN PART (saved-surface SS-1; the introduced-but-inert
// law, jakob 2026-09-14): History waits on the History surface, Hide on the
// hidden-actors packet, Mention on the compose wizard's profile reference.
// Those rows stand at full strength and do nothing yet; the hand-test notes
// name each.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { sendReport } from "@/lib/api/report-api";
import { useSavedWrites } from "@/lib/saved/provider";
import { saveRow, type Notify } from "@/lib/saved/save-row";
import { useAuthGuard } from "@/lib/session/runtime";
import { LINK_COPIED, shareLink } from "@/lib/ui/share";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { MenuSheet, OverflowTrigger, type MenuItem } from "@/lib/ui2/overflow-menu";
import { ReportConfirm } from "@/lib/ui2/report-confirm";
import { REPORTED, REPORT_NOT_SENT } from "@/lib/ui2/post-menu-host";

export type ProfileMenuKind = "own" | "other" | "deleted";

const SHEET = { path: "profile.menuSheet" };
const row = (name: string) => ({ path: `profile.menuSheet.${name}` });

export function ProfileMenu({
  kind,
  profile,
  signedIn,
  notify,
}: {
  kind: ProfileMenuKind;
  profile: { id: string; handle: string; viewerBookmarkedAt?: string | null };
  signedIn: boolean;
  /** The profile's own snackbar. */
  notify: Notify;
}) {
  const router = useRouter();
  const client = useApolloClient();
  const guard = useAuthGuard();
  const writes = useSavedWrites();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  // A guest who taps any row but Share is asked to join (ProfileMenu.md;
  // GuestGate.md:5).
  const gated = (act: () => void) => () => (signedIn ? act() : setJoinOpen(true));
  const share = () => {
    const url = new URL(`/u/${profile.handle}`, window.location.href).toString();
    void shareLink(url).then((outcome) => {
      if (outcome === "copied") notify(LINK_COPIED);
    });
  };
  const inert = () => {};
  const report: MenuItem = {
    label: "Report",
    onSelect: gated(() => setReportOpen(true)),
    testId: "profile-menu-report",
    node: row("report"),
  };
  const save: MenuItem = {
    ...saveRow({
      writes,
      node: profile.id,
      server: profile.viewerBookmarkedAt ?? null,
      notify,
      onGuest: signedIn ? null : () => setJoinOpen(true),
      testId: "profile-menu-save",
    }),
    node: row("save"),
  };

  let items: MenuItem[];
  let ariaLabel: string;
  if (kind === "own") {
    ariaLabel = "More on your profile";
    items = [
      { label: "Saved", onSelect: () => router.push("/saved"), testId: "profile-menu-saved", node: row("saved") },
      // INERT until History is built (saved-surface D4 / History's H3).
      { label: "History", onSelect: inert, testId: "profile-menu-history", node: row("history") },
      { label: "Share your profile", onSelect: share, testId: "profile-menu-share", node: row("share") },
    ];
  } else if (kind === "other") {
    ariaLabel = `More about @${profile.handle}`;
    items = [
      save,
      // INERT until the wizard takes a profile as a staged reference.
      { label: "Mention in a new post", onSelect: gated(inert), testId: "profile-menu-mention", node: row("mention") },
      { label: "Share this profile", onSelect: share, testId: "profile-menu-share", node: row("share") },
      // INERT until the hidden-actors packet wires `hideActor`.
      { label: `Hide @${profile.handle}`, onSelect: gated(inert), testId: "profile-menu-hide", node: row("hide") },
      report,
    ];
  } else {
    ariaLabel = "More about this account";
    items = [
      save,
      { label: "Share this profile", onSelect: share, testId: "profile-menu-share", node: row("share") },
      // INERT until the hidden-actors packet wires `hideActor`.
      { label: "Hide this account", onSelect: gated(inert), testId: "profile-menu-hide", node: row("hide") },
      report,
    ];
  }

  // THE COMMIT SENDS THE MAIL; refused or unanswered, the sheet stays and the
  // snackbar never claims a report that did not go out (the post menu's rule).
  const commitReport = async () => {
    if (sending) return;
    setSending(true);
    const outcome = await guard.run(() => sendReport(client, profile.id));
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
      <OverflowTrigger
        ariaLabel={ariaLabel}
        testId="profile-menu"
        node={{ path: "profile.identity.actionRow.menu" }}
        expanded={open}
        onOpen={() => setOpen(true)}
      />
      <MenuSheet
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        ariaLabel={ariaLabel}
        testId="profile-menu-sheet"
        node={SHEET}
      />
      {kind !== "own" && (
        <ReportConfirm
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          onReport={() => void commitReport()}
          sending={sending}
          // THE TITLE NAMES THE PERSON, and a deleted account by no handle.
          title={kind === "deleted" ? "Report this account?" : `Report @${profile.handle}?`}
          testId="profile-report-sheet"
        />
      )}
      {joinOpen && <JoinPrompt open onClose={() => setJoinOpen(false)} />}
    </>
  );
}
