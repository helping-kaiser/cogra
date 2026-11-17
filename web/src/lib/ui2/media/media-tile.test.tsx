import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { declared } from "@/test/css";
import { MediaTile } from "./media-tile";
import { PORTRAIT_CAP } from "./aspect";

// next/image renders a real <img>; the alt and the reserved box are what this
// component owes, and both are observable in the DOM.

describe("MediaTile", () => {
  it("reserves its space before anything loads, full-width and uncapped", () => {
    render(<MediaTile src="/media/abc" sourceRatio={16 / 9} testId="tile" />);
    const tile = screen.getByTestId("tile");
    expect(tile.style.aspectRatio).toBe(declared("aspect-ratio", `${16 / 9} / 1`));
    // The default frame's ratio is already clamped by `tileRatio`, so nothing
    // it reserves needs a second, viewport-tied height cap on top of it.
    expect(tile.style.maxHeight).toBe("");
    expect(tile.style.maxWidth).toBe("");
  });

  // F3-3. A default frame's ratio comes from `tileRatio`, clamped at 4:5 — so
  // a source shape taller than the cap (a real stored clip states 237:425)
  // reserves exactly 4:5, full column width, and the media centre-crops into
  // it. No pixel-based height cap competes with that ratio here: stacking one
  // on top is what previously reshaped a 4:5 frame into a near-square box on
  // a short viewport, and narrowed a plain square frame for no reason on
  // every viewport.
  describe("the portrait clamp", () => {
    it("reserves exactly 4:5 for a shape stated well past the clamp", () => {
      render(<MediaTile src="/media/tall" sourceRatio={237 / 425} testId="tile" />);
      const tile = screen.getByTestId("tile");
      expect(tile.style.aspectRatio).toBe(`${PORTRAIT_CAP} / 1`);
      // Full-width: no cap narrows it, and nothing centres a tile that already
      // fills its column.
      expect(tile.style.maxWidth).toBe("");
      expect(tile.style.marginInline).toBe("");
    });

    it("clamps a clip's frame the same way — the rule is not pictures-only", () => {
      render(
        <MediaTile src="/media/clip" mimeType="video/mp4" sourceRatio={9 / 16} testId="clip" />,
      );
      const frame = screen.getByTestId("clip-frame");
      // A clip taller than the cap centre-crops TO 4:5, so 4:5 is the shape the
      // frame has to actually be — cropping against a square is the bug.
      expect(frame.style.aspectRatio).toBe(`${PORTRAIT_CAP} / 1`);
      expect(frame.style.maxWidth).toBe("");
    });

    it("leaves a wide tile alone, which is why it never looked wrong", () => {
      render(<MediaTile src="/media/wide" sourceRatio={1.91} testId="tile" />);
      expect(screen.getByTestId("tile").style.aspectRatio).toBe(`${1.91} / 1`);
      expect(screen.getByTestId("tile").style.maxWidth).toBe("");
    });

    it("reserves a plain square full-width when the shape is unprobed", () => {
      render(<MediaTile src="/media/sq" testId="tile" />);
      const tile = screen.getByTestId("tile");
      expect(tile.style.aspectRatio).toBe("1 / 1");
      // This is the case that used to render ~14px narrower than the card: a
      // square wants a taller box than the height cap allowed, so bounding the
      // width to match narrowed it for no reason the ratio itself demanded.
      expect(tile.style.maxWidth).toBe("");
    });
  });

  // W-THREAD-MEDIA-SIZE. The comment scale is drawn as the master's frame
  // (`MediaAttachment.jsx`: `aspectRatio`, `width: 100%`, `maxHeight`) and the
  // built boards carry exactly that (`FeedCommentShapes.dc.html`:
  // `aspect-ratio:1 / 1;width:100%;max-height:220px`): the cap takes its bite
  // out of the HEIGHT alone, and the frame keeps the column's width. A width
  // bound derived from the cap shrank every comment picture to a 220px box
  // centred in the column — much smaller than the board and android.
  describe("an explicit ratio (the comment scale)", () => {
    it("caps the height alone and keeps the column's width, as the board draws it", () => {
      render(<MediaTile src="/media/sq" ratio={1} maxHeight="220px" testId="tile" />);
      const tile = screen.getByTestId("tile");
      expect(tile.style.aspectRatio).toBe("1 / 1");
      expect(tile.style.maxHeight).toBe("220px");
      expect(tile.style.maxWidth).toBe("");
      expect(tile.style.marginInline).toBe("");
      expect(tile.className).toContain("w-full");
    });

    it("draws a comment clip's frame the same way", () => {
      render(
        <MediaTile src="/media/clip" mimeType="video/mp4" ratio={1} maxHeight="220px" testId="clip" />,
      );
      const frame = screen.getByTestId("clip-frame");
      expect(frame.style.maxHeight).toBe("220px");
      expect(frame.style.maxWidth).toBe("");
      expect(frame.className).toContain("w-full");
    });
  });

  it("caps a portrait frame at 4:5 and centre-crops into it — nothing is letterboxed", () => {
    render(<MediaTile src="/media/tall" sourceRatio={9 / 16} testId="tile" />);
    expect(screen.getByTestId("tile").style.aspectRatio).toBe(`${PORTRAIT_CAP} / 1`);
    const img = document.querySelector("img");
    expect(img?.style.objectFit).toBe("cover");
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
