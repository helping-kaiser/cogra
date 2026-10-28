import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it } from "vitest";

import { fetchHashtagDetail, fetchTagNames, prepareTag } from "./topics-api";
import { DEFAULT_CONFIDENCE, DEFAULT_RELEVANCE } from "@/lib/topics/draft";
import { gqlLink, startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function hashtag(name: string, taggedContent: unknown[] = []) {
  return {
    __typename: "Hashtag",
    id: "ht-1",
    name: moderated(name),
    moderationStatus: "NORMAL",
    taggedContent,
  };
}

describe("fetchHashtagDetail", () => {
  it("maps a resolved topic", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () =>
        HttpResponse.json({ data: { hashtag: hashtag("rust") } }),
      ),
    );
    const outcome = await fetchHashtagDetail(client(), "rust");
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value?.name.value).toBe("rust");
    expect(outcome.value?.taggedContent).toEqual([]);
  });

  // D4: `hashtag(name:)` answers null only for a substrate-illegal
  // name — a well-formed but never-tagged name still resolves.
  it("serves null for a substrate-illegal name", async () => {
    server.use(
      gqlLink.query("HashtagDetail", () => HttpResponse.json({ data: { hashtag: null } })),
    );
    const outcome = await fetchHashtagDetail(client(), "münchen");
    expect(outcome).toEqual({ kind: "success", value: null });
  });

  it("fails on a transport fault", async () => {
    server.use(gqlLink.query("HashtagDetail", () => HttpResponse.error()));
    expect((await fetchHashtagDetail(client(), "rust")).kind).toBe("failed");
  });
});

describe("prepareTag", () => {
  // Both parameters are required on the wire — the server never fills a
  // stance in — so an untouched chip sends the pre-fill it showed (D13).
  it("sends the shown pre-fill, never null, for an untouched chip", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(
      gqlLink.mutation("PrepareTag", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({
          data: {
            prepareTag: {
              __typename: "PreparePayload",
              writes: [
                {
                  __typename: "PreparedWrite",
                  id: "w1",
                  family: "TAG",
                  canonicalProposal: "cHJvcG9zYWw=",
                },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    const outcome = await prepareTag(client(), {
      target: "p1",
      name: "rust",
      relevance: DEFAULT_RELEVANCE,
      confidence: DEFAULT_CONFIDENCE,
    });
    expect(outcome.kind).toBe("success");
    expect(variables).toEqual({
      input: { target: "p1", name: "rust", pDirected: 0.1, pInterest: 1 },
    });
  });

  // Un-tagging is a further tag at (0,0) (hashtag.md §4) — never
  // an erasure, just an ordinary priced record the fold reads as
  // withdrawn.
  it("sends (0,0) for the un-tag", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(
      gqlLink.mutation("PrepareTag", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({
          data: {
            prepareTag: {
              __typename: "PreparePayload",
              writes: [
                {
                  __typename: "PreparedWrite",
                  id: "w1",
                  family: "TAG",
                  canonicalProposal: "cHJvcG9zYWw=",
                },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    // The wrapper sends the pair it is handed; the un-tag hands it (0,0)
    // (hashtag.md §4).
    await prepareTag(client(), { target: "p1", name: "rust", relevance: 0, confidence: 0 });
    expect(variables).toEqual({
      input: { target: "p1", name: "rust", pDirected: 0, pInterest: 0 },
    });
  });

  it("refuses with the payload's userErrors", async () => {
    server.use(
      gqlLink.mutation("PrepareTag", () =>
        HttpResponse.json({
          data: {
            prepareTag: {
              __typename: "PreparePayload",
              writes: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "not a legal topic name",
                  code: "BAD_INPUT",
                  field: ["name"],
                },
              ],
            },
          },
        }),
      ),
    );
    const outcome = await prepareTag(client(), {
      target: "p1",
      name: "bad name",
      relevance: 0.1,
      confidence: 1,
    });
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") return;
    expect(outcome.errors[0].field).toEqual(["name"]);
  });
});

describe("fetchTagNames", () => {
  it("asks the topic cue for the typed name and reads the names in use", async () => {
    let asked: unknown = null;
    server.use(
      gqlLink.query("TagNames", ({ variables }) => {
        asked = variables;
        return HttpResponse.json({
          data: {
            search: {
              __typename: "SearchConnection",
              edges: [
                { __typename: "SearchEdge", node: { __typename: "Hashtag", id: "h1", name: moderated("salt") } },
                { __typename: "SearchEdge", node: { __typename: "Hashtag", id: "h2", name: moderated("saltmaps") } },
                // A redacted name has nothing to offer.
                { __typename: "SearchEdge", node: { __typename: "Hashtag", id: "h3", name: moderated(null) } },
              ],
            },
          },
        });
      }),
    );
    const outcome = await fetchTagNames(client(), "salt");
    expect(asked).toEqual({ query: "#salt", first: 8 });
    expect(outcome).toEqual({ kind: "success", value: ["salt", "saltmaps"] });
  });

  it("asks nothing for an empty name", async () => {
    expect(await fetchTagNames(client(), "")).toEqual({ kind: "success", value: [] });
  });

  it("fails on a transport fault", async () => {
    server.use(gqlLink.query("TagNames", () => HttpResponse.error()));
    expect((await fetchTagNames(client(), "salt")).kind).toBe("failed");
  });
});
