import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MediaTile } from "./media-tile";
import { PORTRAIT_CAP } from "./aspect";

// next/image renders a real <img>; the alt and the reserved box are what this
// component owes, and both are observable in the DOM.

describe("MediaTile", () => {
  it("reserves its space before anything loads", () => {
    render(<MediaTile src="/media/abc" sourceRatio={16 / 9} testId="tile" />);
    const tile = screen.getByTestId("tile");
    expect(tile.style.aspectRatio).toBe(`${16 / 9} / 1`);
    // The cap is what keeps a whole post on screen.
    expect(tile.style.maxHeight).toBe("var(--media-max-height)");
  });

  // F3-3. `aspect-ratio` with `width: 100%` and a `max-height` lets the cap
  // take its bite out of the HEIGHT alone, because the width is already
  // definite — so a 4:5 tile that wanted 390x487 on the 390x844 board rendered
  // 390x376, which is 1.04:1, and a vertical picture or clip came out SQUARE.
  // Wide and square looked right only because neither is tall enough to reach
  // the cap. Bounding the width by what the cap allows AT THIS RATIO is what
  // makes the tile get narrower instead of getting reshaped.
  describe("the height cap", () => {
    it("bounds the width too, so a tall tile keeps its shape", () => {
      render(<MediaTile src="/media/tall" sourceRatio={4 / 5} testId="tile" />);
      const tile = screen.getByTestId("tile");
      expect(tile.style.aspectRatio).toBe(`${4 / 5} / 1`);
      // Whatever the cap turns out to be, the width may not exceed what that
      // height allows at this ratio — which is the same statement as "the box
      // is still 4:5 when the cap binds".
      expect(tile.style.maxWidth).toBe(`calc(var(--media-max-height) * ${4 / 5})`);
    });

    it("centres a tile the cap has narrowed", () => {
      render(<MediaTile src="/media/tall" sourceRatio={4 / 5} testId="tile" />);
      // It no longer always fills its column, so it has to say where it sits.
      expect(screen.getByTestId("tile").style.marginInline).toBe("auto");
    });

    it("bounds a clip's frame the same way — the bug was not pictures-only", () => {
      render(
        <MediaTile src="/media/clip" mimeType="video/mp4" sourceRatio={9 / 16} testId="clip" />,
      );
      const frame = screen.getByTestId("clip-frame");
      // A clip taller than the cap centre-crops TO 4:5, so 4:5 is the shape the
      // frame has to actually be — cropping against a square is the bug.
      expect(frame.style.aspectRatio).toBe(`${PORTRAIT_CAP} / 1`);
      expect(frame.style.maxWidth).toBe(`calc(var(--media-max-height) * ${PORTRAIT_CAP})`);
    });

    it("leaves a wide tile alone, which is why it never looked wrong", () => {
      render(<MediaTile src="/media/wide" sourceRatio={1.91} testId="tile" />);
      // The bound is still stated; at 1.91 it is wider than any column the app
      // has, so it simply never binds.
      expect(screen.getByTestId("tile").style.maxWidth).toBe(
        "calc(var(--media-max-height) * 1.91)",
      );
    });
  });

  it("caps a portrait frame at 4:5 and fits it whole rather than cropping it", () => {
    render(<MediaTile src="/media/tall" sourceRatio={9 / 16} testId="tile" />);
    expect(screen.getByTestId("tile").style.aspectRatio).toBe(`${PORTRAIT_CAP} / 1`);
    const img = document.querySelector("img");
    expect(img?.style.objectFit).toBe("contain");
  });

  it("fills the tile when the frame already matches the shape it was cropped to", () => {
    render(<MediaTile src="/media/sq" sourceRatio={1} testId="tile" />);
    expect(document.querySelector("img")?.style.objectFit).toBe("cover");
  });

  it("carries the authored alt text", () => {
    render(<MediaTile src="/media/abc" altText="Salt crust on the coast road" />);
    expect(screen.getByAltText("Salt crust on the coast road")).toBeInTheDocument();
  });

  it("takes an empty alt when none was authored, rather than inventing one", () => {
    render(<MediaTile src="/media/abc" testId="tile" />);
    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("alt")).toBe("");
  });

  it("says what belongs there when there is no source at all", () => {
    render(<MediaTile label="Cover" testId="tile" />);
    expect(screen.getByText("Cover")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    // The space is still reserved — that is the whole point.
    expect(screen.getByTestId("tile").style.aspectRatio).toBeTruthy();
  });

  it("is a labelled control when it opens something, and inert when it does not", async () => {
    const onOpen = vi.fn();
    const { rerender } = render(
      <MediaTile src="/media/abc" altText="A jetty at low tide" onOpen={onOpen} />,
    );
    const button = screen.getByRole("button", { name: "Open the picture: A jetty at low tide" });
    button.click();
    expect(onOpen).toHaveBeenCalledOnce();

    rerender(<MediaTile src="/media/abc" altText="A jetty at low tide" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("still names the control when the picture itself is decorative", () => {
    render(<MediaTile src="/media/abc" onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: "Open the picture" })).toBeInTheDocument();
  });
});
