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
