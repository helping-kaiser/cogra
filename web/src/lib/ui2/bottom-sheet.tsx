"use client";

// The bottom sheet — a drawer the reader opened and can drop.
//
// It comes from the edge it goes back to, covers the bottom bar, traps nothing,
// and is never open beside the stance pad. The compose flow presents the
// license and the sensitive mark this way; the overflow menu presents as one by
// default, because both clients render at phone width and a popover pinned to a
// 24px glyph is a desktop idiom.
//
// Built on the native `<dialog>` element rather than a hand-rolled overlay: it
// gives the top layer, the backdrop, modal focus containment, and Escape
// without any of them being reimplemented — which is the documented platform
// answer and the same one `join-prompt` already takes in the 1.0 layer.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import { exitDuration, SHEET_OUT_MS } from "@/lib/ui/motion";
import { PULL_THRESHOLD } from "@/lib/ui/pull-to-refresh";

/**
 * THE SLIVER A SHEET AT ITS CEILING LEAVES BEHIND (`_shared.jsx:1249` —
 * `height="calc(100% - 72px)"`).
 */
export const SHEET_CEILING_SLIVER_PX = 72;

/**
 * THE SHEET CEILING — how tall a sheet may ever be (jakob 2026-09-22).
 *
 * A sheet's top edge never rises above a {@link SHEET_CEILING_SLIVER_PX}
 * strip measured from the top of the safe area, which on the web is the top
 * of the viewport; `dvh` is what makes that the LIVE viewport rather than the
 * one the browser's own chrome was hiding. The rounded corners keep a strip
 * of the surface behind visible, and no sheet ever passes it.
 *
 * ONE MECHANISM, NOT TWO. The comments sheet already drew exactly this shape;
 * `content` now stops at the same line instead of a second, unrelated `92dvh`
 * of its own — a sheet growing with its field had no reason to stop anywhere
 * else, and the two numbers were the place the platforms would drift.
 *
 * The literals are spelled out because Tailwind scans source TEXT for class
 * names: a class built from the constant would never be generated. The pin in
 * `bottom-sheet.test.tsx` is what keeps the two in step.
 */
const CEILING = "max-h-[calc(100dvh-72px)]";
const CEILING_FULL = "h-[calc(100dvh-72px)]";

