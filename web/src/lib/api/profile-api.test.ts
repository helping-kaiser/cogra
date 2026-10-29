// The profile surface: the chronicle's row decisions, the three-valued avatar
// field, and the reads that carry them.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it } from "vitest";

import {
  fetchAuthorRecords,
  fetchMyProfile,
  fetchProfileByHandle,
  fetchProfileComments,
  fetchProfileFigures,
  fetchProfilePosts,
  mediaField,
  prepareProfileUpdate,
  PROFILE_PAGE_SIZE,
  rowLabel,
  type RecordNode,
} from "./profile-api";
import { gqlLink, startMswServer } from "@/test/msw";
import { answersComment, commentsPage, profileComment } from "@/test/profile-comment";
import { reelPost } from "@/test/reel";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

function node(family: string, over: Partial<RecordNode> = {}): RecordNode {
  return {
    __typename: "Record",
    id: "r-1",
    family,
    targetId: "mint:r-1",
    terminalId: null,
    target: null,
    terminal: null,
    ...over,
  } as unknown as RecordNode;
}

// THE CHRONICLE'S VERBS, ONE PER FAMILY (copy-voice, *The chronicle's verbs*,
// round 22): the verb reads the server's `act` (#324), never a genesis the
// client derives from the target's shape.
describe("rowLabel", () => {
  it("separates a post's or a comment's genesis from its edits by the act", () => {
    expect(rowLabel(node("PUBLISH", { act: "GENESIS" }))).toBe("Published a post");
    expect(rowLabel(node("PUBLISH", { act: "ORDINARY" }))).toBe("Edited a post");
    expect(rowLabel(node("REVIEW", { act: "GENESIS" }))).toBe("Commented");
    expect(rowLabel(node("REVIEW", { act: "ORDINARY" }))).toBe("Edited a comment");
  });

  // The genesis is the server's word: a record whose target LOOKS minted but
  // which the server reads as ORDINARY is an edit (the shape no longer decides).
  it("never derives the genesis from the target's shape", () => {
    expect(rowLabel(node("PUBLISH", { act: "ORDINARY", targetId: "mint:r-1" }))).toBe("Edited a post");
  });

  // The first registration record is the joining; every later one updates.
  it("reads the account's first registration as Joined, the rest as updates", () => {
    expect(rowLabel(node("REGISTRATION", { act: "GENESIS" }))).toBe("Joined");
    expect(rowLabel(node("REGISTRATION", { act: "GENESIS" }), true)).toBe("Joined");
    expect(rowLabel(node("REGISTRATION", { act: "ORDINARY" }))).toBe("Updated their profile");
    expect(rowLabel(node("REGISTRATION", { act: "ORDINARY" }), true)).toBe("Updated your profile");
  });

  // The reader's word is opinion; "stance" never reaches a screen. A
  // walk-back's records and the vouch that landed someone read their own.
  it("reads the opinion families as given, walked back or vouched", () => {
    expect(rowLabel(node("OPINION", { act: "ORDINARY" }))).toBe("Gave an opinion");
    expect(rowLabel(node("AFFINITY", { act: "ORDINARY" }))).toBe("Gave an opinion");
    expect(rowLabel(node("OPINION", { act: "WALK_BACK" }))).toBe("Walked back an opinion");
    expect(rowLabel(node("AFFINITY", { act: "WALK_BACK" }))).toBe("Walked back an opinion");
    expect(rowLabel(node("OPINION", { act: "VOUCH" }))).toBe("Vouched for");
  });

  // A tag at (0, 0) is its withdrawal (api-spec.md: "(0, 0) is the un-tag").
  it("reads a tag and its withdrawal on a post or a comment", () => {
    const post = { __typename: "Post", id: "p" } as unknown as RecordNode["target"];
    const comment = { __typename: "Comment", id: "c" } as unknown as RecordNode["target"];
    expect(rowLabel(node("TAG", { act: "ORDINARY", target: post, pDirected: 0.5, pInterest: 1 }))).toBe(
      "Tagged a post",
    );
    expect(rowLabel(node("TAG", { act: "ORDINARY", target: comment, pDirected: 0.5, pInterest: 1 }))).toBe(
      "Tagged a comment",
    );
    expect(rowLabel(node("TAG", { act: "ORDINARY", target: post, pDirected: 0, pInterest: 0 }))).toBe(
      "Un-tagged a post",
    );
  });

  // The cited node's class is the whole distinction (edges.md): a person cited
  // is a mention.
  it("reads a citation by what it cites", () => {
    const cites = (__typename: string) =>
      rowLabel(node("REFERENCE", { act: "ORDINARY", terminal: { __typename } as unknown as RecordNode["terminal"] }));
    expect(cites("Post")).toBe("Cited a post");
    expect(cites("Comment")).toBe("Cited a comment");
    expect(cites("User")).toBe("Mentioned");
  });

  // A family this build has no blessed verb for still gets a row (seam 247:
  // the fallback stays, unblessed).
  it("labels a family this build does not know", () => {
    expect(rowLabel(node("SOMETHING_NEWER", { act: "ORDINARY" }))).toBe("Did something");
  });
});

