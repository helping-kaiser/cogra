// THE COMMENT'S ROWS (`_shared.jsx` `COMMENT_MENU`, `OWN_COMMENT_MENU`): Save ·
// Cite in a new post · Cited by · Opinions on this · License terms on a
// reader's comment, and the author's own with Remove joined as the last of the
// acts — Save · Cite in a new post · Remove · Cited by · Opinions on this ·
// License terms (CommentMenuOwn.md:3). No Hide — hiding names an actor, and
// its route is the commenter's profile (jakob 2026-09-12). One builder for
// every comment's ⋮ — the thread's, and the comment feed card's — the way
// `post-menu.ts` is the post's.
//
// NO EDIT ROW AND NO SENSITIVE ROW on the own menu, though the post's has both
// (`_shared.jsx`, the comment-removal round): a comment's Edit is a button on
// its own card, and its sensitive mark rides that edit.
//
// Save is the one behaviour every menu shares (`saveRow`), its aftermath on
// the host's own snackbar. `Opinions on this` STANDS WHATEVER THE COUNT IS:
// a row that came and went with a number would make the menu a different
// menu every time.

import type { License } from "@/lib/license";
import { saveRow, type Notify } from "@/lib/saved/save-row";
import type { SavedWrites } from "@/lib/saved/saved-writes";
import type { MenuItem } from "./overflow-menu";

export function commentMenuItems({
  comment,
  writes,
  notify,
  onGuest,
  navigate,
  openCitedBy,
  openOpinions,
  openLicense,
  openRemove,
  testIdPrefix,
}: {
  comment: {
    readonly id: string;
    readonly viewerBookmarkedAt?: string | null;
    readonly license?: License | null;
  };
  writes: SavedWrites;
  /** The host's snackbar. */
  notify: Notify;
  /** The host's join prompt; null means the reader is signed in. */
  onGuest: (() => void) | null;
  navigate: (route: string) => void;
  openCitedBy: (id: string) => void;
  /** The comment's opinions sheet (CommentOpinionsEmpty.md), stacked over the host. */
  openOpinions: (id: string) => void;
  openLicense: (license: License) => void;
  /**
   * The reader's OWN comment: its think-twice dialog (CommentMenuOwn.md:13).
   * Given only for the author — its presence is what makes this the own menu,
   * and the own menus carry no Report row either way.
   */
  openRemove?: () => void;
  /** Rows are `<prefix>-save-<id>`, `<prefix>-cite-<id>`, …. */
  testIdPrefix: string;
}): MenuItem[] {
  const rows: MenuItem[] = [
    saveRow({
      writes,
      node: comment.id,
      server: comment.viewerBookmarkedAt ?? null,
      notify,
      onGuest,
      testId: `${testIdPrefix}-save-${comment.id}`,
    }),
    {
      label: "Cite in a new post",
      onSelect: () => navigate(`/compose?reference=${comment.id}`),
      testId: `${testIdPrefix}-cite-${comment.id}`,
    },
  ];
  // REMOVE IS THE LAST OF THE ACTS, before the two readings — `OWN_POST_MENU`'s
  // place for the row, at comment scale (`CommentMenuOwn.jsx`).
  if (openRemove !== undefined) {
    rows.push({
      label: "Remove",
      onSelect: openRemove,
      testId: `${testIdPrefix}-remove-${comment.id}`,
    });
  }
  rows.push(
    // INBOUND BEFORE OPINIONS (`_shared.jsx:397-413`): it sits between the
    // acts and the license because it is a fact about the ARTIFACT, where the
    // row under it is a fact about people. Like that row it stands whatever
    // the count is — a comment has no count line of its own, so this is the
    // only door to the list, and the only way to meet it empty.
    {
      label: "Cited by",
      onSelect: () => openCitedBy(comment.id),
      testId: `${testIdPrefix}-cited-by-${comment.id}`,
    },
    {
      label: "Opinions on this",
      onSelect: () => openOpinions(comment.id),
      testId: `${testIdPrefix}-opinions-${comment.id}`,
    },
  );
  const license = comment.license;
  if (license !== null && license !== undefined) {
    rows.push({
      label: "License terms",
      onSelect: () => openLicense(license),
      testId: `${testIdPrefix}-license-${comment.id}`,
    });
  }
  return rows;
}
