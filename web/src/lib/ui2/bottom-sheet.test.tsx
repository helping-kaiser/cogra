import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHEET_OUT_MS } from "@/lib/ui/motion";
import { PULL_THRESHOLD } from "@/lib/ui/pull-to-refresh";
import {
  BottomSheet,
  SHEET_CEILING,
  SHEET_CEILING_SLIVER_PX,
  SHEET_DEFAULT,
  SHEET_KEYBOARD_LIFT,
  SHEET_RAISED,
  SheetItem,
} from "./bottom-sheet";

describe("BottomSheet", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("opens and closes with the prop that governs it", () => {
    const { rerender } = render(
      <BottomSheet open={false} onClose={() => {}} title="The license">
        <p>Terms</p>
      </BottomSheet>,
    );
    const dialog = screen.getByTestId("bottom-sheet") as HTMLDialogElement;
    expect(dialog.open).toBe(false);

    rerender(
      <BottomSheet open onClose={() => {}} title="The license">
        <p>Terms</p>
      </BottomSheet>,
    );
    expect(dialog.open).toBe(true);

    rerender(
      <BottomSheet open={false} onClose={() => {}} title="The license">
        <p>Terms</p>
      </BottomSheet>,
    );
    // It leaves the edge it entered from before it goes, so the close waits
    // out the exit animation rather than snapping the surface away.
    expect(dialog.className).toContain("cg-sheet-out");
    expect(dialog.open).toBe(true);
    act(() => void vi.advanceTimersByTime(SHEET_OUT_MS));
    expect(dialog.open).toBe(false);
  });

  it("rises from the bottom edge on the way in", () => {
    render(
      <BottomSheet open onClose={() => {}} title="The license">
        <p>Terms</p>
      </BottomSheet>,
    );
    expect(screen.getByTestId("bottom-sheet").className).toContain("cg-sheet-in");
  });

  it("is named by its title, so what opened is announced", () => {
    render(
      <BottomSheet open onClose={() => {}} title="Marking as sensitive">
        <p>Body</p>
      </BottomSheet>,
    );
    expect(screen.getByLabelText("Marking as sensitive")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Marking as sensitive" })).toBeInTheDocument();
  });

  it("drops when the reader presses outside it", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="The license">
        <p>Terms</p>
      </BottomSheet>,
    );
    screen.getByTestId("bottom-sheet").click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays open when the press lands on its contents", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="The license">
        <p>Terms</p>
      </BottomSheet>,
    );
    screen.getByText("Terms").click();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("rises from the edge it goes back to, at the extra-large rung", () => {
    render(
      <BottomSheet open onClose={() => {}} title="The license">
        <p>Terms</p>
      </BottomSheet>,
    );
    const dialog = screen.getByTestId("bottom-sheet");
    expect(dialog.className).toContain("mt-auto");
    expect(dialog.className).toContain("rounded-t-extra-large");
  });

  it("carries what the heading line holds besides its name, without changing what it is labelled by", () => {
    render(
      <BottomSheet
        open
        onClose={() => {}}
        title="Mark as sensitive"
        titleTrailing={<button type="button">?</button>}
      >
        <p>Body</p>
      </BottomSheet>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Mark as sensitive" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Mark as sensitive")).toBeInTheDocument();
  });

  // The comments sheet's height is drawn rather than content-sized
  // (`_shared.jsx:1249`), because the row pinned at its foot needs the surface
  // itself to own the height.
  it("takes the drawn full height instead of sizing to its content", () => {
    const { rerender } = render(
      <BottomSheet open onClose={() => {}} title="Comments">
        <p>A comment</p>
      </BottomSheet>,
    );
    // Content-sized, held UNDER the ceiling rather than pinned at it: the
    // master's 62% default class stands and the ceiling clamps it
    // (`BottomSheet.jsx`'s `min()`).
    // jsdom re-prints `calc()` in its own normal form, so the pieces are what
    // is compared rather than the string — the exact spelling of the constant
    // is pinned on its own below.
    const capped = screen.getByTestId("bottom-sheet");
    expect(capped.style.maxHeight).toMatch(/^min\(62dvh,/);
    expect(capped.style.maxHeight).toContain("100dvh");
    expect(capped.style.maxHeight).toContain("72px");
    expect(capped.style.maxHeight).toContain("env(safe-area-inset-top");
    expect(capped.style.height).toBe("");

    rerender(
      <BottomSheet open onClose={() => {}} title="Comments" tallest>
        <p>A comment</p>
      </BottomSheet>,
    );
    // The tallest class is PINNED at the ceiling, so it takes a height and
    // not a maximum.
    const pinned = screen.getByTestId("bottom-sheet");
    expect(pinned.style.height).toContain("100dvh");
    expect(pinned.style.height).toContain("72px");
    expect(pinned.style.height).toContain("env(safe-area-inset-top");
    expect(pinned.style.maxHeight).toBe("");
  });

  // THE SLIVER IS THE DRAWN ONE (jakob's ruling, the sheets-and-video round,
  // 2026-09-22; `design/components/core/BottomSheet.jsx`'s `SHEET_CEILING`
  // is the same `calc(100% - 72px - env(safe-area-inset-top, 0px))`).
  // The master's `100%` is the visible screen, so the keyboard's height comes
  // off it (seam 381) — 0 with no keyboard, the drawn ceiling exactly.
  it("measures its ceiling from the top of the safe area", () => {
    expect(SHEET_CEILING_SLIVER_PX).toBe(72);
    expect(SHEET_CEILING).toBe(
      `calc(100dvh - ${SHEET_CEILING_SLIVER_PX}px - env(safe-area-inset-top, 0px) - var(--keyboard-inset, 0px))`,
    );
  });

  // A pinned footer never walks out of reach (design/readme.md, Spacing and
  // layout): with the keyboard up the whole sheet stands on its top edge.
  it("stands_on_the_keyboards_top_edge", () => {
    render(
      <BottomSheet open onClose={() => {}} title="Mark as sensitive">
        <p>Body</p>
      </BottomSheet>,
    );
    expect(screen.getByTestId("bottom-sheet").style.marginBottom).toBe(SHEET_KEYBOARD_LIFT);
    expect(SHEET_KEYBOARD_LIFT).toBe("var(--keyboard-inset, 0px)");
  });

  // The column inside the surface is bounded by the same thing, less the
  // surface's own padding — a sheet whose column could out-grow its surface
  // would put Done past the edge.
  it("bounds the column inside it by the same ceiling", () => {
    render(
      <BottomSheet open onClose={() => {}} title="Mark as sensitive">
        <p>Body</p>
      </BottomSheet>,
    );
    const column = screen.getByTestId("bottom-sheet-column").style.maxHeight;
    const surface = screen.getByTestId("bottom-sheet").style.maxHeight;
    expect(surface).toMatch(/^min\(62dvh,/);
    expect(column.startsWith(`calc(${surface} - `)).toBe(true);
  });

  // SHEET-88 (round 25): A HEIGHT CLASS IS THE SURFACE'S WHOLE HEIGHT
  // (`BottomSheet.jsx`: `boxSizing: "border-box"`) — the grip strip and the
  // bottom inset inside it, never added on top: the surface's padding sits
  // inside its border box, so 88% is 88%.
  it("draws a height class whole: the raised class is 88dvh, nothing added", () => {
    render(
      <BottomSheet open onClose={() => {}} title="Cited by" maxHeight={SHEET_RAISED}>
        <p>Body</p>
      </BottomSheet>,
    );
    const surface = screen.getByTestId("bottom-sheet");
    expect(SHEET_RAISED).toBe("88dvh");
    expect(SHEET_DEFAULT).toBe("62dvh");
    expect(surface.style.maxHeight).toMatch(/^min\(88dvh,/);
    expect(surface.style.maxHeight).not.toMatch(/\+|32px/);
  });

  // W-SHEET-PT2: the master's surface adds no gap between the title (its own
  // 8px under it) and the content — a board that draws one carries it itself.
  it("adds nothing above its content under the title", () => {
    render(
      <BottomSheet open onClose={() => {}} title="Report this post?">
        <p>Body</p>
      </BottomSheet>,
    );
    const body = screen.getByTestId("bottom-sheet-body");
    expect(body.className).not.toMatch(/\bpt-/);
    expect(body.className).toContain("px-6");
    expect(screen.getByRole("heading", { name: "Report this post?" })).toHaveClass("pb-2");
  });

  // THE MASTER'S BOX MODEL (`BottomSheet.jsx`: the surface's `padding:
  // var(--space-2) 0 calc(var(--space-6) + env(safe-area-inset-bottom, 0px))`,
  // the grip's `marginBottom: var(--space-3)` and nothing over it). The padding
  // is the SURFACE's — measured on its node — never a child's margin standing
  // in for it (W-SHEET-PADDING-PLACEMENT).
  describe("the master's box model", () => {
    it("pads the surface itself: 8 over the grip, 24 and the inset under the last child", () => {
      render(
        <BottomSheet open onClose={() => {}} title="Mark as sensitive">
          <p>Body</p>
        </BottomSheet>,
      );
      const surface = screen.getByTestId("bottom-sheet");
      expect(surface.style.paddingTop).toBe("0.5rem");
      expect(surface.style.paddingBottom).toBe("calc(1.5rem + env(safe-area-inset-bottom, 0px))");
      expect(surface.style.paddingLeft).toBe("0px");
      expect(surface.style.paddingRight).toBe("0px");
      expect(surface.className).not.toMatch(/\bp-0\b/);
    });

    it("gives the grip 12 under it and nothing over it", () => {
      render(
        <BottomSheet open onClose={() => {}} title="Mark as sensitive" node={{ path: "x.sheet" }}>
          <p>Body</p>
        </BottomSheet>,
      );
      const grip = screen.getByTestId("x.sheet.dragHandle").className.split(" ");
      expect(grip).toEqual(expect.arrayContaining(["mb-3", "h-1", "w-8"]));
      expect(grip.some((c) => /^m[ty]-/.test(c))).toBe(false);
    });

    // A foot-less body runs into the surface's bottom padding by exactly that
    // padding, so a capped sheet's content still scrolls to the edge — the
    // master's surface IS its scroller, and its padding ends the scroll.
    it("lets a foot-less body scroll through the surface's bottom padding, adding none", () => {
      render(
        <BottomSheet open onClose={() => {}} title="Mark as sensitive">
          <p>Body</p>
        </BottomSheet>,
      );
      const body = screen.getByTestId("bottom-sheet-body");
      expect(body.style.marginBottom).toBe("calc(-1 * (1.5rem + env(safe-area-inset-bottom, 0px)))");
      expect(body.style.paddingBottom).toBe("calc(1.5rem + env(safe-area-inset-bottom, 0px))");
      expect(body.className).not.toMatch(/\bpb-/);
    });

    // W-SHEET-FOOT-GAP (SettingsLicense: the foot stands in the padded
    // column at its `gap:8px`); the 24 under the foot is the surface's.
    it("gaps a foot at 8 and leaves the 24 under it to the surface", () => {
      render(
        <BottomSheet open onClose={() => {}} title="Default license" foot={<div data-testid="foot">Done</div>}>
          <p>Body</p>
        </BottomSheet>,
      );
      const body = screen.getByTestId("bottom-sheet-body");
      expect(body.className.split(" ")).toContain("pb-2");
      expect(body.className).not.toMatch(/\bpb-3\b/);
      expect(body.style.marginBottom).toBe("");
      expect(screen.getByTestId("foot").parentElement?.className).not.toMatch(/\bpb-/);
    });

    // The column fits inside the padded surface: its bound is the surface's
    // less the padding, or it would push past the surface's edge.
    it("bounds the column by the surface's class less the surface's padding", () => {
      render(
        <BottomSheet open onClose={() => {}} title="Cited by" maxHeight={SHEET_RAISED}>
          <p>Body</p>
        </BottomSheet>,
      );
      expect(screen.getByTestId("bottom-sheet-column").style.maxHeight).toBe(
        `calc(min(88dvh, ${SHEET_CEILING}) - 0.5rem - (1.5rem + env(safe-area-inset-bottom, 0px)))`,
      );
    });
  });

  // A sheet over a sheet takes the next tonal rung (design/readme.md:2364:
  // "its surface moves to `surfaceContainerHighest` ... two surfaces at one
  // rung claim one elevation").
  it("takes the next tonal rung when it stacks over another sheet", () => {
    const { rerender } = render(
      <BottomSheet open onClose={() => {}} title="Comment actions" stacked>
        <p>Row</p>
      </BottomSheet>,
    );
    expect(screen.getByTestId("bottom-sheet").className).toContain(
      "bg-surface-container-highest",
    );

    rerender(
      <BottomSheet open onClose={() => {}} title="Comment actions">
        <p>Row</p>
      </BottomSheet>,
    );
    expect(screen.getByTestId("bottom-sheet").className).not.toContain(
      "bg-surface-container-highest",
    );
    expect(screen.getByTestId("bottom-sheet").className).toContain("bg-surface-container-high");
  });

  // ONE SCRIM, HOWEVER MANY SHEETS. The system has a single dimming token and
  // stacking moves the z-layer, never the tone — but every native `<dialog>`
  // paints its own `::backdrop`, so an upper sheet that kept one composited a
  // second 50% black over the first.
  it("dims once when it stacks, and dims itself when it does not", () => {
    const { rerender } = render(
      <BottomSheet open onClose={() => {}} title="Comment actions" stacked>
        <p>Row</p>
      </BottomSheet>,
    );
    expect(screen.getByTestId("bottom-sheet").className).toContain("backdrop:bg-transparent");
    expect(screen.getByTestId("bottom-sheet").className).not.toContain("backdrop:bg-scrim/50");

    rerender(
      <BottomSheet open onClose={() => {}} title="Comment actions">
        <p>Row</p>
      </BottomSheet>,
    );
    expect(screen.getByTestId("bottom-sheet").className).toContain("backdrop:bg-scrim/50");
  });

  // THE DRAG IS M3's (design/readme.md §4, *Sheets*; BottomSheet.jsx): from
  // the handle area, and from a list at its scroll-top; it dismisses past
  // about 25 % of its height or on a downward fling, and otherwise snaps back.
  describe("the drag that drops it", () => {
    // A laid-out sheet 400px tall whose title row ends at y=460: the quarter
    // that dismisses is 100px.
    const SHEET_TOP = 400;
    const layOut = (zoneBottom = SHEET_TOP + 60) => {
      const dialog = screen.getByTestId("bottom-sheet");
      vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
        top: SHEET_TOP, bottom: SHEET_TOP + 400, left: 0, right: 400, width: 400, height: 400, x: 0, y: SHEET_TOP,
      } as DOMRect);
      const zone = dialog.querySelector("h2") ?? dialog.querySelector("span[aria-hidden]");
      if (zone) {
        vi.spyOn(zone, "getBoundingClientRect").mockReturnValue({ bottom: zoneBottom } as DOMRect);
      }
      return dialog;
    };
    /** One pointer event at `y`, stamped at `t` ms — the clock a fling is read on. */
    const at = (
      kind: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel",
      target: Element,
      y: number,
      t: number,
      pointerType = "touch",
    ) => {
      const event = createEvent[kind](target, { pointerType, pointerId: 1, clientX: 50, clientY: y, button: 0 });
      Object.defineProperty(event, "timeStamp", { value: t });
      act(() => void fireEvent(target, event));
    };
    /** A slow drag by `travel` px in 10px steps 16ms apart, held still for `rest` ms, then released. */
    const drag = (target: Element, from: number, travel: number, { rest = 200, pointerType = "touch" } = {}) => {
      let t = 0;
      at("pointerDown", target, from, t, pointerType);
      const step = travel < 0 ? -10 : 10;
      for (let y = from + step; Math.abs(y - from) <= Math.abs(travel); y += step) {
        t += 16;
        at("pointerMove", target, y, t, pointerType);
      }
      at("pointerUp", target, from + travel, t + rest, pointerType);
    };
    const sheet = (onClose: () => void, children: ReactNode = <p>A comment</p>, props = {}) => (
      <BottomSheet open onClose={onClose} title="Comments" {...props}>
        {children}
      </BottomSheet>
    );

    it("drops when a slow drag passes a quarter of the sheet's height", () => {
      const onClose = vi.fn();
      render(sheet(onClose));
      drag(layOut(), 500, 110);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("snaps back from a slow drag short of the quarter", () => {
      const onClose = vi.fn();
      render(sheet(onClose));
      const dialog = layOut();
      drag(dialog, 500, 90);
      expect(onClose).not.toHaveBeenCalled();
      expect(dialog.style.translate).toBe("");
    });

    it("follows the pointer while it is held", () => {
      render(sheet(vi.fn()));
      const dialog = layOut();
      at("pointerDown", dialog, 500, 0);
      at("pointerMove", dialog, 540, 16);
      expect(dialog.style.translate).toBe("0px 40px");
      at("pointerMove", dialog, 520, 32);
      expect(dialog.style.translate).toBe("0px 20px");
    });

    it("drops on a downward fling, however short", () => {
      const onClose = vi.fn();
      render(sheet(onClose));
      const dialog = layOut();
      at("pointerDown", dialog, 500, 0);
      at("pointerMove", dialog, 520, 16);
      at("pointerMove", dialog, 540, 32);
      at("pointerUp", dialog, 540, 40);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("stays for an upward drag, which is the reader scrolling in", () => {
      const onClose = vi.fn();
      render(sheet(onClose));
      drag(layOut(), 600, -150);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("drops by a mouse the same way it drops by a finger", () => {
      const onClose = vi.fn();
      render(sheet(onClose));
      drag(layOut(), 500, 150, { pointerType: "mouse" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("drops from the handle zone even when the list under it is scrolled", () => {
      const onClose = vi.fn();
      render(sheet(onClose));
      const dialog = layOut();
      Object.defineProperty(screen.getByTestId("bottom-sheet-body"), "scrollTop", { value: 40, configurable: true });
      drag(dialog, 430, 150);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    // A SCROLLED LIST IS BEING SCROLLED, NOT PULLED — which is what keeps an
    // unfolded branch standing through a drag inside the thread.
    it("stays when the body is not at its own top", () => {
      const onClose = vi.fn();
      render(sheet(onClose));
      layOut();
      const body = screen.getByTestId("bottom-sheet-body");
      Object.defineProperty(body, "scrollTop", { value: 40, configurable: true });
      drag(screen.getByText("A comment"), 500, 200);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("stays when an inner list the press started in is not at its top", () => {
      const onClose = vi.fn();
      render(
        sheet(
          onClose,
          <div data-testid="thread">
            <p>A comment</p>
          </div>,
        ),
      );
      layOut();
      Object.defineProperty(screen.getByTestId("thread"), "scrollTop", { value: 120, configurable: true });
      drag(screen.getByText("A comment"), 500, 200);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("leaves a field its own pointer", () => {
      const onClose = vi.fn();
      render(sheet(onClose, <textarea aria-label="Reply" />));
      layOut();
      drag(screen.getByLabelText("Reply"), 500, 200);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("drags a pad's sheet only from its handle and title zone", () => {
      const onClose = vi.fn();
      render(sheet(onClose, <p>The square</p>, { dragFromHandle: true }));
      const dialog = layOut();
      drag(screen.getByText("The square"), 500, 200);
      expect(onClose).not.toHaveBeenCalled();
      drag(dialog, 430, 200);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("is not a press on whatever the drag let go over", () => {
      const onClose = vi.fn();
      const onRow = vi.fn();
      render(sheet(onClose, <button onClick={onRow}>Save</button>));
      const dialog = layOut();
      const row = screen.getByText("Save");
      drag(row, 500, 60, { pointerType: "mouse" });
      act(() => row.click());
      expect(onRow).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      // A press that never travelled is still a press.
      at("pointerDown", row, 500, 1000, "mouse");
      at("pointerUp", row, 502, 1050, "mouse");
      act(() => row.click());
      expect(onRow).toHaveBeenCalledTimes(1);
      expect(dialog.style.translate).toBe("");
    });

    it("takes a downward touch from the browser, and leaves it an upward one", () => {
      render(sheet(vi.fn()));
      const dialog = layOut();
      const touch = (y: number) => {
        const event = new Event("touchmove", { cancelable: true, bubbles: true });
        Object.defineProperty(event, "touches", { value: [{ clientX: 50, clientY: y }] });
        dialog.dispatchEvent(event);
        return event.defaultPrevented;
      };
      at("pointerDown", dialog, 500, 0);
      expect(touch(505)).toBe(true);
      at("pointerCancel", dialog, 505, 10);
      at("pointerDown", dialog, 500, 20);
      expect(touch(490)).toBe(false);
    });

    // The surface's own padding targets the dialog just as the scrim does: a
    // tap on the strip over the grip is a press on the sheet, never the scrim.
    it("drops on a press on the scrim, never on one on the sheet's own padding", () => {
      const onClose = vi.fn();
      render(sheet(onClose));
      const dialog = layOut();
      fireEvent.click(dialog, { clientX: 200, clientY: SHEET_TOP + 4 });
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.click(dialog, { clientX: 200, clientY: SHEET_TOP - 50 });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("pins the foot below the body, outside what scrolls", () => {
    render(
      <BottomSheet
        open
        onClose={() => {}}
        title="Comments"
        tallest
        foot={<button type="button">Add a comment</button>}
      >
        <p>A comment</p>
      </BottomSheet>,
    );
    const body = screen.getByText("A comment").parentElement;
    expect(body?.className).toContain("overflow-y-auto");
    expect(body).not.toContainElement(screen.getByRole("button", { name: "Add a comment" }));
  });

  // (e) A SHEET ALREADY AT THE CEILING TAKES THE ROOM FROM ITS LIST (jakob's
  // ruling, the sheets-and-video round, 2026-09-22 — design/readme.md §13).
  // The comments sheet cannot grow, so the composer's growth comes out of the
  // thread above it, the way every chat app does it. The law is in which of
  // the two can give: the body yields (`flex-1`, `min-h-0`) and the foot does
  // not (`flex-none`), so a taller foot shortens the list and the sheet's own
  // top edge never moves.
  it("takes a growing foot's room out of the list above it", () => {
    render(
      <BottomSheet
        open
        onClose={() => {}}
        title="Comments"
        tallest
        foot={<button type="button">Add a comment</button>}
      >
        <p>A comment</p>
      </BottomSheet>,
    );
    const body = screen.getByTestId("bottom-sheet-body");
    expect(body.className).toContain("flex-1");
    expect(body.className).toContain("min-h-0");

    const foot = screen.getByRole("button", { name: "Add a comment" }).parentElement;
    expect(foot?.className).toContain("flex-none");
  });

  // `onClose` IS THE READER'S WORD. The sheet closes its own dialog after the
  // exit animation once the host has already set `open` false; that close is
  // the host's own doing and is never reported back, because a host that has
  // meanwhile asked to reopen would have the stale report override it.
  describe("who closed it", () => {
    const sheet = (open: boolean, onClose: () => void) => (
      <BottomSheet open={open} onClose={onClose} title="Comments">
        <p>A comment</p>
      </BottomSheet>
    );

    it("does not report the close it performs itself after the host dropped it", () => {
      const onClose = vi.fn();
      const { rerender } = render(sheet(true, onClose));
      const dialog = screen.getByTestId("bottom-sheet") as HTMLDialogElement;
      rerender(sheet(false, onClose));
      act(() => void vi.advanceTimersByTime(SHEET_OUT_MS));
      // Let a close event the platform dispatches later arrive too.
      act(() => void vi.runAllTimers());
      expect(dialog.open).toBe(false);
      expect(onClose).not.toHaveBeenCalled();
    });

    // THE LOST REOPEN. The platform dispatches `close` as a task of its own, so
    // the programmatic close's event can arrive after the host has reopened.
    it("keeps a reopen the host asked for when the programmatic close's event arrives late", () => {
      function Host() {
        const [open, setOpen] = useState(true);
        return (
          <>
            <button type="button" onClick={() => setOpen(false)}>
              drop
            </button>
            <button type="button" onClick={() => setOpen(true)}>
              raise
            </button>
            {sheet(open, () => setOpen(false))}
          </>
        );
      }
      render(<Host />);
      const dialog = screen.getByTestId("bottom-sheet") as HTMLDialogElement;
      // The close takes effect now; its event is the platform's to dispatch
      // later, so the test dispatches it itself, after the reopen.
      const closed = vi.spyOn(dialog, "close").mockImplementation(() => {
        dialog.removeAttribute("open");
      });

      fireEvent.click(screen.getByText("drop"));
      act(() => void vi.advanceTimersByTime(SHEET_OUT_MS));
      expect(closed).toHaveBeenCalledOnce();
      expect(dialog.open).toBe(false);
      fireEvent.click(screen.getByText("raise"));
      expect(dialog.open).toBe(true);

      act(() => void fireEvent(dialog, new Event("close")));
      act(() => void vi.runAllTimers());
      expect(dialog.open).toBe(true);
    });

    it("does not close a dialog that was raised again before the exit finished", () => {
      const onClose = vi.fn();
      const { rerender } = render(sheet(true, onClose));
      const dialog = screen.getByTestId("bottom-sheet") as HTMLDialogElement;
      rerender(sheet(false, onClose));
      act(() => void vi.advanceTimersByTime(SHEET_OUT_MS - 1));
      rerender(sheet(true, onClose));
      act(() => void vi.runAllTimers());
      expect(dialog.open).toBe(true);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("reports the reader's own close — Escape — exactly once", () => {
      const onClose = vi.fn();
      render(sheet(true, onClose));
      const dialog = screen.getByTestId("bottom-sheet") as HTMLDialogElement;
      // Escape asks the platform to close the dialog: no flag of ours is set.
      act(() => dialog.close());
      act(() => void vi.runAllTimers());
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("reports Escape even right after a programmatic close", () => {
      const onClose = vi.fn();
      const { rerender } = render(sheet(true, onClose));
      const dialog = screen.getByTestId("bottom-sheet") as HTMLDialogElement;
      rerender(sheet(false, onClose));
      act(() => void vi.runAllTimers());
      rerender(sheet(true, onClose));
      expect(dialog.open).toBe(true);
      act(() => dialog.close());
      act(() => void vi.runAllTimers());
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("reports Escape pressed while the exit is running exactly once and leaves nothing armed", () => {
      const onClose = vi.fn();
      const { rerender } = render(sheet(true, onClose));
      const dialog = screen.getByTestId("bottom-sheet") as HTMLDialogElement;
      rerender(sheet(false, onClose));
      act(() => dialog.close());
      act(() => void vi.runAllTimers());
      expect(onClose).toHaveBeenCalledTimes(1);
      // The timer found it closed and closed nothing, so the next Escape counts.
      rerender(sheet(true, onClose));
      act(() => dialog.close());
      act(() => void vi.runAllTimers());
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("reports the press outside it exactly once", () => {
      const onClose = vi.fn();
      render(sheet(true, onClose));
      screen.getByTestId("bottom-sheet").click();
      act(() => void vi.runAllTimers());
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("reports the pull exactly once", () => {
      const onClose = vi.fn();
      render(sheet(true, onClose));
      const dialog = screen.getByTestId("bottom-sheet");
      fireEvent.pointerDown(dialog, { pointerType: "touch", clientY: 100 });
      fireEvent.pointerMove(dialog, { pointerType: "touch", clientY: 100 + PULL_THRESHOLD });
      fireEvent.pointerUp(dialog, { pointerType: "touch", clientY: 100 + PULL_THRESHOLD });
      act(() => void vi.runAllTimers());
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

describe("SheetItem", () => {
  it("selects on press", () => {
    const onSelect = vi.fn();
    render(
      <SheetItem testId="public-domain" onSelect={onSelect}>
        Public domain
      </SheetItem>,
    );
    screen.getByTestId("public-domain").click();
    expect(onSelect).toHaveBeenCalledOnce();
  });


  it("reports the chosen row rather than relying on its colour", () => {
    render(
      <SheetItem testId="pd" onSelect={() => {}} selected>
        Public domain
      </SheetItem>,
    );
    expect(screen.getByTestId("pd")).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps a 48px row", () => {
    render(
      <SheetItem testId="pd" onSelect={() => {}}>
        Public domain
      </SheetItem>,
    );
    expect(screen.getByTestId("pd").className).toContain("min-h-12");
  });

  // `SheetItem`'s own padding (`BottomSheet.jsx`: `calc((48px − label-large's
  // 20px line) / 2) var(--space-6)` = 14 24): the row's height is its padding
  // around the line, the 48px minimum only a floor under it.
  it("pads its row 14 over and under the line, the master's padding rather than a centred minimum", () => {
    render(
      <SheetItem testId="pd" onSelect={() => {}} edge>
        Public domain
      </SheetItem>,
    );
    const row = screen.getByTestId("pd").className.split(" ");
    expect(row).toEqual(expect.arrayContaining(["py-3.5", "px-6", "min-h-12"]));
  });

  // NamesLong.md:5 and :9 at the longest legal handle (NamesLong.jsx).
  it("keeps a menu row to one line, clipped at its end where the handle ends it", () => {
    const label = "Hide @maximiliana_featherstone_haugh";
    render(
      <SheetItem testId="hide" onSelect={() => {}}>
        {label}
      </SheetItem>,
    );
    const row = screen.getByRole("button", { name: label });
    const words = row.firstElementChild as HTMLElement;
    expect(words.className.split(" ")).toEqual(expect.arrayContaining(["min-w-0", "flex-1", "truncate"]));
    expect(words.textContent).toBe(label);
  });

  // NamesLong.md:7 — words after the handle keep their room.
  it("cuts the handle and keeps the words after it", () => {
    render(
      <SheetItem testId="cite" onSelect={() => {}}>
        {"@maximiliana_featherstone_haugh's comment"}
      </SheetItem>,
    );
    const line = screen.getByTestId("cite").querySelector("[data-name-line]");
    expect(line?.lastElementChild?.textContent).toBe("'s comment");
  });
});

// NamesLong.md:11 and :13 — a sheet's heading wraps; the handle is one unit.
describe("BottomSheet's title with a long handle", () => {
  it("keeps the handle whole on one line inside the wrapping heading", () => {
    render(
      <BottomSheet open onClose={() => {}} title="Report @maximiliana_featherstone_haugh?">
        <p>Terms</p>
      </BottomSheet>,
    );
    const heading = screen.getByRole("heading", { name: "Report @maximiliana_featherstone_haugh?" });
    const unit = heading.querySelector("[data-name-unit]") as HTMLElement;
    expect(unit.className.split(" ")).toEqual(expect.arrayContaining(["inline-flex", "max-w-full", "whitespace-nowrap"]));
    expect(unit.lastElementChild?.textContent).toBe("?");
  });
});
