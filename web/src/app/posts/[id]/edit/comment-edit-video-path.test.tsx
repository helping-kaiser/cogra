// The comment edit's video path — CommentEdit.md:17–27 and CommentEditVideo.md
// compiled to behavior for a clip PICKED AT THE EDIT, through the real batch.
//
// Its own file because of the module mocks below, as the reply's video tests
// are: jsdom decodes no video, so the frame capture, the compression and the
// remux are stubbed while the container sniff, the comment's caps and the
// pictures-or-one-video grammar stay real — those are the rules the edit is
// meant to apply.
//
// jakob, hand test 2026-11-11: "when editing a comment (that had an image
// before which i removed) i can not add a video … but i should be allowed to
// either add up to 4 photos or 1 video (as this post now has zero media)."

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommentView } from "@/lib/api/content-api";
import { createTokenStore } from "@/lib/session/token-store";
import { captureFrameZero } from "@/lib/ui2/media/video";
import { echoedMedia } from "@/test/media-echo";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { CommentEditor } from "./comment-editor";

const FRAME_ZERO = new Blob([new Uint8Array([0]) as BlobPart], { type: "image/png" });

vi.mock("@/lib/ui2/media/video", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ui2/media/video")>()),
  captureFrameZero: vi.fn(async () => FRAME_ZERO),
}));

vi.mock("@/lib/ui2/media/strip-video", () => ({
  stripVideoMetadata: vi.fn(async () => ({
    blob: new Blob([new Uint8Array(new ArrayBuffer(8)) as BlobPart], { type: "video/mp4" }),
    tookMs: 3,
  })),
}));

vi.mock("@/lib/ui2/media/compress-video", () => ({
  compressVideo: vi.fn(async (blob: Blob) => ({ blob, path: "unsupported", tookMs: 0, videoCodec: null })),
  clipOutlook: vi.fn(async () => "as-picked"),
}));

// The device's upload digest, pinned so the server can echo it (test/media-echo.ts).
vi.mock("@/lib/api/media-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/media-api")>()),
  uploadDigestOf: async () => "ee".repeat(32),
}));

const server = startMswServer(
  gqlLink.query("CommentSelfMark", ({ variables }) =>
    HttpResponse.json({
      data: {
        comment: { __typename: "Comment", id: variables.id, sensitiveSelfMark: false, sensitiveReason: null },
      },
    }),
  ),
  gqlLink.query("MediaAttachmentStatus", ({ variables }) =>
    HttpResponse.json({
      data: {
        mediaAttachment: {
          ...echoedMedia(variables.id as string),
          digest: "11".repeat(32),
          uploadDigest: "11".repeat(32),
        },
      },
    }),
  ),
);

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function installEncoder() {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 1080, height: 1080, close: () => {} })),
  );
  class Canvas {
    constructor(
      public width: number,
      public height: number,
    ) {}
    getContext() {
      return { drawImage: () => {} };
    }
    async convertToBlob({ type }: { type: string }) {
      return new Blob([new Uint8Array(new ArrayBuffer(8)) as BlobPart], { type });
    }
  }
  vi.stubGlobal("OffscreenCanvas", Canvas);
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:preview", configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
}

/** Each upload waits on its own latch and lands READY as `up-N` in arrival order, or fails. */
function uploads() {
  const latches: { release: (outcome: "land" | "fail") => void }[] = [];
  let next = 0;
  server.use(
    gqlLink.mutation("UploadMedia", async () => {
      const outcome = await new Promise<"land" | "fail">((resolve) => latches.push({ release: resolve }));
      if (outcome === "fail") return HttpResponse.error();
      return HttpResponse.json({
        data: {
          uploadMedia: { __typename: "UploadMediaPayload", media: echoedMedia(`up-${next++}`), userErrors: [] },
        },
      });
    }),
  );
  return {
    async answer(outcome: "land" | "fail" = "land") {
      await waitFor(() => expect(latches.length).toBeGreaterThan(0));
      latches.shift()!.release(outcome);
      await act(async () => {});
    },
  };
}

type Sent = { attachments?: Record<string, unknown>[] | null };

function prepared(capture: (input: Sent) => void = () => {}) {
  server.use(
    gqlLink.mutation("PrepareCommentEdit", ({ variables }) => {
      capture(variables.input as Sent);
      return HttpResponse.json({
        data: {
          prepareCommentEdit: {
            __typename: "PrepareContentPayload",
            node: "c1",
            writes: [
              {
                __typename: "PreparedWrite",
                id: "w-edit",
                family: "REVIEW",
                canonicalProposal: "cHJvcG9zYWw=",
                gcAfterEpochs: 8,
              },
            ],
            userErrors: [],
          },
        },
      });
    }),
  );
}

