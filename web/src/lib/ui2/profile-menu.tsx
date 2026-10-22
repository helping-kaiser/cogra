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
// THE PROFILE FEED CARD'S ⋮ IS THE SAME MENU LESS THE SHARE ROW the card's own
// row already carries (`_shared.jsx` `FEED_PROFILE_MENU`,
// `FEED_DELETED_PROFILE_MENU`): a person's reads Save · Mention · Hide, a
// deleted account's Save · Hide · Report. `feed` places it on a card: the
// card names the trigger, and the sheet and its rows carry the card's test
// ids rather than the profile page's registered paths.
//
// BUILT WHOLE, WIRED IN PART (saved-surface SS-1; the introduced-but-inert
// law, jakob 2026-09-14): History waits on the History surface, Mention on
// the compose wizard's profile reference.
// Those rows stand at full strength and do nothing yet; the hand-test notes
// name each.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { sendReport } from "@/lib/api/report-api";
import { hideAct, hideLabel, hiddenPersonOf, type ActorLike } from "@/lib/hidden/hide-row";
import { useHiddenSet } from "@/lib/hidden/provider";
import { useSavedWrites } from "@/lib/saved/provider";
import { saveRow, type Notify } from "@/lib/saved/save-row";
import { useAuthGuard } from "@/lib/session/runtime";
import type { DataNode } from "@/lib/ui/data-node";
import { LINK_COPIED, shareLink } from "@/lib/ui/share";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { MenuSheet, OverflowTrigger, type MenuItem } from "@/lib/ui2/overflow-menu";
import { ReportConfirm } from "@/lib/ui2/report-confirm";
import { REPORTED, REPORT_NOT_SENT } from "@/lib/ui2/post-menu-host";

export type ProfileMenuKind = "own" | "other" | "deleted";

const SHEET = { path: "profile.menuSheet" };
const pageRow = (name: string): DataNode => ({ path: `profile.menuSheet.${name}` });

/** Where a profile feed card places the menu: its trigger's node, and its test-id scope. */
export type FeedPlacement = {
  readonly trigger?: DataNode;
  readonly testId: string;
};

export function ProfileMenu({
  kind,
  profile,
  signedIn,
  notify,
  feed,
}: {
  kind: ProfileMenuKind;
  profile: ActorLike & { handle: string; viewerBookmarkedAt?: string | null };
  signedIn: boolean;
  /** The host's own snackbar. */
  notify: Notify;
  /** The menu on a profile feed card instead of the profile page. */
  feed?: FeedPlacement;
}) {
  const router = useRouter();
  const client = useApolloClient();
  const guard = useAuthGuard();
  const writes = useSavedWrites();
  const hidden = useHiddenSet();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const prefix = feed?.testId ?? "profile-menu";
  const row = (name: string): DataNode | undefined => (feed === undefined ? pageRow(name) : undefined);

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
    testId: `${prefix}-report`,
    node: row("report"),
  };
  const save: MenuItem = {
    ...saveRow({
      writes,
      node: profile.id,
      server: profile.viewerBookmarkedAt ?? null,
      notify,
      onGuest: signedIn ? null : () => setJoinOpen(true),
      testId: `${prefix}-save`,
    }),
    node: row("save"),
  };
  const mention: MenuItem = {
    // INERT until the wizard takes a profile as a staged reference.
    label: "Mention in a new post",
    onSelect: gated(inert),
    testId: `${prefix}-mention`,
    node: row("mention"),
  };
  const shareRow: MenuItem = {
    label: "Share this profile",
    onSelect: share,
    testId: `${prefix}-share`,
    node: row("share"),
  };
  // HIDING KEEPS THE READER WHERE THEY ARE (ProfileMenu.md:23): the person
  // leaves the feed, the page stays, and the host's snackbar offers Undo.
  // A deleted account's row and snackbar name no one (ProfileDeletedMenu.md:19).
  const person = hiddenPersonOf(kind === "deleted" ? { ...profile, handle: null } : profile);
  const hide: MenuItem = {
    label: hideLabel(person),
    onSelect: hideAct({
      set: hidden,
      person,
      origin: profile.id,
      notify,
      onGuest: signedIn ? null : () => setJoinOpen(true),
    }),
    testId: `${prefix}-hide`,
    node: row("hide"),
  };

  let items: MenuItem[];
  let ariaLabel: string;
  if (kind === "own" && feed === undefined) {
    ariaLabel = "More on your profile";
    items = [
      { label: "Saved", onSelect: () => router.push("/saved"), testId: "profile-menu-saved", node: row("saved") },
      // INERT until History is built (saved-surface D4 / History's H3).
      { label: "History", onSelect: inert, testId: "profile-menu-history", node: row("history") },
      { label: "Share your profile", onSelect: share, testId: "profile-menu-share", node: row("share") },
    ];
  } else if (kind === "deleted") {
    ariaLabel = "More about this account";
    items = feed === undefined ? [save, shareRow, hide, report] : [save, hide, report];
  } else {
    ariaLabel = `More about @${profile.handle}`;
    // THE READER'S OWN CARD (undrawn: a card of oneself is reached only by
    // saving one's own profile) keeps the one act that is theirs to take on it.
    if (kind === "own") items = [save];
    else items = feed === undefined ? [save, mention, shareRow, hide, report] : [save, mention, hide];
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
        testId={prefix}
        node={feed === undefined ? { path: "profile.identity.actionRow.menu" } : feed.trigger}
        expanded={open}
        onOpen={() => setOpen(true)}
      />
      <MenuSheet
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        // THE SHEET IS NAMED FOR WHAT IT HOLDS: `Profile actions` over another
        // person's page or a deleted account's (`ProfileMenu.jsx`,
        // `ProfileDeletedMenu.jsx`), while the ⋮ names whose they are.
        ariaLabel={kind === "own" || feed !== undefined ? ariaLabel : "Profile actions"}
        testId={`${prefix}-sheet`}
        node={feed === undefined ? SHEET : undefined}
      />
      {kind !== "own" && (
        <ReportConfirm
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          onReport={() => void commitReport()}
          sending={sending}
          // THE TITLE NAMES THE PERSON, and a deleted account by no handle.
          title={kind === "deleted" ? "Report this account?" : `Report @${profile.handle}?`}
          testId={feed === undefined ? "profile-report-sheet" : `${prefix}-report-sheet`}
        />
      )}
      {joinOpen && <JoinPrompt open onClose={() => setJoinOpen(false)} />}
    </>
  );
}