// THE HEADER'S FIGURES (open-questions.md Q35, closed 2026-10-28, jakob's
// confirmation pending): three record counts, each its own `totalCount`.
describe("fetchProfileFigures", () => {
  it("reads the three counts off the one read", async () => {
    let asked: unknown;
    server.use(
      gqlLink.query("ProfileFigures", ({ variables }) => {
        asked = variables;
        return HttpResponse.json({
          data: {
            user: {
              __typename: "User",
              id: "u-1",
              posts: { __typename: "RecordConnection", totalCount: 5 },
              opinionsOn: { __typename: "RecordConnection", totalCount: 1204 },
              opinionsBy: { __typename: "RecordConnection", totalCount: null },
            },
          },
        });
      }),
    );
    const outcome = await fetchProfileFigures(client(), "u-1");
    expect(asked).toEqual({ id: "u-1" });
    expect(outcome).toEqual({ kind: "success", value: { posts: 5, opinionsOn: 1204, opinionsBy: null } });
  });

  // The query's own recipes, read from the document the client sends, so a
  // count quietly changing its filter fails here.
  it("asks for genesis Publish records, Opinions toward the person, and theirs toward people", () => {
    const document = readFileSync(join(process.cwd(), "src", "lib", "graphql", "profile.graphql"), "utf-8");
    const figures = document.slice(document.indexOf("query ProfileFigures"));
    expect(figures).toContain("posts: outgoingRecords(family: PUBLISH, toKind: POST, genesis: true, first: 0)");
    expect(figures).toContain("opinionsOn: incomingRecords(family: OPINION, first: 0)");
    expect(figures).toContain("opinionsBy: outgoingRecords(family: OPINION, toKind: USER, first: 0)");
  });
});

describe("fetchProfilePosts", () => {
  it("reads the person's posts off their genesis Publish records, in the served order", async () => {
    let asked: unknown;
    server.use(
      gqlLink.query("ProfilePosts", ({ variables }) => {
        asked = variables;
        return HttpResponse.json({
          data: {
            user: {
              __typename: "User",
              id: "u-1",
              posts: {
                __typename: "RecordConnection",
                edges: [
                  { __typename: "RecordEdge", node: { __typename: "Record", id: "r-2", target: reelPost("p-2") } },
                  // A record whose post CoGra does not carry draws no blank card.
                  { __typename: "RecordEdge", node: { __typename: "Record", id: "r-x", target: null } },
                  { __typename: "RecordEdge", node: { __typename: "Record", id: "r-1", target: reelPost("p-1", "photo") } },
                ],
                pageInfo: { __typename: "PageInfo", hasNextPage: true, endCursor: "c-1" },
              },
            },
          },
        });
      }),
    );
    const outcome = await fetchProfilePosts(client(), "u-1", "c-0");
    expect(asked).toEqual({ id: "u-1", after: "c-0", includePending: true });
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.items.map((post) => post.id)).toEqual(["p-2", "p-1"]);
    expect(outcome.value.endCursor).toBe("c-1");
    expect(outcome.value.hasNextPage).toBe(true);
  });

  it("reads an unknown person as an empty view, and a fault as failed", async () => {
    server.use(gqlLink.query("ProfilePosts", () => HttpResponse.json({ data: { user: null } })));
    expect(await fetchProfilePosts(client(), "u-9")).toEqual({
      kind: "success",
      value: { items: [], endCursor: null, hasNextPage: false },
    });
    server.use(gqlLink.query("ProfilePosts", () => HttpResponse.error()));
    expect((await fetchProfilePosts(client(), "u-9")).kind).toBe("failed");
  });

  // The figure and the list are one filter, read from the document the client
  // sends: the Posts count can never disagree with the cards it counts.
  it("asks for exactly the records the Posts figure counts, ten to a page, each a whole card", () => {
    const document = readFileSync(join(process.cwd(), "src", "lib", "graphql", "profile.graphql"), "utf-8");
    const posts = document.slice(document.indexOf("query ProfilePosts"), document.indexOf("query ProfileComments"));
    expect(posts).toContain(
      "posts: outgoingRecords(family: PUBLISH, toKind: POST, genesis: true, first: 10, after: $after)",
    );
    expect(posts).toContain("...FeedPost");
  });
});

