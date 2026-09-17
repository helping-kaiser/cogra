import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { COVER_FROM_PICTURE, type CoverAsset } from "@/lib/compose/wizard";
import { CoverRow } from "./cover-row";

const FILE = new Blob([new Uint8Array([1])], { type: "image/png" });

function ownPicture(): CoverAsset {
  return { id: "cover-1", file: FILE, frame: COVER_FROM_PICTURE, upload: { kind: "waiting" } };
}

describe("CoverRow", () => {
  // W2: the tile used to draw only the dashed outline once a picture of the
  // author's own was chosen — an author could not tell WHICH picture they
  // had picked, only that something other than a frame was selected.
  it("shows the chosen picture in the own-picture tile", () => {
    render(
      <CoverRow
        framePreviews={[]}
        cover={ownPicture()}
        coverPreview="blob:own-cover"
        capturing={false}
        onPickFrame={vi.fn()}
        onPickPicture={vi.fn()}
      />,
    );
    const image = screen.getByTestId("wizard-cover-picture-image");
    expect(image).toHaveAttribute("src", "blob:own-cover");
  });

  it("draws the plain dashed tile when no picture of the author's own is chosen", () => {
    render(
      <CoverRow
        framePreviews={["blob:frame-0"]}
        cover={{ id: "cover-2", file: FILE, frame: 0, upload: { kind: "waiting" } }}
        coverPreview={null}
        capturing={false}
        onPickFrame={vi.fn()}
        onPickPicture={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("wizard-cover-picture-image")).toBeNull();
    // The glyph alone carries the tile; the name is the button's own label.
    expect(screen.getByLabelText("A picture of your own")).toBeInTheDocument();
  });

  it("still draws the plain tile if the picture is chosen but its preview hasn't minted yet", () => {
    render(
      <CoverRow
        framePreviews={[]}
        cover={ownPicture()}
        coverPreview={null}
        capturing={false}
        onPickFrame={vi.fn()}
        onPickPicture={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("wizard-cover-picture-image")).toBeNull();
  });

  // NEW-2 (ComposeCoverNoFrames.jsx:44): the terminal answer once extraction
  // is done and came back with nothing — never while `capturing` still has a
  // chance of producing an offer.
  it("names the reason once extraction is done and found no frames", () => {
    render(
      <CoverRow
        framePreviews={[]}
        cover={null}
        coverPreview={null}
        capturing={false}
        onPickFrame={vi.fn()}
        onPickPicture={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "This clip gave no frames — choose a picture of your own, or leave it without one.",
      ),
    ).toBeInTheDocument();
  });

  // Design #781: `cover === null` is the row's own rest state — no ring
  // and no dim on any frame, because choosing a cover is always a
  // willing act (CoverRow.jsx:20-24). Every unchosen frame used to carry
  // `opacity-65` unconditionally (`selected ? "" : "opacity-65"`), which
  // dimmed the whole strip before anyone had picked anything.
  it("rings and dims no frame when no cover has been picked yet", () => {
    render(
      <CoverRow
        framePreviews={["blob:frame-0", "blob:frame-1"]}
        cover={null}
        coverPreview={null}
        capturing={false}
        onPickFrame={vi.fn()}
        onPickPicture={vi.fn()}
      />,
    );
    for (const testId of ["wizard-cover-frame-0", "wizard-cover-frame-1"]) {
      const tile = screen.getByTestId(testId);
      expect(tile).toHaveAttribute("aria-pressed", "false");
      expect(tile).not.toHaveClass("opacity-65");
    }
  });

  it("keeps the default caption while capture is still running", () => {
    render(
      <CoverRow
        framePreviews={[]}
        cover={null}
        coverPreview={null}
        capturing
        onPickFrame={vi.fn()}
        onPickPicture={vi.fn()}
      />,
    );
    expect(screen.getByText("A frame, or a picture of your own.")).toBeInTheDocument();
    expect(screen.queryByText(/gave no frames/)).toBeNull();
  });
});
