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
    expect(screen.getByText("A picture")).toBeInTheDocument();
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
});
