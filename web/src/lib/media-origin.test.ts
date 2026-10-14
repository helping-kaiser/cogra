import { InMemoryCache, gql } from "@apollo/client";
import { describe, expect, it } from "vitest";

import { mediaTypePolicies, toSameOriginMediaUrl } from "./media-origin";

describe("toSameOriginMediaUrl", () => {
  it("drops the origin of a minted object URL", () => {
    expect(toSameOriginMediaUrl("https://192.168.0.5:3000/media/objects/x.webp")).toBe(
      "/media/objects/x.webp",
    );
  });

  it("keeps the query string of an upload URL", () => {
    expect(
      toSameOriginMediaUrl("https://192.168.0.5:3000/media/uploads/u1?token=abc&n=2"),
    ).toBe("/media/uploads/u1?token=abc&n=2");
  });

  it("leaves an external URL untouched", () => {
    expect(toSameOriginMediaUrl("https://media.test/1.webp")).toBe("https://media.test/1.webp");
  });

  it("leaves a non-URL string untouched", () => {
    expect(toSameOriginMediaUrl("not a url")).toBe("not a url");
  });

  it("leaves an already-relative media path untouched", () => {
    expect(toSameOriginMediaUrl("/media/objects/x.webp")).toBe("/media/objects/x.webp");
  });
});

describe("mediaTypePolicies", () => {
  const ATTACHMENT = gql`
    fragment MediaFields on MediaAttachment {
      id
      url
    }
  `;

  it("reads a cached MediaAttachment url back same-origin", () => {
    const cache = new InMemoryCache({ typePolicies: mediaTypePolicies });
    cache.writeFragment({
      id: "MediaAttachment:m1",
      fragment: ATTACHMENT,
      data: {
        __typename: "MediaAttachment",
        id: "m1",
        url: "https://192.168.0.5:3000/media/objects/x.webp",
      },
    });

    const read = cache.readFragment<{ url: string }>({
      id: "MediaAttachment:m1",
      fragment: ATTACHMENT,
    });

    expect(read?.url).toBe("/media/objects/x.webp");
  });
});
