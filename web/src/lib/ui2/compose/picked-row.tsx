// The picked-pictures row (design/components/compose/PickedRow) — the
// composer's summary of the body: thumbnails and the count, one tappable row.
//
// THE ROW CARRIES NO "Crop" OR "Edit" LINKS (jakob 2026-08-31: "none"). The
// whole row is the affordance and it opens the Show all sheet, which is the
// per-picture manager. The crop step needs no second entrance: the wizard is
// linear and Back reaches it, and a duplicate entrance to one step is the
// two-menus pattern the system refuses elsewhere.
//
// A CLIP HAS NO MANAGER (jakob's ruling 2026-09-15, "one clip is not a set" —
// there is no set for a Show all sheet to open on). `onManage` is nullable for
// exactly that case: null draws no tap affordance of its own, and `onRemove`
// gives the one tile its own × instead — the same × the pick tray already
// draws on the same clip (`design/designs/canonical/screens/
// ComposeDetailsVideo.jsx` lines 22-32).

import { MediaThumb } from "./media-thumb";
import type { Crop } from "../media/crop";

export type PickedThumb = {
  id: string;
  src?: string | null;
  altText?: string | null;
  /** The framing the author chose, so the row shows it rather than the source. */
  crop?: Crop | null;
  /** The clip's length — turns the tile into the composer's video anatomy. */
  durationMs?: number | null;
  progress?: number | "indeterminate";
  failed?: boolean;
  /**
   * A clip's chosen cover, riding this item's own tile as its inset corner
   * mark rather than a second attachment — one attachment is one tile
   * (`design/designs/canonical/screens/ComposeDetailsVideo.jsx:19-21`,
   * design/readme.md §13 "The cover's tile"). Pictures never set it.
   */
  coverSrc?: string | null;
};

export function PickedRow({
  items,
  caption,
  onManage,
  manageLabel = "Manage the pictures",
  onRemove,
  removeLabel,
  testId = "picked-row",
}: {
  items: readonly PickedThumb[];
  caption: string;
  /** Opens the per-picture manager, or null where there is none to open. */
  onManage: (() => void) | null;
  manageLabel?: string;
  /** The tile's own remove control, wired only where there is no manager. */
  onRemove?: (index: number) => void;
  removeLabel?: string;
  testId?: string;
}) {
  const thumbs = items.map((item, index) => (
    <MediaThumb
      key={item.id}
      src={item.src}
      altText={item.altText}
      crop={item.crop}
      // The "Cover" badge is the manager's own vocabulary — a clip with no
      // manager marks its cover through `coverSrc`'s inset instead, never
      // both on the same tile.
      cover={onManage !== null && index === 0}
      coverSrc={item.coverSrc}
      durationMs={item.durationMs}
      progress={item.progress}
      failed={item.failed}
      onRemove={onRemove ? () => onRemove(index) : undefined}
      removeLabel={removeLabel}
      testId={`${testId}-thumb-${index}`}
    />
  ));

  if (onManage === null) {
    return (
      <div
        data-testid={testId}
        className="flex min-h-12 w-full items-center gap-2 text-left text-on-surface"
      >
        {thumbs}
        <span className="flex-1 text-label-small text-on-surface-variant">{caption}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onManage}
      aria-label={manageLabel}
      className="cg-state cg-focus flex min-h-12 w-full cursor-pointer items-center gap-2 text-left text-on-surface"
    >
      {thumbs}
      <span className="flex-1 text-label-small text-on-surface-variant">{caption}</span>
    </button>
  );
}

/**
 * "Describe the pictures · 1 of 3 described" — the details step's entry into
 * per-picture descriptions, with the quiet count beside it.
 *
 * Alt text is authored, optional, and never invented; a described set is a
 * choice made visible, not a chore bar.
 */
/**
 * The describe entry, counting what has been described.
 *
 * THE SUBJECT FOLLOWS THE BODY (design/backlog.md item 31, round 2 point 1): a
 * video takes ONE description and the row reads "Describe the video · 0 of 1
 * described". Its COVER takes none — a poster is the video's face, not a second
 * attachment a reader could be told about, so it never enters this count.
 *
 * THE REASON RIDES UNDER THE ROW (jakob 2026-09-03), permanently: an optional
 * field with no stated purpose reads as a chore, and the one thing that makes
 * it worth writing — someone is listening to it — was behind a "?" nobody
 * opens. Same words as the sheet's own sub-line, so the row and the sheet it
 * opens say one thing.
 */
export function DescribeCounter({
  described,
  total,
  subject = "the pictures",
  onDescribe,
  testId = "describe-counter",
}: {
  described: number;
  total: number;
  subject?: string;
  onDescribe: () => void;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 text-label-small">
        <button
          type="button"
          data-testid={testId}
          onClick={onDescribe}
          className="cg-state cg-focus cursor-pointer border-0 bg-transparent p-0 text-label-small text-primary"
        >
          Describe {subject}
        </button>{" "}
        <span className="text-on-surface-variant">
          · {described} of {total} described
        </span>
      </p>
      <p className="m-0 text-label-small text-on-surface-variant">
        Read aloud to people who can&apos;t see it.
      </p>
    </div>
  );
}
