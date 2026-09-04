// The media surface: the generated filename, and the three outcome tiers of
// one upload. The transport is a plain link here — what is under test is the
// name the part carries and the mapping of the payload, not the multipart
// encoding, which belongs to the link's own suite.

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { uploadFilename, uploadMedia } from "./media-api";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

function uploadHandler(
  body: unknown,
  seen?: { input?: { coverMediaId?: string | null } },
) {
  return graphql.mutation("UploadMedia", ({ variables }) => {
    if (seen) seen.input = (variables as { input: { coverMediaId?: string | null } }).input;
    return HttpResponse.json({ data: { uploadMedia: body } });
  });
}

function payload(media: unknown, userErrors: unknown[] = []) {
  return { __typename: "UploadMediaPayload", media, userErrors };
}

function media(id: string) {
  return {
    __typename: "MediaAttachment",
    id,
    url: `https://media.example/${id}`,
    altText: null,
    status: "NORMAL",
    options: { __typename: "MediaOptions", aspectRatio: "1:1" },
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

  // A cover is part of what the video IS — an asset row is immutable once
  // written — so it is named on the call that creates the video, and omitted
  // entirely on every other call rather than sent as null.
  it("carries coverMediaId only when one was given", async () => {
    const seen: { input?: { coverMediaId?: string | null } } = {};
    server.use(uploadHandler(payload(media("m-2")), seen));

    await uploadMedia(client(), { blob });
    expect(seen.input).not.toHaveProperty("coverMediaId");

    await uploadMedia(client(), { blob, coverMediaId: "cover-1" });
    expect(seen.input?.coverMediaId).toBe("cover-1");
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
