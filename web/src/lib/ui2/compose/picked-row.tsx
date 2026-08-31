// The picked-pictures row (design/components/compose/PickedRow) — the
// composer's summary of the body: thumbnails and the count, one tappable row.
//
// THE ROW CARRIES NO "Crop" OR "Edit" LINKS (jakob 2026-08-31: "none"). The
// whole row is the affordance and it opens the Show all sheet, which is the
// per-picture manager. The crop step needs no second entrance: the wizard is
// linear and Back reaches it, and a duplicate entrance to one step is the
// two-menus pattern the system refuses elsewhere.

import { MediaThumb } from "./media-thumb";

export type PickedThumb = {
  id: string;
  src?: string | null;
  altText?: string | null;
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
export function DescribeCounter({
  described,
  total,
  onDescribe,
  testId = "describe-counter",
}: {
  described: number;
  total: number;
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
        Describe the pictures
      </button>{" "}
      <span className="text-on-surface-variant">
        · {described} of {total} described
      </span>
    </p>
  );
}
