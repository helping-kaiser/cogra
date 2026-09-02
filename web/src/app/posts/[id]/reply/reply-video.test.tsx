// A comment's video, as an author drives it — ReplyVideo taken 1:1.
//
// Its own file because of the mock below: jsdom decodes no video, so the probe
// and the frame capture are stubbed while the container sniff and the 50 MiB
// cap are left real, since those are the rules this composer is meant to apply.

import { act, fireEvent, screen } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { fakeWriteSigner } from "@/test/registration";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { ReplyWizard } from "./reply-wizard-view";

const FRAME = new Blob([new Uint8Array([9]) as BlobPart], { type: "image/png" });

vi.mock("@/lib/ui2/media/video", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ui2/media/video")>();
  return {
    ...actual,
    probeVideo: vi.fn(async () => ({ durationMs: 18_000, width: 1080, height: 1080 })),
    captureFrames: vi.fn(async () => [FRAME, FRAME, FRAME]),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// The remux is covered on its own in `strip-video.test.ts`, and Node cannot run
// a real one — left unmocked it fails the upload, and a FAILED tile correctly
// hides its duration and its remove button, which is not what these assert.
vi.mock("@/lib/ui2/media/strip-video", () => ({
  stripVideoMetadata: vi.fn(async () => ({
    blob: new Blob([new Uint8Array(new ArrayBuffer(8)) as BlobPart], { type: "video/mp4" }),
    tookMs: 3,
  })),
}));

const server = startMswServer();

const uploadOk = (id = "m1") =>
  graphql.mutation("UploadMedia", () =>
    HttpResponse.json({
      data: {
        uploadMedia: {
          __typename: "UploadMediaPayload",
          media: {
            __typename: "MediaAttachment",
            id,
            url: "https://media.test/x.webp",
            altText: null,
            status: "NORMAL",
            options: { __typename: "MediaOptions", aspectRatio: "1:1" },
          },
          userErrors: [],
        },
      },
    }),
  );

const target = {
  id: "post-1",
  kind: "post" as const,
  label: "The long way home",
  authorHandle: "ada",
  authorName: "Ada Okonkwo",
  avatarUrl: null,
  snippet: "The light does something at the third headland",
};

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
  return store;
}

/**
 * jsdom has no canvas and no WebP encoder, so the COVER's encode is stubbed.
 * Without it the cover fails, which fails the video with it — and a failed tile
 * correctly hides its duration and its remove button, which several of these
 * assert the presence of.
 */
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
}

beforeEach(() => {
  installEncoder();
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:x", configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
});

afterEach(() => vi.unstubAllGlobals());

/** A real MP4 header, so the container sniff passes for the right reason. */
function mp4Bytes(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(32));
  const write = (text: string, at: number) => {
    for (let i = 0; i < 4; i += 1) bytes[at + i] = text.charCodeAt(i);
  };
  bytes[3] = 16;
  write("ftyp", 4);
  write("isom", 8);
  return bytes;
}

function aVideo(sizeBytes?: number): File {
  const made = new File([mp4Bytes() as BlobPart], "clip.mp4", { type: "video/mp4" });
  if (sizeBytes !== undefined) Object.defineProperty(made, "size", { value: sizeBytes });
  return made;
}

const aPicture = () =>
  new File([new Uint8Array([1, 2, 3]) as BlobPart], "shot.jpg", { type: "image/jpeg" });

function draw() {
  const onLeave = vi.fn();
  const onSigned = vi.fn();
  renderWithProviders(
    <ReplyWizard
      target={target}
      store={fakeIdentityStore({ keyOnDevice: true })}
      onLeave={onLeave}
      onSigned={onSigned}
    />,
    { store: signedInStore(), writeSigner: fakeWriteSigner() },
  );
  return { onLeave, onSigned };
}

/** The clip's tile carries a generated id, so it is found by its remove label. */
function removeClip() {
  return screen.getByLabelText("Remove this video");
}

