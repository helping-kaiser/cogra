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

import { useEffect, useRef, useState, type ReactNode } from "react";

import { exitDuration, SHEET_OUT_MS } from "@/lib/ui/motion";

export function BottomSheet({
  open,
  onClose,
  title,
  titleTrailing,
  titleHidden = false,
  height = "content",
  foot,
  children,
  testId = "bottom-sheet",
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
  testId?: string;
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
      // `mt-auto` is what puts it at the bottom edge: a dialog is centred by
      // default, and this one rises from the edge it will go back to. It may
      // fill the screen up to a sliver below the top, so the rounded corners
      // keep a strip of the surface behind visible.
      className={`${closing ? "cg-sheet-out" : "cg-sheet-in"} ${
        height === "full" ? "h-[calc(100dvh-72px)]" : "max-h-[92dvh]"
      } mt-auto mb-0 w-full max-w-[42rem] rounded-t-extra-large border-0 bg-surface-container-high p-0 text-on-surface backdrop:bg-scrim/50`}
    >
      <div className={`flex flex-col ${height === "full" ? "h-full" : "max-h-[92dvh]"}`}>
        {/* The drag handle is drawn but not a control: the sheet is dropped
            with the backdrop, Escape, or its own action, and a handle that
            looks draggable but is not would lie. */}
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
          className={`min-h-0 flex-1 overflow-y-auto px-6 pt-2 ${foot === undefined ? "pb-8" : "pb-3"}`}
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
      className={`cg-state cg-focus flex min-h-12 w-full items-center gap-3 rounded-small px-2 text-left text-body-large ${
        selected ? "text-primary" : "text-on-surface"
      }`}
    >
      {children}
    </button>
  );
}
