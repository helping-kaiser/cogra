import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { fetchHashtagDetail, prepareTag } from "./topics-api";
import { startMswServer } from "@/test/msw";

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
      graphql.query("HashtagDetail", () =>
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
      graphql.query("HashtagDetail", () => HttpResponse.json({ data: { hashtag: null } })),
    );
    const outcome = await fetchHashtagDetail(client(), "münchen");
    expect(outcome).toEqual({ kind: "success", value: null });
  });

  it("fails on a transport fault", async () => {
    server.use(graphql.query("HashtagDetail", () => HttpResponse.error()));
    expect((await fetchHashtagDetail(client(), "rust")).kind).toBe("failed");
  });
});

describe("prepareTag", () => {
  it("omits relevance and confidence when not given, for the server defaults (D13)", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(
      graphql.mutation("PrepareTag", ({ variables: v }) => {
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
    const outcome = await prepareTag(client(), { target: "p1", name: "rust" });
    expect(outcome.kind).toBe("success");
    expect(variables).toEqual({
      input: { target: "p1", name: "rust", pDirected: null, pInterest: null },
    });
  });

  // Un-tagging is a further tag at relevance 0 (hashtag.md §4) — never
  // an erasure, just an ordinary priced record the fold reads as
  // withdrawn.
  it("sends relevance 0 for the un-tag", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(
      graphql.mutation("PrepareTag", ({ variables: v }) => {
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
    await prepareTag(client(), { target: "p1", name: "rust", relevance: 0 });
    expect(variables).toEqual({
      input: { target: "p1", name: "rust", pDirected: 0, pInterest: null },
    });
  });

  it("refuses with the payload's userErrors", async () => {
    server.use(
      graphql.mutation("PrepareTag", () =>
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
    const outcome = await prepareTag(client(), { target: "p1", name: "bad name" });
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") return;
    expect(outcome.errors[0].field).toEqual(["name"]);
  });
});
