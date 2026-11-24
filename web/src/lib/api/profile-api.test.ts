// The profile surface: the chronicle's row decisions, the three-valued avatar
// field, and the reads that carry them.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it } from "vitest";

import {
  fetchMyProfile,
  fetchProfileByHandle,
  fetchProfileChronicle,
  fetchProfileComments,
  fetchProfileFigures,
  fetchProfilePosts,
  mediaField,
  prepareAvatarChange,
  prepareProfileUpdate,
  PROFILE_PAGE_SIZE,
  rowLabel,
  type RecordNode,
} from "./profile-api";
import { gqlLink, startMswServer } from "@/test/msw";
import { answersComment, commentsPage, profileComment, settlingComment } from "@/test/profile-comment";
import { reelPost } from "@/test/reel";
import { chroniclePage, settlingCommentEntry, settlingPostEntry } from "@/test/chronicle";

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

// THE HEADER'S FIGURES (open-questions.md Q35, ruled 2026-11-10): bundles,
// never records — Posts a `totalCount`, the two opinion figures `bundleCount`s.
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
              posts: { __typename: "PostConnection", totalCount: 5 },
              opinionsOn: { __typename: "RecordConnection", bundleCount: 1204 },
              opinionsBy: { __typename: "RecordConnection", bundleCount: null },
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
  // THE POSTS FIGURE IS THE POSTS LIST'S OWN COUNT (ProfilePosts.md:15,
  // ProfilePostsOwn.md:11; seam 395 item 1): `User.posts`' `totalCount` —
  // landed, still settling and removed, never an edit — the very connection
  // the Posts tab pages, so the figure and the list cannot disagree. The old
  // landed-only count (`outgoingRecords(family: PUBLISH …)`) must be gone.
  it("asks for the Posts list's own count, and the bundles of unmarked Opinions toward the person and theirs toward people", () => {
    const document = readFileSync(join(process.cwd(), "src", "lib", "graphql", "profile.graphql"), "utf-8");
    const figures = document.slice(document.indexOf("query ProfileFigures"));
    expect(figures).toContain("posts(first: 0) {\n      totalCount");
    expect(figures).not.toContain("family: PUBLISH");
    expect(figures).toContain(
      "opinionsOn: incomingRecords(family: OPINION, payloadMarked: false, first: 0) {\n      bundleCount",
    );
    expect(figures).toContain(
      "opinionsBy: outgoingRecords(family: OPINION, toKind: USER, payloadMarked: false, first: 0) {\n      bundleCount",
    );
  });
});