export function BottomSheet({
  open,
  onClose,
  title,
  titleTrailing,
  titleHidden = false,
  height = "content",
  foot,
  children,
  bodyRef,
  testId = "bottom-sheet",
  stacked = false,
}: {
  open: boolean;
  onClose: () => void;
  // Every sheet is titled: the title is what the sheet is labelled by, so a
  // screen reader announces what opened rather than "dialog".
  title: string;
  /**
   * What the heading line carries besides its name (design's `SheetTitle`
   * `trailing`) — a sheet's own "?", or the switch the sheet exists for. The
   * dialog's accessible name still comes from `title` alone; this only adds
   * to the drawn row.
   */
  titleTrailing?: ReactNode;
  /**
   * A sheet whose content heads itself draws no title row — design keeps the
   * two apart (`BottomSheet` takes an `ariaLabel`; `SheetTitle` is a separate
   * master a board includes when it wants one). A menu is its own rows, and the
   * license block's caption already says `License terms`, so a title above it
   * would say the words twice a few pixels apart in two sizes. The name still
   * reaches a screen reader through `aria-label`, which is where one asks.
   */
  titleHidden?: boolean;
  /**
   * `content` lets the content set the sheet's size, up to the sliver the
   * screen keeps; `full` pins it at the drawn full height instead — the
   * comments sheet fills the screen to 72px below the top
   * (`_shared.jsx:1249` — `height="calc(100% - 72px)"`). Design's own master
   * takes the same prop for the same reason: "a pinned input row at its foot
   * needs the surface itself to own the height" (`BottomSheet.jsx:29-32`),
   * and a sheet sized by its content would rise and fall as a page of
   * comments lands.
   */
  height?: "content" | "full";
  /**
   * The row pinned below the scrolling body — design's `CommentComposerFoot`
   * slot. It sits outside the scroll region so it stays reachable however
   * long the body is, and it carries its own gutters, the way every slot of
   * design's `BottomSheet` does.
   */
  foot?: ReactNode;
  children: ReactNode;
  /**
   * The scrolling body itself, for a sheet that has to know where its reader
   * was. The body is the scroller — not the dialog — and a closed dialog is
   * `display: none`, which drops the offset the browser was holding. A sheet
   * that gives way to a composer and takes the reader back therefore has to
   * measure and restore the place itself, and this is the element it does it
   * on (`scroll-pin.ts` says why a place is an anchor, not a number).
   */
  bodyRef?: RefObject<HTMLDivElement | null>;
  testId?: string;
  /**
   * This sheet opens over another sheet — the comment's menu and the
   * comment's license, both over the comments thread (design/readme.md:2364).
   * It takes the next tonal rung, `surfaceContainerHighest`: elevation is
   * tonal, and two surfaces at one rung claim one elevation. The native
   * `<dialog>` stacking already lets a later `showModal()` layer above an
   * earlier one with its own backdrop between them, so only the tone is
   * wired here — the dimming is the platform's top layer, not this prop.
   */
  stacked?: boolean;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  // A DISMISSAL EXITS THE EDGE IT ENTERED FROM (design/tokens/transitions.css).
  // `close()` drops the element out of the top layer at once, so the sheet is
  // held open for the length of its exit animation and closed after.
  //
  // Which way it is going is derived from the prop as it changes, adjusted
  // during render rather than in an effect — React's own "you might not need an
  // effect": an effect that sets state on every open would cascade a render.
  const [closing, setClosing] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setClosing(!open);
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (!dialog.open) return;
    const timer = setTimeout(() => {
      setClosing(false);
      dialog.close();
    }, exitDuration(SHEET_OUT_MS));
    return () => clearTimeout(timer);
  }, [open]);

  // PULLING DOWN IS HOW A DRAWER IS DROPPED (design/readme.md: "pulling down
  // already means dismiss and one gesture may not mean two things"). The
  // handle was drawn but inert, so the sheet answered only the backdrop, the
  // back arrow and Escape — and the one gesture a reader reaches for first
  // did nothing.
  //
  // IT PULLS THE SHEET, NEVER ITS CONTENTS. The gesture starts only when the
  // body is at its own top, so a scrolled thread scrolls; and it moves the
  // surface alone — nothing it does reaches what the sheet is showing, which
  // is what keeps an unfolded branch unfolded through a pull.
  const body = useRef<HTMLDivElement | null>(null);
  const pulledFrom = useRef<number | null>(null);
  const [pull, setPull] = useState(0);

  const endPull = () => {
    if (pulledFrom.current === null) return;
    const travel = pull;
    pulledFrom.current = null;
    setPull(0);
    if (travel >= PULL_THRESHOLD) onClose();
  };

  return (
    <dialog
      ref={ref}
      data-testid={testId}
      aria-label={title}
      onClose={onClose}
      // A press outside drops the sheet — the same gesture as the back arrow,
      // because a sheet is a drawer rather than a decision.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      onPointerDown={(event) => {
        // A pull is a touch gesture; a mouse drag on a sheet is a selection.
        if (event.pointerType === "mouse") return;
        if ((body.current?.scrollTop ?? 0) > 0) return;
        pulledFrom.current = event.clientY;
      }}
      onPointerMove={(event) => {
        if (pulledFrom.current === null) return;
        const travel = event.clientY - pulledFrom.current;
        // Upward is the reader scrolling into the sheet, not dropping it.
        setPull(travel > 0 ? travel : 0);
      }}
      onPointerUp={endPull}
      onPointerCancel={endPull}
      style={{ "--cg-sheet-drag": `${pull}px` } as CSSProperties}
      // `mt-auto` is what puts it at the bottom edge: a dialog is centred by
      // default, and this one rises from the edge it will go back to. It may
      // fill the screen up to a sliver below the top, so the rounded corners
      // keep a strip of the surface behind visible.
      className={`${closing ? "cg-sheet-out" : "cg-sheet-in"} ${
        height === "full" ? CEILING_FULL : CEILING
      } mt-auto mb-0 w-full max-w-[42rem] rounded-t-extra-large border-0 ${
        // ONE SCRIM, HOWEVER MANY SHEETS. The system has a single dimming
        // token (`--scrim-dialog`, 50% black) and stacking moves the z-layer,
        // never the tone (design/components/core/BottomSheet.jsx). Every
        // native `<dialog>` paints its own `::backdrop`, so a sheet raised
        // over another one composited a second 50% over the first — ~75%
        // black, far darker than anything drawn. The upper sheet takes the
        // next tonal rung and no scrim of its own; the one beneath it is
        // still dimming the page.
        stacked
          ? "bg-surface-container-highest backdrop:bg-transparent"
          : "bg-surface-container-high backdrop:bg-scrim/50"
      } p-0 text-on-surface`}
    >
      <div className={`flex flex-col ${height === "full" ? "h-full" : CEILING}`}>
        {/* The handle says the sheet can be pulled down, and it can. The
            gesture is read across the whole surface, so the grip marks where
            the eye goes rather than the only place that answers; the
            backdrop, Escape and the sheet's own action drop it too. */}
        <span aria-hidden="true" className="mx-auto mt-3 h-1 w-8 rounded-full bg-outline-variant" />
        {titleHidden ? null : titleTrailing === undefined ? (
          <h2 className="px-6 pt-4 pb-2 text-title-medium">{title}</h2>
        ) : (
          <div className="flex items-center gap-2 px-6 pt-4 pb-2">
            <h2 className="m-0 flex-1 text-title-medium">{title}</h2>
            {titleTrailing}
          </div>
        )}
        <div
          // The pull needs the scroller too — it may only start at its top —
          // so the node goes to this component's own ref as well as the
          // caller's.
          ref={(node) => {
            body.current = node;
            if (bodyRef) bodyRef.current = node;
          }}
          data-testid={`${testId}-body`}
          // A COLUMN, SO WHAT IT HOLDS CAN YIELD. A sheet that grows with a
          // field stops at the ceiling, and from there something has to give
          // way: the body's children shrink (down to their own `min-h-0`)
          // before the body starts scrolling, which is what puts the scroll
          // INSIDE the growing field rather than under the whole sheet. The
          // scroll stays as the fallback for content that cannot shrink.
          className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-2 ${foot === undefined ? "pb-8" : "pb-3"}`}
        >
          {children}
        </div>
        {foot !== undefined && <div className="flex-none pb-8">{foot}</div>}
      </div>
    </dialog>
  );
}

// A row inside a sheet: the overflow menu's items, the license options.
//
// There is no destructive variant. "Remove" rides an ordinary row and the
// think-twice dialog behind it carries the weight — a removal is a deliberate
// act, not a failure, so it takes no new colour.
export function SheetItem({
  children,
  testId,
  onSelect,
  selected = false,
}: {
  children: ReactNode;
  testId: string;
  onSelect: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onSelect}
      aria-pressed={selected || undefined}
      className={`cg-state cg-focus flex min-h-12 w-full items-center gap-3 rounded-small px-2 text-left text-label-large ${
        selected ? "text-primary" : "text-on-surface"
      }`}
    >
      {children}
    </button>
  );
}
