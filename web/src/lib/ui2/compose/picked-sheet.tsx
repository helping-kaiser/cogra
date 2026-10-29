"use client";

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
// THE HANDLE DRAGS (ComposePicked.md: "drag a picture by its handle to a new
// place"), and the drag has its non-drag twins: the arrow keys on the focused
// handle and the row's own `Make it the cover` · `Move up` · `Move down`
// (PickedSheet.jsx, the K13 round). The web gives the drag no haptic.

import { useState } from "react";

import { instance, part, testAttributes, type DataNode } from "@/lib/ui/data-node";

import { BottomSheet, SHEET_RAISED } from "../bottom-sheet";
import { InlineAction } from "../inline-action";
import { PillButton } from "../pill-button";
import { LABEL_SMALL_PLAIN } from "../plain-type";
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

/**
 * Where a drag of `travel` pixels from row `from` lands, rows being `pitch`
 * tall: the nearest row boundary, held inside the list.
 */
export function dropIndex(from: number, travel: number, pitch: number, count: number): number {
  if (pitch <= 0) return from;
  return Math.max(0, Math.min(count - 1, from + Math.round(travel / pitch)));
}

export function PickedSheet({
  open,
  onClose,
  items,
  onDescribe,
  onRemove,
  onMove,
  testId = "picked-sheet",
  node,
}: {
  open: boolean;
  onClose: () => void;
  items: readonly PickedSheetItem[];
  onDescribe: (id: string) => void;
  onRemove: (id: string) => void;
  // Move the picture at `from` to `to`. The sheet never reorders its own props.
  onMove: (from: number, to: number) => void;
  testId?: string;
  /**
   * The registered sheet on a registered screen (`postEdit.pickedSheet`): each
   * row a `picture` keyed by its place from 1, with its controls, then the
   * sheet's `note` and `done`. It names them instead of `testId`.
   */
  node?: DataNode;
}) {
  // The row being dragged, where the pointer went down, how far it has
  // travelled, and the row pitch measured at the press.
  const [drag, setDrag] = useState<{
    from: number;
    startY: number;
    travel: number;
    pitch: number;
  } | null>(null);

  return (
    <BottomSheet open={open} onClose={onClose} title={`Picked · ${items.length}`} testId={testId} node={node} maxHeight={SHEET_RAISED}>
      <ul className="m-0 flex list-none flex-col border-t border-outline-variant p-0">
        {items.map((item, index) => {
          const lifted = drag !== null && drag.from === index;
          const picture = instance(node, "picture", String(index + 1));
          return (
            <li
              key={item.id}
              {...testAttributes(picture, `${testId}-row-${index}`)}
              style={
                lifted
                  ? { transform: `translateY(${drag.travel}px)`, position: "relative", zIndex: 1 }
                  : undefined
              }
              className={`flex min-h-[68px] items-center gap-4 border-b border-outline-variant ${
                lifted ? "bg-surface-container-highest" : ""
              }`}
            >
              <button
                type="button"
                {...testAttributes(part(picture, "reorder"), `${testId}-move-${index}`)}
                aria-label={`Reorder ${index === 0 ? "the cover" : `picture ${index + 1}`}`}
                aria-keyshortcuts="ArrowUp ArrowDown"
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" && index > 0) {
                    event.preventDefault();
                    onMove(index, index - 1);
                  } else if (event.key === "ArrowDown" && index < items.length - 1) {
                    event.preventDefault();
                    onMove(index, index + 1);
                  }
                }}
                // The drag itself. The pointer is captured so the row follows
                // it past the handle, and the press stops here so the sheet's
                // own pull-to-dismiss never reads it as a pull.
                onPointerDown={(event) => {
                  event.stopPropagation();
                  const row = event.currentTarget.closest("li");
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  setDrag({
                    from: index,
                    startY: event.clientY,
                    travel: 0,
                    pitch: row?.getBoundingClientRect().height ?? 0,
                  });
                }}
                onPointerMove={(event) => {
                  if (drag === null || drag.from !== index) return;
                  setDrag({ ...drag, travel: event.clientY - drag.startY });
                }}
                onPointerUp={() => {
                  if (drag === null || drag.from !== index) return;
                  const to = dropIndex(drag.from, drag.travel, drag.pitch, items.length);
                  setDrag(null);
                  if (to !== drag.from) onMove(drag.from, to);
                }}
                onPointerCancel={() => setDrag(null)}
                className="cg-state cg-focus cg-hit relative flex flex-none cursor-grab touch-none items-center border-0 bg-transparent p-0 text-on-surface-variant"
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
                node={part(picture, "thumb")}
              />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-label-large" {...testAttributes(part(picture, "label"))}>
                  {rowName(index)}
                </span>
                {/* THE DRAG HAS NON-DRAG TWINS (the K13 round; PickedSheet.jsx):
                    after Describe, `Make it the cover` · `Move up` · `Move down`,
                    each only where the move is possible. They wrap at a 24px
                    pitch, clear under WCAG 2.5.8's spacing rule. */}
                <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {item.described ? (
                    <span
                      {...testAttributes(part(picture, "described"), `${testId}-described-${index}`)}
                      className="text-label-small text-on-surface-variant"
                    >
                      Described
                    </span>
                  ) : (
                    <InlineAction
                      size="sm"
                      testId={`${testId}-describe-${index}`}
                      node={part(picture, "describe")}
                      onClick={() => onDescribe(item.id)}>
                      Describe
                    </InlineAction>
                  )}
                  {index > 0 && (
                    <InlineAction
                      size="sm"
                      testId={`${testId}-make-cover-${index}`}
                      node={part(picture, "makeCover")}
                      onClick={() => onMove(index, 0)}>
                      Make it the cover
                    </InlineAction>
                  )}
                  {index > 0 && (
                    <InlineAction
                      size="sm"
                      testId={`${testId}-up-${index}`}
                      node={part(picture, "moveUp")}
                      onClick={() => onMove(index, index - 1)}>
                      Move up
                    </InlineAction>
                  )}
                  {index < items.length - 1 && (
                    <InlineAction
                      size="sm"
                      testId={`${testId}-down-${index}`}
                      node={part(picture, "moveDown")}
                      onClick={() => onMove(index, index + 1)}>
                      Move down
                    </InlineAction>
                  )}
                </span>
              </span>
              <button
                type="button"
                {...testAttributes(part(picture, "remove"), `${testId}-remove-${index}`)}
                aria-label={`Remove ${index === 0 ? "the cover" : `picture ${index + 1}`}`}
                onClick={() => onRemove(item.id)}
                className="cg-state cg-focus cg-hit relative flex flex-none cursor-pointer items-center border-0 bg-transparent p-0 text-on-surface-variant"
              >
                <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
                  <path d={CLOSE_GLYPH} />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
      {/* PickedSheet.jsx: the footnote at the body's weight, then the Done row
          on its own 8 · 16 · 8 inset — 16 from the sheet's edge, not the
          column's 24. */}
      <p className={`m-0 pt-3 ${LABEL_SMALL_PLAIN} text-on-surface-variant`} {...testAttributes(part(node, "note"))}>
        The first one is the cover.
      </p>
      <div className="-mr-2 flex justify-end py-2">
        <PillButton testId={`${testId}-done`} node={part(node, "done")} variant="text" onClick={onClose}>
          Done
        </PillButton>
      </div>
    </BottomSheet>
  );
}