describe("fetchProfileComments", () => {
  it("reads the person's comments off their genesis Review records, in the served order", async () => {
    let asked: unknown;
    server.use(
      gqlLink.query("ProfileComments", ({ variables }) => {
        asked = variables;
        const page = commentsPage(
          "u-1",
          [
            profileComment("c-2", { replies: { __typename: "CommentConnection", totalCount: 2 } }),
            // A record whose comment CoGra does not carry draws no blank card.
            null,
            profileComment("c-1", { target: answersComment("c-0", "sol") }),
          ],
          "k-1",
        );
        return HttpResponse.json({ data: page });
      }),
    );
    const outcome = await fetchProfileComments(client(), "u-1", "k-0");
    expect(asked).toEqual({ id: "u-1", after: "k-0", includePending: true });
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.items.map((comment) => [comment.id, comment.replyCount])).toEqual([
      ["c-2", 2],
      ["c-1", 0],
    ]);
    expect(outcome.value.items[1]?.target?.__typename).toBe("Comment");
    expect(outcome.value.items[0]?.post?.id).toBe("p1");
    expect(outcome.value.endCursor).toBe("k-1");
    expect(outcome.value.hasNextPage).toBe(true);
  });

  it("reads an unknown person as an empty view, and a fault as failed", async () => {
    server.use(gqlLink.query("ProfileComments", () => HttpResponse.json({ data: { user: null } })));
    expect(await fetchProfileComments(client(), "u-9")).toEqual({
      kind: "success",
      value: { items: [], endCursor: null, hasNextPage: false },
    });
    server.use(gqlLink.query("ProfileComments", () => HttpResponse.error()));
    expect((await fetchProfileComments(client(), "u-9")).kind).toBe("failed");
  });

  // Every comment the person made, once, whatever it answers: the genesis
  // Review (never an edit), with no `toKind` — a Review's actor leg enters on
  // the parent, so `toKind: COMMENT` would keep the replies alone.
  it("asks for each comment's own Review record, any parent, ten to a page, each a whole card", () => {
    const document = readFileSync(join(process.cwd(), "src", "lib", "graphql", "profile.graphql"), "utf-8");
    const comments = document.slice(document.indexOf("query ProfileComments"), document.indexOf("query ProfileFigures"));
    expect(comments).toContain("comments: outgoingRecords(family: REVIEW, genesis: true, first: 10, after: $after)");
    expect(comments).toContain("...CommentFields");
    expect(comments).toContain("replies(first: 0, includePending: $includePending)");
  });
});

describe("mediaField", () => {
  // Omitted, cleared and replaced are three different instructions, and
  // `undefined` is the one that serialises to an absent field.
  it("keeps the three values apart", () => {
    expect(mediaField(undefined)).toBeUndefined();
    expect(mediaField("unchanged")).toBeUndefined();
    expect(mediaField({ clear: true })).toBeNull();
    expect(mediaField({ mediaId: "m-9" })).toBe("m-9");
  });
});

function profile(id: string, handle: string) {
  return {
    __typename: "User",
    id,
    handle,
    displayName: { __typename: "ModeratedText", value: "Ada", status: "NORMAL" },
    bio: { __typename: "ModeratedText", value: null, status: "NORMAL" },
    websiteUrl: { __typename: "ModeratedText", value: null, status: "NORMAL" },
    avatar: null,
  };
}

describe("the profile reads", () => {
  it("maps a resolved handle", async () => {
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u-1", "ada") } }),
      ),
    );
    const outcome = await fetchProfileByHandle(client(), "ada");
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value?.handle).toBe("ada");
  });

  // An unknown handle is a `success` carrying null, not a refusal: nothing
  // went wrong, there is simply nobody there.
  it("serves null for an unknown handle", async () => {
    server.use(gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: null } })));
    expect(await fetchProfileByHandle(client(), "nobody")).toEqual({
      kind: "success",
      value: null,
    });
  });

  it("reports a transport fault as failed", async () => {
    server.use(gqlLink.query("MyProfile", () => HttpResponse.error()));
    expect((await fetchMyProfile(client())).kind).toBe("failed");
  });
});

