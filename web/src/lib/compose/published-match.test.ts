import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it } from "vitest";

import { gqlLink, startMswServer } from "@/test/msw";

import {
  earliestMatch,
  findPublishedMatch,
  publishedMarkerText,
  publishedOn,
  type PlacedPost,
} from "./published-match";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

const post = (postId: string, createdAt: string, ...assets: [string, string][]): PlacedPost => ({
  postId,
  createdAt,
  assets: assets.map(([id, digest]) => ({ id, digest })),
});

describe("earliestMatch", () => {
  // ComposeDetailsReused.md: the line names the earliest matching post, and a
  // later post never repoints it.
  it("names the earliest of several matching posts", () => {
    const posts = [
      post("p-new", "2026-10-20T00:00:00Z", ["m1", "d1"]),
      post("p-old", "2026-09-12T00:00:00Z", ["m1", "d1"]),
      post("p-other", "2026-01-01T00:00:00Z", ["m9", "d9"]),
    ];
    expect(earliestMatch(posts, [{ mediaId: "m1", digest: "d1" }])).toEqual({
      postId: "p-old",
      publishedAt: "2026-09-12T00:00:00Z",
    });
  });

  it("matches a re-encoded upload by its rendition digest under another id", () => {
    const posts = [post("p-1", "2026-09-12T00:00:00Z", ["m-held", "d-rendition"])];
    expect(earliestMatch(posts, [{ mediaId: "m-upload", digest: "d-rendition" }])?.postId).toBe("p-1");
  });

  // ComposeDetails.md: a match only in drafts, or only in other people's
  // posts, draws nothing — neither is in the author's own chronicle.
  it("names nothing when no published post carries the media", () => {
    const posts = [post("p-1", "2026-09-12T00:00:00Z", ["m9", "d9"])];
    expect(earliestMatch(posts, [{ mediaId: "m1", digest: "d1" }])).toBeNull();
    expect(earliestMatch(posts, [])).toBeNull();
  });
});

describe("publishedOn", () => {
  const now = new Date("2026-10-28T12:00:00Z");

  it("reads day and month in the current year", () => {
    expect(publishedOn("2026-09-12T10:00:00Z", now, "en-GB")).toBe("12 September");
  });

  it("appends the year only when it differs from the current one", () => {
    expect(publishedOn("2025-09-12T10:00:00Z", now, "en-GB")).toBe("12 September 2025");
  });

  it("is the line's words, and the door's name", () => {
    expect(publishedMarkerText("12 September")).toBe("Already in your post from 12 September.");
  });
});

describe("findPublishedMatch", () => {
  it("pages the viewer's published posts to the end and names the earliest match", async () => {
    const asked: unknown[] = [];
    server.use(
      gqlLink.query("ViewerId", () =>
        HttpResponse.json({ data: { me: { __typename: "User", id: "u-me" } } }),
      ),
      gqlLink.query("OwnPublishedMedia", ({ variables }) => {
        asked.push(variables);
        const second = (variables as { after: string | null }).after === "c1";
        const node = (id: string, createdAt: string, mediaId: string) => ({
          __typename: "Record",
          id: `r-${id}`,
          target: {
            __typename: "Post",
            id,
            createdAt,
            attachments: [{ __typename: "MediaAttachment", id: mediaId, digest: `d-${mediaId}` }],
          },
        });
        return HttpResponse.json({
          data: {
            records: {
              __typename: "RecordConnection",
              edges: second
                ? [{ __typename: "RecordEdge", node: node("p-old", "2026-09-12T00:00:00Z", "m1") }]
                : [{ __typename: "RecordEdge", node: node("p-new", "2026-10-20T00:00:00Z", "m1") }],
              pageInfo: { __typename: "PageInfo", hasNextPage: !second, endCursor: second ? null : "c1" },
            },
          },
        });
      }),
    );
    const outcome = await findPublishedMatch(client(), [{ mediaId: "m1", digest: "d-m1" }]);
    expect(outcome).toEqual({
      kind: "success",
      value: { postId: "p-old", publishedAt: "2026-09-12T00:00:00Z" },
    });
    expect(asked).toEqual([
      { author: "u-me", first: 50, after: null },
      { author: "u-me", first: 50, after: "c1" },
    ]);
  });

  it("reads nothing for a stage with no landed media", async () => {
    expect(await findPublishedMatch(client(), [])).toEqual({ kind: "success", value: null });
  });
});
