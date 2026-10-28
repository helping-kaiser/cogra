import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DetailsStep } from "./details-step";
import type { PickedAsset } from "@/lib/compose/wizard";
import { byNode } from "@/test/data-node";
import { newReferenceDraft } from "@/lib/references/draft";
import type { TagDraft } from "@/lib/topics/draft";

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
    coverDoor: false,
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
    onOpenTagPicker: vi.fn(),
    onOpenReferencePicker: vi.fn(),
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
    const input = screen.getByTestId(byNode("composeDetails.title.input")) as HTMLInputElement;
    expect(input.value).toHaveLength(105);
    expect(input).not.toHaveAttribute("maxLength");
  });

  // Description's cap is 500, tenth-driven: the window is max(20, round(500/10)) = 50.
  it("shows the count at the exact boundary of the description's tenth-driven window", () => {
    renderStep({ mode: "media", description: "a".repeat(450) }); // remaining 50 — exactly the tenth
    expect(screen.getByText("50 left")).toBeInTheDocument();
  });

  it("says nothing one scalar value short of the description's window", () => {
    renderStep({ mode: "media", description: "a".repeat(449) }); // remaining 51 — outside the window
    expect(screen.queryByText(/left$/)).not.toBeInTheDocument();
  });

  it("flips the description's count to over past 500 and reaches the drawn refusal", () => {
    // The board's own fixture: 507 of 500 reads "7 over"
    // (design/designs/canonical/screens/ComposeDetailsCaps.jsx:14-19).
    renderStep({ mode: "media", description: "a".repeat(507) });
    expect(screen.getByText("7 over")).toBeInTheDocument();
    expect(
      screen.getByText("Too long — at most 500 characters."),
    ).toBeInTheDocument();
  });

  // K8.1/D4 (ComposeDetailsWords.md:3, ComposeCited.md:15): the words path
  // composes no description; the media path keeps its field.
  it("the_words_path_draws_no_description", () => {
    renderStep({ mode: "words", description: "left over" });
    expect(screen.queryByTestId(byNode("composeDetails.description.input"))).not.toBeInTheDocument();
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
  });

  it("the_media_path_keeps_its_description", () => {
    renderStep({ mode: "media", description: "Beside the pictures" });
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  // ComposeDetailsCaps.jsx:21-24 — Next goes inert while a field is over.
  it("disables Next while a field is over its cap, per the drawn board", () => {
    renderStep({ description: "a".repeat(507), blocked: true });
    expect(screen.getByTestId(byNode("composeDetails.next"))).toBeDisabled();
  });

  it("leaves Next enabled while nothing is over its cap", () => {
    renderStep({ title: "Salt maps", description: "Three weekends of rubbings.", blocked: false });
    expect(screen.getByTestId(byNode("composeDetails.next"))).not.toBeDisabled();
  });

  // The Cover field (`ComposeDetailsVideo.jsx:19-21`, design/readme.md §13
  // "The cover's tile"; jakob's ruling mirrored from PR #813): the door is
  // the field's only state now. Once a face is chosen it rides the clip's
  // own tile above as its inset corner mark instead of a second field —
  // ONE TILE, NEVER TWO.
  describe("the Cover field", () => {
    it("shows the door when the clip skipped the cover step and has no face", () => {
      const onCover = vi.fn();
      renderStep({ mode: "media", assets: [VIDEO_ASSET], coverPreview: null, coverDoor: true, onCover });

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

    // ComposeDetailsVideo.md: "ALWAYS the stage carries no cover section
    // GIVEN the clip came through the cover step" — a face declined there is
    // one Back away, never a second door.
    it("draws no door for a clip that came through the cover step without a face", () => {
      renderStep({ mode: "media", assets: [VIDEO_ASSET], coverPreview: null, coverDoor: false });
      expect(screen.queryByTestId("wizard-cover-door")).not.toBeInTheDocument();
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

      const row = screen.getByTestId(byNode("composeDetails.mediaRow"));
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

// THE STAGED PAIRS (ComposeDetails.md, TagPadCompose.md, RefPair.md). The
// wizard's reducer holds the staged tags and citations; a pair sheet holds its
// own copy until Done, so the stage hears exactly one change per Done and none
// from any other way out.
describe("DetailsStep — the staged pairs", () => {
  const rust: TagDraft = { name: "rust", relevance: 0.1, confidence: 1 };
  const ada = newReferenceDraft("u-ada", { kind: "User", label: "@ada", href: "/u/ada" });

  // ComposeDetails board: the tags section is its label, its chips and the
  // quiet `+ Add a tag` — no inline name field, no Add pill, no loose pair.
  it("adds a tag through the tag picker, never an inline field", () => {
    const { onOpenTagPicker, onTags } = renderStep({ tags: [rust] });
    expect(screen.queryByTestId("wizard-tag-input")).not.toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    const add = screen.getByTestId(byNode("composeDetails.tags.add"));
    expect(add).toHaveTextContent("+ Add a tag");
    fireEvent.click(add);
    expect(onOpenTagPicker).toHaveBeenCalledTimes(1);
    expect(onTags).not.toHaveBeenCalled();
    expect(screen.getByTestId(byNode("composeDetails.tags.label")).tagName).toBe("SPAN");
  });

  // ComposeDetails.md: tap composeDetails.references.add GIVEN a citation is
  // staged -> the citation picker opens AND the staged citation stays.
  it("opens the citation picker from + Cite something, and the staged citation stays", () => {
    const { onOpenReferencePicker, onReferences } = renderStep({ references: [ada] });
    fireEvent.click(screen.getByTestId(byNode("composeDetails.references.add")));
    expect(onOpenReferencePicker).toHaveBeenCalledTimes(1);
    expect(onReferences).not.toHaveBeenCalled();
    expect(screen.getByTestId(byNode("composeDetails.references.stagedReference", "1"))).toBeInTheDocument();
    // No finder dialog of its own any more: the picker is the way in.
    expect(screen.queryByTestId("wizard-finder")).not.toBeInTheDocument();
  });

  it("opens a tag chip's pair in a sheet over the stage, and dispatches only on Done", () => {
    const { onTags } = renderStep({ tags: [rust] });
    const chip = screen.getByTestId(byNode("composeDetails.tags.tag", "rust"));
    fireEvent.click(within(chip).getByTestId("wizard-tag-0-select"));
    const sheet = screen.getByTestId("wizard-tag-pair") as HTMLDialogElement;
    expect(sheet.open).toBe(true);
    expect(sheet).toHaveAttribute("aria-label", "#rust");

    fireEvent.click(screen.getByTestId("wizard-tag-pair-exact-route"));
    fireEvent.change(screen.getByTestId("wizard-tag-pair-tracks-interest"), {
      target: { value: "0.3" },
    });
    expect(onTags).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("wizard-tag-pair-done"));
    expect(onTags).toHaveBeenCalledTimes(1);
    expect(onTags).toHaveBeenCalledWith([{ name: "rust", relevance: 0.1, confidence: 0.3 }]);
  });

  it("dispatches nothing when the tag's sheet is dropped", () => {
    const { onTags } = renderStep({ tags: [rust] });
    fireEvent.click(screen.getByTestId("wizard-tag-0-select"));
    fireEvent.click(screen.getByTestId("wizard-tag-pair-exact-route"));
    fireEvent.change(screen.getByTestId("wizard-tag-pair-tracks-directed"), {
      target: { value: "0.8" },
    });
    fireEvent.click(screen.getByTestId("wizard-tag-pair"));
    expect(onTags).not.toHaveBeenCalled();
  });

  it("removes a tag on the spot, with no dialog", () => {
    const { onTags } = renderStep({ tags: [rust] });
    fireEvent.click(screen.getByTestId(byNode("composeDetails.tags.tag.remove", "rust")));
    expect(onTags).toHaveBeenCalledWith([]);
    expect((screen.getByTestId("wizard-tag-pair") as HTMLDialogElement).open).toBe(false);
  });

  it("opens a staged citation's pair in a sheet over the stage, and dispatches only on Done", () => {
    const { onReferences } = renderStep({ references: [ada] });
    fireEvent.click(screen.getByTestId(byNode("composeDetails.references.stagedReference.name", "1")));
    const sheet = screen.getByTestId("wizard-reference-pair") as HTMLDialogElement;
    expect(sheet.open).toBe(true);
    expect(sheet).toHaveAttribute("aria-label", "@ada");
    expect(screen.getByTestId("wizard-reference-pair-exact")).toHaveTextContent("+0.10 / +0.10");

    fireEvent.click(screen.getByTestId("wizard-reference-pair-exact-route"));
    fireEvent.change(screen.getByTestId("wizard-reference-pair-tracks-directed"), {
      target: { value: "-0.4" },
    });
    fireEvent.click(sheet);
    expect(onReferences).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId(byNode("composeDetails.references.stagedReference.name", "1")));
    fireEvent.click(screen.getByTestId("wizard-reference-pair-exact-route"));
    fireEvent.change(screen.getByTestId("wizard-reference-pair-tracks-directed"), {
      target: { value: "-0.4" },
    });
    fireEvent.click(screen.getByTestId("wizard-reference-pair-done"));
    expect(onReferences).toHaveBeenCalledTimes(1);
    expect(onReferences).toHaveBeenCalledWith([{ ...ada, relevance: -0.4 }]);
  });

  it("removes a staged citation on the spot, with no dialog", () => {
    const { onReferences } = renderStep({ references: [ada] });
    fireEvent.click(
      screen.getByTestId(byNode("composeDetails.references.stagedReference.remove", "1")),
    );
    expect(onReferences).toHaveBeenCalledWith([]);
    expect((screen.getByTestId("wizard-reference-pair") as HTMLDialogElement).open).toBe(false);
  });

  // `ComposeUploading` draws the aside while something is still going up; the
  // stage at rest (`ComposeDetails`) draws none.
  it("says pictures upload while you write only while one is still going up", () => {
    const picture = (upload: PickedAsset["upload"]): PickedAsset => ({ ...VIDEO_ASSET, id: "p0", kind: "picture", upload });
    renderStep({ mode: "media", assets: [picture({ kind: "uploading" })] });
    expect(screen.getByTestId("wizard-upload-aside")).toHaveTextContent(
      "Pictures upload while you write — signing waits for them.",
    );
  });

  it("draws no upload aside once every picture has landed", () => {
    renderStep({ mode: "media", assets: [{ ...VIDEO_ASSET, id: "p0", kind: "picture" }] });
    expect(screen.queryByTestId("wizard-upload-aside")).toBeNull();
  });
});
