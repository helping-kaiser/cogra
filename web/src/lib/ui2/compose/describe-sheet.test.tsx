import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DescribeSheet } from "./describe-sheet";

function open(overrides: Partial<Parameters<typeof DescribeSheet>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    src: "blob:a",
    value: "",
    onChange: vi.fn(),
    ...overrides,
  };
  render(<DescribeSheet {...props} />);
  return props;
}

describe("DescribeSheet", () => {
  it("is titled by what it is for", () => {
    open();
    expect(screen.getByTestId("describe-sheet")).toHaveAttribute(
      "aria-label",
      "Describe this picture",
    );
  });

  it("says a description is optional, and what it is for", () => {
    open();
    expect(screen.getByText(/Read aloud to people who can't see it/)).toBeInTheDocument();
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("carries the words the author has written so far", () => {
    open({ value: "Crates of strawberries." });
    expect(screen.getByDisplayValue("Crates of strawberries.")).toBeInTheDocument();
  });

  it("reports what the author types", () => {
    const props = open();
    fireEvent.change(screen.getByTestId("describe-sheet-field"), {
      target: { value: "A jar of honey" },
    });
    expect(props.onChange).toHaveBeenCalledWith("A jar of honey");
  });

  it("says which picture is being described, when there is more than one", () => {
    open({ position: { index: 1, total: 3 } });
    expect(screen.getByText("Picture 2 of 3")).toBeInTheDocument();
  });

  it("stays quiet about position when there is only one picture", () => {
    open({ position: { index: 0, total: 1 } });
    expect(screen.queryByText(/Picture 1 of 1/)).toBeNull();
  });

  it("carries the ? that says nothing is described for you", () => {
    open();
    fireEvent.click(screen.getByTestId("describe-sheet-help"));
    expect(screen.getByTestId("describe-sheet-help-dialog")).toHaveAttribute(
      "aria-label",
      "Describing pictures",
    );
  });

  it("leaves the preview out of the screen reader's way — the field is the content", () => {
    open();
    const preview = screen.getByTestId("describe-sheet").querySelector("img");
    expect(preview).toHaveAttribute("aria-hidden", "true");
  });
});
