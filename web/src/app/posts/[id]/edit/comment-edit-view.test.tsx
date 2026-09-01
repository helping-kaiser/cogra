import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { galleryOf } from "@/lib/compose/comment-edit";
import { CommentEditView } from "./comment-edit-view";

function draw(overrides: Partial<Parameters<typeof CommentEditView>[0]> = {}) {
  const props = {
    targetLabel: "The long way home",
    words: "The glovebox camera earns its keep.",
    gallery: galleryOf([]),
    previews: {},
    tags: [],
    references: [],
    acts: 1,
    actsOpen: false,
    busy: false,
    blocked: null,
    refusal: null,
    failed: false,
    onWords: vi.fn(),
    onPick: vi.fn(),
    onRemovePicture: vi.fn(),
    onDescribe: vi.fn(),
    onTags: vi.fn(),
    onReferences: vi.fn(),
    onActs: vi.fn(),
    onHelp: vi.fn(),
    onSign: vi.fn(),
    onLeave: vi.fn(),
    ...overrides,
  };
  render(<CommentEditView {...props} />);
  return props;
}

const ONE_PICTURE = galleryOf([
  { id: "m1", url: "https://media.test/1.webp", altText: "A film camera" },
]);

describe("CommentEdit", () => {
  it("says which comment is being edited", () => {
    draw();
    expect(screen.getByTestId("comment-edit")).toHaveTextContent(
      "Your comment on “The long way home”.",
    );
  });

  it("opens on the words the comment carries", () => {
    draw();
    expect(screen.getByTestId("comment-edit-input")).toHaveValue(
      "The glovebox camera earns its keep.",
    );
  });

  // FIDELITY, not a deviation: the CommentEdit board draws no sensitive row.
  // The author's own mark still travels on the wire, untouched.
  it("draws no sensitive row — the board has none", () => {
    draw();
    expect(screen.getByTestId("comment-edit")).not.toHaveTextContent("Sensitive");
  });

  it("states the license and locks it — an edit has nothing to change it to", () => {
    draw();
    expect(screen.getByTestId("comment-edit")).toHaveTextContent("Public domain");
    expect(screen.getByTestId("comment-edit-license-locked")).toHaveAttribute(
      "aria-label",
      "The license never changes",
    );
  });

  describe("the gallery", () => {
    it("counts what the comment carries against the cap of four", () => {
      draw({ gallery: ONE_PICTURE });
      expect(screen.getByTestId("comment-edit-add-media")).toHaveTextContent("+ Add · 1 of 4");
    });

    it("adds through the browser's own dialog — an editor has no pick stage", () => {
      const props = draw();
      const input = screen.getByTestId("comment-edit-media-input");
      const files = [new File([new Uint8Array([1]) as BlobPart], "a.jpg", { type: "image/jpeg" })];
      Object.defineProperty(input, "files", { value: files, configurable: true });
      fireEvent.change(input);
      expect(props.onPick).toHaveBeenCalledWith(files);
    });

    it("removes the picture whose × was pressed, by its media id", () => {
      const props = draw({
        gallery: ONE_PICTURE,
        previews: { m1: "https://media.test/1.webp" },
      });
      fireEvent.click(screen.getByTestId("comment-edit-media-m1-remove"));
      expect(props.onRemovePicture).toHaveBeenCalledWith("m1");
    });

    it("offers the describe counter only when there is something to describe", () => {
      draw();
      expect(screen.queryByTestId("comment-edit-describe-counter")).not.toBeInTheDocument();
      draw({ gallery: ONE_PICTURE });
      expect(screen.getByTestId("comment-edit-describe-counter")).toBeInTheDocument();
    });

    it("describes one picture at a time, named by its id", () => {
      const props = draw({ gallery: ONE_PICTURE });
      fireEvent.click(screen.getByTestId("comment-edit-describe-counter"));
      expect(props.onDescribe).toHaveBeenCalledWith("m1");
    });
  });

  describe("the acts footer", () => {
    it("names what the edit would sign", () => {
      draw({ acts: 2 });
      expect(screen.getByTestId("comment-edit-signed-actions")).toHaveTextContent(
        "This creates 2 signed actions",
      );
    });

    it("uses the product's own words for an untouched editor", () => {
      draw({ acts: 0 });
      expect(screen.getByTestId("comment-edit-signed-actions")).toHaveTextContent(
        "This creates no signed actions",
      );
    });

    it("opens the acts sheet — the footer is an affordance, not a label", () => {
      const props = draw({ acts: 2 });
      fireEvent.click(screen.getByTestId("comment-edit-signed-actions"));
      expect(props.onActs).toHaveBeenCalledWith(true);
    });

    it("carries the count in the sheet's own title", () => {
      draw({ acts: 2, actsOpen: true });
      expect(screen.getByTestId("comment-edit-acts-sheet")).toHaveAttribute(
        "aria-label",
        "2 signed actions",
      );
      expect(screen.getByTestId("comment-edit-acts-sheet")).toHaveTextContent(
        "They land together, or none does.",
      );
    });
  });

  describe("signing", () => {
    it("refuses to sign an edit that would stage nothing", () => {
      draw({ acts: 0 });
      expect(screen.getByTestId("comment-edit-save")).toBeDisabled();
    });

    it("holds the button while a picture is still on its way, and says why", () => {
      draw({ blocked: "One picture is still uploading." });
      expect(screen.getByTestId("comment-edit-save")).toBeDisabled();
      expect(screen.getByTestId("comment-edit-blocked")).toHaveTextContent(
        "One picture is still uploading.",
      );
    });

    it("signs when there is something to sign", () => {
      const props = draw({ acts: 1 });
      fireEvent.click(screen.getByTestId("comment-edit-save"));
      expect(props.onSign).toHaveBeenCalled();
    });

    it("shows a refusal where the reader is looking", () => {
      draw({ refusal: "that topic is reserved" });
      expect(screen.getByTestId("comment-edit-refused")).toHaveTextContent(
        "that topic is reserved",
      );
    });
  });

  describe("leaving", () => {
    it("says the edit is discarded rather than kept — a comment keeps no draft", () => {
      draw();
      expect(screen.getByTestId("header-leave")).toHaveAttribute(
        "aria-label",
        "Leave — this edit is discarded",
      );
    });

    it("takes both ways out back to the thread", () => {
      const props = draw();
      fireEvent.click(screen.getByTestId("header-back"));
      fireEvent.click(screen.getByTestId("header-leave"));
      expect(props.onLeave).toHaveBeenCalledTimes(2);
    });

    it("opens the Editing help from its own dot", () => {
      const props = draw();
      fireEvent.click(screen.getByTestId("header-help"));
      expect(props.onHelp).toHaveBeenCalled();
    });
  });
});
