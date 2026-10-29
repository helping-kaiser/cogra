import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { dropIndex, PickedSheet, type PickedSheetItem } from "./picked-sheet";

const items: PickedSheetItem[] = [
  { id: "a", src: "blob:a", described: true },
  { id: "b", src: "blob:b", described: false },
  { id: "c", src: "blob:c", described: false },
];

function open(overrides: Partial<Parameters<typeof PickedSheet>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    items,
    onDescribe: vi.fn(),
    onRemove: vi.fn(),
    onMove: vi.fn(),
    ...overrides,
  };
  render(<PickedSheet {...props} />);
  return props;
}

describe("PickedSheet", () => {
  it("names the first picture as the cover and the rest by position", () => {
    open();
    expect(screen.getByText("Cover — shown first")).toBeInTheDocument();
    expect(screen.getByText("Picture 2")).toBeInTheDocument();
    expect(screen.getByText("Picture 3")).toBeInTheDocument();
  });

  it("counts the set in its title", () => {
    open();
    expect(screen.getByTestId("picked-sheet")).toHaveAttribute("aria-label", "Picked · 3");
  });

  // PickedSheet.jsx: the list opens right under the title, its rule the first line.
  it("stands the list right under the title, with no body padding of its own above it", () => {
    open();
    expect(screen.getByTestId("picked-sheet-body").className).not.toContain("pt-2");
  });

  // Round 27 (seam 253, measured): the note box spans the sheet and its 24px is
  // its own PADDING; the list's hairline spans the sheet over padded rows.
  it("spans the sheet with the note box and the list, each part carrying its own inset", () => {
    open();
    const body = screen.getByTestId("picked-sheet-body").className;
    expect(body).not.toMatch(/\bpx-6\b/);
    const note = screen.getByText("The first one is the cover.");
    expect(note.className).toMatch(/\bpx-6\b/);
    expect(note.className).toMatch(/\bpt-3\b/);
    // No margin of its own beyond the reset `m-0`.
    expect(note.className.split(/\s+/).filter((cls) => /^-?m[xytrbl]?-/.test(cls))).toEqual(["m-0"]);
    const list = screen.getByTestId("picked-sheet-row-0").parentElement!;
    expect(list.className).toMatch(/\bpx-6\b/);
    expect(list.className).toContain("border-t");
    // Done stands 16px from the sheet's edge (8 · 16 · 8).
    expect(screen.getByTestId("picked-sheet-done").parentElement!.className).toMatch(/\bpx-4\b/);
  });

  it("shows the quiet word instead of the link once a picture is described", () => {
    open();
    expect(screen.getByTestId("picked-sheet-described-0")).toHaveTextContent("Described");
    expect(screen.queryByTestId("picked-sheet-describe-0")).toBeNull();
    expect(screen.getByTestId("picked-sheet-describe-1")).toBeInTheDocument();
  });

  it("moves a picture with the arrow keys, so the drag is not the only route", () => {
    const props = open();
    fireEvent.keyDown(screen.getByTestId("picked-sheet-move-1"), { key: "ArrowUp" });
    expect(props.onMove).toHaveBeenCalledWith(1, 0);
    fireEvent.keyDown(screen.getByTestId("picked-sheet-move-1"), { key: "ArrowDown" });
    expect(props.onMove).toHaveBeenCalledWith(1, 2);
  });

  it("does not move the first picture up or the last one down", () => {
    const props = open();
    fireEvent.keyDown(screen.getByTestId("picked-sheet-move-0"), { key: "ArrowUp" });
    fireEvent.keyDown(screen.getByTestId("picked-sheet-move-2"), { key: "ArrowDown" });
    expect(props.onMove).not.toHaveBeenCalled();
  });

  it("names the remove target so the control is not just an X", () => {
    open();
    expect(screen.getByLabelText("Remove the cover")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove picture 2")).toBeInTheDocument();
  });

  // EditPicked.md / PickedSheet.jsx: the drag's non-drag twins, each only
  // where the move is possible; the handle is named for its picture.
  it("offers make-it-the-cover, move up and move down only where each is possible", () => {
    const props = open();
    expect(screen.queryByTestId("picked-sheet-make-cover-0")).toBeNull();
    expect(screen.queryByTestId("picked-sheet-up-0")).toBeNull();
    expect(screen.queryByTestId("picked-sheet-down-2")).toBeNull();
    fireEvent.click(screen.getByTestId("picked-sheet-make-cover-2"));
    expect(props.onMove).toHaveBeenLastCalledWith(2, 0);
    fireEvent.click(screen.getByTestId("picked-sheet-up-1"));
    expect(props.onMove).toHaveBeenLastCalledWith(1, 0);
    fireEvent.click(screen.getByTestId("picked-sheet-down-1"));
    expect(props.onMove).toHaveBeenLastCalledWith(1, 2);
    expect(screen.getByLabelText("Reorder the cover")).toBeInTheDocument();
    expect(screen.getByLabelText("Reorder picture 2")).toBeInTheDocument();
    expect(screen.getByText("The first one is the cover.")).toBeInTheDocument();
  });

  it("reports which picture is to be described", () => {
    const props = open();
    fireEvent.click(screen.getByTestId("picked-sheet-describe-2"));
    expect(props.onDescribe).toHaveBeenCalledWith("c");
  });
});

describe("PickedSheet's drag", () => {
  it("lands a dragged row on the nearest row boundary, inside the list", () => {
    // 68px rows (PickedSheet.jsx minHeight): half a row or more is a move.
    expect(dropIndex(2, -70, 68, 3)).toBe(1);
    expect(dropIndex(2, -140, 68, 3)).toBe(0);
    expect(dropIndex(0, 30, 68, 3)).toBe(0);
    expect(dropIndex(0, 35, 68, 3)).toBe(1);
    expect(dropIndex(0, 999, 68, 3)).toBe(2);
    expect(dropIndex(1, -999, 68, 3)).toBe(0);
    expect(dropIndex(1, 50, 0, 3)).toBe(1);
  });

  it("gives the handle and the remove X the 48px target", () => {
    open();
    expect(screen.getByTestId("picked-sheet-move-1").className).toContain("cg-hit");
    expect(screen.getByTestId("picked-sheet-remove-1").className).toContain("cg-hit");
  });
});
