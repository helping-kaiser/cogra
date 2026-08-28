import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MediaGallery, type GalleryItem } from "./media-gallery";

const items = (count: number): GalleryItem[] =>
  Array.from({ length: count }, (_, index) => ({
    src: `/media/${index}`,
    altText: `Picture ${index + 1}`,
    sourceRatio: 1,
  }));

describe("MediaGallery", () => {
  it("renders nothing for an empty set", () => {
    const { container } = render(<MediaGallery items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a single attachment as one tile, with no strip", () => {
    render(<MediaGallery items={items(1)} />);
    expect(screen.getByTestId("media-gallery-lead")).toBeInTheDocument();
    expect(screen.queryByTestId("media-gallery-tile-1")).toBeNull();
  });

  it("leads with the first and puts the rest in the strip", () => {
    render(<MediaGallery items={items(3)} />);
    expect(screen.getByTestId("media-gallery-lead")).toBeInTheDocument();
    expect(screen.getByTestId("media-gallery-tile-1")).toBeInTheDocument();
    expect(screen.getByTestId("media-gallery-tile-2")).toBeInTheDocument();
    expect(screen.queryByTestId("media-gallery-remainder")).toBeNull();
  });

  it("shows three and a remainder rather than growing a row per picture", () => {
    render(<MediaGallery items={items(7)} />);
    expect(screen.getByTestId("media-gallery-tile-2")).toBeInTheDocument();
    expect(screen.queryByTestId("media-gallery-tile-3")).toBeNull();
    // 7 total, 3 shown, 4 left.
    expect(screen.getByTestId("media-gallery-remainder")).toHaveTextContent("+4");
  });

  it("crops the secondary squares, because they index the set rather than being it", () => {
    render(<MediaGallery items={items(3)} />);
    const strip = screen.getByTestId("media-gallery-tile-1");
    expect(strip.style.aspectRatio).toBe("1 / 1");
  });

  it("splits the height cap between the lead and the strip", () => {
    render(<MediaGallery items={items(3)} />);
    expect(screen.getByTestId("media-gallery-lead").style.maxHeight).toBe(
      "calc(var(--media-max-height) * 0.6)",
    );
    expect(screen.getByTestId("media-gallery-tile-1").style.maxHeight).toBe(
      "calc(var(--media-max-height) * 0.4)",
    );
  });

  it("reports which tile was opened", () => {
    const onOpen = vi.fn();
    render(<MediaGallery items={items(3)} onOpen={onOpen} />);
    screen.getByRole("button", { name: "Open the picture: Picture 3" }).click();
    expect(onOpen).toHaveBeenCalledWith(2);
  });
});
