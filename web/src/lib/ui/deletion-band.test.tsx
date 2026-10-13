import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeletionBand } from "./deletion-band";

describe("DeletionBand", () => {
  it("says_when_and_carries_cancel", () => {
    const onCancel = vi.fn();
    render(<DeletionBand line="Your account is deleted in 6 days." onCancel={onCancel} node={{ path: "feed.deletionBand" }} />);
    expect(screen.getByTestId("feed.deletionBand.line")).toHaveTextContent("Your account is deleted in 6 days.");
    fireEvent.click(screen.getByTestId("feed.deletionBand.cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("wears_the_bar_fill_and_never_the_error_colour", () => {
    render(<DeletionBand line="x" onCancel={() => {}} />);
    const band = screen.getByTestId("deletion-band");
    // `surface-bar` is `surface-container` (tokens-2.css); the prompt forbids `--error`.
    expect(band.className).toContain("bg-surface-container");
    expect(band.className).not.toMatch(/error/);
    expect(screen.getByTestId("deletion-band-line").className).toContain("text-on-surface");
  });
});
