import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it } from "vitest";

import { gqlLink, startMswServer } from "@/test/msw";

import { findPublishedMatch, publishedMarkerText, publishedOn } from "./published-match";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

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
  // ComposeDetailsReused.md: the line names the earliest matching post — the
  // server's answer (`ownPublishedPlacement`), asked with the stage's uploads,
  // and the post's own date.
  it("asks once with the stage's uploads and names the post served", async () => {
    const asked: unknown[] = [];
    server.use(
      gqlLink.query("OwnPublishedPlacement", ({ variables }) => {
        asked.push(variables);
        return HttpResponse.json({
          data: { ownPublishedPlacement: { __typename: "Post", id: "p-old", createdAt: "2026-09-12T00:00:00Z" } },
        });
      }),
    );
    const outcome = await findPublishedMatch(client(), ["m1", "m2"]);
    expect(outcome).toEqual({
      kind: "success",
      value: { postId: "p-old", publishedAt: "2026-09-12T00:00:00Z" },
    });
    expect(asked).toEqual([{ mediaIds: ["m1", "m2"] }]);
  });

  // ComposeDetails.md: a match only in drafts, or only in other people's
  // posts, draws nothing — the server answers null for both.
  it("names nothing when no published post of the author carries the media", async () => {
    server.use(gqlLink.query("OwnPublishedPlacement", () => HttpResponse.json({ data: { ownPublishedPlacement: null } })));
    expect(await findPublishedMatch(client(), ["m1"])).toEqual({ kind: "success", value: null });
  });

  it("reads nothing for a stage with no landed media", async () => {
    const asked: unknown[] = [];
    server.use(
      gqlLink.query("OwnPublishedPlacement", ({ variables }) => {
        asked.push(variables);
        return HttpResponse.json({ data: { ownPublishedPlacement: null } });
      }),
    );
    expect(await findPublishedMatch(client(), [])).toEqual({ kind: "success", value: null });
    expect(asked).toEqual([]);
  });
});
