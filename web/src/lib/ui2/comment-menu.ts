// THE COMMENT'S ROWS (CommentMenu.md:7, CommentMenuOwn.md:3; round 41): Save ·
// Cite in a new post · Cited by · Opinions on this · License terms · Report on
// a reader's comment, and the author's own with Edit and Remove joined after
// Cite — Save · Cite in a new post · Edit · Remove · Cited by · Opinions on
// this · License terms, no Report row (the own menus' rule). No Hide — hiding
// names an actor, and its route is the commenter's profile (jakob 2026-09-12).
// One builder for every comment's ⋮ — the thread's, and the comment feed
// card's — the way `post-menu.ts` is the post's.
//
// EDIT IS A MENU ROW, NEVER A BUTTON ON THE CARD (jakob on #423, seam 304): the
// row is the one door to the comment's edit on every host the own comment
// stands in (CommentMenuOwn.md:11). No sensitive row: a comment's sensitive
// mark rides that edit.
//
// Save is the one behaviour every menu shares (`saveRow`), its aftermath on
// the host's own snackbar. `Opinions on this` STANDS WHATEVER THE COUNT IS:
// a row that came and went with a number would make the menu a different
// menu every time.
//
// THE GUEST GATE (GuestGate.md:5-7): Save, Cite in a new post and Report ask a
// guest to join; Cited by, Opinions on this and License terms are reads and
// open for one (seam 316 item 8, design's lean at jakob as question 22).

import type { License } from "@/lib/license";
import { saveRow, type Notify } from "@/lib/saved/save-row";
import { POST_LOCKED } from "@/lib/session/reader-state";
import type { SavedWrites } from "@/lib/saved/saved-writes";
import type { DataNode } from "@/lib/ui/data-node";
import type { MenuItem } from "./overflow-menu";

/** The rows a comment menu can hold, by the names their sheet nodes take. */
export type CommentMenuRow =
  | "save"
  | "cite"
  | "edit"
  | "remove"
  | "citedBy"
  | "opinions"
  | "license"
  | "report";

/** The report confirm's heading over a comment (ReportConfirm.md:5). */
export const REPORT_COMMENT_TITLE = "Report this comment?";

export function commentMenuItems({
  comment,
  writes,
  notify,
  onGuest,
  applicant = false,
  navigate,
  openCitedBy,
  openOpinions,
  openLicense,
  openEdit,
  openRemove,
  openReport,
  testIdPrefix,
  rowNode = () => undefined,
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
  /**
   * The reader is an applicant (`useReaderIsApplicant`): Cite tells on the
   * host's snackbar rather than opening the wizard — the post menu's rule.
   */
  applicant?: boolean;
  navigate: (route: string) => void;
  openCitedBy: (id: string) => void;
  /** The comment's opinions sheet (CommentOpinionsEmpty.md), stacked over the host. */
  openOpinions: (id: string) => void;
  openLicense: (license: License) => void;
  /**
   * The reader's OWN comment: its edit, over the surface the menu was opened
   * on (CommentMenuOwn.md:13). Given with `openRemove`, only for the author.
   */
  openEdit?: () => void;
  /**
   * The reader's OWN comment: its think-twice dialog (CommentMenuOwn.md:19).
   * Given only for the author — its presence is what makes this the own menu,
   * and the own menus carry no Report row.
   */
  openRemove?: () => void;
  /**
   * Someone else's comment: the report confirm over the surface the menu was
   * opened on (CommentMenu.md:29-31). A guest is asked to join instead
   * (ReportConfirm.md:21) — `onGuest` answers before this is reached.
   * Absent where the host mounts no confirm, and the row then stands inert
   * (jakob 2026-09-14, the introduced-but-inert law; `post-menu.ts`'s).
   */
  openReport?: () => void;
  /** Rows are `<prefix>-save-<id>`, `<prefix>-cite-<id>`, …. */
  testIdPrefix: string;
  /**
   * The registered node a row wears on a registered sheet
   * (`history.menuSheet.citedBy`); undefined keeps the row's test id.
   */
  rowNode?: (row: CommentMenuRow) => DataNode | undefined;
}): MenuItem[] {
  const row = (name: CommentMenuRow, testName: string, label: string, onSelect: () => void): MenuItem => ({
    label,
    onSelect,
    testId: `${testIdPrefix}-${testName}-${comment.id}`,
    node: rowNode(name),
  });
  const own = openRemove !== undefined;
  const rows: MenuItem[] = [
    saveRow({
      writes,
      node: comment.id,
      server: comment.viewerBookmarkedAt ?? null,
      notify,
      onGuest,
      testId: `${testIdPrefix}-save-${comment.id}`,
      rowNode: rowNode("save"),
    }),
    row(
      "cite",
      "cite",
      "Cite in a new post",
      onGuest ??
        (applicant ? () => notify(POST_LOCKED) : () => navigate(`/compose?reference=${comment.id}`)),
    ),
  ];
  // EDIT, THEN REMOVE, ARE THE LAST OF THE ACTS, before the two readings —
  // `OWN_POST_MENU`'s place for the pair, at comment scale (`CommentMenuOwn.jsx`).
  if (own) {
    rows.push(row("edit", "edit", "Edit", openEdit ?? (() => {})), row("remove", "remove", "Remove", openRemove));
  }
  rows.push(
    // INBOUND BEFORE OPINIONS (`_shared.jsx:397-413`): it sits between the
    // acts and the license because it is a fact about the ARTIFACT, where the
    // row under it is a fact about people. Like that row it stands whatever
    // the count is — a comment has no count line of its own, so this is the
    // only door to the list, and the only way to meet it empty.
    row("citedBy", "cited-by", "Cited by", () => openCitedBy(comment.id)),
    row("opinions", "opinions", "Opinions on this", () => openOpinions(comment.id)),
  );
  const license = comment.license;
  if (license !== null && license !== undefined) {
    rows.push(row("license", "license", "License terms", () => openLicense(license)));
  }
  // REPORT AT THE SHEET'S TAIL, below even the license (ruling 75), on every
  // other-person menu.
  if (!own) rows.push(row("report", "report", "Report", onGuest ?? openReport ?? (() => {})));
  return rows;
}
