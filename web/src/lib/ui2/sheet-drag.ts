"use client";

// THE DRAG IS M3's (design/readme.md §4, *Sheets*; `BottomSheet.jsx`): the
// sheet follows the pointer from its handle area, and from a list at its
// scroll-top; it dismisses past about 25 % of its height or on a downward
// fling, and otherwise snaps back. No intermediate detents. A sheet hosting a
// pad drags only from its handle and title zone — the pad's field owns every
// pointer that starts on it.
//
// ONE GESTURE, EVERY POINTER. The reader's finger, a pen and a mouse all move
// the sheet the same way (pointer events, W3C Pointer Events Level 3). A
// touch needs one more word to the browser: left alone, it claims a vertical
// touch as a pan the moment the finger moves, fires `pointercancel`, and the
// sheet never hears the rest. A non-passive `touchmove` listener that cancels
// exactly the moves the sheet has taken keeps the stream with the sheet — and
// every other move stays the browser's, so a list that is not at its top
// scrolls as it always did.

import { useEffect, useRef, useState, type RefObject } from "react";

/** The positional threshold: the fraction of the sheet's height a drag must pass (readme §4). */
export const SHEET_DISMISS_FRACTION = 0.25;

/**
 * The fling: a downward release faster than this dismisses at any travel —
 * M3's sheet velocity threshold, 125dp per second
 * (androidx.compose.material3 `SheetState`, the Android twin's own sheet),
 * here in CSS pixels per millisecond.
 */
export const SHEET_FLING_PX_PER_MS = 0.125;

/**
 * How far the pointer travels before a press becomes a drag — the platform's
 * touch slop (Android `ViewConfiguration`, 8dp). Under it the press is still a
 * tap, and the control under it keeps it.
 */
export const SHEET_DRAG_SLOP_PX = 8;

/** The window a release's velocity is read over: only the last moves say how it left. */
const VELOCITY_WINDOW_MS = 100;

/** Elements whose own pointer behaviour a sheet drag may never take over. */
const OWNED_FIELD = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

/**
 * Whether a press on the `<dialog>` is a press on its scrim. The backdrop is
 * the dialog's own pseudo-element, so a press there targets the dialog — and
 * so does a press on the surface's own padding (the strip over the grip, the
 * inset under the last child). Only where the press landed tells them apart.
 * A box with no area has not been laid out and cannot tell: it reads as the
 * scrim, the dialog's only target that is not a child.
 */
export function pressIsOnScrim(dialog: HTMLElement, event: { target: EventTarget | null; clientX: number; clientY: number }): boolean {
  if (event.target !== dialog) return false;
  const box = dialog.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return true;
  return event.clientY < box.top || event.clientY > box.bottom || event.clientX < box.left || event.clientX > box.right;
}

/** Whether a release at `travel` px, moving at `velocity` px/ms, dismisses a sheet `height` px tall. */
export function releaseDismisses(travel: number, height: number, velocity: number): boolean {
  if (travel <= 0) return false;
  return travel >= height * SHEET_DISMISS_FRACTION || velocity >= SHEET_FLING_PX_PER_MS;
}

/**
 * The downward velocity a gesture left with, from its recent samples: the
 * travel across the last {@link VELOCITY_WINDOW_MS} before the release. A
 * pointer held still before it lifts left at rest.
 */
export function releaseVelocity(samples: readonly { t: number; y: number }[], releasedAt: number): number {
  const recent = samples.filter((sample) => releasedAt - sample.t <= VELOCITY_WINDOW_MS);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const span = last.t - first.t;
  return span > 0 ? (last.y - first.y) / span : 0;
}

/**
 * Whether a press at `target` may become a drag of `sheet`. The handle zone —
 * the strip from the sheet's top edge to the foot of its title (or of the grip
 * where it has none) — always may; outside it, a sheet that drags only from
 * its handle never does, a field keeps its own pointer, and a list that is
 * not at its scroll-top is being scrolled, not pulled.
 */
export function mayStartDrag({
  target,
  sheet,
  clientY,
  handleZoneBottom,
  handleOnly,
}: {
  target: Element;
  sheet: HTMLElement;
  clientY: number;
  handleZoneBottom: number;
  handleOnly: boolean;
}): boolean {
  if (clientY <= handleZoneBottom) return true;
  if (handleOnly) return false;
  if (target.closest(OWNED_FIELD) !== null) return false;
  for (let at: Element | null = target; at !== null && at !== sheet; at = at.parentElement) {
    if (at.scrollTop > 0) return false;
    if (getComputedStyle(at).touchAction === "none") return false;
  }
  return sheet.scrollTop <= 0;
}

type Gesture = {
  pointerId: number;
  startY: number;
  startX: number;
  dragging: boolean;
  samples: { t: number; y: number }[];
};

/**
 * The drag that drops a sheet. It reads the gesture off the `<dialog>` and
 * returns the surface's offset while the pointer holds it; `onDismiss` is the
 * reader's word, called once a release passes the threshold or flings.
 */
