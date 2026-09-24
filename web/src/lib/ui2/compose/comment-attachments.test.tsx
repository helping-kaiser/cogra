import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CommentAttachments, commentDropHandlers } from "./comment-attachments";
import { NO_COMMENT_MEDIA, pickInto, withUpload } from "@/lib/compose/comment-media";
import type { CoverAsset } from "@/lib/compose/wizard";

const file = (name = "one.jpg") =>
  new File([new Uint8Array([1]) as BlobPart], name, { type: "image/jpeg" });

const media = (n: number) =>
  pickInto(
    NO_COMMENT_MEDIA,
    Array.from({ length: n }, (_, i) => ({ id: `c${i}`, file: file(`${i}.jpg`) })),
  );

const previews = (n: number) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`c${i}`, `blob:${i}`]));

function show(overrides: Partial<Parameters<typeof CommentAttachments>[0]> = {}) {
  const props = {
    media: NO_COMMENT_MEDIA,
    previews: {},
    onPick: vi.fn(),
    onRemove: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  render(<CommentAttachments {...props} />);
  return props;
}

describe("the comment picture row", () => {
  // ReplyPictures: the counter lives INSIDE the Add label, in the house
  // "n of m" form — there is no slash counter anywhere in this flow.
  it("offers both kinds while the composer is empty", () => {
    // The label follows the state (item 31, round 2): with nothing picked both
    // are still possible, so the label must not name only one of them.
    show();
    expect(screen.getByTestId("comment-add-media")).toHaveTextContent(
      "+ Add pictures or a video",
    );
  });

  it("counts up as pictures arrive", () => {
    show({ media: media(2), previews: previews(2) });
    expect(screen.getByTestId("comment-add-media")).toHaveTextContent(
      "+ Add pictures · 2 of 4",
    );
  });

  // ReplyPicturesWeb's single addition over ReplyPictures.
  it("says the composer takes a drop, and draws no target for it", () => {
    show();
    expect(screen.getByText("…or drop pictures or a video here.")).toBeInTheDocument();
  });

  it("stops offering more once the comment is full", () => {
    show({ media: media(4), previews: previews(4) });
    expect(screen.getByTestId("comment-media-input")).toBeDisabled();
  });

  it("hands EVERY picked file up, including ones it cannot use", () => {
    // Filtering here is what made a dropped PDF vanish without a word; the
    // screening above is the only thing that can say why a file did not get in.
    const props = show();
    const input = screen.getByTestId("comment-media-input");
    const pdf = new File([new Uint8Array([1]) as BlobPart], "n.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(input, "files", { value: [file("a.jpg"), pdf], configurable: true });
    fireEvent.change(input);
    expect(props.onPick).toHaveBeenCalledWith([
      expect.objectContaining({ name: "a.jpg" }),
      expect.objectContaining({ name: "n.pdf" }),
    ]);
  });

  it("draws a turning ring while a picture is moving, never a made-up number", () => {
    show({ media: media(1), previews: previews(1) });
    expect(screen.getByTestId("comment-media-c0-progress")).toHaveAttribute(
      "aria-label",
      "Uploading",
    );
  });

  it("puts the ways out of a failure beside the row, not in the tile", () => {
    const props = show({
      media: withUpload(media(1), "c0", {
        kind: "failed",
        message: "Couldn't reach the server.",
        retryable: true,
      }),
      previews: previews(1),
    });
    expect(screen.getByTestId("comment-media-error-c0")).toHaveTextContent(
      "Couldn't reach the server.",
    );
    fireEvent.click(screen.getByTestId("comment-media-retry-c0"));
    expect(props.onRetry).toHaveBeenCalledWith("c0");
    fireEvent.click(screen.getByTestId("comment-media-drop-c0"));
    expect(props.onRemove).toHaveBeenCalledWith("c0");
  });

  it("offers no retry for a picture this browser cannot read", () => {
    show({
      media: withUpload(media(1), "c0", {
        kind: "failed",
        message: "This browser couldn't read that picture.",
        retryable: false,
      }),
      previews: previews(1),
    });
    expect(screen.queryByTestId("comment-media-retry-c0")).not.toBeInTheDocument();
  });

  it("removes a picture from its own tile", () => {
    const props = show({ media: media(1), previews: previews(1) });
    fireEvent.click(screen.getByTestId("comment-media-c0-remove"));
    expect(props.onRemove).toHaveBeenCalledWith("c0");
  });
});

const videoMedia = () =>
  pickInto(NO_COMMENT_MEDIA, [{ id: "v0", file: file("clip.mp4"), kind: "video" }]);

const aCover = (frame: number): CoverAsset => ({
  id: "cover0",
  file: file("frame.jpg"),
  frame,
  upload: { kind: "done", mediaId: "cover-media-0" },
});

describe("the reply tile's face and inset", () => {
  // THE RULE HOLDS AT BOTH SCALES (readme §13, 2026-09-24): the reply tile is
  // an authoring tile like the post tray's — frame 0 as its face, always, the
  // chosen frame riding as the ringed inset rather than replacing the face.
  it("wears the clip's stored frame 0 as its face with no cover chosen", () => {
    show({ media: videoMedia(), clipFace: "blob:frame-zero" });
    expect(screen.getByTestId("comment-media-v0-image")).toHaveAttribute(
      "src",
      "blob:frame-zero",
    );
  });

  it("keeps the clip's stored frame 0 as its face once a cover is chosen", () => {
    show({
      media: videoMedia(),
      clipFace: "blob:frame-zero",
      cover: aCover(2),
      framePreviews: ["blob:f0", "blob:f1", "blob:f2"],
    });
    expect(screen.getByTestId("comment-media-v0-image")).toHaveAttribute(
      "src",
      "blob:frame-zero",
    );
  });

  it("shows the chosen frame in the tile's ringed inset", () => {
    show({
      media: videoMedia(),
      clipFace: "blob:frame-zero",
      cover: aCover(2),
      framePreviews: ["blob:f0", "blob:f1", "blob:f2"],
    });
    const inset = screen.getByTestId("comment-media-v0-cover-mark");
    expect(inset.querySelector("img")).toHaveAttribute("src", "blob:f2");
  });

  it("draws no inset while no cover has been chosen", () => {
    show({ media: videoMedia(), clipFace: "blob:frame-zero" });
    expect(screen.queryByTestId("comment-media-v0-cover-mark")).not.toBeInTheDocument();
  });
});

describe("the drop path", () => {
  it("takes pictures dropped anywhere on the composer", () => {
    const onPick = vi.fn();
    const handlers = commentDropHandlers(onPick);
    const preventDefault = vi.fn();
    handlers.onDrop({
      preventDefault,
      dataTransfer: { files: [file("dropped.jpg")] },
    } as unknown as React.DragEvent);
    expect(preventDefault).toHaveBeenCalled();
    expect(onPick).toHaveBeenCalledWith([expect.objectContaining({ name: "dropped.jpg" })]);
  });

  // Without the dragover default the browser navigates to the file and the
  // half-written comment is gone.
  it("holds the browser back from opening the file itself", () => {
    const preventDefault = vi.fn();
    commentDropHandlers(vi.fn()).onDragOver({ preventDefault } as unknown as React.DragEvent);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("ignores a drop that carries nothing to show", () => {
    const onPick = vi.fn();
    commentDropHandlers(onPick).onDrop({
      preventDefault: vi.fn(),
      dataTransfer: { files: [] },
    } as unknown as React.DragEvent);
    expect(onPick).not.toHaveBeenCalled();
  });
});
