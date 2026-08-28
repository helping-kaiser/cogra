// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApolloClient } from "@apollo/client";
import { CENTERED } from "@/lib/ui2/media/crop";
import { runUpload, waitingAssets } from "./uploads";
import type { AssetUpload, PickedAsset } from "./wizard";

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
      { ...asset, crop: { zoom: 2, x: 0.5, y: 0.5 } },
      1,
      steps().step,
    );

    // A square shape out of a square source at zoom 2: half the source, drawn
    // at its own size because it is well inside the caps.
    expect(drawn).toEqual([{ w: 50, h: 50 }]);
  });

  it("sends the alt text with the bytes, because it cannot be added later", async () => {
    encodable();
    const client = clientAnswering({
      uploadMedia: { media: { id: "m" }, userErrors: [] },
    });

    await runUpload(client, asset, 1, steps().step);

    const variables = (client.mutate as ReturnType<typeof vi.fn>).mock.calls[0]![0].variables;
    expect(variables.input.altText).toBe("paper against the salt crust");
    expect(variables.input.file).toBeInstanceOf(File);
  });

  it("sends no alt text at all rather than an empty description", async () => {
    encodable();
    const client = clientAnswering({
      uploadMedia: { media: { id: "m" }, userErrors: [] },
    });

    await runUpload(client, { ...asset, altText: "   " }, 1, steps().step);

    const variables = (client.mutate as ReturnType<typeof vi.fn>).mock.calls[0]![0].variables;
    expect(variables.input.altText).toBeNull();
  });

  it("shows the server's own refusal, and leaves it retryable", async () => {
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
      message: "too many uploads, wait before retrying",
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