function media(id: string) {
  return {
    __typename: "MediaAttachment",
    id,
    url: `https://media.test/${id}.webp`,
    altText: null,
    status: "NORMAL",
    mimeType: "image/webp",
    options: { __typename: "MediaOptions", aspectRatio: "1:1", durationMs: null },
    coverMedia: null,
    coverTaken: false,
  };
}

function comment(attachments: Record<string, unknown>[] = []): CommentView {
  return {
    __typename: "Comment",
    id: "c1",
    content: { __typename: "ModeratedText", value: "The headland, again.", status: "NORMAL" },
    attachments,
    attachmentsStatus: "NORMAL",
    sensitiveSelfMark: false,
    sensitiveReason: null,
    topics: [],
    references: [],
    license: { __typename: "License", attribution: 0, provenance: 0 },
  } as unknown as CommentView;
}

function draw(target: CommentView) {
  const signer = fakeWriteSigner();
  const onSigned = vi.fn();
  renderWithProviders(
    <CommentEditor
      comment={target}
      parentId={null}
      postId="p1"
      targetLabel="The long way home"
      onLeave={vi.fn()}
      onSigned={onSigned}
    />,
    { store: signedInStore(), writeSigner: signer },
  );
  return { signer, onSigned };
}

/** A real MP4 header, so the container sniff passes for the right reason. */
function aVideo(name = "clip.mp4"): File {
  const bytes = new Uint8Array(new ArrayBuffer(32));
  const write = (text: string, at: number) => {
    for (let i = 0; i < 4; i += 1) bytes[at + i] = text.charCodeAt(i);
  };
  bytes[3] = 16;
  write("ftyp", 4);
  write("isom", 8);
  return new File([bytes as BlobPart], name, { type: "video/mp4" });
}

const aPicture = (name = "shot.jpg") =>
  new File([new Uint8Array([1, 2, 3]) as BlobPart], name, { type: "image/jpeg" });

async function pickInto(testId: string, files: File[]) {
  const input = await screen.findByTestId(testId);
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
  await act(async () => {});
}

const save = () => screen.getByTestId("commentEdit.sign");
const gate = () => screen.queryByTestId("commentEdit.gate");
const STAGED = "A video can't join an edit yet — post it on its own.";

beforeEach(() => installEncoder());
afterEach(() => vi.unstubAllGlobals());

