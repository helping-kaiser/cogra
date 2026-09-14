import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OverflowMenu } from "./overflow-menu";

const rows = (onSelect = vi.fn()) => [
  { label: "Save", onSelect, testId: "row-save" },
  { label: "License terms", onSelect, testId: "row-license" },
];

describe("OverflowMenu", () => {
  it("names the trigger for what it opens", () => {
    render(<OverflowMenu items={rows()} ariaLabel="More on this post" testId="post-menu" />);
    const trigger = screen.getByTestId("post-menu");
    expect(trigger).toHaveAttribute("aria-label", "More on this post");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  });

  it("opens the sheet on the trigger, in the order the rows were given", () => {
    render(<OverflowMenu items={rows()} ariaLabel="More on this post" testId="post-menu" />);
    const sheet = screen.getByTestId("post-menu-sheet") as HTMLDialogElement;
    expect(sheet.open).toBe(false);

    fireEvent.click(screen.getByTestId("post-menu"));
    expect(sheet.open).toBe(true);
    expect(screen.getByTestId("row-save")).toHaveTextContent("Save");
    expect(screen.getByTestId("row-license")).toHaveTextContent("License terms");
    // The license closes the menu; the acts it was opened for lead.
    expect(
      screen.getByTestId("row-save").compareDocumentPosition(screen.getByTestId("row-license")),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("carries no title row — the rows are the sheet", () => {
    render(<OverflowMenu items={rows()} ariaLabel="More on this post" testId="post-menu" />);
    fireEvent.click(screen.getByTestId("post-menu"));
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("drops the sheet as a row acts, so what the row opens is not behind it", () => {
    const onSelect = vi.fn();
    render(
      <OverflowMenu
        items={[{ label: "License terms", onSelect, testId: "row-license" }]}
        ariaLabel="More on this post"
        testId="post-menu"
      />,
    );
    fireEvent.click(screen.getByTestId("post-menu"));
    fireEvent.click(screen.getByTestId("row-license"));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.getByTestId("post-menu-sheet").className).toContain("cg-sheet-out");
  });

  it("draws no trigger at all when there are no rows — an empty sheet is a lie", () => {
    render(<OverflowMenu items={[]} ariaLabel="More on this post" testId="post-menu" />);
    expect(screen.queryByTestId("post-menu")).not.toBeInTheDocument();
  });
});