export function useSheetDrag({
  sheet,
  handleZone,
  handleOnly,
  open,
  onDismiss,
}: {
  sheet: RefObject<HTMLDialogElement | null>;
  /** The lowest element of the handle zone: the title row, or the grip. */
  handleZone: RefObject<HTMLElement | null>;
  handleOnly: boolean;
  open: boolean;
  onDismiss: () => void;
}): { offset: number; dragging: boolean } {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });

  // A SHEET RAISED AGAIN STARTS AT REST: a drag that dismissed it held its
  // offset through the exit, so the drawer kept leaving from where it was let
  // go rather than jumping back first.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOffset(0);
  }

  useEffect(() => {
    const dialog = sheet.current;
    if (!dialog || !open) return;

    // A press on the scrim drops the sheet by its own route, never by a drag.
    // An unlaid-out box is let through here: nothing can be dragged on it
    // anyway, and its press is the drag's to test.
    const inside = (event: PointerEvent): boolean => {
      const box = dialog.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return true;
      return !pressIsOnScrim(dialog, event);
    };

    let suppressClick = false;

    const onDown = (event: PointerEvent) => {
      // One pointer drags: a second finger joining a drag is not a new one.
      if (gesture.current?.dragging && gesture.current.pointerId !== event.pointerId) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!(event.target instanceof Element) || !inside(event)) return;
      const zone = handleZone.current?.getBoundingClientRect().bottom ?? dialog.getBoundingClientRect().top;
      if (!mayStartDrag({ target: event.target, sheet: dialog, clientY: event.clientY, handleZoneBottom: zone, handleOnly })) {
        gesture.current = null;
        return;
      }
      gesture.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startX: event.clientX,
        dragging: false,
        samples: [{ t: event.timeStamp, y: event.clientY }],
      };
    };

    const onMove = (event: PointerEvent) => {
      const held = gesture.current;
      if (held === null || event.pointerId !== held.pointerId) return;
      const travel = event.clientY - held.startY;
      if (!held.dragging) {
        const sideways = Math.abs(event.clientX - held.startX);
        // Upward first, or more sideways than down: the reader is scrolling
        // into the sheet or along a strip in it, never dropping it.
        if (travel < -SHEET_DRAG_SLOP_PX || (sideways > SHEET_DRAG_SLOP_PX && sideways > travel)) {
          gesture.current = null;
          return;
        }
        if (travel < SHEET_DRAG_SLOP_PX) return;
        held.dragging = true;
        setDragging(true);
        // The drag owns the pointer from here: a mouse dragged past the sheet's
        // edge keeps moving it, and a selection the press began is dropped.
        try {
          dialog.setPointerCapture?.(event.pointerId);
        } catch {
          // A pointer that has already gone keeps no capture; the gesture ends
          // on its own `pointerup`.
        }
        window.getSelection?.()?.removeAllRanges();
      }
      held.samples.push({ t: event.timeStamp, y: event.clientY });
      if (held.samples.length > 32) held.samples.shift();
      setOffset(Math.max(0, travel));
    };

    const onEnd = (event: PointerEvent) => {
      const held = gesture.current;
      if (held === null || event.pointerId !== held.pointerId) return;
      gesture.current = null;
      if (!held.dragging) return;
      setDragging(false);
      // A cancelled pointer was never released by the reader: it snaps back.
      const travel = event.type === "pointercancel" ? 0 : Math.max(0, event.clientY - held.startY);
      const velocity = event.type === "pointercancel" ? 0 : releaseVelocity(held.samples, event.timeStamp);
      // The drag ended where the pointer let go, so the click it would make
      // there is not a press on whatever lies beneath it.
      suppressClick = true;
      if (releaseDismisses(travel, dialog.getBoundingClientRect().height, velocity)) {
        setOffset(travel);
        dismiss.current();
      } else {
        setOffset(0);
      }
    };

    const onClick = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    };
    // A press that never travelled leaves no click to swallow.
    const onDownReset = () => {
      suppressClick = false;
    };

    // The one touch word the browser needs (see the head of this file): a move
    // the sheet takes is not a pan. It is decided from the touch itself, not
    // from the pointer stream, because the browser picks pan or not on the
    // first move it is told about — which may come before the sheet's own
    // slop has passed. Down, and more down than across, from a press that may
    // drag: the sheet's. Anything else: the browser's, and a pan it starts
    // cancels the pointer, which ends the gesture as a snap back.
    const onTouchMove = (event: TouchEvent) => {
      const held = gesture.current;
      const touch = event.touches[0];
      if (held === null || touch === undefined || !event.cancelable) return;
      const down = touch.clientY - held.startY;
      const across = Math.abs(touch.clientX - held.startX);
      if (held.dragging || (down > 0 && down >= across)) event.preventDefault();
    };

    dialog.addEventListener("pointerdown", onDownReset, true);
    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointermove", onMove);
    dialog.addEventListener("pointerup", onEnd);
    dialog.addEventListener("pointercancel", onEnd);
    dialog.addEventListener("click", onClick, true);
    dialog.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      dialog.removeEventListener("pointerdown", onDownReset, true);
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointermove", onMove);
      dialog.removeEventListener("pointerup", onEnd);
      dialog.removeEventListener("pointercancel", onEnd);
      dialog.removeEventListener("click", onClick, true);
      dialog.removeEventListener("touchmove", onTouchMove);
      gesture.current = null;
    };
  }, [sheet, handleZone, handleOnly, open]);

  return { offset, dragging };
}
