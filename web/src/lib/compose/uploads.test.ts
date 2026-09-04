// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApolloClient } from "@apollo/client";
import { CENTERED } from "@/lib/ui2/media/crop";
import { runUpload, runVideoUpload, waitingAssets } from "./uploads";
import type { AssetUpload, CoverAsset, PickedAsset } from "./wizard";

// The remux is mocked: it is covered on its own in `strip-video.test.ts`, and
// Node cannot run a real one. What matters here is that the upload path calls
// it and sends ITS bytes rather than the picked ones.
const STRIPPED = new Blob([new Uint8Array(new ArrayBuffer(12)) as BlobPart], {
  type: "video/mp4",
});
const stripVideoMetadata = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui2/media/strip-video", () => ({ stripVideoMetadata }));

const asset: PickedAsset = {
  id: "a0",
  file: new Blob([new Uint8Array([1]) as BlobPart]),
  crop: CENTERED,
  altText: "paper against the salt crust",
  upload: { kind: "waiting" },
};

/** Collects the stages the run reports, which is the whole observable behaviour. */
function steps() {
  const seen: AssetUpload[] = [];
  return { seen, step: (next: AssetUpload) => seen.push(next) };
}

function clientAnswering(data: unknown): ApolloClient {
  return { mutate: vi.fn(async () => ({ data })) } as unknown as ApolloClient;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  stripVideoMetadata.mockReset();
  stripVideoMetadata.mockResolvedValue({ blob: STRIPPED, tookMs: 12 });
});

/** A canvas that encodes to fixed bytes, so the encode is not what is under test. */
function encodable() {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 100, height: 100, close: () => {} })),
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
      return new Blob([new Uint8Array(4) as BlobPart], { type });
    }
  }
  vi.stubGlobal("OffscreenCanvas", Canvas);
}

describe("runUpload", () => {
  it("reports encoding, then uploading, then the id", async () => {
    encodable();
    const { seen, step } = steps();
    const client = clientAnswering({
      uploadMedia: { media: { id: "media-1" }, userErrors: [] },
    });

    await runUpload(client, asset, 4 / 5, step);

    expect(seen).toEqual([
      { kind: "encoding" },
      { kind: "uploading" },
      { kind: "done", mediaId: "media-1" },
    ]);
  });

  it("carries the crop and the shape into the encode", async () => {
    encodable();
    const drawn: { w: number; h: number }[] = [];
    class Canvas {
      constructor(
        public width: number,
        public height: number,
      ) {
        drawn.push({ w: width, h: height });
      }
      getContext() {
        return { drawImage: () => {} };
      }
      async convertToBlob({ type }: { type: string }) {
        return new Blob([new Uint8Array(4) as BlobPart], { type });
      }
    }
    vi.stubGlobal("OffscreenCanvas", Canvas);

    await runUpload(
      clientAnswering({ uploadMedia: { media: { id: "m" }, userErrors: [] } }),
      {
        ...asset,
        crop: {
          x: 0,
          y: 0,
          zoom: 2,
          area: { x: 25, y: 25, width: 50, height: 50 },
          areaPercent: { x: 25, y: 25, width: 50, height: 50 },
        },
      },
      1,
      steps().step,
    );

    // The rectangle the cropper measured is what is drawn — half the source,
    // at its own size because it is well inside the caps.
    expect(drawn).toEqual([{ w: 50, h: 50 }]);
  });

  it("sends the bytes and nothing the author typed", async () => {
    encodable();
    const client = clientAnswering({
      uploadMedia: { media: { id: "m" }, userErrors: [] },
    });

    await runUpload(client, asset, 1, steps().step);

    // The description belongs to the placement, not to the asset: it
    // rides `AttachmentInput` at prepare, which is what lets the upload
    // start the moment the picture is picked.
    const variables = (client.mutate as ReturnType<typeof vi.fn>).mock.calls[0]![0].variables;
    expect(variables.input).toEqual({ file: expect.any(File) });
  });

  // The refusal is read off its CODE, never off `UserError.message` — which the
  // contract calls developer-facing fallback text. A rate limit clears, so it
  // stays retryable.
  it("reads the refusal off its code, and leaves it retryable", async () => {
    encodable();
    const client = clientAnswering({
      uploadMedia: {
        media: null,
        userErrors: [
          { message: "too many uploads, wait before retrying", code: "RATE_LIMITED", field: null },
        ],
      },
    });
    const { seen, step } = steps();

    await runUpload(client, asset, 1, step);

    expect(seen.at(-1)).toEqual({
      kind: "failed",
      message: "Too many attempts — wait a moment and try again.",
      retryable: true,
    });
  });

  it("marks an unreachable server retryable and an unreadable picture not", async () => {
    encodable();
    const unreachable = {
      mutate: vi.fn(async () => {
        throw new Error("offline");
      }),
    } as unknown as ApolloClient;
    const network = steps();
    await runUpload(unreachable, asset, 1, network.step);
    expect(network.seen.at(-1)).toEqual({
      kind: "failed",
      message: "Couldn't reach the server.",
      retryable: true,
    });

    // No decoder at all: the picture never becomes bytes, so a retry is a lie.
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("cannot decode");
      }),
    );
    const broken = steps();
    await runUpload(clientAnswering({}), asset, 1, broken.step);
    expect(broken.seen).toEqual([
      { kind: "encoding" },
      { kind: "failed", message: "This browser couldn't read that picture.", retryable: false },
    ]);
  });

  it("never rejects, whatever fails", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );
    await expect(runUpload(clientAnswering({}), asset, 1, () => {})).resolves.toBeUndefined();
  });
});

