import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DescribeCounter, PickedRow, type PickedThumb } from "./picked-row";

const items: PickedThumb[] = [
  { id: "a", src: "blob:a" },
  { id: "b", src: "blob:b" },
];

describe("PickedRow", () => {
  it("is one affordance, and it opens the manager", () => {
    const onManage = vi.fn();
    render(<PickedRow items={items} caption="2 pictures — the body" onManage={onManage} />);
    fireEvent.click(screen.getByTestId("picked-row"));
    expect(onManage).toHaveBeenCalled();
  });

  it("carries no Crop or Edit shortcut — the row itself is the way in", () => {
    // jakob 2026-08-31: "none". A second entrance to the crop step is the
    // two-menus pattern the system refuses; Back reaches it.
    render(<PickedRow items={items} caption="2 pictures — the body" onManage={vi.fn()} />);
    expect(screen.queryByText("Crop")).toBeNull();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("badges the first picture as the cover", () => {
    render(<PickedRow items={items} caption="2 pictures — the body" onManage={vi.fn()} />);
    expect(screen.getAllByText("Cover")).toHaveLength(1);
  });

  it("says what the body is", () => {
    render(<PickedRow items={items} caption="2 pictures — the body" onManage={vi.fn()} />);
    expect(screen.getByText("2 pictures — the body")).toBeInTheDocument();
  });
});

describe("DescribeCounter", () => {
  it("offers the way in and counts what is done, without nagging", () => {
    const onDescribe = vi.fn();
    render(<DescribeCounter described={1} total={3} onDescribe={onDescribe} />);
    expect(screen.getByText("· 1 of 3 described")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("describe-counter"));
    expect(onDescribe).toHaveBeenCalled();
  });
});
