import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  fetchPostDetail,
  fetchPosts,
  prepareComment,
  preparePost,
  preparePostEdit,
} from "./content-api";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

function moderated(value: string | null, status = "NORMAL") {
  return { __typename: "ModeratedText", value, status };
}

function post(id: string, overrides: Record<string, unknown> = {}) {
  return {
    __typename: "Post",
    id,
    title: moderated("Hello"),
    description: moderated(null),
    content: moderated("body"),
    author: { __typename: "User", id: "u1", handle: "alice" },
    createdAt: "2026-08-12T10:00:00Z",
    updatedAt: "2026-08-12T10:00:00Z",
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    references: [],
    ...overrides,
  };
}

function pageInfo(hasNextPage: boolean, endCursor: string | null) {
  return { __typename: "PageInfo", hasNextPage, endCursor };
}

describe("fetchPosts", () => {
  it("maps the page and its cursor", async () => {
    server.use(
      graphql.query("Posts", () =>
        HttpResponse.json({
          data: {
            posts: {
              __typename: "PostConnection",
              edges: [{ __typename: "PostEdge", node: post("p1") }],
              pageInfo: pageInfo(true, "c1"),
            },
          },
        }),
      ),
    );
    const outcome = await fetchPosts(client());
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.items.map((p) => p.id)).toEqual(["p1"]);
    expect(outcome.value.items[0].title.value).toBe("Hello");
    expect(outcome.value.endCursor).toBe("c1");
    expect(outcome.value.hasNextPage).toBe(true);
  });

  it("fails on a transport fault", async () => {
    server.use(graphql.query("Posts", () => HttpResponse.error()));
    expect((await fetchPosts(client())).kind).toBe("failed");
  });

  // The listing serves pending entries unless the reader opts out
  // (api-spec.md "Pagination"): the default rides every read, and false
  // asks for the settled graph.
  it("asks for pending entries by default and carries the landed-only opt-out", async () => {
    const asked: unknown[] = [];
    server.use(
      graphql.query("Posts", ({ variables }) => {
        asked.push(variables.includePending);
        return HttpResponse.json({
          data: {
            posts: {
              __typename: "PostConnection",
              edges: [],
              pageInfo: pageInfo(false, null),
            },
          },
        });
      }),
    );
    const c = client();
    await fetchPosts(c);
    await fetchPosts(c, null, { includePending: false });
    expect(asked).toEqual([true, false]);
  });
});

describe("fetchPostDetail", () => {
  it("maps the thread and serves null for an unknown id", async () => {
    server.use(
      graphql.query("PostDetail", ({ variables }) =>
        HttpResponse.json({
          data: {
            post:
              variables.id === "p1"
                ? {
                    ...post("p1", { author: null }),
                    comments: {
                      __typename: "CommentConnection",
                      edges: [
                        {
                          __typename: "CommentEdge",
                          node: {
                            __typename: "Comment",
                            id: "c1",
                            content: moderated("hi"),
                            author: { __typename: "User", id: "u2", handle: "bob" },
                            createdAt: "2026-08-12T10:05:00Z",
                            updatedAt: "2026-08-12T10:05:00Z",
                            landing: { __typename: "Landing", state: "LANDED" },
                            moderationStatus: "NORMAL",
                            license: {
                              __typename: "License",
                              attribution: 0,
                              provenance: 0,
                            },
                            topics: [],
                            references: [],
                          },
                        },
                      ],
                      pageInfo: pageInfo(false, null),
                    },
                  }
                : null,
          },
        }),
      ),
    );
    const c = client();
    const found = await fetchPostDetail(c, "p1");
    expect(found.kind).toBe("success");
    if (found.kind !== "success") return;
    expect(found.value?.post.author).toBeNull();
    expect(found.value?.comments.items.map((x) => x.id)).toEqual(["c1"]);

    const missing = await fetchPostDetail(c, "gone");
    expect(missing.kind).toBe("success");
    if (missing.kind !== "success") return;
    expect(missing.value).toBeNull();
  });
});

