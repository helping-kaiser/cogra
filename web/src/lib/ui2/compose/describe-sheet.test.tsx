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

  // A DESCRIPTION IS OF WHAT WILL BE SEEN, so the sheet shows the framing the
  // author chose rather than the source it was cut from (jakob, round 6).
  it("previews the framing, at the framing's own shape", () => {
    open({
      crop: {
        x: 0,
        y: 0,
        zoom: 1,
        area: { x: 0, y: 100, width: 800, height: 500 },
        areaPercent: { x: 0, y: 10, width: 100, height: 50 },
      },
    });

    // 180 tall at the framing's 1.6, so nothing is cropped a second time and
    // nothing is squashed.
    const framed = screen.getByTestId("describe-sheet-framed");
    expect(framed.style.width).toBe("288px");
    expect(framed.style.height).toBe("180px");
    const preview = framed.querySelector("img")!;
    expect(preview.style.position).toBe("absolute");
    expect(Number(preview.style.top.replace("px", ""))).toBeCloseTo(-36, 3);
  });

  it("falls back to the whole picture where nothing has been framed", () => {
    // A comment's picture, or a pick nobody framed — the sheet keeps the
    // contain-fitted preview it always had.
    open();
    expect(screen.queryByTestId("describe-sheet-framed")).toBeNull();
    expect(screen.getByTestId("describe-sheet").querySelector("img")!.className).toContain(
      "max-h-full",
    );
  });
});
