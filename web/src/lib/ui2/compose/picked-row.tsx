// The picked-pictures row (design/components/compose/PickedRow) — the
// composer's summary of the body: thumbnails and the count, one tappable row.
//
// THE ROW CARRIES NO "Crop" OR "Edit" LINKS (jakob 2026-08-31: "none"). The
// whole row is the affordance and it opens the Show all sheet, which is the
// per-picture manager. The crop step needs no second entrance: the wizard is
// linear and Back reaches it, and a duplicate entrance to one step is the
// two-menus pattern the system refuses elsewhere.

import { MediaThumb } from "./media-thumb";
import type { Crop } from "../media/crop";

export type PickedThumb = {
  id: string;
  src?: string | null;
  altText?: string | null;
  /** The framing the author chose, so the row shows it rather than the source. */
  crop?: Crop | null;
  progress?: number | "indeterminate";
  failed?: boolean;
};

export function PickedRow({
  items,
  caption,
  onManage,
  manageLabel = "Manage the pictures",
  testId = "picked-row",
}: {
  items: readonly PickedThumb[];
  caption: string;
  onManage: () => void;
  manageLabel?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onManage}
      aria-label={manageLabel}
      className="cg-state cg-focus flex min-h-12 w-full cursor-pointer items-center gap-2 text-left text-on-surface"
    >
      {items.map((item, index) => (
        <MediaThumb
          key={item.id}
          src={item.src}
          altText={item.altText}
          crop={item.crop}
          cover={index === 0}
          progress={item.progress}
          failed={item.failed}
          testId={`${testId}-thumb-${index}`}
        />
      ))}
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
  );
}
