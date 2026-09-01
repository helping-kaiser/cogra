// "Show all" — the per-picture manager (design/components/compose/PickedSheet).
//
// Opened by the pick step's "Show all" and by the details step's picked row. One
// home for every per-picture concern:
//
//  · ORDER — the FIRST one is the cover and the badge travels with it. There is
//    no separate cover control.
//  · REMOVE — the X on each row.
//  · DESCRIBE — the per-picture entry into the describe sheet; a described
//    picture shows the quiet word "Described" instead of the link.
//
// Rows are named ("Cover — shown first", "Picture 2") so a screen-reader pass
// reads as a list of pictures rather than a list of buttons.
//
// THE DRAG HAS A NON-DRAG EQUIVALENT, as every drag in this app must: the handle
// is a real button and the arrow keys move the picture it holds. The canvas
// draws a handle rather than up/down controls, so the keyboard route is offered
// without painting one (web.md §Accessibility).

import { BottomSheet } from "../bottom-sheet";
import { PillButton } from "../pill-button";
import { MediaThumb } from "./media-thumb";
import type { Crop } from "../media/crop";

const DRAG_GLYPH =
  "M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z";
const CLOSE_GLYPH =
  "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z";

export type PickedSheetItem = {
  id: string;
  src?: string | null;
  altText?: string | null;
  /** The framing the author chose, so the sheet shows it rather than the source. */
  crop?: Crop | null;
  described: boolean;
};

function rowName(index: number): string {
  return index === 0 ? "Cover — shown first" : `Picture ${index + 1}`;
}

export function PickedSheet({
  open,
  onClose,
  items,
  onDescribe,
  onRemove,
  onMove,
  testId = "picked-sheet",
}: {
  open: boolean;
  onClose: () => void;
  items: readonly PickedSheetItem[];
  onDescribe: (id: string) => void;
  onRemove: (id: string) => void;
  // Move the picture at `from` to `to`. The sheet never reorders its own props.
  onMove: (from: number, to: number) => void;
  testId?: string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={`Picked · ${items.length}`} testId={testId}>
      <ul className="m-0 flex list-none flex-col border-t border-outline-variant p-0">
        {items.map((item, index) => (
          <li
            key={item.id}
            data-testid={`${testId}-row-${index}`}
            className="flex min-h-[68px] items-center gap-4 border-b border-outline-variant"
          >
            <button
              type="button"
              data-testid={`${testId}-move-${index}`}
              aria-label={`Reorder ${rowName(index)}. Use the arrow keys to move it.`}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp" && index > 0) {
                  event.preventDefault();
                  onMove(index, index - 1);
                } else if (event.key === "ArrowDown" && index < items.length - 1) {
                  event.preventDefault();
                  onMove(index, index + 1);
                }
              }}
              className="cg-focus flex flex-none cursor-grab items-center text-on-surface-variant"
            >
              <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true">
                <path d={DRAG_GLYPH} />
              </svg>
            </button>
            <MediaThumb
              src={item.src}
              altText={item.altText}
              crop={item.crop}
              size={56}
              cover={index === 0}
              testId={`${testId}-thumb-${index}`}
            />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-label-large">{rowName(index)}</span>
              {item.described ? (
                <span
                  data-testid={`${testId}-described-${index}`}
                  className="text-label-small text-on-surface-variant"
                >
                  Described
                </span>
              ) : (
                <button
                  type="button"
                  data-testid={`${testId}-describe-${index}`}
                  onClick={() => onDescribe(item.id)}
                  className="cg-state cg-focus cursor-pointer self-start border-0 bg-transparent p-0 text-label-small text-primary"
                >
                  Describe
                </button>
              )}
            </span>
            <button
              type="button"
              data-testid={`${testId}-remove-${index}`}
              aria-label={`Remove ${index === 0 ? "the cover" : `picture ${index + 1}`}`}
              onClick={() => onRemove(item.id)}
              className="cg-state cg-focus flex flex-none cursor-pointer items-center text-on-surface-variant"
            >
              <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
                <path d={CLOSE_GLYPH} />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <p className="m-0 pt-3 text-label-small text-on-surface-variant">
        The first one is the cover — drag to reorder.
      </p>
      <div className="flex justify-end pt-2">
        <PillButton testId={`${testId}-done`} variant="text" onClick={onClose}>
          Done
        </PillButton>
      </div>
    </BottomSheet>
  );
}
