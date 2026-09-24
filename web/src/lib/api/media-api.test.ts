// The media surface: the generated filename, and the three outcome tiers of
// one upload. The transport is a plain link here — what is under test is the
// name the part carries and the mapping of the payload, not the multipart
// encoding, which belongs to the link's own suite.

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  fetchMediaAttachmentStatus,
  uploadFilename,
  uploadMedia,
  uploadVideo,
  UploadPartsError,
} from "./media-api";
import type { PartUploader } from "./part-uploader";
import type { AuthGuard } from "@/lib/session/guard";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

function uploadHandler(body: unknown) {
  return graphql.mutation("UploadMedia", () => {
    return HttpResponse.json({ data: { uploadMedia: body } });
  });
}

function payload(media: unknown, userErrors: unknown[] = []) {
  return { __typename: "UploadMediaPayload", media, userErrors };
}

function media(id: string, extra: Record<string, unknown> = {}) {
  return {
    __typename: "MediaAttachment",
    id,
    url: `https://media.example/${id}`,
    altText: null,
    status: "NORMAL",
    mimeType: "image/webp",
    options: { __typename: "MediaOptions", aspectRatio: "1:1", durationMs: null },
    coverMedia: null,
    state: "READY",
    failureReason: null,
    ...extra,
  };
}

describe("uploadFilename", () => {
  // The picked file's own name never leaves the device: it can itself be
  // personal data, and nothing downstream reads it.
  it("names the part after the type's subtype", () => {
    expect(uploadFilename("image/webp")).toBe("upload.webp");
    expect(uploadFilename("video/mp4")).toBe("upload.mp4");
  });

  it("falls back to a name rather than upload.undefined", () => {
    expect(uploadFilename("")).toBe("upload.bin");
    expect(uploadFilename("notamimetype")).toBe("upload.bin");
  });

  it("defaults to the encoder's own output type", () => {
    expect(uploadFilename()).toBe("upload.webp");
  });
});

describe("uploadMedia", () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });

  it("maps the uploaded asset back", async () => {
    server.use(uploadHandler(payload(media("m-1"))));
    const outcome = await uploadMedia(client(), { blob });
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.id).toBe("m-1");
  });

  it("surfaces a refusal with its code", async () => {
    server.use(
      uploadHandler(
        payload(null, [
          { __typename: "UserError", message: "too large", code: "BAD_INPUT", field: ["file"] },
        ]),
      ),
    );
    const outcome = await uploadMedia(client(), { blob });
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") return;
    expect(outcome.errors[0]?.code).toBe("BAD_INPUT");
  });

  it("reports a transport fault as failed, not refused", async () => {
    server.use(graphql.mutation("UploadMedia", () => HttpResponse.error()));
    expect((await uploadMedia(client(), { blob })).kind).toBe("failed");
  });
});

