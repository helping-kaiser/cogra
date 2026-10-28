import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { addTo, galleryOf, withNewCover, withUpload } from "@/lib/compose/comment-edit";
import type { ReferenceDraft } from "@/lib/references/draft";
import type { EditActRow } from "@/lib/compose/edit-batch";
import { newTagDraft } from "@/lib/topics/draft";
import { raisedLayersForTests } from "@/lib/ui2/covering-layer";
import { CommentEditView } from "./comment-edit-view";

const EDIT: EditActRow = { kind: "edit", label: "Edit", value: "The glovebox", count: 1, noun: "edit" };
const WITHDRAWN: EditActRow = {
  kind: "citationsWithdrawn",
  label: "Citations withdrawn",
  value: "Tide tables — @juno",
  count: 2,
  noun: "thing",
};

function draw(overrides: Partial<Parameters<typeof CommentEditView>[0]> = {}) {
  const props = {
    targetLabel: "The long way home",
    words: "The glovebox camera earns its keep.",
    gallery: galleryOf([]),
    previews: {},
    license: { attribution: 0, provenance: 0 },
    tags: [],
    references: [],
    loadedTags: [],
    loadedReferences: [],
    sensitive: false,
    sensitiveReason: "",
    sensitiveOpen: false,
    acts: [EDIT],
    actsOpen: false,
    busy: false,
    refusal: null,
    failed: false,
    onWords: vi.fn(),
    onSensitive: vi.fn(),
    onSensitiveReason: vi.fn(),
    onSensitiveOpen: vi.fn(),
    onSensitiveHelp: vi.fn(),
    onPick: vi.fn(),
    onRetryUploads: vi.fn(),
    onRemoveFailed: vi.fn(),
    onPickCover: vi.fn(),
    onRemoveCover: vi.fn(),
    onNotNow: vi.fn(),
    onTryAgain: vi.fn(),
    onDiscard: vi.fn(),
    onRemoveRefusedCitation: vi.fn(),
    onRemovePicture: vi.fn(),
    onDescribe: vi.fn(),
    onTags: vi.fn(),
    onReferences: vi.fn(),
    onUndoTag: vi.fn(),
    onUndoReference: vi.fn(),
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

/** A standing citation whose target never landed. */
const CITED: ReferenceDraft = {
  targetId: "p-unlanded",
  target: { kind: "Post", label: "Tide tables — @juno", href: "/posts/p-unlanded" },
  relevance: 0.1,
  support: 0.1,
  withdrawalCost: 1,
  rawRelevance: 0.1,
  rawSupport: 0.1,
};

/** A comment whose body is one clip, its face chosen (or taken) when it was published. */
const clip = (coverTaken = false) =>
  galleryOf([
    {
      id: "v1",
      url: "https://media.test/v1.mp4",
      altText: "A headland",
      mimeType: "video/mp4",
      options: { aspectRatio: "9:16", durationMs: 18_000 },
      coverMedia: { id: "c1", url: "https://media.test/c1.webp" },
      coverTaken,
    },
  ]);

const face = {
  id: "face",
  file: new Blob(["x"]),
  crop: { x: 0, y: 0, zoom: 1, area: null, areaPercent: null },
  altText: "",
  upload: { kind: "waiting" as const },
};

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

  it("reads the mark back and offers to set one", () => {
    draw();
    expect(screen.getByTestId("comment-edit-sensitive-value")).toHaveTextContent("Not marked");
    expect(screen.getByTestId("comment-edit-open-sensitive")).toHaveTextContent("Mark");
  });

  it("a marked comment says so, and the row offers the change", () => {
    draw({ sensitive: true });
    expect(screen.getByTestId("comment-edit-sensitive-value")).toHaveTextContent("Marked");
    expect(screen.getByTestId("comment-edit-open-sensitive")).toHaveTextContent("Change");
  });

  it("the row opens the mark sheet", () => {
    const props = draw();
    fireEvent.click(screen.getByTestId("comment-edit-open-sensitive"));
    expect(props.onSensitiveOpen).toHaveBeenCalledWith(true);
  });

  // The sheet opens marked (`Mark` was the intent) and stages; Done commits.
  it("the sheet stages the mark, and its reason waits for one", () => {
    const props = draw({ sensitiveOpen: true });
    fireEvent.click(screen.getByTestId("comment-edit-sensitive-switch"));
    // A reason without the mark is a refusal, so the field waits for it.
    expect(screen.getByTestId("comment-edit-sensitive-reason")).toBeDisabled();
    expect(props.onSensitive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("comment-edit-sensitive-done"));
    expect(props.onSensitive).toHaveBeenCalledWith(false);
  });

  it("the sheet's reason is live once the comment is marked", () => {
    const props = draw({ sensitiveOpen: true, sensitive: true });
    const reason = screen.getByTestId("comment-edit-sensitive-reason");
    expect(reason).not.toBeDisabled();
    fireEvent.change(reason, { target: { value: "A dead seabird." } });
    fireEvent.click(screen.getByTestId("comment-edit-sensitive-done"));
    expect(props.onSensitive).toHaveBeenCalledWith(true);
    expect(props.onSensitiveReason).toHaveBeenCalledWith("A dead seabird.");
  });

  it("the sheet's help is the mark's own topic, not the editor's", () => {
    const props = draw({ sensitiveOpen: true });
    fireEvent.click(screen.getByTestId("comment-edit-sensitive-help"));
    expect(props.onSensitiveHelp).toHaveBeenCalled();
    expect(props.onHelp).not.toHaveBeenCalled();
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
    // CommentEditBody draws `+ Add pictures · 1 of 4` (copy-voice: the add
    // grammar carries the cap at both scales).
    it("counts what the comment carries against the cap of four", () => {
      draw({ gallery: ONE_PICTURE });
      expect(screen.getByTestId("comment-edit-add-media")).toHaveTextContent("+ Add pictures · 1 of 4");
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
    it("reads the live count of the batch, You're signing N things", () => {
      draw({ acts: [EDIT, WITHDRAWN] });
      expect(screen.getByTestId("comment-edit-signed-actions")).toHaveTextContent(
        "You're signing 3 things",
      );
    });

    // EditComposeUnchanged.md — the family's guard, CommentEdit included.
    it("an_empty_batch_leaves_sign_inert_and_the_footer_not_a_control", () => {
      draw({ acts: [] });
      const foot = screen.getByTestId("comment-edit-signed-actions");
      expect(foot).toHaveTextContent("Nothing to sign yet");
      expect(foot.tagName).not.toBe("BUTTON");
      expect(screen.getByTestId("comment-edit-save")).toBeVisible();
      expect(screen.getByTestId("comment-edit-save")).toBeDisabled();
    });

    it("opens the acts sheet — the footer is an affordance, not a label", () => {
      const props = draw({ acts: [EDIT, WITHDRAWN] });
      fireEvent.click(screen.getByTestId("comment-edit-signed-actions"));
      expect(props.onActs).toHaveBeenCalledWith(true);
    });

    it("carries the count in the sheet's own title, every kind counted in records", () => {
      draw({ acts: [EDIT, WITHDRAWN], actsOpen: true });
      const sheet = screen.getByTestId("comment-edit-acts-sheet");
      expect(sheet).toHaveTextContent("3 things, signed together");
      expect(screen.getByTestId("comment-edit-acts-sheet-row-citationsWithdrawn")).toHaveTextContent(
        "2",
      );
      expect(sheet).toHaveTextContent("They land together, or none does.");
    });

    it("reads a withdrawn tag back under its block, with Undo", () => {
      const coastroad = newTagDraft("coastroad");
      const props = draw({ loadedTags: [coastroad], tags: [] });
      expect(screen.getByTestId("comment-edit-withdrawn-tag-coastroad")).toHaveTextContent(
        "Withdrawn: #coastroad",
      );
      fireEvent.click(screen.getByTestId("comment-edit-withdrawn-tag-coastroad-undo"));
      expect(props.onUndoTag).toHaveBeenCalledWith("coastroad");
    });
  });

  describe("signing", () => {
    it("refuses to sign an edit that would stage nothing", () => {
      draw({ acts: [] });
      expect(screen.getByTestId("comment-edit-save")).toBeDisabled();
    });

    // CommentEdit.md: "the line Uploading N of M — signing waits for the
    // picture. stands above the acts footer GIVEN pictures the edit took are
    // uploading and M is 1" … "Sign the edit is enabled GIVEN an upload is running".
    it("keeps Sign enabled while a picture is on its way, the gate standing over the foot", () => {
      draw({ gallery: addTo(ONE_PICTURE, [{ id: "new-0", file: new Blob(["x"]) }]) });
      expect(screen.getByTestId("comment-edit-save")).not.toBeDisabled();
      expect(screen.getByTestId("comment-edit-gate")).toHaveTextContent(
        "Uploading 0 of 1 — signing waits for the picture.",
      );
    });

    // CommentEdit.md: "Sign the edit is disabled GIVEN the gate line shows its
    // fault reading" … "its thumbnail is marked AND the line One picture
    // didn't upload. stands under the pictures with Retry and Remove it".
    it("shuts Sign on a failed picture, the gate and the row both saying so", () => {
      const props = draw({
        gallery: withUpload(addTo(ONE_PICTURE, [{ id: "new-0", file: new Blob(["x"]) }]), "new-0", {
          kind: "failed",
          message: "no",
          retryable: true,
        }),
      });
      expect(screen.getByTestId("comment-edit-save")).toBeDisabled();
      expect(screen.getByTestId("comment-edit-gate")).toHaveTextContent(
        "One picture didn't upload. Signing waits for it.",
      );
      expect(screen.getByTestId("comment-edit-upload-error")).toHaveTextContent("One picture didn't upload.");
      fireEvent.click(screen.getByTestId("comment-edit-upload-error-retry"));
      expect(props.onRetryUploads).toHaveBeenCalled();
      fireEvent.click(screen.getByTestId("comment-edit-upload-error-remove"));
      expect(props.onRemoveFailed).toHaveBeenCalled();
    });

    // CommentEdit.md: past 200ms the label swaps in its own place, and the
    // ways out refuse; a held press refuses a second one.
    it("refuses a second press while held, and never dims", () => {
      const props = draw({ held: true });
      fireEvent.click(screen.getByTestId("comment-edit-save"));
      expect(props.onSign).not.toHaveBeenCalled();
      expect(screen.getByTestId("comment-edit-save")).not.toBeDisabled();
    });

    it("stands the slow line and the count line under the acts footer", () => {
      draw({ slow: true });
      expect(screen.getByTestId("comment-edit-signed-actions-subline")).toHaveTextContent(
        "Still signing — the network is slow right now.",
      );
      cleanup();
      draw({ countChanged: true });
      expect(screen.getByTestId("comment-edit-signed-actions-subline")).toHaveTextContent(
        "The count changed while you were editing — check it, then sign again.",
      );
    });

    // CommentEdit.md: "the write rule refuses the edit -> … the notice's fact
    // ends Nothing was signed or spent — your edit is still here. AND the way
    // out under the notice reads Not now AND NEVER the notice says a draft is
    // kept AND NEVER Retry appears".
    it("stands the write rule's notice in the commit's place, Not now its way out", () => {
      const props = draw({ fault: { kind: "writeRule" } });
      const notice = screen.getByTestId("comment-edit-write-rule");
      expect(notice).toHaveTextContent(/Nothing was signed or spent — your edit is still here.$/);
      expect(notice).not.toHaveTextContent(/draft/);
      expect(screen.queryByTestId("comment-edit-save")).not.toBeInTheDocument();
      expect(screen.queryByText(/Retry/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId("comment-edit-not-now"));
      expect(props.onNotNow).toHaveBeenCalled();
    });

    // CommentEdit.md: "the signing is refused for one staged act GIVEN the
    // act's target landed -> the notice This shouldn't have happened takes the
    // commit's place AND Try again, Report a problem and Discard the edit stand".
    it("stands the bug's notice with Try again, Report a problem and Discard the edit", () => {
      const props = draw({ fault: { kind: "bug" } });
      expect(screen.getByTestId("comment-edit-bug")).toHaveTextContent("This shouldn't have happened");
      expect(screen.getByTestId("comment-edit-report")).toHaveTextContent("Report a problem");
      fireEvent.click(screen.getByTestId("comment-edit-discard"));
      expect(props.onDiscard).toHaveBeenCalled();
      fireEvent.click(screen.getByTestId("comment-edit-try-again"));
      expect(props.onTryAgain).toHaveBeenCalled();
    });

    // CommentEdit.md: "the signing is refused for one staged citation GIVEN
    // the cited post never landed -> that citation's row reads This post
    // didn't land, so it can't be cited. followed by Remove it AND NEVER Retry".
    it("says on the citation why it cannot be cited, with Remove it and no Retry", () => {
      const props = draw({ references: [CITED], fault: { kind: "row", targetId: CITED.targetId } });
      const line = screen.getByTestId("comment-edit-citation-fault");
      expect(line).toHaveTextContent("This post didn't land, so it can't be cited. Remove it");
      expect(screen.queryByTestId("comment-edit-citation-fault-retry")).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId("comment-edit-citation-fault-remove"));
      expect(props.onRemoveRefusedCitation).toHaveBeenCalledWith(CITED.targetId);
    });

    it("signs when there is something to sign", () => {
      const props = draw({ acts: [EDIT] });
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
        "Leave — the edit is discarded",
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

// A modal dialog over the thread's surface, so it announces itself as one
// (`covering-layer.tsx`; Feed.md:31) for as long as it is mounted.
describe("CommentEdit as a covering layer", () => {
  it("suspends the surface beneath it while it is up", () => {
    draw();
    expect(raisedLayersForTests()).toEqual(["suspend"]);
  });
});

// CommentEditVideo.md compiled at the view: the clip stays or leaves whole,
// its cover row reads the face it has or the door, and the cover's crop is
// locked to the comment's square.
describe("CommentEditVideo", () => {
  it("draws the clip in the Video field with its one description, no add control", () => {
    draw({ gallery: clip() });
    expect(screen.getByTestId("comment-edit-clip")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove this video")).toBeInTheDocument();
    expect(screen.getByTestId("comment-edit-describe-counter")).toHaveTextContent("Describe the video");
    expect(screen.queryByTestId("comment-edit-add-media")).not.toBeInTheDocument();
  });

  // "tap the clip's remove control -> the clip leaves whole, taking the
  // comment's media with it AND the comment is its words".
  it("takes the clip out whole from its own remove control", () => {
    const props = draw({ gallery: clip() });
    fireEvent.click(screen.getByLabelText("Remove this video"));
    expect(props.onRemovePicture).toHaveBeenCalledWith("v1");
  });

  // "the cover row shows the cover and Change the cover GIVEN the comment's
  // clip has a cover" / "shows Add a cover and no picture GIVEN … no cover".
  it("shows the face and Change the cover where one was chosen, the door where none was", () => {
    draw({ gallery: clip(false) });
    expect(screen.getByTestId("comment-edit-cover")).toBeInTheDocument();
    expect(screen.getByTestId("comment-edit-change-cover")).toHaveTextContent("Change the cover");
    cleanup();
    draw({ gallery: clip(true) });
    expect(screen.getByTestId("comment-edit-add-cover")).toHaveTextContent("Add a cover");
    expect(screen.queryByTestId("comment-edit-cover")).not.toBeInTheDocument();
  });

  // "tap Change the cover -> the platform's own picker opens AND NEVER the
  // clip's frames are offered".
  it("opens the platform's own picker for the face, pictures only", () => {
    const props = draw({ gallery: clip() });
    const input = screen.getByTestId("comment-edit-cover-input") as HTMLInputElement;
    const opened = vi.spyOn(input, "click");
    fireEvent.click(screen.getByTestId("comment-edit-change-cover"));
    expect(opened).toHaveBeenCalledTimes(1);
    expect(input.accept).toBe("image/*");
    const files = [new File([new Uint8Array([1]) as BlobPart], "face.jpg", { type: "image/jpeg" })];
    Object.defineProperty(input, "files", { value: files, configurable: true });
    fireEvent.change(input);
    expect(props.onPickCover).toHaveBeenCalledWith(files[0]);
  });

  // "a picture comes back from the picker -> it passes through the cover's
  // crop, locked to the comment's square, before it lands on the edit".
  it("stands the cover's crop in the edit's place, locked, with its own ways out", () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    const props = draw({
      gallery: clip(),
      cropping: { src: "blob:face", crop: face.crop, onCrop: vi.fn(), onNext, onBack },
    });
    expect(screen.getByRole("heading", { name: "The cover" })).toBeInTheDocument();
    expect(screen.getByTestId("comment-edit-cover-crop")).toHaveTextContent("The cover takes the video's shape.");
    expect(screen.queryByRole("group", { name: "The post's shape" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("coverCrop.next"));
    expect(onNext).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Back to the edit"));
    expect(onBack).toHaveBeenCalled();
    // The X is the edit's own X.
    fireEvent.click(screen.getByTestId("header-leave"));
    expect(props.onLeave).toHaveBeenCalled();
  });

  // "the line Uploading N of M — signing waits for the cover. stands above the
  // acts footer GIVEN the cover the edit set is uploading".
  it("gates on the face the edit set, in the cover's noun", () => {
    draw({ gallery: withNewCover(clip(), "v1", face) });
    expect(screen.getByTestId("comment-edit-gate")).toHaveTextContent(
      "Uploading 0 of 1 — signing waits for the cover.",
    );
    expect(screen.getByTestId("comment-edit-save")).not.toBeDisabled();
  });

  // "the cover the edit set fails to upload -> the cover's thumbnail is marked
  // AND the line One picture didn't upload. stands under the cover row with
  // Retry and Remove it AND the gate line takes its fault reading".
  it("marks a failed face under the cover row, with Retry and Remove it", () => {
    const props = draw({
      gallery: withNewCover(clip(), "v1", {
        ...face,
        upload: { kind: "failed", message: "no", retryable: true },
      }),
    });
    expect(screen.getByTestId("comment-edit-cover-error")).toHaveTextContent("One picture didn't upload.");
    expect(screen.getByTestId("comment-edit-gate")).toHaveTextContent(
      "One picture didn't upload. Signing waits for it.",
    );
    expect(screen.getByTestId("comment-edit-save")).toBeDisabled();
    fireEvent.click(screen.getByTestId("comment-edit-cover-error-remove"));
    expect(props.onRemoveCover).toHaveBeenCalled();
  });
});

// CommentEdit.md: "WHEN the stage opens -> focus lands on the stage's heading
// AND NEVER the keyboard rises before a field is tapped".
describe("CommentEdit opening", () => {
  it("lands focus on its heading, never on a field", () => {
    draw();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Edit comment" }));
  });
});
