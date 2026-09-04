import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MediaGallery, type GalleryItem } from "./media-gallery";

const items = (count: number, sourceRatio: number | null = 1): GalleryItem[] =>
  Array.from({ length: count }, (_, index) => ({
    src: `/media/${index}`,
    altText: `Picture ${index + 1}`,
    sourceRatio,
    mimeType: "image/webp",
  }));

describe("MediaGallery", () => {
  it("renders nothing for an empty set", () => {
    const { container } = render(<MediaGallery items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a lone attachment as one tile, with no pager and no dots", () => {
    render(<MediaGallery items={items(1)} />);
    expect(screen.getByTestId("media-gallery-lead")).toBeInTheDocument();
    expect(screen.queryByTestId("media-gallery-strip")).toBeNull();
    expect(screen.queryByTestId("media-gallery-dots")).toBeNull();
  });

  it("pages every picture rather than leading with one and cropping the rest", () => {
    render(<MediaGallery items={items(4)} />);
    // Four pictures, four pages — no lead-plus-strip, no remainder badge.
    for (let index = 0; index < 4; index += 1) {
      expect(screen.getByTestId(`media-gallery-page-${index}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId("media-gallery-remainder")).toBeNull();
    expect(screen.queryByTestId("media-gallery-lead")).toBeNull();
  });

  it("renders every frame at the one shape, so the card never changes height per swipe", () => {
    // A mixed set on an explicit square frame — the comment case.
    const mixed: GalleryItem[] = [
      { src: "/media/a", altText: "A", sourceRatio: 4 / 3, mimeType: "image/webp" },
      { src: "/media/b", altText: "B", sourceRatio: 1, mimeType: "image/webp" },
    ];
    render(<MediaGallery items={mixed} ratio={1} />);
    expect(screen.getByTestId("media-gallery-page-0").style.aspectRatio).toBe("1 / 1");
    expect(screen.getByTestId("media-gallery-page-1").style.aspectRatio).toBe("1 / 1");
  });

  it("takes the frame from the first picture when none is stated", () => {
    render(<MediaGallery items={items(2, 1.91)} />);
    expect(screen.getByTestId("media-gallery-page-0").style.aspectRatio).toBe("1.91 / 1");
  });

  it("fits a picture whole when its shape is not the frame's, and fills when it is", () => {
    const mixed: GalleryItem[] = [
      { src: "/media/a", altText: "A", sourceRatio: 4 / 3, mimeType: "image/webp" },
      { src: "/media/b", altText: "B", sourceRatio: 1, mimeType: "image/webp" },
    ];
    render(<MediaGallery items={mixed} ratio={1} />);
    // The 4:3 frame is letterboxed inside the square; the square one fills it.
    const first = screen.getByTestId("media-gallery-page-0").querySelector("img");
    const second = screen.getByTestId("media-gallery-page-1").querySelector("img");
    expect(first).toHaveStyle({ objectFit: "contain" });
    expect(second).toHaveStyle({ objectFit: "cover" });
  });

  it("carries the position as dots, never as a count pill", () => {
    render(<MediaGallery items={items(3)} />);
    const dots = screen.getByTestId("media-gallery-dots");
    expect(dots).toHaveAttribute("aria-label", "Picture 1 of 3");
    expect(dots.textContent).toBe("");
  });

  it("moves through the set with the arrow keys, so the swipe is not the only route", () => {
    render(<MediaGallery items={items(3)} />);
    const strip = screen.getByTestId("media-gallery-strip");
    const dots = () => screen.getByTestId("media-gallery-dots");

    fireEvent.keyDown(strip, { key: "ArrowRight" });
    expect(dots()).toHaveAttribute("aria-label", "Picture 2 of 3");

    fireEvent.keyDown(strip, { key: "End" });
    expect(dots()).toHaveAttribute("aria-label", "Picture 3 of 3");

    // Already at the end — it stays rather than wrapping.
    fireEvent.keyDown(strip, { key: "ArrowRight" });
    expect(dots()).toHaveAttribute("aria-label", "Picture 3 of 3");

    fireEvent.keyDown(strip, { key: "Home" });
    expect(dots()).toHaveAttribute("aria-label", "Picture 1 of 3");

    fireEvent.keyDown(strip, { key: "ArrowLeft" });
    expect(dots()).toHaveAttribute("aria-label", "Picture 1 of 3");
  });

  it("names the strip so a keyboard reader knows what they entered", () => {
    render(<MediaGallery items={items(4)} />);
    expect(screen.getByRole("group", { name: "4 pictures" })).toBeInTheDocument();
  });

  it("reports which picture was opened", () => {
    const onOpen = vi.fn();
    render(<MediaGallery items={items(3)} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Open the picture: Picture 3" }));
    expect(onOpen).toHaveBeenCalledWith(2);
  });
});