describe("preparePost", () => {
  const license = { attribution: 1, provenance: 0 };

  it("lifts the node and the staged writes", async () => {
    server.use(
      graphql.mutation("PreparePost", () =>
        HttpResponse.json({
          data: {
            preparePost: {
              __typename: "PrepareContentPayload",
              node: "node-1",
              writes: [
                {
                  __typename: "PreparedWrite",
                  id: "w1",
                  family: "PUBLISH",
                  canonicalProposal: "cHJvcG9zYWw=",
                  gcAfterEpochs: 8,
                },
              ],
              userErrors: [],
            },
          },
        }),
      ),
    );
    const outcome = await preparePost(client(), {
      title: "T",
      description: null,
      content: "B",
      license,
    });
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.node).toBe("node-1");
    expect(outcome.value.writes[0]).toMatchObject({ id: "w1", state: "AWAITING_PRE_SIGN" });
  });

  it("refuses with the payload's userErrors", async () => {
    server.use(
      graphql.mutation("PreparePost", () =>
        HttpResponse.json({
          data: {
            preparePost: {
              __typename: "PrepareContentPayload",
              node: null,
              writes: null,
              userErrors: [
                { __typename: "UserError", message: "not a member", code: "FORBIDDEN", field: null },
              ],
            },
          },
        }),
      ),
    );
    const outcome = await preparePost(client(), {
      title: null,
      description: null,
      content: "B",
      license,
    });
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") return;
    expect(outcome.errors[0].code).toBe("FORBIDDEN");
  });
});

describe("preparePostEdit", () => {
  it("sends explicit nulls for cleared fields", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(
      graphql.mutation("PreparePostEdit", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({
          data: {
            preparePostEdit: {
              __typename: "PrepareContentPayload",
              node: "p1",
              writes: [],
              userErrors: [],
            },
          },
        });
      }),
    );
    await preparePostEdit(client(), { id: "p1", title: null, description: null, content: "B" });
    expect(variables).toEqual({
      input: { id: "p1", title: null, description: null, content: "B" },
    });
  });
});

describe("prepareComment", () => {
  it("targets the post and carries the license", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(
      graphql.mutation("PrepareComment", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({
          data: {
            prepareComment: {
              __typename: "PrepareContentPayload",
              node: "c-node",
              writes: [
                {
                  __typename: "PreparedWrite",
                  id: "w1",
                  family: "REVIEW",
                  canonicalProposal: "cHJvcG9zYWw=",
                  gcAfterEpochs: 8,
                },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    const outcome = await prepareComment(client(), {
      target: "p1",
      content: "First!",
      license: { attribution: 0, provenance: 0.5 },
    });
    expect(outcome.kind).toBe("success");
    expect(variables).toEqual({
      input: {
        target: "p1",
        content: "First!",
        license: { attribution: 0, provenance: 0.5 },
        tags: null,
        references: null,
      },
    });
  });

  // A comment tags at creation on the same terms as a post
  // (api-spec.md `PrepareCommentInput.tags`).
  it("carries drafted tags as structured input", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(
      graphql.mutation("PrepareComment", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({
          data: {
            prepareComment: {
              __typename: "PrepareContentPayload",
              node: "c-node",
              writes: [
                {
                  __typename: "PreparedWrite",
                  id: "w1",
                  family: "REVIEW",
                  canonicalProposal: "cHJvcG9zYWw=",
                  gcAfterEpochs: 8,
                },
                {
                  __typename: "PreparedWrite",
                  id: "w2",
                  family: "TAG",
                  canonicalProposal: "cHJvcG9zYWw=",
                  gcAfterEpochs: 8,
                },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    const outcome = await prepareComment(client(), {
      target: "p1",
      content: "First!",
      license: { attribution: 0, provenance: 0.5 },
      tags: [{ name: "rust", relevance: 0.4, confidence: 0.8 }],
    });
    expect(outcome.kind).toBe("success");
    expect(
      (variables as unknown as { input: { tags: unknown } } | null)?.input.tags,
    ).toEqual([{ name: "rust", pDirected: 0.4, pInterest: 0.8 }]);
    // The whole batch comes back for the one signing pass.
    if (outcome.kind === "success") expect(outcome.value.writes).toHaveLength(2);
  });
});
