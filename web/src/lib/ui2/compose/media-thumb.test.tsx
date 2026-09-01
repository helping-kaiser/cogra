import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MediaThumb } from "./media-thumb";
import { CENTERED, type Crop } from "../media/crop";

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

  it("says only that it is uploading when no fraction has been measured", () => {
    // The upload model reports a state, not a percentage — so the ring turns
    // rather than claiming a number nobody counted.
    render(<MediaThumb src="blob:one" progress="indeterminate" testId="thumb" />);
    expect(screen.getByLabelText("Uploading")).toBeInTheDocument();
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

  // jakob, round 6: the previews after the crop step "should display the
  // cropped version so that people dont think it has reset".
  describe("the framing the author chose", () => {
    const BAND: Crop = {
      x: 0,
      y: 0,
      zoom: 1,
      area: { x: 0, y: 100, width: 800, height: 500 },
      areaPercent: { x: 0, y: 10, width: 100, height: 50 },
    };

    it("draws the framed section rather than the middle of the source", () => {
      render(<MediaThumb src="blob:one" crop={BAND} testId="thumb" />);
      const image = screen.getByTestId("thumb-image");
      expect(image).toHaveAttribute("data-framed", "true");
      // Sized past the 48px tile and slid up, which is the band and not the
      // picture's own centre.
      expect(image.style.position).toBe("absolute");
      expect(Number(image.style.height.replace("px", ""))).toBeCloseTo(96, 3);
      expect(Number(image.style.top.replace("px", ""))).toBeCloseTo(-9.6, 3);
      expect(image.className).not.toContain("object-cover");
    });

    it("cover-fits the whole picture where there is no framing to show", () => {
      // A comment's pictures are never cropped, and a pick nobody has framed
      // yet has nothing measured — both keep the tile they always had.
      const { rerender } = render(<MediaThumb src="blob:one" testId="thumb" />);
      expect(screen.getByTestId("thumb-image")).not.toHaveAttribute("data-framed");
      expect(screen.getByTestId("thumb-image").className).toContain("object-cover");

      rerender(<MediaThumb src="blob:one" crop={CENTERED} testId="thumb" />);
      expect(screen.getByTestId("thumb-image")).not.toHaveAttribute("data-framed");
    });

    it("frames to the tile it was actually given, not to a 48px assumption", () => {
      // The Show all sheet draws 56px rows; a framing computed for 48 would
      // sit off-centre in them.
      render(<MediaThumb src="blob:one" crop={BAND} size={56} testId="thumb" />);
      const image = screen.getByTestId("thumb-image");
      expect(Number(image.style.height.replace("px", ""))).toBeCloseTo(112, 3);
    });
  });
});
