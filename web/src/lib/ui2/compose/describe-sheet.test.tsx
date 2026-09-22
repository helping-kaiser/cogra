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
  // THE DRAWN MINIMUM, AND THE GROWTH FROM IT (jakob's ruling, the
  // sheets-and-video round, 2026-09-22 — design/readme.md §13: "the
  // description sheet keeps its two-line opening"). The box opens at two
  // lines and takes another whenever the writing needs one; past the room
  // the sheet has left it scrolls inside itself, so Done stays in reach.
  it("opens at its drawn two lines and grows from there", () => {
    open();
    expect(screen.getByTestId("describe-sheet-field")).toHaveAttribute("rows", "2");
    expect(screen.getByTestId("growing-box")).toHaveAttribute("data-min-rows", "2");
  });

  it("keeps the scroll inside the box rather than under the sheet", () => {
    open({ value: "a\n".repeat(200) });
    expect(screen.getByTestId("growing-box").className).toContain("overflow-y-auto");
    expect(screen.getByTestId("describe-sheet-field").className).toContain("overflow-hidden");
    // The one thing the whole ceiling is for.
    expect(screen.getByTestId("describe-sheet-done")).toBeVisible();
  });

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

  // Visible but disabled over the cap, never hidden (the caps-affordance
  // round's ruling, PR #755's pattern) — Done stays on screen so the author
  // can trim back under the cap, rather than losing the way out.
  it("disables, rather than hides, Done past the cap", () => {
    open({ value: "x".repeat(ALT_TEXT_MAX_CHARS + 1) });
    expect(screen.getByTestId("describe-sheet-done")).toBeVisible();
    expect(screen.getByTestId("describe-sheet-done")).toBeDisabled();
  });

  it("leaves Done enabled at the cap the write side allows", () => {
    open({ value: "x".repeat(ALT_TEXT_MAX_CHARS) });
    expect(screen.getByTestId("describe-sheet-done")).toBeEnabled();
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

  // Drawn truth, pinned against the master (jakob hand-test finding,
  // 2026-09-17: the strip rendered at ~2/3 of this): contain-whole media
  // strip, 180px tall, on surface-container-high
  // (design/components/compose/DescribeSheet.jsx:61,63).
  it("draws the strip at the board's 180px height on the reserved surface", () => {
    open();
    const strip = screen.getByTestId("describe-sheet-strip");
    expect(strip).toHaveClass("h-[180px]");
    expect(strip).toHaveClass("bg-surface-container-high");
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
