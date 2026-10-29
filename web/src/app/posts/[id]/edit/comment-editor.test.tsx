// The comment edit's controller — CommentEdit.md and CommentEditVideo.md
// compiled to behavior through the real batch: the bytes the edit takes go up
// (the encoder stubbed — jsdom has no canvas — and the upload answered by MSW,
// held open where a line needs it running), a press is held at the gate, and
// a clip's new face is signed as the clip's cover pointer.

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CommentView } from "@/lib/api/content-api";
import { createTokenStore } from "@/lib/session/token-store";
import { echoedMedia } from "@/test/media-echo";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { CommentEditor } from "./comment-editor";

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
  // The kept placements' digests, read back by id at sign time.
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

/** jsdom has no canvas and no WebP encoder, so the encode is stubbed whole. */
function installEncoder() {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 1200, height: 1200, close: () => {} })),
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
      return new Blob([new Uint8Array(8) as BlobPart], { type });
    }
  }
  vi.stubGlobal("OffscreenCanvas", Canvas);
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:preview", configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
}

/** Each upload waits on its own latch and lands READY under the next id, or fails. */
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
    },
  };
}

function prepared(capture: (input: Record<string, unknown>) => void = () => {}) {
  server.use(
    gqlLink.mutation("PrepareCommentEdit", ({ variables }) => {
      capture(variables.input as Record<string, unknown>);
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

function media(id: string, extra: Record<string, unknown> = {}) {
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
    ...extra,
  };
}

const CLIP = media("clip-1", {
  url: "https://media.test/clip-1.mp4",
  mimeType: "video/mp4",
  options: { __typename: "MediaOptions", aspectRatio: "9:16", durationMs: 18_000 },
  coverMedia: {
    __typename: "MediaAttachment",
    id: "face-1",
    url: "https://media.test/face-1.webp",
    status: "NORMAL",
    options: { __typename: "MediaOptions", aspectRatio: "1:1" },
  },
  coverTaken: false,
});

function comment(attachments: Record<string, unknown>[] = []): CommentView {
  return {
    __typename: "Comment",
    id: "c1",
    content: { __typename: "ModeratedText", value: "Eighteen seconds of the same headland.", status: "NORMAL" },
    attachments,
    attachmentsStatus: "NORMAL",
    sensitiveSelfMark: false,
    sensitiveReason: null,
    topics: [],
    references: [],
    license: { __typename: "License", attribution: 0, provenance: 0 },
  } as unknown as CommentView;
}

function draw(target: CommentView, signer = fakeWriteSigner()) {
  const onLeave = vi.fn();
  const onSigned = vi.fn();
  renderWithProviders(
    <CommentEditor
      comment={target}
      parentId={null}
      postId="p1"
      targetLabel="The long way home"
      onLeave={onLeave}
      onSigned={onSigned}
    />,
    { store: signedInStore(), writeSigner: signer },
  );
  return { signer, onLeave, onSigned };
}

function picture(name: string) {
  return new File([new Uint8Array([1, 2, 3]) as BlobPart], name, { type: "image/jpeg" });
}

async function pickInto(testId: string, files: File[]) {
  const input = await screen.findByTestId(testId);
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
  await act(async () => {});
}

const save = () => screen.getByTestId("commentEdit.sign");
const gate = () => screen.queryByTestId("commentEdit.gate");

beforeEach(() => installEncoder());

describe("CommentEditor — + Add pictures and the gate (CommentEdit)", () => {
  // CommentEdit.md: "WHEN press Sign the edit GIVEN an upload is running ->
  // Sign the edit refuses a second press AND NEVER anything is signed before
  // the last upload lands" … "the last upload lands GIVEN Sign the edit was
  // pressed while the uploads ran -> signing proceeds AND NEVER a second press
  // is asked".
  it("holds a press while the picture uploads and signs the moment it lands", async () => {
    let sent: Record<string, unknown> | null = null;
    prepared((input) => (sent = input));
    const bytes = uploads();
    const { signer, onSigned } = draw(comment([media("m1")]));
    await pickInto("comment-edit-media-input", [picture("a.jpg")]);
    expect(await screen.findByTestId("commentEdit.gate")).toHaveTextContent(
      "Uploading 0 of 1 — signing waits for the picture.",
    );
    expect(save()).not.toBeDisabled();
    fireEvent.click(save());
    fireEvent.click(save());
    await waitFor(() => expect(save()).toHaveTextContent("Signing the edit…"), { timeout: 1000 });
    expect(signer.signStaged).not.toHaveBeenCalled();
    await bytes.answer("land");
    await waitFor(() => expect(onSigned).toHaveBeenCalledTimes(1));
    expect(signer.signStaged).toHaveBeenCalledTimes(1);
    expect((sent as unknown as { attachments: { mediaId: string }[] }).attachments.map((a) => a.mediaId)).toEqual([
      "m1",
      "up-0",
    ]);
  });

  // CommentEdit.md: "an upload fails GIVEN Sign the edit was pressed while the
  // uploads ran -> the held press drops AND the gate line takes its fault
  // reading AND … the header back arrow and the header X answer again AND
  // NEVER anything is signed".
  it("drops the held press on a failed upload, and the ways out answer again", async () => {
    prepared();
    const bytes = uploads();
    const { signer, onLeave } = draw(comment());
    await pickInto("comment-edit-media-input", [picture("a.jpg")]);
    fireEvent.click(save());
    await bytes.answer("fail");
    await waitFor(() => expect(gate()).toHaveTextContent("One picture didn't upload. Signing waits for it."));
    expect(save()).toBeDisabled();
    expect(save()).toHaveTextContent("Sign the edit");
    expect(signer.signStaged).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("commentEdit.header.leave"));
    // A batch holding an act asks first.
    await waitFor(() => expect(screen.getByTestId("comment-edit-discard-confirm")).toHaveAttribute("open"));
    expect(onLeave).not.toHaveBeenCalled();
  });

  // CommentEdit.md: "press Retry GIVEN the held press dropped -> the gate runs
  // again AND NEVER signing proceeds until Sign the edit is pressed again".
  it("re-gates on Retry and signs nothing until Sign is pressed again", async () => {
    prepared();
    const bytes = uploads();
    const { signer, onSigned } = draw(comment());
    await pickInto("comment-edit-media-input", [picture("a.jpg")]);
    fireEvent.click(save());
    await bytes.answer("fail");
    fireEvent.click(await screen.findByTestId("commentEdit.gate.retry"));
    await bytes.answer("land");
    await waitFor(() => expect(gate()).not.toBeInTheDocument());
    expect(signer.signStaged).not.toHaveBeenCalled();
    fireEvent.click(save());
    await waitFor(() => expect(onSigned).toHaveBeenCalled());
  });

  // CommentEdit.md: "press Remove it under the pictures GIVEN nothing else the
  // edit took is uploading -> the failed picture leaves the batch AND the gate
  // line goes AND Sign the edit is enabled".
  it("Remove it under the pictures takes the failed one out and un-gates Sign", async () => {
    prepared();
    const bytes = uploads();
    draw(comment([media("m1")]));
    await pickInto("comment-edit-media-input", [picture("a.jpg")]);
    await bytes.answer("fail");
    fireEvent.click(await screen.findByTestId("comment-edit-upload-error-remove"));
    await waitFor(() => expect(gate()).not.toBeInTheDocument());
    expect(screen.getByTestId("commentEdit.pictures.add")).toHaveTextContent("+ Add pictures · 1 of 4");
    expect(save()).not.toBeDisabled();
  });

  // copy-voice, *Refused files*: "That's more than a comment carries — up to
  // four pictures." — never a picture dropped in silence.
  it("refuses a fifth picture in words under the pictures, never in a dialog", async () => {
    uploads();
    draw(comment([media("m1"), media("m2"), media("m3")]));
    await pickInto("comment-edit-media-input", [picture("four.jpg"), picture("five.jpg")]);
    expect(await screen.findByTestId("comment-edit-refusals")).toHaveTextContent(
      "That's more than a comment carries — up to four pictures.",
    );
    expect(screen.getByTestId("commentEdit.pictures.add")).toHaveTextContent("+ Add pictures · 4 of 4");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  // CommentEdit.md: "the count the signing prepared differs from the count
  // the footer read -> the held press drops … AND NEVER anything is signed".
  it("drops the press when the prepared count is not the one the foot read", async () => {
    server.use(
      gqlLink.mutation("PrepareCommentEdit", () =>
        HttpResponse.json({
          data: {
            prepareCommentEdit: {
              __typename: "PrepareContentPayload",
              node: "c1",
              writes: ["a", "b"].map((id) => ({
                __typename: "PreparedWrite",
                id,
                family: "REVIEW",
                canonicalProposal: "cHJvcG9zYWw=",
                gcAfterEpochs: 8,
              })),
              userErrors: [],
            },
          },
        }),
      ),
    );
    const { signer } = draw(comment());
    fireEvent.change(await screen.findByTestId("commentEdit.words.input"), { target: { value: "New words." } });
    fireEvent.click(save());
    expect(await screen.findByTestId("comment-edit-signed-actions-subline")).toHaveTextContent(
      "The count changed while you were editing — check it, then sign again.",
    );
    expect(signer.signStaged).not.toHaveBeenCalled();
  });

  // CommentEdit.md: "the write rule refuses the edit -> nothing is staged or
  // spent AND the notice's fact ends …" / "press Not now on the write rule's
  // notice -> the notice goes AND the comment edit stands again with the
  // changes as they were".
  it("stands the write rule's notice, and Not now gives the edit back as it was", async () => {
    server.use(
      gqlLink.mutation("PrepareCommentEdit", () =>
        HttpResponse.json({
          data: {
            prepareCommentEdit: {
              __typename: "PrepareContentPayload",
              node: null,
              writes: [],
              userErrors: [{ __typename: "UserError", code: "WRITE_RULE_FAILED", field: null, message: "no" }],
            },
          },
        }),
      ),
    );
    const { signer } = draw(comment());
    fireEvent.change(await screen.findByTestId("commentEdit.words.input"), { target: { value: "New words." } });
    fireEvent.click(save());
    expect(await screen.findByTestId("comment-edit-write-rule")).toHaveTextContent(
      "Nothing was signed or spent — your edit is still here.",
    );
    expect(signer.signStaged).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("comment-edit-not-now"));
    expect(screen.queryByTestId("comment-edit-write-rule")).not.toBeInTheDocument();
    expect(screen.getByTestId("commentEdit.words.input")).toHaveValue("New words.");
  });
});

describe("CommentEditor — a clip's face (CommentEditVideo)", () => {
  // CommentEditVideo.md: "a picture comes back from the picker -> it passes
  // through the cover's crop, locked to the comment's square" … "the edit with
  // a new cover is signed -> the clip's attachment points at the new picture
  // AND NEVER the clip itself changes".
  it("crops the face at the comment's square and signs the clip pointing at it", async () => {
    let sent: { attachments: Record<string, unknown>[] } | null = null;
    prepared((input) => (sent = input as never));
    const bytes = uploads();
    const { onSigned } = draw(comment([CLIP]));
    fireEvent.click(await screen.findByTestId("commentEdit.cover.change"));
    await pickInto("comment-edit-cover-input", [picture("face.jpg")]);
    expect(await screen.findByTestId("comment-edit-cover-crop")).toHaveTextContent(
      "The cover takes the video's shape.",
    );
    fireEvent.click(screen.getByTestId("coverCrop.next"));
    expect(await screen.findByTestId("commentEdit.gate")).toHaveTextContent(
      "Uploading 0 of 1 — signing waits for the cover.",
    );
    expect(screen.getByTestId("commentEdit.acts.line")).toHaveTextContent("You're signing 1 thing");
    fireEvent.click(save());
    await bytes.answer("land");
    await waitFor(() => expect(onSigned).toHaveBeenCalled());
    expect(sent!.attachments).toEqual([
      expect.objectContaining({ mediaId: "clip-1", coverMediaId: "up-0", coverTaken: null }),
    ]);
  });

  // CommentEditVideo (round 24): A NEW FACE RIDES THE EDIT RECORD — staging it
  // when nothing has yet, adding nothing when it is already staged; `Cover
  // changed` is no row.
  it("adds nothing to the count when the edit's record is already staged", async () => {
    uploads();
    draw(comment([CLIP]));
    fireEvent.change(await screen.findByTestId("commentEdit.words.input"), { target: { value: "New words." } });
    expect(screen.getByTestId("commentEdit.acts.line")).toHaveTextContent("You're signing 1 thing");
    fireEvent.click(screen.getByTestId("commentEdit.cover.change"));
    await pickInto("comment-edit-cover-input", [picture("face.jpg")]);
    fireEvent.click(await screen.findByTestId("coverCrop.next"));
    await screen.findByTestId("commentEdit.gate");
    expect(screen.getByTestId("commentEdit.acts.line")).toHaveTextContent("You're signing 1 thing");
    expect(screen.queryByText("Cover changed")).not.toBeInTheDocument();
  });

  it("the cover crop's back arrow gives the cover row back, the picture unused", async () => {
    draw(comment([CLIP]));
    await pickInto("comment-edit-cover-input", [picture("face.jpg")]);
    await screen.findByTestId("comment-edit-cover-crop");
    fireEvent.click(screen.getByLabelText("Back to the edit"));
    expect(await screen.findByTestId("commentEdit.cover.change")).toBeInTheDocument();
    expect(screen.getByTestId("commentEdit.acts.line")).toHaveTextContent("Nothing to sign yet");
  });

  // CommentEditVideo.md: "press Remove it under the cover row -> the new cover
  // leaves the batch AND the cover row reads as it stood before the edit".
  it("Remove it under the cover row puts the face back as it stood", async () => {
    const bytes = uploads();
    draw(comment([CLIP]));
    await pickInto("comment-edit-cover-input", [picture("face.jpg")]);
    fireEvent.click(await screen.findByTestId("coverCrop.next"));
    await bytes.answer("fail");
    fireEvent.click(await screen.findByTestId("comment-edit-cover-error-remove"));
    await waitFor(() => expect(gate()).not.toBeInTheDocument());
    expect(screen.getByTestId("commentEdit.cover.thumb")).toBeInTheDocument();
    expect(save()).not.toBeDisabled();
  });

  // CommentEditVideo.md: "tap the clip's remove control -> the clip leaves
  // whole, taking the comment's media with it AND the comment is its words".
  it("takes the clip out whole, leaving the comment its words", async () => {
    let sent: { attachments: unknown[] | null } | null = null;
    prepared((input) => (sent = input as never));
    const { onSigned } = draw(comment([CLIP]));
    fireEvent.click(await screen.findByLabelText("Remove this video"));
    expect(screen.queryByTestId("commentEdit.video.thumb")).not.toBeInTheDocument();
    expect(screen.getByTestId("commentEdit.pictures.add")).toHaveTextContent("+ Add pictures · 0 of 4");
    fireEvent.click(save());
    await waitFor(() => expect(onSigned).toHaveBeenCalled());
    // An omitted gallery is a comment without one (api-spec.md, edit as complete state).
    expect(sent!.attachments ?? []).toEqual([]);
  });
});