describe("fetchAuthorRecords", () => {
  function records(edges: unknown[], hasNextPage = false, endCursor: string | null = null) {
    return {
      __typename: "RecordConnection",
      edges,
      pageInfo: { __typename: "PageInfo", hasNextPage, endCursor },
    };
  }

  it("maps edges to rows and carries the page shape", async () => {
    server.use(
      gqlLink.query("AuthorRecords", () =>
        HttpResponse.json({
          data: {
            records: records(
              [
                {
                  __typename: "RecordEdge",
                  node: {
                    __typename: "Record",
                    id: "r-1",
                    family: "PUBLISH",
                    act: "GENESIS",
                    targetId: "mint:r-1",
                    terminalId: null,
                    landedAt: "2026-10-20T10:00:00Z",
                    pDirected: 0,
                    pInterest: 0,
                    severed: null,
                    target: {
                      __typename: "Post",
                      id: "p-1",
                      title: { __typename: "ModeratedText", value: "A title" },
                      content: { __typename: "ModeratedText", value: "body" },
                    },
                    terminal: null,
                  },
                },
              ],
              true,
              "cursor-1",
            ),
          },
        }),
      ),
    );
    const outcome = await fetchAuthorRecords(client(), "u-1");
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.items).toEqual([
      {
        id: "r-1",
        kind: "post",
        label: "Published a post",
        aside: null,
        snippet: "A title",
        postId: "p-1",
        landedAt: "2026-10-20T10:00:00Z",
        face: null,
        cited: null,
        mentioned: null,
      },
    ]);
    expect(outcome.value.endCursor).toBe("cursor-1");
    expect(outcome.value.hasNextPage).toBe(true);
  });

  // An opinion on a person wears its own face and names them (`on @mira`);
  // it has nowhere to open.
  it("gives an opinion on a person its face and its name", async () => {
    server.use(
      gqlLink.query("AuthorRecords", () =>
        HttpResponse.json({
          data: {
            records: records([
              {
                __typename: "RecordEdge",
                node: {
                  __typename: "Record",
                  id: "r-2",
                  family: "OPINION",
                  act: "ORDINARY",
                  targetId: "prof:mira",
                  terminalId: null,
                  landedAt: "2026-10-19T10:00:00Z",
                  pDirected: 0.4,
                  pInterest: 0.5,
                  severed: false,
                  target: { __typename: "User", id: "u-9", handle: "mira" },
                  terminal: null,
                },
              },
            ]),
          },
        }),
      ),
    );
    const outcome = await fetchAuthorRecords(client(), "u-1", null, true);
    if (outcome.kind !== "success") throw new Error(outcome.kind);
    expect(outcome.value.items[0]).toMatchObject({
      kind: "opinion",
      label: "Gave an opinion",
      aside: "on @mira",
      snippet: null,
      postId: null,
      face: { pDirected: 0.4, pInterest: 0.5, severed: false },
    });
  });

  // The chronicle stands on Everything alone, every family the person signed:
  // the Posts and Comments tabs are card views on reads of their own
  // (`fetchProfilePosts`, `fetchProfileComments`).
  it("reads every family, never one tab's", async () => {
    const seen: unknown[] = [];
    server.use(
      gqlLink.query("AuthorRecords", ({ variables }) => {
        seen.push(variables);
        return HttpResponse.json({ data: { records: records([]) } });
      }),
    );
    await fetchAuthorRecords(client(), "u-1", "c-0");
    expect(seen).toEqual([{ author: "u-1", first: PROFILE_PAGE_SIZE, after: "c-0" }]);
  });

  it("asks for the page size the chronicle pages by", async () => {
    let first: number | undefined;
    server.use(
      gqlLink.query("AuthorRecords", ({ variables }) => {
        first = (variables as { first: number }).first;
        return HttpResponse.json({ data: { records: records([]) } });
      }),
    );
    await fetchAuthorRecords(client(), "u-1");
    expect(first).toBe(PROFILE_PAGE_SIZE);
  });
});

describe("prepareProfileUpdate", () => {
  it("sends the three-valued avatar field and maps the staged writes", async () => {
    let input: { avatarMediaId?: string | null } | undefined;
    server.use(
      gqlLink.mutation("PrepareProfileUpdate", ({ variables }) => {
        input = (variables as { input: { avatarMediaId?: string | null } }).input;
        return HttpResponse.json({
          data: {
            prepareProfileUpdate: {
              __typename: "PrepareProfileUpdatePayload",
              writes: [
                {
                  __typename: "StagedWrite",
                  id: "sw-1",
                  family: "REGISTRATION",
                  canonicalProposal: "AA==",
                  gcAfterEpochs: 3,
                },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    const outcome = await prepareProfileUpdate(client(), {
      displayName: "Ada",
      bio: null,
      websiteUrl: null,
      avatar: { clear: true },
    });
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.map((write) => write.id)).toEqual(["sw-1"]);
    expect(input?.avatarMediaId).toBeNull();
  });

  it("surfaces a refusal with its field path", async () => {
    server.use(
      gqlLink.mutation("PrepareProfileUpdate", () =>
        HttpResponse.json({
          data: {
            prepareProfileUpdate: {
              __typename: "PrepareProfileUpdatePayload",
              writes: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "nope",
                  code: "BAD_INPUT",
                  field: ["websiteUrl"],
                },
              ],
            },
          },
        }),
      ),
    );
    const outcome = await prepareProfileUpdate(client(), {
      displayName: "Ada",
      bio: null,
      websiteUrl: "not a url",
    });
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") return;
    expect(outcome.errors[0]?.field).toEqual(["websiteUrl"]);
  });
});
