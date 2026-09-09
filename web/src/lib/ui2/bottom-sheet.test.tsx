import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHEET_OUT_MS } from "@/lib/ui/motion";
import { BottomSheet, SheetItem } from "./bottom-sheet";

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
