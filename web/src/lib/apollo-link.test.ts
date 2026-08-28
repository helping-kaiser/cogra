// @vitest-environment jsdom
//
// The wire shape of an upload, asserted rather than assumed. `uploadMedia` is
// the app's only operation that carries bytes, and it rides the GraphQL
// multipart request spec — so what this file proves is that a mutation holding a
// `File` leaves as `multipart/form-data` with the spec's three parts, and that
// every other operation still leaves as the plain JSON POST it was before the
// terminating link changed.

import { ApolloClient, InMemoryCache, gql } from "@apollo/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authorizedLink } from "./apollo-link";
import type { TokenStore } from "@/lib/session/token-store";

const UPLOAD = gql`
  mutation Upload($input: UploadMediaInput!) {
    uploadMedia(input: $input) {
      media {
        id
      }
    }
  }
`;

const PLAIN = gql`
  mutation Plain($id: UUID!) {
    prepareStance(input: { target: $id }) {
      node
    }
  }
`;

function store(token: string | null): TokenStore {
  return { accessToken: () => token } as TokenStore;
}

/** Captures the one request the link makes, and answers it with an empty body. */
function captureFetch() {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchStub = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ data: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchStub);
  return calls;
}

function clientWith(token: string | null) {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: authorizedLink(store(token), "/graphql"),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the terminating link", () => {
  it("sends a file as a GraphQL multipart request", async () => {
    const calls = captureFetch();
    const file = new File([new Uint8Array([1, 2, 3]) as BlobPart], "shot.webp", {
      type: "image/webp",
    });

    await clientWith("t0ken").mutate({
      mutation: UPLOAD,
      variables: { input: { file, altText: "a salt crust" } },
    });

    const body = calls[0]!.init.body;
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;

    // The spec's three parts, in its own vocabulary.
    const operations = JSON.parse(form.get("operations") as string);
    expect(operations.variables.input.file).toBeNull();
    expect(operations.variables.input.altText).toBe("a salt crust");

    const map = JSON.parse(form.get("map") as string);
    expect(Object.values(map)).toEqual([["variables.input.file"]]);

    // …and the file itself, under the field name the map points at.
    // FormData copies what it is given, so the part is compared by what a server
    // reads off it rather than by identity.
    const fieldName = Object.keys(map)[0]!;
    const part = form.get(fieldName) as File;
    expect(part.name).toBe("shot.webp");
    expect(part.type).toBe("image/webp");
    expect(part.size).toBe(3);

    // The auth link still runs ahead of it: an upload is an authored act.
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer t0ken");
    // The boundary is the browser's to choose, so the link must NOT have set a
    // content type of its own — a hand-set one would break the parse.
    expect(headers["content-type"]).toBeUndefined();
  });

  it("leaves every fileless operation on the plain JSON POST", async () => {
    const calls = captureFetch();

    await clientWith(null).mutate({
      mutation: PLAIN,
      variables: { id: "11111111-1111-1111-1111-111111111111" },
    });

    const { init } = calls[0]!;
    expect(init.body).toBeTypeOf("string");
    expect(JSON.parse(init.body as string).variables.id).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
    const headers = init.headers as Record<string, string>;
    expect(headers["content-type"]).toContain("application/json");
    // No token in this tab: the request goes out anonymous rather than with an
    // empty bearer.
    expect(headers.authorization).toBeUndefined();
  });
});
