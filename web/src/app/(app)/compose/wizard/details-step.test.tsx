import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DetailsStep } from "./details-step";
import type { PickedAsset } from "@/lib/compose/wizard";

const VIDEO_ASSET: PickedAsset = {
  id: "v0",
  file: new Blob(["v"], { type: "video/mp4" }),
  crop: { x: 0, y: 0, zoom: 1, area: null, areaPercent: null },
  altText: "",
  upload: { kind: "done", mediaId: "m0" },
  kind: "video",
};

function renderStep(overrides: Partial<Parameters<typeof DetailsStep>[0]> = {}) {
  const props = {
    mode: "words" as const,
    assets: [],
    previews: {},
    clipFace: null,
    coverPreview: null,
    durationMs: 0,
    onCover: vi.fn(),
    title: "",
    description: "",
    tags: [],
    references: [],
    tagErrors: {},
    referenceErrors: {},
    onTitle: vi.fn(),
    onDescription: vi.fn(),
    onTags: vi.fn(),
    onReferences: vi.fn(),
    onManage: vi.fn(),
    onDescribe: vi.fn(),
    onRetry: vi.fn(),
    onRemove: vi.fn(),
    onNext: vi.fn(),
    blocked: false,
    ...overrides,
  };
  render(<DetailsStep {...props} />);
  return props;
}

