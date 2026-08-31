import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PickedSheet, type PickedSheetItem } from "./picked-sheet";

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

  it("reports which picture is to be described", () => {
    const props = open();
    fireEvent.click(screen.getByTestId("picked-sheet-describe-2"));
    expect(props.onDescribe).toHaveBeenCalledWith("c");
  });
});
