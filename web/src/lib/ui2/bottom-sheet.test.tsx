import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHEET_OUT_MS } from "@/lib/ui/motion";
import { PULL_THRESHOLD } from "@/lib/ui/pull-to-refresh";
import {
  BottomSheet,
  SHEET_CEILING,
  SHEET_CEILING_SLIVER_PX,
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
    // 92dvh class stands and the ceiling clamps it (`BottomSheet.jsx`'s
    // `min()`).
    // jsdom re-prints `calc()` in its own normal form, so the pieces are what
    // is compared rather than the string — the exact spelling of the constant
    // is pinned on its own below.
    const capped = screen.getByTestId("bottom-sheet");
    expect(capped.style.maxHeight).toMatch(/^min\(92dvh,/);
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
  it("measures its ceiling from the top of the safe area", () => {
    expect(SHEET_CEILING_SLIVER_PX).toBe(72);
    expect(SHEET_CEILING).toBe(
      `calc(100dvh - ${SHEET_CEILING_SLIVER_PX}px - env(safe-area-inset-top, 0px))`,
    );
  });

  // The column inside the surface is bounded by the same thing — a sheet
  // whose column could out-grow its surface would put Done past the edge.
  it("bounds the column inside it by the same ceiling", () => {
    render(
      <BottomSheet open onClose={() => {}} title="Mark as sensitive">
        <p>Body</p>
      </BottomSheet>,
    );
    const column = screen.getByTestId("bottom-sheet-column").style.maxHeight;
    expect(column).toMatch(/^min\(92dvh,/);
    expect(column).toBe(screen.getByTestId("bottom-sheet").style.maxHeight);
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

  // PULLING DOWN IS HOW A DRAWER IS DROPPED (design/readme.md: "pulling down
  // already means dismiss").
  describe("the pull that drops it", () => {
    const pull = (from: number, to: number) => {
      const dialog = screen.getByTestId("bottom-sheet");
      fireEvent.pointerDown(dialog, { pointerType: "touch", clientY: from });
      fireEvent.pointerMove(dialog, { pointerType: "touch", clientY: to });
      fireEvent.pointerUp(dialog, { pointerType: "touch", clientY: to });
    };

    it("drops when the pull passes the threshold", () => {
      const onClose = vi.fn();
      render(
        <BottomSheet open onClose={onClose} title="Comments">
          <p>A comment</p>
        </BottomSheet>,
      );
      pull(100, 100 + PULL_THRESHOLD);
      expect(onClose).toHaveBeenCalled();
    });

    it("stays for a pull that does not reach it", () => {
      const onClose = vi.fn();
      render(
        <BottomSheet open onClose={onClose} title="Comments">
          <p>A comment</p>
        </BottomSheet>,
      );
      pull(100, 100 + PULL_THRESHOLD - 1);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("stays for an upward drag, which is the reader scrolling in", () => {
      const onClose = vi.fn();
      render(
        <BottomSheet open onClose={onClose} title="Comments">
          <p>A comment</p>
        </BottomSheet>,
      );
      pull(200, 100);
      expect(onClose).not.toHaveBeenCalled();
    });

    // A SCROLLED BODY IS BEING SCROLLED, NOT PULLED — which is what keeps an
    // unfolded branch standing through a drag inside the thread.
    it("stays when the body is not at its own top", () => {
      const onClose = vi.fn();
      render(
        <BottomSheet open onClose={onClose} title="Comments">
          <p>A comment</p>
        </BottomSheet>,
      );
      const body = screen.getByTestId("bottom-sheet-body");
      Object.defineProperty(body, "scrollTop", { value: 40, configurable: true });
      pull(100, 100 + PULL_THRESHOLD * 2);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("ignores a mouse drag, which is a selection rather than a gesture", () => {
      const onClose = vi.fn();
      render(
        <BottomSheet open onClose={onClose} title="Comments">
          <p>A comment</p>
        </BottomSheet>,
      );
      const dialog = screen.getByTestId("bottom-sheet");
      fireEvent.pointerDown(dialog, { pointerType: "mouse", clientY: 100 });
      fireEvent.pointerMove(dialog, { pointerType: "mouse", clientY: 100 + PULL_THRESHOLD * 2 });
      fireEvent.pointerUp(dialog, { pointerType: "mouse", clientY: 100 + PULL_THRESHOLD * 2 });
      expect(onClose).not.toHaveBeenCalled();
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
});