describe("DetailsStep", () => {
  // Title's cap is 100, floor-driven: the window is max(20, round(100/10)) — the
  // floor of 20, not the tenth of 10 (design/readme.md's caps-affordance round).
  it("says nothing until the title is within its floor-driven window", () => {
    renderStep({ title: "a".repeat(79) }); // remaining 21 — outside the window of 20
    expect(screen.queryByText(/left$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/over$/)).not.toBeInTheDocument();
  });

  it("shows the count at the exact boundary of the title's window", () => {
    renderStep({ title: "a".repeat(80) }); // remaining 20 — exactly the floor
    expect(screen.getByText("20 left")).toBeInTheDocument();
  });

  it("flips the title's count to over past its cap, and still lets the reader type", () => {
    const onTitle = vi.fn();
    renderStep({ title: "a".repeat(105), onTitle });
    expect(screen.getByText("5 over")).toBeInTheDocument();
    // De-truncation: the field carries no native maxLength to make this state
    // unreachable, and typing further is still reported to the caller.
    const input = screen.getByTestId("wizard-title") as HTMLInputElement;
    expect(input.value).toHaveLength(105);
    expect(input).not.toHaveAttribute("maxLength");
  });

  // Description's cap is 500, tenth-driven: the window is max(20, round(500/10)) = 50.
  it("shows the count at the exact boundary of the description's tenth-driven window", () => {
    renderStep({ description: "a".repeat(450) }); // remaining 50 — exactly the tenth
    expect(screen.getByText("50 left")).toBeInTheDocument();
  });

  it("says nothing one scalar value short of the description's window", () => {
    renderStep({ description: "a".repeat(449) }); // remaining 51 — outside the window
    expect(screen.queryByText(/left$/)).not.toBeInTheDocument();
  });

  it("flips the description's count to over past 500 and reaches the drawn refusal", () => {
    // The board's own fixture: 507 of 500 reads "7 over"
    // (design/designs/canonical/screens/ComposeDetailsCaps.jsx:14-19).
    renderStep({ description: "a".repeat(507) });
    expect(screen.getByText("7 over")).toBeInTheDocument();
    expect(
      screen.getByText("Too long — at most 500 characters."),
    ).toBeInTheDocument();
  });

  // ComposeDetailsCaps.jsx:21-24 — Next goes inert while a field is over.
  it("disables Next while a field is over its cap, per the drawn board", () => {
    renderStep({ description: "a".repeat(507), blocked: true });
    expect(screen.getByTestId("wizard-next")).toBeDisabled();
  });

  it("leaves Next enabled while nothing is over its cap", () => {
    renderStep({ title: "Salt maps", description: "Three weekends of rubbings.", blocked: false });
    expect(screen.getByTestId("wizard-next")).not.toBeDisabled();
  });

  // The Cover field (`ComposeDetailsVideo.jsx:19-21`, design/readme.md §13
  // "The cover's tile"; jakob's ruling mirrored from PR #813): the door is
  // the field's only state now. Once a face is chosen it rides the clip's
  // own tile above as its inset corner mark instead of a second field —
  // ONE TILE, NEVER TWO.
  describe("the Cover field", () => {
    it("shows the door when the clip has no chosen cover", () => {
      const onCover = vi.fn();
      renderStep({ mode: "media", assets: [VIDEO_ASSET], coverPreview: null, onCover });

      screen.getByTestId("wizard-cover-door").click();
      expect(onCover).toHaveBeenCalledTimes(1);
    });

    it("draws no Cover section at all once a face is chosen", () => {
      renderStep({
        mode: "media",
        assets: [VIDEO_ASSET],
        coverPreview: "blob:cover-face",
      });

      expect(screen.queryByTestId("wizard-cover-door")).not.toBeInTheDocument();
      // The old two-state face row is gone entirely — the cover rides the
      // tile's own inset mark instead (asserted in "the video body strip"
      // below), never a second field under it.
      expect(screen.queryByText("Cover")).not.toBeInTheDocument();
    });

    it("carries no Cover section for a non-video body", () => {
      renderStep({ mode: "words" });
      expect(screen.queryByTestId("wizard-cover-door")).not.toBeInTheDocument();
    });
  });

  // ONE TILE, NEVER TWO (jakob's ruling mirrored from Android PR #813;
  // `ComposeDetailsVideo.jsx:15-34`, `ComposePickVideoCover.jsx:12-19`,
  // design/readme.md §13 "The cover's tile"). NO MANAGER ON THE VIDEO PATH
  // (`ComposeDetailsVideo.jsx:22-32`): the tile's only affordances are its
  // own × and the Describe entry below it.
  describe("the video body strip", () => {
    it("rides the chosen cover on the clip's own tile, as one tile", () => {
      renderStep({
        mode: "media",
        assets: [VIDEO_ASSET],
        clipFace: "blob:clip-face",
        coverPreview: "blob:cover-face",
      });

      // One tile: exactly one thumbnail image for the video's row.
      expect(screen.getAllByTestId(/wizard-picked-row-thumb-\d+-image/)).toHaveLength(1);
      expect(screen.getByTestId("wizard-picked-row-thumb-0-cover-mark")).toBeInTheDocument();
    });

    it("uses the clip's first frame as the tile's face, never the chosen cover", () => {
      renderStep({
        mode: "media",
        assets: [VIDEO_ASSET],
        clipFace: "blob:clip-face",
        coverPreview: "blob:cover-face",
      });

      const tileImage = screen.getByTestId("wizard-picked-row-thumb-0-image");
      expect(tileImage).toHaveAttribute("src", "blob:clip-face");
    });

    it("draws no cover mark while no face is chosen", () => {
      renderStep({
        mode: "media",
        assets: [VIDEO_ASSET],
        clipFace: "blob:clip-face",
        coverPreview: null,
      });

      expect(screen.queryByTestId("wizard-picked-row-thumb-0-cover-mark")).not.toBeInTheDocument();
    });

    it("opens no manager on the video tile — the row is not a button", () => {
      const onManage = vi.fn();
      renderStep({ mode: "media", assets: [VIDEO_ASSET], onManage });

      const row = screen.getByTestId("wizard-picked-row");
      expect(row.tagName).not.toBe("BUTTON");
      row.click();
      expect(onManage).not.toHaveBeenCalled();
    });

    it("gives the video tile its own × instead of a manager", () => {
      const onRemove = vi.fn();
      renderStep({ mode: "media", assets: [VIDEO_ASSET], onRemove });

      screen.getByLabelText("Remove this video").click();
      expect(onRemove).toHaveBeenCalledWith(VIDEO_ASSET.id);
    });
  });
});