describe("CommentEdit — a comment holding words alone (CommentEdit.md:17–21)", () => {
  // CommentEdit.md:17: "ALWAYS the comment edit's add row reads + Add pictures
  // or a video GIVEN the comment holds words alone, no picture and no clip".
  // :19: "commentEdit.pictures holds commentEdit.pictures.add alone, with no
  // commentEdit.pictures.label, no commentEdit.pictures.thumb and no
  // commentEdit.pictures.describeRow".
  it("reads its add row + Add pictures or a video, the add row alone", async () => {
    draw(comment());
    expect(await screen.findByTestId("commentEdit.pictures.add")).toHaveTextContent("+ Add pictures or a video");
    expect(screen.queryByTestId("commentEdit.pictures.label")).not.toBeInTheDocument();
    expect(screen.queryByTestId("commentEdit.pictures.describeRow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("commentEdit.pictures.thumb")).not.toBeInTheDocument();
  });

  // :21 "WHEN tap + Add pictures or a video -> the platform's own picker opens"
  // — and it offers clips (jakob 2026-11-11: "the picker just shows images").
  it("opens the platform's own picker, offering clips beside pictures", async () => {
    draw(comment());
    const input = await screen.findByTestId("comment-edit-media-input");
    expect(input.getAttribute("accept")).toContain("video/mp4");
    expect(input.getAttribute("accept")).toContain("image/*");
  });

  it("reads the same once this edit removed the comment's last picture — words alone is the edit's own state", async () => {
    draw(comment([media("m1")]));
    expect(await screen.findByTestId("commentEdit.pictures.add")).toHaveTextContent("+ Add pictures · 1 of 4");
    fireEvent.click(screen.getByTestId("commentEdit.pictures.thumb.remove"));
    expect(screen.getByTestId("commentEdit.pictures.add")).toHaveTextContent("+ Add pictures or a video");
    expect(screen.queryByTestId("commentEdit.pictures.label")).not.toBeInTheDocument();
  });
});

describe("CommentEdit — a video picked at the edit (CommentEdit.md:23, CommentEditVideo)", () => {
  // CommentEdit.md:23: "WHEN a video is picked from + Add pictures or a video
  // -> the clip arrives as the comment's video with its cover row, as
  // CommentEditVideo draws it". THE BEHAVIOUR JAKOB REPORTED: a comment whose
  // picture this edit removed takes a video, signed as its whole body.
  it("takes a clip into a comment whose picture this edit removed, and signs it as the whole body", async () => {
    let sent: Sent | null = null;
    prepared((input) => (sent = input));
    const bytes = uploads();
    const { signer, onSigned } = draw(comment([media("m1")]));
    fireEvent.click(await screen.findByTestId("commentEdit.pictures.thumb.remove"));
    await pickInto("comment-edit-media-input", [aVideo()]);

    expect(screen.queryByText(STAGED)).not.toBeInTheDocument();
    expect(await screen.findByTestId("commentEdit.video.thumb")).toBeInTheDocument();
    expect(screen.getByTestId("commentEdit.video.label")).toHaveTextContent("Video");
    // CommentEditVideo.md:15 — a clip with no chosen face: Add a cover, no picture.
    expect(screen.getByTestId("commentEdit.cover.label")).toHaveTextContent("Cover");
    expect(screen.getByTestId("comment-edit-add-cover")).toHaveTextContent("Add a cover");
    expect(screen.queryByTestId("commentEdit.cover.thumb")).not.toBeInTheDocument();
    expect(screen.queryByTestId("commentEdit.pictures")).not.toBeInTheDocument();
    // The edit record carries the body: one act.
    expect(screen.getByTestId("commentEdit.acts.line")).toHaveTextContent("You're signing 1 thing");

    // The clip uploads at once (ReplyVideo.md:5): its frame 0 first, the clip after.
    expect(await screen.findByTestId("commentEdit.gate")).toHaveTextContent(
      "Uploading 0 of 1 — signing waits for the video.",
    );
    expect(captureFrameZero).toHaveBeenCalled();
    fireEvent.click(save());
    expect(signer.signStaged).not.toHaveBeenCalled();
    await bytes.answer("land"); // frame 0 → up-0
    await bytes.answer("land"); // the clip → up-1
    await waitFor(() => expect(onSigned).toHaveBeenCalledTimes(1));
    // The stored face of a coverless clip is its frame 0, TAKEN.
    expect(sent!.attachments).toEqual([
      expect.objectContaining({ mediaId: "up-1", coverMediaId: "up-0", coverTaken: true }),
    ]);
  });

  // CommentEdit.md:27: "WHEN a video is picked at the edit GIVEN the comment
  // holds pictures -> the refusal A comment carries pictures or one video, not
  // both. stands under commentEdit.pictures with Remove it alone AND NEVER the
  // video is taken".
  it("refuses a clip beside pictures, in words under the pictures, with Remove it alone", async () => {
    draw(comment([media("m1")]));
    await pickInto("comment-edit-media-input", [aVideo()]);
    const refusals = await screen.findByTestId("comment-edit-refusals");
    expect(refusals).toHaveTextContent("A comment carries pictures or one video, not both.");
    expect(refusals).toHaveTextContent("Remove it");
    expect(refusals).not.toHaveTextContent("Retry");
    expect(screen.getByTestId("commentEdit.pictures")).toContainElement(refusals);
    expect(screen.queryByTestId("commentEdit.video.thumb")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  // ReplyVideo.md:29, the family's: a batch's first clip is the body and each
  // other reads the one-video line — standing under the clip, never lost.
  it("takes a batch's first clip and refuses the second in words under the clip", async () => {
    uploads();
    draw(comment());
    await pickInto("comment-edit-media-input", [aVideo("one.mp4"), aVideo("two.mp4")]);
    expect(await screen.findByTestId("commentEdit.video.thumb")).toBeInTheDocument();
    const refusals = screen.getByTestId("comment-edit-refusals");
    expect(refusals).toHaveTextContent("A comment carries one video.");
    expect(screen.getByTestId("commentEdit.video")).toContainElement(refusals);
  });

  // CommentEdit.md:69/71/75 at the clip's noun: a failed upload drops the
  // held press, the gate takes its fault reading, Sign shuts; Remove it makes
  // the comment its words again (CommentEditVideo.md:5).
  it("drops a held press when the clip fails, and Remove it gives the comment its words back", async () => {
    const bytes = uploads();
    const { signer } = draw(comment());
    await pickInto("comment-edit-media-input", [aVideo()]);
    fireEvent.click(save());
    await bytes.answer("land"); // frame 0
    await bytes.answer("fail"); // the clip
    await waitFor(() => expect(gate()).toHaveTextContent("The video didn't upload. Signing waits for it."));
    expect(screen.getByTestId("comment-edit-clip-error")).toHaveTextContent("The video didn't upload.");
    expect(screen.getByTestId("comment-edit-clip-failed")).toBeInTheDocument();
    expect(save()).toBeDisabled();
    expect(save()).toHaveTextContent("Sign the edit");
    expect(signer.signStaged).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("comment-edit-clip-error-remove"));
    expect(screen.queryByTestId("commentEdit.video")).not.toBeInTheDocument();
    expect(gate()).not.toBeInTheDocument();
    expect(screen.getByTestId("commentEdit.pictures.add")).toHaveTextContent("+ Add pictures or a video");
  });

  it("re-sends only the clip on Retry, keeping the frame that already landed", async () => {
    let sent: Sent | null = null;
    prepared((input) => (sent = input));
    const bytes = uploads();
    const { onSigned } = draw(comment());
    await pickInto("comment-edit-media-input", [aVideo()]);
    await bytes.answer("land"); // frame 0 → up-0
    await bytes.answer("fail"); // the clip
    const frames = vi.mocked(captureFrameZero).mock.calls.length;
    fireEvent.click(await screen.findByTestId("comment-edit-clip-error-retry"));
    await bytes.answer("land"); // the clip → up-1
    await waitFor(() => expect(gate()).not.toBeInTheDocument());
    expect(vi.mocked(captureFrameZero).mock.calls.length).toBe(frames);
    fireEvent.click(save());
    await waitFor(() => expect(onSigned).toHaveBeenCalled());
    expect(sent!.attachments).toEqual([
      expect.objectContaining({ mediaId: "up-1", coverMediaId: "up-0", coverTaken: true }),
    ]);
  });

  // CommentEditVideo.md:17–19 + 25 on a clip picked here: Add a cover opens the
  // platform's picker, the picture passes the square crop, and the signed clip
  // points at the CHOSEN face, never at its taken frame.
  it("gives the picked clip a chosen face through the square crop, signed over its frame 0", async () => {
    let sent: Sent | null = null;
    prepared((input) => (sent = input));
    const bytes = uploads();
    const { onSigned } = draw(comment());
    await pickInto("comment-edit-media-input", [aVideo()]);
    await bytes.answer("land"); // frame 0 → up-0
    await bytes.answer("land"); // the clip → up-1
    await waitFor(() => expect(gate()).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId("comment-edit-add-cover"));
    await pickInto("comment-edit-cover-input", [aPicture("face.jpg")]);
    expect(await screen.findByTestId("comment-edit-cover-crop")).toHaveTextContent(
      "The cover takes the video's shape.",
    );
    fireEvent.click(screen.getByTestId("coverCrop.next"));
    expect(await screen.findByTestId("commentEdit.gate")).toHaveTextContent(
      // N of M counts every upload the edit took (CommentEdit.md:47): the clip landed, its face goes up.
      "Uploading 1 of 2 — signing waits for the cover.",
    );
    expect(screen.getByTestId("commentEdit.cover.thumb")).toBeInTheDocument();
    expect(screen.getByTestId("commentEdit.cover.change")).toHaveTextContent("Change the cover");
    // CommentEditVideo.md:23 — the record is already staged; the face adds nothing.
    expect(screen.getByTestId("commentEdit.acts.line")).toHaveTextContent("You're signing 1 thing");
    fireEvent.click(save());
    await bytes.answer("land"); // the face → up-2
    await waitFor(() => expect(onSigned).toHaveBeenCalled());
    expect(sent!.attachments).toEqual([
      expect.objectContaining({ mediaId: "up-1", coverMediaId: "up-2", coverTaken: null }),
    ]);
  });

  // CommentEditVideo.md:59 on a clip picked here: the cover row reads as it
  // stood — Add a cover — once the failed face is removed.
  it("Remove it under the cover row gives a picked clip its Add a cover back", async () => {
    const bytes = uploads();
    draw(comment());
    await pickInto("comment-edit-media-input", [aVideo()]);
    await bytes.answer("land");
    await bytes.answer("land");
    fireEvent.click(screen.getByTestId("comment-edit-add-cover"));
    await pickInto("comment-edit-cover-input", [aPicture("face.jpg")]);
    fireEvent.click(await screen.findByTestId("coverCrop.next"));
    await bytes.answer("fail");
    expect(await screen.findByTestId("comment-edit-cover-error")).toHaveTextContent("One picture didn't upload.");
    fireEvent.click(screen.getByTestId("comment-edit-cover-error-remove"));
    await waitFor(() => expect(gate()).not.toBeInTheDocument());
    expect(screen.getByTestId("comment-edit-add-cover")).toBeInTheDocument();
    expect(save()).not.toBeDisabled();
  });
});