// THE ORDER IS THE CONTRACT. A video names its cover on its own upload and an
// asset row is immutable once written, so there is no call that could attach a
// poster afterwards — the cover has to be a real asset before the video is
// created, and these assert exactly that.
describe("runVideoUpload", () => {
  const clip: PickedAsset = {
    ...asset,
    id: "v0",
    file: new Blob([new Uint8Array([0, 0, 0, 24]) as BlobPart], { type: "video/mp4" }),
    kind: "video",
  };
  const cover: CoverAsset = {
    id: "c0",
    file: new Blob([new Uint8Array([2]) as BlobPart], { type: "image/png" }),
    frame: 0,
    upload: { kind: "waiting" },
  };

  /** Answers the cover call and the video call with different ids, in order. */
  function clientAnsweringInTurn(...ids: readonly string[]): ApolloClient {
    let call = 0;
    return {
      mutate: vi.fn(async () => ({
        data: { uploadMedia: { media: { id: ids[call++] }, userErrors: [] } },
      })),
    } as unknown as ApolloClient;
  }

  it("uploads the cover first and names it on the video", async () => {
    encodable();
    const client = clientAnsweringInTurn("media-cover", "media-video");
    const video = steps();
    const poster = steps();

    await runVideoUpload(client, clip, cover, video.step, poster.step);

    const calls = (client.mutate as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    // The cover goes up as bytes alone…
    expect(calls[0]![0].variables.input).toEqual({ file: expect.any(File) });
    // …and the video names it.
    expect(calls[1]![0].variables.input).toEqual({
      file: expect.any(File),
      coverMediaId: "media-cover",
    });
    expect(poster.seen.at(-1)).toEqual({ kind: "done", mediaId: "media-cover" });
    expect(video.seen.at(-1)).toEqual({ kind: "done", mediaId: "media-video" });
  });

  it("sends the STRIPPED bytes, not the ones that were picked", async () => {
    encodable();
    const client = clientAnsweringInTurn("media-cover", "media-video");

    await runVideoUpload(client, clip, cover, steps().step, steps().step);

    expect(stripVideoMetadata).toHaveBeenCalledWith(clip.file);
    const sent = (client.mutate as ReturnType<typeof vi.fn>).mock.calls[1]![0].variables.input
      .file as File;
    expect(sent.type).toBe("video/mp4");
    expect(sent.name).toBe("upload.mp4");
    // The remuxed bytes, which is what makes the strip real rather than
    // decorative — uploading the picked file would carry its GPS tag along.
    expect(sent.size).toBe(STRIPPED.size);
  });

  it("refuses rather than uploading a video it could not strip", async () => {
    encodable();
    stripVideoMetadata.mockRejectedValueOnce(new Error("nope"));
    const client = clientAnsweringInTurn("media-cover", "media-video");
    const video = steps();

    await runVideoUpload(client, clip, cover, video.step, steps().step);

    // Falling back to the picked bytes would upload the file with its metadata
    // intact — the exact outcome the strip exists to prevent. And it is not
    // retryable: a second attempt cannot make the container readable.
    expect(video.seen.at(-1)).toEqual({
      kind: "failed",
      message: "This browser couldn't prepare that video.",
      retryable: false,
    });
    // The cover went up; the video never did.
    expect((client.mutate as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("fails the video when the cover fails, because the video cannot exist without it", async () => {
    encodable();
    const client = clientAnswering({
      uploadMedia: {
        media: null,
        userErrors: [{ message: "the file is larger than 10485760 bytes", code: "BAD_INPUT", field: ["file"] }],
      },
    });
    const video = steps();
    const poster = steps();

    await runVideoUpload(client, clip, cover, video.step, poster.step);

    // The refusal on the cover, named as a cover rather than as a file…
    expect(poster.seen.at(-1)).toEqual({
      kind: "failed",
      message: "That cover wasn't accepted — try a different one.",
      retryable: true,
    });
    // …and a video that never went up at all.
    expect(video.seen.at(-1)).toEqual({
      kind: "failed",
      message: "The cover didn't upload.",
      retryable: true,
    });
    expect((client.mutate as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("never rejects, whatever fails", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );
    await expect(
      runVideoUpload(clientAnswering({}), clip, cover, () => {}, () => {}),
    ).resolves.toBeUndefined();
  });
});

describe("waitingAssets", () => {
  it("picks out exactly what has not been started", () => {
    const assets: PickedAsset[] = [
      { ...asset, id: "a", upload: { kind: "waiting" } },
      { ...asset, id: "b", upload: { kind: "uploading" } },
      { ...asset, id: "c", upload: { kind: "done", mediaId: "m" } },
      { ...asset, id: "d", upload: { kind: "failed", message: "x", retryable: true } },
      { ...asset, id: "e", upload: { kind: "waiting" } },
    ];
    expect(waitingAssets(assets).map((a) => a.id)).toEqual(["a", "e"]);
  });
});