describe("uploadVideo", () => {
  const passthrough: AuthGuard = { run: (block) => block(), prime: async () => {} };

  /** A parts run with no network: what it was asked for, and what it answers. */
  function uploader(failure: string | null = null) {
    const seen: {
      uploadId?: string;
      blob?: Blob;
      partSizeBytes?: number;
      partCount?: number;
    } = {};
    const stub: PartUploader = {
      async sendAll(uploadId, blob, partSizeBytes, partCount) {
        Object.assign(seen, { uploadId, blob, partSizeBytes, partCount });
        return failure;
      },
    };
    return { seen, stub };
  }

  function beginHandler(
    upload: unknown,
    userErrors: unknown[] = [],
    seen?: { declaredBytes?: number; kind?: string; scale?: string },
  ) {
    return graphql.mutation("BeginMediaUpload", ({ variables }) => {
      if (seen) Object.assign(seen, variables);
      return HttpResponse.json({
        data: { beginMediaUpload: { __typename: "BeginMediaUploadPayload", upload, userErrors } },
      });
    });
  }

  function session(id = "sess-1", partSizeBytes = 8 * 1024 * 1024, partCount = 2) {
    return { __typename: "MediaUploadSession", id, partSizeBytes, partCount };
  }

  function completeHandler(
    body: unknown,
    seen?: { uploadId?: string },
  ) {
    return graphql.mutation("CompleteMediaUpload", ({ variables }) => {
      if (seen) Object.assign(seen, variables);
      return HttpResponse.json({ data: { completeMediaUpload: body } });
    });
  }

  const big = (bytes: number) =>
    new Blob([new Uint8Array(bytes) as BlobPart], { type: "video/mp4" });

  it("sends a small clip in one request rather than opening a session", async () => {
    // A session is three round trips and a server-side row; under the
    // threshold it buys nothing the single-shot route does not already give.
    server.use(uploadHandler(payload(media("m-small"))));
    const parts = uploader();
    const outcome = await uploadVideo(
      client(),
      passthrough,
      { blob: big(1024), scale: "POST" },
      { uploader: parts.stub },
    );
    expect(outcome.kind).toBe("success");
    expect(parts.seen.uploadId).toBeUndefined();
  });

  it("takes the parts path at the threshold and no earlier", async () => {
    server.use(beginHandler(session()), completeHandler(payload(media("m-big"))));
    const parts = uploader();
    const outcome = await uploadVideo(
      client(),
      passthrough,
      { blob: big(64), scale: "POST" },
      { uploader: parts.stub, thresholdBytes: 64 },
    );
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.id).toBe("m-big");
    expect(parts.seen.uploadId).toBe("sess-1");
  });

  it("sends the parts at the cut the SERVER dictated, not one of its own", async () => {
    // Guessing the cut wrong is only discovered at assembly, which is why the
    // session carries it and the client never computes it.
    server.use(
      beginHandler(session("sess-2", 4 * 1024 * 1024, 7)),
      completeHandler(payload(media("m-big"))),
    );
    const parts = uploader();
    await uploadVideo(
      client(),
      passthrough,
      { blob: big(64), scale: "POST" },
      { uploader: parts.stub, thresholdBytes: 64 },
    );
    expect(parts.seen.partSizeBytes).toBe(4 * 1024 * 1024);
    expect(parts.seen.partCount).toBe(7);
  });

  it("declares the byte count it is about to send and names the video kind", async () => {
    const seen: { declaredBytes?: number; kind?: string } = {};
    server.use(beginHandler(session(), [], seen), completeHandler(payload(media("m"))));
    await uploadVideo(
      client(),
      passthrough,
      { blob: big(4096), scale: "POST" },
      { uploader: uploader().stub, thresholdBytes: 64 },
    );
    expect(seen.declaredBytes).toBe(4096);
    // STILL exists in the schema and is reserved; nothing names it.
    expect(seen.kind).toBe("VIDEO");
  });

  // The server sizes, re-encodes and validates a clip for the cap of the parent
  // it is headed for — a comment's is half a post's — so the destination rides
  // whichever path the clip's size takes.
  it("names the clip's destination on both paths", async () => {
    const opened: { scale?: string } = {};
    server.use(beginHandler(session(), [], opened), completeHandler(payload(media("m"))));
    await uploadVideo(
      client(),
      passthrough,
      { blob: big(4096), scale: "COMMENT" },
      { uploader: uploader().stub, thresholdBytes: 64 },
    );
    expect(opened.scale).toBe("COMMENT");

    let single: { input?: { scale?: string } } = {};
    server.use(
      graphql.mutation("UploadMedia", ({ variables }) => {
        single = variables as typeof single;
        return HttpResponse.json({ data: { uploadMedia: payload(media("m-small")) } });
      }),
    );
    await uploadVideo(
      client(),
      passthrough,
      { blob: big(16), scale: "COMMENT" },
      { uploader: uploader().stub, thresholdBytes: 64 },
    );
    expect(single.input?.scale).toBe("COMMENT");
  });

  // The clip names no poster of its own: a cover is a fact about the
  // placement, so the id rides `AttachmentInput` at prepare instead.
  it("completes the session by its id alone", async () => {
    const seen: { uploadId?: string } = {};
    server.use(beginHandler(session()), completeHandler(payload(media("m")), seen));
    await uploadVideo(
      client(),
      passthrough,
      { blob: big(4096), scale: "POST" },
      { uploader: uploader().stub, thresholdBytes: 64 },
    );
    expect(seen.uploadId).toBe("sess-1");
  });

  it("surfaces a refusal at begin without touching the parts", async () => {
    server.use(
      beginHandler(null, [
        { __typename: "UserError", message: "too large", code: "BAD_INPUT", field: ["declaredBytes"] },
      ]),
    );
    const parts = uploader();
    const outcome = await uploadVideo(
      client(),
      passthrough,
      { blob: big(4096), scale: "POST" },
      { uploader: parts.stub, thresholdBytes: 64 },
    );
    expect(outcome.kind).toBe("refused");
    expect(parts.seen.uploadId).toBeUndefined();
  });

  it("keeps the parts run's own sentence, and gives the parts back", async () => {
    let aborted: string | undefined;
    server.use(
      beginHandler(session()),
      graphql.mutation("AbortMediaUpload", ({ variables }) => {
        aborted = (variables as { uploadId: string }).uploadId;
        return HttpResponse.json({
          data: {
            abortMediaUpload: { __typename: "AbortMediaUploadPayload", aborted: true, userErrors: [] },
          },
        });
      }),
    );
    const outcome = await uploadVideo(
      client(),
      passthrough,
      { blob: big(4096), scale: "POST" },
      { uploader: uploader("The server would not take that video.").stub, thresholdBytes: 64 },
    );

    expect(outcome.kind).toBe("failed");
    if (outcome.kind !== "failed") return;
    // "Couldn't reach the server" would be a lie: the server answered.
    expect(outcome.cause).toBeInstanceOf(UploadPartsError);
    expect((outcome.cause as Error).message).toBe("The server would not take that video.");
    // The session is dead the moment the parts are abandoned.
    expect(aborted).toBe("sess-1");
  });

  it("guards each step on its own, so a refresh does not re-send the file", async () => {
    // The guard wraps begin and complete separately — never the parts, which
    // a replay would send twice.
    const wrapped: string[] = [];
    let n = 0;
    const counting: AuthGuard = {
      run: (block) => {
        wrapped.push(`call-${n++}`);
        return block();
      },
      prime: async () => {},
    };
    server.use(beginHandler(session()), completeHandler(payload(media("m"))));
    await uploadVideo(
      client(),
      counting,
      { blob: big(4096), scale: "POST" },
      { uploader: uploader().stub, thresholdBytes: 64 },
    );
    expect(wrapped).toEqual(["call-0", "call-1"]);
  });
});

describe("fetchMediaAttachmentStatus", () => {
  it("returns the asset when found", async () => {
    server.use(
      graphql.query("MediaAttachmentStatus", () =>
        HttpResponse.json({ data: { mediaAttachment: media("m-1", { state: "PROCESSING" }) } }),
      ),
    );
    const outcome = await fetchMediaAttachmentStatus(client(), "m-1");
    expect(outcome).toEqual({
      kind: "success",
      value: expect.objectContaining({ id: "m-1", state: "PROCESSING" }),
    });
  });

  it("returns success(null) for an asset this viewer cannot read", async () => {
    server.use(
      graphql.query("MediaAttachmentStatus", () =>
        HttpResponse.json({ data: { mediaAttachment: null } }),
      ),
    );
    expect(await fetchMediaAttachmentStatus(client(), "m-1")).toEqual({
      kind: "success",
      value: null,
    });
  });
});