describe("fetchProfilePosts", () => {
  it("reads the person's posts off `User.posts`, each edge's node the post, in the served order", async () => {
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
                __typename: "PostConnection",
                edges: [
                  // A still-settling post heads the page, as the listing serves it.
                  {
                    __typename: "PostEdge",
                    cursor: "c-3",
                    node: reelPost("p-3", "photo", { landing: { __typename: "Landing", state: "PENDING" } }),
                  },
                  { __typename: "PostEdge", cursor: "c-2", node: reelPost("p-2") },
                  { __typename: "PostEdge", cursor: "c-1", node: reelPost("p-1", "photo") },
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
    expect(outcome.value.items.map((post) => post.id)).toEqual(["p-3", "p-2", "p-1"]);
    expect(outcome.value.items[0]?.landing.state).toBe("PENDING");
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

  // The figure and the list are one connection, read from the document the
  // client sends: the Posts count can never disagree with the cards it counts
  // (ProfilePosts.md:15). Still-settling posts ride it (ProfilePosts.md:7).
  it("asks for the connection the Posts figure counts, twenty to a page, each node a whole card", () => {
    const document = readFileSync(join(process.cwd(), "src", "lib", "graphql", "profile.graphql"), "utf-8");
    const posts = document.slice(document.indexOf("query ProfilePosts"), document.indexOf("query ProfileComments"));
    expect(posts).toContain("posts(first: 20, after: $after) {");
    expect(posts).not.toContain("outgoingRecords");
    expect(posts).not.toContain("includePending: false");
    expect(posts).toMatch(/node \{\s+\.\.\.FeedPost\s+\}/);
  });
});

describe("fetchProfileComments", () => {
  it("reads the person's comments off `User.comments`, each edge's node the comment, in the served order", async () => {
    let asked: unknown;
    server.use(
      gqlLink.query("ProfileComments", ({ variables }) => {
        asked = variables;
        const page = commentsPage(
          "u-1",
          [
            // A still-settling comment heads the page, as the listing serves it.
            settlingComment("c-3"),
            profileComment("c-2"),
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
    expect(outcome.value.items.map((comment) => comment.id)).toEqual(["c-3", "c-2", "c-1"]);
    expect(outcome.value.items[0]?.landing.state).toBe("PENDING");
    expect(outcome.value.items[2]?.target?.__typename).toBe("Comment");
    expect(outcome.value.items[1]?.post?.id).toBe("p1");
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

  // Every comment the person made, once, whatever it answers, never an edit —
  // the still-settling ones included (ProfileComments.md:5) — off the
  // person's own comment listing, each node a whole card.
  it("asks for the person's comment listing, any parent, twenty to a page, each node a whole card", () => {
    const document = readFileSync(join(process.cwd(), "src", "lib", "graphql", "profile.graphql"), "utf-8");
    const comments = document.slice(document.indexOf("query ProfileComments"), document.indexOf("query ProfileFigures"));
    expect(comments).toContain("comments(first: 20, after: $after) {");
    expect(comments).not.toContain("outgoingRecords");
    expect(comments).not.toContain("includePending: false");
    expect(comments).toMatch(/node \{\s+\.\.\.CommentFields/);
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

describe("fetchProfileChronicle", () => {
  /** The served page, the edges' nodes under the person's `chronicle`. */
  function records(edges: unknown[], hasNextPage = false, endCursor: string | null = null) {
    return chroniclePage((edges as { node: unknown }[]).map((edge) => edge.node), { userId: "u-1", hasNextPage, endCursor }).data.user;
  }

  it("maps edges to rows and carries the page shape", async () => {
    server.use(
      gqlLink.query("ProfileChronicle", () =>
        HttpResponse.json({
          data: {
            user: records(
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
    const outcome = await fetchProfileChronicle(client(), "u-1");
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
      gqlLink.query("ProfileChronicle", () =>
        HttpResponse.json({
          data: {
            user: records([
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
    const outcome = await fetchProfileChronicle(client(), "u-1", null, true);
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
      gqlLink.query("ProfileChronicle", ({ variables }) => {
        seen.push(variables);
        return HttpResponse.json({ data: { user: records([]) } });
      }),
    );
    await fetchProfileChronicle(client(), "u-1", "c-0");
    expect(seen).toEqual([{ id: "u-1", first: PROFILE_PAGE_SIZE, after: "c-0" }]);
  });

  it("asks for the page size the chronicle pages by", async () => {
    let first: number | undefined;
    server.use(
      gqlLink.query("ProfileChronicle", ({ variables }) => {
        first = (variables as { first: number }).first;
        return HttpResponse.json({ data: { user: records([]) } });
      }),
    );
    await fetchProfileChronicle(client(), "u-1");
    expect(first).toBe(PROFILE_PAGE_SIZE);
  });
});

// A REMOVED THING KEEPS ITS ROW (Profile.md:37 and :39, ProfileOther.md:33 and
// :39, ProfileDeleted.md:25): the second line reads `Removed by its author`
// where its words were — never the words of the post it answered, nor of the
// thing that cited it — and its door stays (`_shared.jsx` `ChronicleAct`).
describe("fetchProfileChronicle's removed rows", () => {
  const removed = { __typename: "Removal", at: "2026-11-20T10:00:00Z", by: "AUTHOR" };
  const words = (value: string | null) => ({ __typename: "ModeratedText", value });
  const post = (id: string, title: string | null, removal: unknown = null) => ({
    __typename: "Post",
    id,
    title: words(title),
    content: words(title === null ? null : `${title}, the body`),
    removal,
  });
  const comment = (id: string, content: string | null, removal: unknown = null, parent: unknown = null) => ({
    __typename: "Comment",
    id,
    content: words(content),
    removal,
    target: parent,
  });
  function record(id: string, family: string, over: Record<string, unknown>) {
    return {
      __typename: "Record",
      id,
      family,
      act: "GENESIS",
      targetId: `t:${id}`,
      terminalId: null,
      topic: null,
      landedAt: "2026-11-20T09:00:00Z",
      pDirected: 0.4,
      pInterest: 0.5,
      severed: false,
      target: null,
      terminal: null,
      ...over,
    };
  }
  async function rows(nodes: unknown[]) {
    server.use(gqlLink.query("ProfileChronicle", () => HttpResponse.json(chroniclePage(nodes))));
    const outcome = await fetchProfileChronicle(client(), "u-chronicle");
    if (outcome.kind !== "success") throw new Error(outcome.kind);
    return outcome.value.items;
  }

  it("reads a removed comment's row as removed, never its post's words", async () => {
    const [row] = await rows([
      record("r-c", "REVIEW", {
        target: post("p-1", "The parent post"),
        terminal: comment("c-1", null, removed, { __typename: "Post", id: "p-1" }),
      }),
    ]);
    expect(row).toMatchObject({ label: "Commented", snippet: "Removed by its author", postId: "p-1" });
  });

  it("reads a removed reply's row as removed, never the comment it answered", async () => {
    const [row] = await rows([
      record("r-r", "REVIEW", {
        target: comment("c-0", "The answered comment", null, { __typename: "Post", id: "p-1" }),
        terminal: comment("c-1", null, removed, { __typename: "Comment" }),
      }),
    ]);
    expect(row).toMatchObject({ label: "Commented", snippet: "Removed by its author" });
  });

  it("reads a removed post's publish, edit and tag rows as removed, their doors kept", async () => {
    const [publish, edit, tag] = await rows([
      record("r-p", "PUBLISH", { target: post("p-2", null, removed) }),
      record("r-e", "PUBLISH", { act: "ORDINARY", target: post("p-2", null, removed) }),
      record("r-t", "TAG", { target: post("p-2", null, removed), topic: { name: words("saltmaps") } }),
    ]);
    expect(publish).toMatchObject({ label: "Published a post", snippet: "Removed by its author", postId: "p-2" });
    expect(edit).toMatchObject({ label: "Edited a post", snippet: "Removed by its author", postId: "p-2" });
    expect(tag).toMatchObject({ label: "Tagged a post", aside: "#saltmaps", snippet: "Removed by its author", postId: "p-2" });
  });

  it("reads an opinion on a removed post or comment as removed", async () => {
    const [onPost, onComment] = await rows([
      record("r-o", "OPINION", { act: "ORDINARY", target: post("p-2", null, removed) }),
      record("r-q", "OPINION", { act: "ORDINARY", target: comment("c-2", null, removed) }),
    ]);
    expect(onPost).toMatchObject({ aside: "on a post", snippet: "Removed by its author" });
    expect(onComment).toMatchObject({ aside: "on a comment", snippet: "Removed by its author" });
  });

  it("reads a citation of a removed thing as removed, never the citing thing's words", async () => {
    const [ofPost, ofComment] = await rows([
      record("r-x", "REFERENCE", { target: post("p-3", "The citing post"), terminal: post("p-4", null, removed) }),
      record("r-y", "REFERENCE", {
        target: post("p-3", "The citing post"),
        terminal: comment("c-4", null, removed, { __typename: "Post", id: "p-5" }),
      }),
    ]);
    expect(ofPost).toMatchObject({ label: "Cited a post", snippet: "Removed by its author", postId: "p-4" });
    expect(ofComment).toMatchObject({ label: "Cited a comment", snippet: "Removed by its author" });
  });

  it("reads a moderation verdict's removal in its own mark", async () => {
    const [row] = await rows([
      record("r-m", "PUBLISH", { target: post("p-6", null, { ...removed, by: "MODERATION" }) }),
    ]);
    expect(row).toMatchObject({ snippet: "Removed under the platform's rules" });
  });

  it("leaves a row whose thing stands unchanged, beside a removed one", async () => {
    const [live, gone] = await rows([
      record("r-l", "REVIEW", {
        target: post("p-1", "The parent post"),
        terminal: comment("c-5", "Still here", null, { __typename: "Post", id: "p-1" }),
      }),
      record("r-g", "REVIEW", {
        target: post("p-1", "The parent post"),
        terminal: comment("c-6", null, removed, { __typename: "Post", id: "p-1" }),
      }),
    ]);
    expect(live).toMatchObject({ snippet: "Still here", postId: "p-1" });
    expect(gone).toMatchObject({ snippet: "Removed by its author", postId: "p-1" });
  });

  it("reads a removed post or comment still settling as removed", async () => {
    const [p, c] = await rows([
      { ...settlingPostEntry({ id: "p9", title: null, content: null }), removal: removed },
      { ...settlingCommentEntry({ id: "c9", postId: "p1", content: null }), removal: removed },
    ]);
    expect(p).toMatchObject({ snippet: "Removed by its author", postId: "p9", pending: true });
    expect(c).toMatchObject({ snippet: "Removed by its author", postId: "p1", commentId: "c9" });
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

describe("prepareAvatarChange", () => {
  it("stages the picture alone: every text field absent from the input", async () => {
    let input: Record<string, unknown> | undefined;
    server.use(
      gqlLink.mutation("PrepareProfileUpdate", ({ variables }) => {
        input = (variables as { input: Record<string, unknown> }).input;
        return HttpResponse.json({
          data: {
            prepareProfileUpdate: {
              __typename: "PrepareProfileUpdatePayload",
              writes: [
                {
                  __typename: "StagedWrite",
                  id: "sw-2",
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
    const outcome = await prepareAvatarChange(client(), { mediaId: "m-1" });
    expect(outcome.kind).toBe("success");
    // Omitted = untouched (api-spec.md "Content authoring"): the wire carries
    // the avatar's key and no other, never a null that would clear.
    expect(input).toEqual({ avatarMediaId: "m-1" });
  });
});

// THE EVERYTHING TAB'S SETTLING ENTRIES (Profile.md:31, ProfileOther.md:27): a
// post or comment still settling maps to its act's row, keyed by the record it
// lands as, in the order served — no client-side merge, no sort.
describe("fetchProfileChronicle's settling entries", () => {
  it("maps a settling post and comment to their acts' rows, in the order served, before the landed one", async () => {
    const signed = "2026-11-24T11:59:00Z";
    server.use(
      gqlLink.query("ProfileChronicle", () =>
        HttpResponse.json(
          chroniclePage([
            settlingPostEntry({ id: "p9", title: null, content: "Only words", createdAt: signed }),
            settlingCommentEntry({ id: "c9", postId: "p1", content: "A reply", createdAt: signed }),
            {
              __typename: "Record",
              id: "r-1",
              family: "PUBLISH",
              act: "GENESIS",
              targetId: "mint:r-1",
              terminalId: null,
              topic: null,
              landedAt: "2026-10-20T10:00:00Z",
              pDirected: 0,
              pInterest: 0,
              severed: null,
              target: null,
              terminal: null,
            },
          ]),
        ),
      ),
    );
    const outcome = await fetchProfileChronicle(client(), "u-1");
    if (outcome.kind !== "success") throw new Error(outcome.kind);
    expect(outcome.value.items.map((row) => row.id)).toEqual(["act:p9", "act:c9", "r-1"]);
    expect(outcome.value.items[0]).toEqual({
      id: "act:p9",
      kind: "post",
      label: "Published a post",
      aside: null,
      snippet: "Only words",
      postId: "p9",
      commentId: null,
      face: null,
      cited: null,
      mentioned: null,
      pending: true,
      signedAt: signed,
    });
    expect(outcome.value.items[1]).toMatchObject({
      kind: "comment",
      label: "Commented",
      snippet: "A reply",
      postId: "p1",
      commentId: "c9",
      pending: true,
    });
    expect(outcome.value.items[2]).not.toHaveProperty("pending");
  });

  it("keeps an entry read landed in the instant its record mirrors, unmarked", async () => {
    server.use(
      gqlLink.query("ProfileChronicle", () =>
        HttpResponse.json(chroniclePage([settlingPostEntry({ id: "p9", state: "LANDED" })])),
      ),
    );
    const outcome = await fetchProfileChronicle(client(), "u-1");
    if (outcome.kind !== "success") throw new Error(outcome.kind);
    expect(outcome.value.items).toHaveLength(1);
    expect(outcome.value.items[0]).toMatchObject({ id: "act:p9", pending: false });
  });

  it("reads an absent person as an empty page", async () => {
    server.use(gqlLink.query("ProfileChronicle", () => HttpResponse.json({ data: { user: null } })));
    const outcome = await fetchProfileChronicle(client(), "u-1");
    expect(outcome).toEqual({ kind: "success", value: { items: [], endCursor: null, hasNextPage: false } });
  });
});
