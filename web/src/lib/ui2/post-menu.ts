// The rows a post's overflow menu holds, for every surface that draws one.
//
// THE MENU IS THE POST'S, NOT THE SCREEN'S. `PostCard.jsx:262` puts the ⋮ on
// every non-detail card and `_shared.jsx:341-346` takes it off the detail's,
// where the page header carries the one menu instead — so the same two row
// sets are built by a card in a feed and by a page header on a detail. They
// live here rather than in either caller, because a second copy is how the
// two drift.

import type { License } from "@/lib/license";
import type { DataNode } from "@/lib/ui/data-node";
import type { MenuItem } from "./overflow-menu";

/** The rows a post menu can hold, by the names their sheet nodes take. */
export type PostMenuRow =
  | "save"
  | "cite"
  | "hide"
  | "license"
  | "report"
  | "edit"
  | "markSensitive"
  | "remove";

/**
 * What a surface hands the builder so the rows can act.
 *
 * `navigate` rather than the router itself: the detail builds its rows below
 * an early return, where a hook cannot be called, so this stays a plain
 * function and the caller brings its own `router.push`.
 */
export type PostMenuContext = {
  postId: string;
  /** The viewer is the author — `OWN_POST_MENU` rather than `READER_POST_MENU`. */
  own: boolean;
  /** The author's handle, for the reader menu's hide row. */
  handle: string | null;
  /** Dropped from the rows when there is none: a redacted record has no license. */
  license: License | null;
  /** `router.push`. */
  navigate: (href: string) => void;
  openLicense: (license: License) => void;
  openRemove: () => void;
  /**
   * The report row's door: the confirm sheet over the surface the menu was
   * opened from (ReportConfirm.md:3), or the join prompt for a guest (:21).
   * Absent where the surface hosts no confirm yet, and the row then stands
   * inert (jakob 2026-09-14, the introduced-but-inert law).
   */
  openReport?: () => void;
  /**
   * THE NARROW PHONE'S MENU HOLDS THE SHARE IT TOOK (design/readme.md, jakob
   * 2026-09-17, sharpened 2026-09-22 — PR #794): strictly below 360px of
   * viewport width the affordance row's Share control folds into this menu
   * instead, leading the sheet; at 360 the wide row keeps it. Built by the
   * caller — the same place `ShareButton` mounts — and only where it
   * applies: null skips the row (own posts have no drawn board for it, and a
   * browser with no share door grows no dead row either).
   */
  shareRow: MenuItem | null;
  /**
   * The first row's words and act — `Save` or `Unsave` as the post is kept
   * (`saveRow`, the one save behaviour every menu shares).
   */
  save: { label: string; onSelect: () => void };
  /** Row test ids derive from this — `post-menu` gives `post-menu-save`. */
  testIdPrefix: string;
  /**
   * The registered node a row wears on a registered sheet
   * (`feed.menuSheet.save`), or undefined for a row whose path the board does
   * not register — that row keeps its `testIdPrefix` id.
   */
  rowNode?: (row: PostMenuRow) => DataNode | undefined;
};

/**
 * THE ROWS THE ONE MENU HOLDS — the author's post vs someone else's
 * (`_shared.jsx:597-605`). Both keep the card's order: the acts the menu was
 * opened for lead, and the license row closes the author's. The license row is
 * dropped when there is none to show: the license rode the payload, so a
 * redacted record has none (`PostCard.jsx:146-148`).
 *
 * REPORT SITS AT THE TAIL OF EVERY OTHER-PERSON MENU, below even the license
 * (ruling 75; `_shared.jsx:586-596`): the one row a reader reaches for about
 * someone else's conduct rather than about using the thing. Own menus carry
 * none — a reader has nothing to report themselves for.
 *
 * ROWS WHOSE DESTINATION IS NOT BUILT STAND ANYWAY and do nothing (jakob
 * 2026-09-14, the introduced-but-inert law): a menu that grew a row per slice
 * would be a different menu every release, and the row order is ruled. Hide
 * waits on hidden-actors' `hideActor`.
 */
export function postMenuItems({
  postId,
  own,
  handle,
  license,
  navigate,
  openLicense,
  openRemove,
  openReport,
  shareRow,
  save,
  testIdPrefix,
  rowNode = () => undefined,
}: PostMenuContext): MenuItem[] {
  const row = (name: PostMenuRow, testName: string, label: string, onSelect: () => void) => ({
    label,
    onSelect,
    testId: `${testIdPrefix}-${testName}`,
    node: rowNode(name),
  });
  const rows: MenuItem[] = [];
  // SHARE LEADS THE SHEET, ahead of Save: every other row here is a menu row
  // by nature, and share is the one that was a one-tap control a moment ago
  // (design/readme.md). Only the reader's menu gains it — no board draws it
  // leaving the author's own.
  if (!own && shareRow !== null) rows.push(shareRow);
  rows.push(row("save", "save", save.label, save.onSelect));
  // CITE STANDS SECOND ON BOTH MENUS (`_shared.jsx:414-420`, backlog item
  // 100): self-citation is a real authorial act, so the thumb finds the row
  // in one place on every menu that has it.
  rows.push(row("cite", "cite", "Cite in a new post", () => navigate(`/compose?reference=${postId}`)));
  if (own) {
    rows.push(
      row("edit", "edit", "Edit", () => navigate(`/compose?post=${postId}`)),
      // SENSITIVE STAYS IN EDIT (jakob 2026-09-14): marking a published post
      // sensitive is always a signed action changing the post — an edit — so
      // there is no standalone commit path and this row is a door into the
      // edit flow rather than a sheet of its own. Edit is the general door;
      // this is the intentioned one. When the edit surface's drawn Sensitive
      // row lands (CW-46) the link can focus it.
      row("markSensitive", "sensitive", "Mark as sensitive", () =>
        navigate(`/compose?post=${postId}`),
      ),
      row("remove", "remove", "Remove", openRemove),
    );
  } else {
    // The handle is the thing a reader recognises, and the word they will
    // look for again under Hidden accounts (`ActorChip.jsx:67`).
    rows.push(row("hide", "hide", handle === null ? "Hide this account" : `Hide @${handle}`, () => {}));
  }
  if (license !== null) {
    rows.push(row("license", "license", "License terms", () => openLicense(license)));
  }
  if (!own) rows.push(row("report", "report", "Report", openReport ?? (() => {})));
  return rows;
}
