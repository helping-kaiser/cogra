import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ALT_TEXT_MAX_CHARS } from "../media/caps";
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

  // The server refuses past this length, so the sheet says so where the words
  // are written rather than letting the seal carry the news.
  it("stays quiet at the cap the write side allows", () => {
    open({ value: "x".repeat(ALT_TEXT_MAX_CHARS) });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when the description is past that cap", () => {
    open({ value: "x".repeat(ALT_TEXT_MAX_CHARS + 1) });
    expect(screen.getByRole("alert")).toHaveTextContent(/too long/i);
  });

  // CW-15 (2026-09-08 UI audit): the board never drew a running count, so
  // the sheet stays quiet about it regardless of what a caller passes.
  it("never shows a running count — the board draws no such line", () => {
    open({ position: { index: 1, total: 3 } });
    expect(screen.queryByText(/Picture \d+ of \d+/)).toBeNull();
  });

  // CW-15: the reason sits directly under the title on both shapes, not as
  // an extended trailing line near the field.
  it("carries the reason under the title, not as an extended trailing line", () => {
    open();
    expect(
      screen.getByText("Read aloud to people who can't see it."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/shown if the picture can't load/),
    ).toBeNull();
  });

  // CW-16 (2026-09-08 UI audit): the sheet's other shape, for a clip.
  it("becomes the video shape when asked", () => {
    open({ video: true });
    expect(screen.getByTestId("describe-sheet")).toHaveAttribute(
      "aria-label",
      "Describe the video",
    );
    expect(screen.getByText("What's in the video")).toBeInTheDocument();
    expect(screen.getByTestId("describe-sheet-play-disc")).toBeInTheDocument();
  });

  it("wears no play disc, and asks about the picture, off the picture shape", () => {
    open();
    expect(screen.getByText("What's in the picture")).toBeInTheDocument();
    expect(screen.queryByTestId("describe-sheet-play-disc")).toBeNull();
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
