import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MediaThumb } from "./media-thumb";

describe("MediaThumb", () => {
  it("leaves an undescribed picture out of the screen reader's way", () => {
    render(<MediaThumb src="blob:one" testId="thumb" />);
    const image = screen.getByTestId("thumb").querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("aria-hidden", "true");
  });

  it("reads out a description the author wrote", () => {
    render(<MediaThumb src="blob:one" altText="A jar of honey" testId="thumb" />);
    expect(screen.getByAltText("A jar of honey")).not.toHaveAttribute("aria-hidden");
  });

  it("badges the cover, and only the cover", () => {
    const { rerender } = render(<MediaThumb src="blob:one" cover testId="thumb" />);
    expect(screen.getByText("Cover")).toBeInTheDocument();
    rerender(<MediaThumb src="blob:one" testId="thumb" />);
    expect(screen.queryByText("Cover")).toBeNull();
  });

  it("says how far an upload has got, in words as well as the ring", () => {
    render(<MediaThumb src="blob:one" progress={0.42} testId="thumb" />);
    expect(screen.getByLabelText("Uploading, 42%")).toBeInTheDocument();
  });

  it("trades the remove X for the badge when the upload failed", () => {
    // The ways out of a failure are words beside the row, not a second meaning
    // for the same corner.
    render(<MediaThumb src="blob:one" failed onRemove={vi.fn()} testId="thumb" />);
    expect(screen.getByLabelText("Didn't upload")).toBeInTheDocument();
    expect(screen.queryByTestId("thumb-remove")).toBeNull();
  });

  it("shows no ring once the picture has failed", () => {
    render(<MediaThumb src="blob:one" progress={0.5} failed testId="thumb" />);
    expect(screen.queryByTestId("thumb-progress")).toBeNull();
  });
});
