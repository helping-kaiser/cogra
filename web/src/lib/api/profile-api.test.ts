// The profile surface: the chronicle's row decisions, the three-valued avatar
// field, and the reads that carry them.

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  fetchAuthorRecords,
  fetchMyProfile,
  fetchProfileByHandle,
  mediaField,
  prepareProfileUpdate,
  PROFILE_PAGE_SIZE,
  rowLabel,
  type RecordNode,
} from "./profile-api";
import { startMswServer } from "@/test/msw";

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

describe("rowLabel", () => {
  // The genesis mark is what separates writing from editing; the family alone
  // cannot tell them apart.
  it("separates a genesis from an edit within a family", () => {
    expect(rowLabel(node("PUBLISH"), true)).toBe("Published a post");
    expect(rowLabel(node("PUBLISH"), false)).toBe("Edited a post");
    expect(rowLabel(node("REVIEW"), true)).toBe("Commented");
    expect(rowLabel(node("REVIEW"), false)).toBe("Edited a comment");
  });

  // The anchoring record and its updates share one honest label — the chain
  // shape is not visible per row.
  it("gives the registration chain one label either way", () => {
    expect(rowLabel(node("REGISTRATION"), true)).toBe("Profile update");
    expect(rowLabel(node("REGISTRATION"), false)).toBe("Profile update");
  });

  it("reads both stance families as one gesture", () => {
    expect(rowLabel(node("OPINION"), true)).toBe("Shared a stance");
    expect(rowLabel(node("AFFINITY"), false)).toBe("Shared a stance");
  });

  // A family this build does not know still gets a row rather than an empty
  // one — the chronicle is the honest history, so it says something happened.
  it("labels a family this build does not know", () => {
    expect(rowLabel(node("SOMETHING_NEWER"), true)).toBe("Did something");
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
      graphql.query("UserProfile", () =>
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
    server.use(graphql.query("UserProfile", () => HttpResponse.json({ data: { user: null } })));
    expect(await fetchProfileByHandle(client(), "nobody")).toEqual({
      kind: "success",
      value: null,
    });
  });

  it("reports a transport fault as failed", async () => {
    server.use(graphql.query("MyProfile", () => HttpResponse.error()));
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
      graphql.query("AuthorRecords", () =>
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
                    targetId: "mint:r-1",
                    terminalId: null,
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
    const outcome = await fetchAuthorRecords(client(), "u-1", "posts");
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.items).toEqual([
      { id: "r-1", label: "Published a post", snippet: "A title", postId: "p-1" },
    ]);
    expect(outcome.value.endCursor).toBe("cursor-1");
    expect(outcome.value.hasNextPage).toBe(true);
  });

  // The chips are a family filter, and "everything" is the absence of one —
  // not a third family the server would have to know about.
  it("maps each chip to its family, and everything to none", async () => {
    const seen: string[] = [];
    server.use(
      graphql.query("AuthorRecords", ({ variables }) => {
        seen.push(String((variables as { family: string | null }).family));
        return HttpResponse.json({ data: { records: records([]) } });
      }),
    );
    const c = client();
    await fetchAuthorRecords(c, "u-1", "posts");
    await fetchAuthorRecords(c, "u-1", "comments");
    await fetchAuthorRecords(c, "u-1", "everything");
    expect(seen).toEqual(["PUBLISH", "REVIEW", "null"]);
  });

  it("asks for the page size the chronicle pages by", async () => {
    let first: number | undefined;
    server.use(
      graphql.query("AuthorRecords", ({ variables }) => {
        first = (variables as { first: number }).first;
        return HttpResponse.json({ data: { records: records([]) } });
      }),
    );
    await fetchAuthorRecords(client(), "u-1", "posts");
    expect(first).toBe(PROFILE_PAGE_SIZE);
  });
});

describe("prepareProfileUpdate", () => {
  it("sends the three-valued avatar field and maps the staged writes", async () => {
    let input: { avatarMediaId?: string | null } | undefined;
    server.use(
      graphql.mutation("PrepareProfileUpdate", ({ variables }) => {
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
      graphql.mutation("PrepareProfileUpdate", () =>
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