async function pickFiles(files: readonly File[]) {
  const input = await screen.findByTestId("reply-media-input");
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
  // The screening reads bytes before anything joins the comment.
  await act(async () => {});
}

function write(words: string) {
  fireEvent.change(screen.getByTestId("reply-words"), { target: { value: words } });
}

describe("a comment's video", () => {
  it("takes the body whole and offers its face inline", async () => {
    draw();
    await pickFiles([aVideo()]);

    // No stage between: the cover row is in the composer the author is on.
    expect(await screen.findByTestId("reply-cover-frame-0")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("reply-cover-picture")).toBeInTheDocument();
  });

  it("asks for one description of the clip, and none of its cover", async () => {
    draw();
    await pickFiles([aVideo()]);

    const counter = await screen.findByTestId("reply-describe-counter");
    expect(counter).toHaveTextContent("Describe the video");
    expect(counter.parentElement).toHaveTextContent("0 of 1 described");
  });

  it("shows the clip's length on the composer's own tile", async () => {
    server.use(uploadOk());
    draw();
    await pickFiles([aVideo()]);
    // Authoring-side only — the thread's copy wears no duration at all. The
    // tile's id is generated, so the length is found by what it says.
    expect(await screen.findByText("0:18")).toBeInTheDocument();
  });

  it("offers no way to add once a video is the body", async () => {
    draw();
    await pickFiles([aVideo()]);
    await screen.findByTestId("reply-cover-frame-0");
    expect(screen.queryByTestId("reply-add-media")).toBeNull();
  });

  it("returns the composer to words when the clip is removed", async () => {
    server.use(uploadOk());
    draw();
    await pickFiles([aVideo()]);
    await screen.findByTestId("reply-cover-frame-0");
    fireEvent.click(removeClip());
    // ReplyVideo's remove-× leads back to ReplyCompose.
    expect(await screen.findByTestId("reply-add-media")).toHaveTextContent(
      "+ Add pictures or a video",
    );
    expect(screen.queryByTestId("reply-cover-frame-0")).toBeNull();
  });

  it("refuses a clip over the comment's own cap, in the board's words", async () => {
    draw();
    await pickFiles([aVideo(60 * 1024 * 1024)]);

    expect(await screen.findByTestId("reply-refusals")).toHaveTextContent(
      "That video is too big — a comment's video can be up to 50 MB.",
    );
    // And the composer is untouched: a refused file never joined it.
    expect(screen.getByTestId("reply-add-media")).toBeInTheDocument();
  });

  it("refuses a video beside pictures, keeping what was already picked", async () => {
    draw();
    await pickFiles([aPicture()]);
    await pickFiles([aVideo()]);

    expect(await screen.findByTestId("reply-refusals")).toHaveTextContent(
      "A comment carries pictures or one video, not both.",
    );
    expect(screen.getByTestId("reply-add-media")).toHaveTextContent("+ Add pictures · 1 of 4");
  });

  it("keeps refusal lines until each is dismissed", async () => {
    draw();
    await pickFiles([
      new File([new Uint8Array(4) as BlobPart], "notes.txt", { type: "text/plain" }),
      new File([new Uint8Array(4) as BlobPart], "readme.md", { type: "text/markdown" }),
    ]);

    const list = await screen.findByTestId("reply-refusals");
    expect(list.querySelectorAll("li")).toHaveLength(2);
    fireEvent.click(screen.getAllByText("Remove it")[0]!);
    expect(screen.getByTestId("reply-refusals").querySelectorAll("li")).toHaveLength(1);
  });

  it("still reaches the seal on words alone when nothing attached", async () => {
    // ReplyMediaErrors' Next: "the words alone — nothing was attached".
    draw();
    await pickFiles([new File([new Uint8Array(4) as BlobPart], "n.txt", { type: "text/plain" })]);
    write("the words stand on their own");
    fireEvent.click(screen.getByTestId("reply-next"));
    expect(await screen.findByTestId("reply-seal")).toBeInTheDocument();
  });
});
