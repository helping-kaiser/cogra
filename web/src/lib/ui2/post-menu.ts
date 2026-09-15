// The rows a post's overflow menu holds, for every surface that draws one.
//
// THE MENU IS THE POST'S, NOT THE SCREEN'S. `PostCard.jsx:257` puts the ⋮ on
// every non-detail card and `_shared.jsx:337-341` takes it off the detail's,
// where the page header carries the one menu instead — so the same two row
// sets are built by a card in a feed and by a page header on a detail. They
// live here rather than in either caller, because a second copy is how the
// two drift.

import type { License } from "@/lib/license";
import type { MenuItem } from "./overflow-menu";

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
  /** Row test ids derive from this — `post-menu` gives `post-menu-save`. */
  testIdPrefix: string;
};

/**
 * THE ROWS THE ONE MENU HOLDS — the author's post vs someone else's
 * (`_shared.jsx:369-376`). Both keep the card's order: the acts the menu was
 * opened for lead, and the license row closes it, the license being the
 * rarest read in the product. The license row is dropped when there is none
 * to show: the license rode the payload, so a redacted record has none
 * (`PostCard.jsx:142`).
 *
 * ROWS WHOSE DESTINATION IS NOT BUILT STAND ANYWAY and do nothing (jakob
 * 2026-09-14, the introduced-but-inert law): a menu that grew a row per slice
 * would be a different menu every release, and the row order is ruled.
 */
export function postMenuItems({
  postId,
  own,
  handle,
  license,
  navigate,
  openLicense,
  openRemove,
  testIdPrefix,
}: PostMenuContext): MenuItem[] {
  const rows: MenuItem[] = [
    { label: "Save", onSelect: () => {}, testId: `${testIdPrefix}-save` },
  ];
  if (own) {
    rows.push(
      {
        label: "Edit",
        onSelect: () => navigate(`/compose?post=${postId}`),
        testId: `${testIdPrefix}-edit`,
      },
      {
        // SENSITIVE STAYS IN EDIT (jakob 2026-09-14): marking a published
        // post sensitive is always a signed action changing the post — an
        // edit — so there is no standalone commit path and this row is a
        // door into the edit flow rather than a sheet of its own. Edit is
        // the general door; this is the intentioned one. When the edit
        // surface's drawn Sensitive row lands (CW-46) the link can focus it.
        label: "Mark as sensitive",
        onSelect: () => navigate(`/compose?post=${postId}`),
        testId: `${testIdPrefix}-sensitive`,
      },
      { label: "Remove", onSelect: openRemove, testId: `${testIdPrefix}-remove` },
    );
  } else {
    rows.push(
      {
        label: "Cite in a new post",
        onSelect: () => navigate(`/compose?reference=${postId}`),
        testId: `${testIdPrefix}-cite`,
      },
      {
        // The handle is the thing a reader recognises, and the word they will
        // look for again under Hidden accounts (`ActorChip.jsx:67`).
        label: handle === null ? "Hide this account" : `Hide @${handle}`,
        onSelect: () => {},
        testId: `${testIdPrefix}-hide`,
      },
    );
  }
  if (license !== null) {
    rows.push({
      label: "License terms",
      onSelect: () => openLicense(license),
      testId: `${testIdPrefix}-license`,
    });
  }
  return rows;
}
