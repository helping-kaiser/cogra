import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { writeConfirmMultiAction } from "@/lib/signing/confirm-multi-action";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { stanceBundle, stanceHandlers } from "@/test/stance";
import { PostView } from "./post-view";

// The post and every comment read their own standing, so the read is a
// default rather than something each test remembers: an unhandled one
// degrades the control silently instead of failing the test.
//
// Opening a comment's editor reads that comment's OWN sensitive mark for the
// same reason — it is not on the thread read — so it gets the same treatment:
// unmarked by default, and a test that cares says so with its own handler.
const server = startMswServer(
  ...stanceHandlers(),
  graphql.query("CommentSelfMark", ({ variables }) =>
    HttpResponse.json({
      data: {
        comment: {
          __typename: "Comment",
          id: variables.id,
          sensitiveSelfMark: false,
        },
      },
    }),
  ),
);

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function landing(pending = false) {
  return { __typename: "Landing", state: pending ? "PENDING" : "LANDED" };
}

function topicClaim(name: string, relevance = 0.4, confidence = 0.9) {
  return {
    __typename: "TopicClaim",
    hashtag: {
      __typename: "Hashtag",
      id: `ht-${name}`,
      name: { __typename: "ModeratedText", value: name, status: "NORMAL" },
    },
    relevance,
    confidence,
    pending: false,
  };
}

type TopicFixture = ReturnType<typeof topicClaim>;

type FixtureComment = {
  id: string;
  body: string;
  authorId?: string;
  edited?: boolean;
  pending?: boolean;
  /** What `CommentConnection.totalCount` reports for this comment's branch. */
  replyCount?: number;
  topics?: TopicFixture[];
  references?: ReferenceFixture[];
  attachments?: unknown[];
  attachmentsStatus?: string;
};

/**
 * A `ReferenceClaim` as the wire serves it: the L1 identifier beside the
 * TYPED target, whose own `id` is the L2 one the prepare verbs take.
 */
function referenceClaim(
  target: Record<string, unknown>,
  relevance = 0.1,
  support = 0.1,
  pending = false,
  withdrawalCost = 1,
) {
  return {
    __typename: "ReferenceClaim",
    targetId: `l1-${target.id as string}`,
    relevance,
    support,
    withdrawalCost,
    pending,
    target,
  };
}

function userTarget(id: string, handle: string) {
  return {
    __typename: "User",
    id,
    handle,
    displayName: { __typename: "ModeratedText", value: handle },
  };
}

function postTarget(id: string, title: string) {
  return {
    __typename: "Post",
    id,
    title: { __typename: "ModeratedText", value: title },
    content: { __typename: "ModeratedText", value: "quoted body" },
    author: { __typename: "User", handle: "carol" },
  };
}

type ReferenceFixture = ReturnType<typeof referenceClaim>;

function commentNode(comment: FixtureComment): Record<string, unknown> {
  return {
    __typename: "Comment",
    id: comment.id,
    content: moderated(comment.body),
    attachments: comment.attachments ?? [],
    attachmentsStatus: comment.attachmentsStatus ?? "NORMAL",
    author: {
      __typename: "User",
      id: comment.authorId ?? "u2",
      handle: "bob",
      displayName: { __typename: "ModeratedText", value: "Bob" },
      avatar: null,
    },
    createdAt: "2026-08-12T10:05:00Z",
    updatedAt: comment.edited ? "2026-08-12T11:00:00Z" : "2026-08-12T10:05:00Z",
    landing: landing(comment.pending),
    moderationStatus: "NORMAL",
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: comment.topics ?? [],
    references: comment.references ?? [],
    // Q49: a comment carries its branch as a COUNT, never as a page — on the
    // thread read and on the expand read alike. `withReplies` is gone with the
    // prefetch; every node answers the same way.
    replies: {
      __typename: "CommentConnection",
      totalCount: comment.replyCount ?? 0,
    },
  };
}

function detail(
  authorId: string,
  comments: FixtureComment[],
  page: { hasNextPage: boolean; endCursor: string | null } = {
    hasNextPage: false,
    endCursor: null,
  },
  postPending = false,
  postTopics: TopicFixture[] = [],
  postReferences: ReferenceFixture[] = [],
  body: {
    description?: string | null;
    content?: string | null;
    attachments?: unknown[];
    attachmentsStatus?: string;
    moderationStatus?: string;
  } = {},
) {
  return {
    post: {
      __typename: "Post",
      id: "p1",
      title: moderated("The title"),
      description: moderated(body.description ?? null),
      content: moderated(body.content === undefined ? "The body" : body.content),
      attachments: body.attachments ?? [],
      attachmentsStatus: body.attachmentsStatus ?? "NORMAL",
      author: {
        __typename: "User",
        id: authorId,
        handle: "alice",
        displayName: { __typename: "ModeratedText", value: "Alice" },
        avatar: null,
      },
      createdAt: "2026-08-12T10:00:00Z",
      updatedAt: "2026-08-12T10:00:00Z",
      landing: landing(postPending),
      moderationStatus: body.moderationStatus ?? "NORMAL",
      license: { __typename: "License", attribution: 0, provenance: 0 },
      topics: postTopics,
      references: postReferences,
      comments: {
        __typename: "CommentConnection",
        edges: comments.map((comment) => ({
          __typename: "CommentEdge",
          node: commentNode(comment),
        })),
        pageInfo: {
          __typename: "PageInfo",
          hasNextPage: page.hasNextPage,
          endCursor: page.endCursor,
        },
      },
    },
  };
}

function storeFor(accountId: string) {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId });
  return store;
}

describe("PostView", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the post with its thread", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: detail("u1", [{ id: "c1", body: "First!" }]) }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("post-title")).toHaveTextContent("The title");
    expect(screen.getByTestId("post-body")).toHaveTextContent("The body");
    expect(screen.getByTestId("post-comment-c1")).toHaveTextContent("First!");
    expect(screen.queryByTestId("post-no-comments")).not.toBeInTheDocument();
  });

  it("carries a stance control on the post and on every comment", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("u1", [{ id: "c1", body: "First!", replyCount: 1 }]),
        }),
      ),
      graphql.query("CommentReplies", () =>
        HttpResponse.json({
          data: {
            comment: {
              __typename: "Comment",
              id: "c1",
              replies: {
                __typename: "CommentConnection",
                edges: [
                  { __typename: "CommentEdge", node: commentNode({ id: "c1a", body: "Nested" }) },
                ],
                pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
              },
            },
          },
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("u2"),
      writeSigner: fakeWriteSigner(),
    });
    // Opinion toward any passive node — a post, a comment, a reply
    // (design.md §6; roadmap slice 2.2).
    expect(await screen.findByTestId("post-stance")).toBeInTheDocument();
    expect(screen.getByTestId("comment-stance-c1")).toBeInTheDocument();
    // The reply arrives unfolded, and wears the control like anything else.
    fireEvent.click(screen.getByTestId("replies-more-c1"));
    expect(await screen.findByTestId("comment-stance-c1a")).toBeInTheDocument();
  });

  it("wears the viewer's own standing on the post and on a comment", async () => {
    // §8.3: at rest the target shows the standing — on every surface
    // that carries a control, not only on the one it was built for.
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("u1", [{ id: "c1", body: "First!" }]),
        }),
      ),
      ...stanceHandlers({
        p1: { pDirected: 0.9, pInterest: 0.25, recordCount: 3 },
        c1: { pDirected: -0.55, pInterest: 0.25, recordCount: 1 },
      }),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("u2"),
      writeSigner: fakeWriteSigner(),
    });
    await waitFor(() => expect(screen.getByTestId("post-stance")).toHaveTextContent("Love this"));
    expect(screen.getByTestId("post-stance-resting-exact")).toHaveTextContent("+0.90 / +0.25");
    expect(screen.getByTestId("comment-stance-c1")).toHaveTextContent("Don't like this");
    expect(screen.getByTestId("comment-stance-c1-resting-exact")).toHaveTextContent(
      "-0.55 / +0.25",
    );
  });

  // The quiet marker in design.md §9's register: the content reads in
  // full either way, and only its place in the order is unsettled.
  it("marks a pending post and a pending comment, leaving landed ones unmarked", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail(
            "u1",
            [
              { id: "c1", body: "Just signed", pending: true },
              { id: "c2", body: "Long landed" },
            ],
            { hasNextPage: false, endCursor: null },
            true,
          ),
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("post-pending")).toHaveTextContent("Still settling");
    expect(screen.getByTestId("comment-pending-c1")).toHaveTextContent("Still settling");
    expect(screen.queryByTestId("comment-pending-c2")).not.toBeInTheDocument();
    expect(screen.getByTestId("post-body")).toHaveTextContent("The body");
    expect(screen.getByTestId("post-comment-c1")).toHaveTextContent("Just signed");
  });

  it("leaves a landed post unmarked", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: detail("u1", [{ id: "c1", body: "First!" }]) }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("post-title")).toBeInTheDocument();
    expect(screen.queryByTestId("post-pending")).not.toBeInTheDocument();
  });

  // Enforcement inside CoGra reduces to honest display
  // (platform-guidelines.md §5), so the qualifiers ride both the post
  // and every comment.
  it("shows the license terms on the post and on each comment", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: detail("u1", [{ id: "c1", body: "First!" }]) }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("post-license-terms")).toHaveTextContent(
      "Public domain",
    );
    expect(screen.getByTestId("comment-license-terms-c1")).toHaveTextContent(
      "Public domain",
    );
  });

  it("offers the edit link to the creator only", async () => {
    server.use(
      graphql.query("PostDetail", () => HttpResponse.json({ data: detail("acct-1", []) })),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("post-edit")).toHaveAttribute("href", "/compose?post=p1");
  });

  it("hides the edit link from non-creators", async () => {
    server.use(
      graphql.query("PostDetail", () => HttpResponse.json({ data: detail("someone-else", []) })),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("post-no-comments")).toBeInTheDocument();
    expect(screen.queryByTestId("post-edit")).not.toBeInTheDocument();
  });

  it("serves not-found for an unknown id", async () => {
    server.use(graphql.query("PostDetail", () => HttpResponse.json({ data: { post: null } })));
    renderWithProviders(<PostView postId="gone" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("post-not-found")).toBeInTheDocument();
  });

  it("reads without a session and swaps the comment box for the sign-in entry", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: detail("u1", [{ id: "c1", body: "First!" }]) }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("post-title")).toHaveTextContent("The title");
    expect(screen.getByTestId("post-comment-c1")).toHaveTextContent("First!");
    expect(screen.queryByTestId("comment-draft")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comment-submit")).not.toBeInTheDocument();
    expect(screen.getByTestId("comment-signin")).toHaveAttribute("href", "/login");
  });

  it("keeps the thread readable and faults at the load-more slot when a comments page fails", async () => {
    let calls = 0;
    server.use(
      graphql.query("PostDetail", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({
              data: detail("u1", [{ id: "c1", body: "First!" }], {
                hasNextPage: true,
                endCursor: "cur1",
              }),
            })
          : HttpResponse.error();
      }),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    fireEvent.click(await screen.findByTestId("post-more-comments"));
    expect(await screen.findByTestId("post-more-comments-error")).toBeInTheDocument();
    // The fault surfaces where the failed fetch was requested — at the
    // load-more slot, not the banner above the thread.
    expect(screen.queryByTestId("post-thread-transport-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("post-more-comments")).not.toBeInTheDocument();
    expect(screen.getByTestId("post-title")).toHaveTextContent("The title");
    expect(screen.getByTestId("post-comment-c1")).toHaveTextContent("First!");
  });

  it("clears the load-more error when a retried comments page succeeds", async () => {
    let calls = 0;
    server.use(
      graphql.query("PostDetail", () => {
        calls += 1;
        if (calls === 2) return HttpResponse.error();
        return HttpResponse.json({
          data:
            calls === 1
              ? detail("u1", [{ id: "c1", body: "First!" }], {
                  hasNextPage: true,
                  endCursor: "cur1",
                })
              : detail("u1", [{ id: "c2", body: "Second!" }]),
        });
      }),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    fireEvent.click(await screen.findByTestId("post-more-comments"));
    await screen.findByTestId("post-more-comments-error");
    fireEvent.click(screen.getByTestId("post-more-comments-retry"));
    expect(await screen.findByTestId("post-comment-c2")).toBeInTheDocument();
    expect(screen.queryByTestId("post-more-comments-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("post-comment-c1")).toBeInTheDocument();
  });

  it("offers a retry on the nothing-loaded transport error and heals from it", async () => {
    let calls = 0;
    server.use(
      graphql.query("PostDetail", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: detail("u1", [{ id: "c1", body: "First!" }]) });
      }),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("post-transport-error")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("post-retry"));
    expect(await screen.findByTestId("post-title")).toHaveTextContent("The title");
    expect(screen.queryByTestId("post-transport-error")).not.toBeInTheDocument();
  });

  it("backs to the feed from every branch", async () => {
    server.use(graphql.query("PostDetail", () => HttpResponse.json({ data: { post: null } })));
    renderWithProviders(<PostView postId="gone" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("post-not-found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to feed" })).toHaveAttribute("href", "/feed");
  });

  it("marks an edited comment softly and offers the edit to its creator only", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("author-1", [
            { id: "c1", body: "mine", authorId: "acct-1", edited: true },
            { id: "c2", body: "theirs" },
          ]),
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("comment-edited-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("comment-edited-c2")).not.toBeInTheDocument();
    expect(screen.getByTestId("comment-edit-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("comment-edit-c2")).not.toBeInTheDocument();
  });

  it("edits a comment inline and signs the update", async () => {
    let variables: unknown;
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("author-1", [{ id: "c1", body: "old words", authorId: "acct-1" }]),
        }),
      ),
      graphql.mutation("PrepareCommentEdit", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({
          data: {
            prepareCommentEdit: {
              __typename: "PrepareContentPayload",
              node: "c1",
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
    const signer = fakeWriteSigner();
    renderWithProviders(<PostView postId="p1" />, { store: storeFor("acct-1"), writeSigner: signer });
    fireEvent.click(await screen.findByTestId("comment-edit-c1"));
    const input = screen.getByTestId("comment-edit-input");
    expect(input).toHaveValue("old words");
    fireEvent.change(input, { target: { value: "better words" } });
    fireEvent.click(screen.getByTestId("comment-edit-save"));
    await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(1));
    expect(variables).toEqual({
      // The mark is re-stated on the edit: a complete-state write that omitted
      // it would unveil a comment its author had veiled. The gallery is
      // complete state for the same reason — this comment carries none, so an
      // empty gallery is what the edit leaves standing.
      input: {
        id: "c1",
        content: "better words",
        attachments: null,
        sensitive: false,
        sensitiveReason: null,
      },
    });
    // The editor closes and the in-flight notice shows.
    expect(screen.queryByTestId("comment-edit-input")).not.toBeInTheDocument();
    expect(screen.getByTestId("comment-signed")).toBeInTheDocument();
  });

  // Q49: the thread read carries no replies at all. A branch is a count, and
  // the nodes arrive only for the reader who unfolds one.
  it("collapses a branch behind its count and unfolds it on request", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("author-1", [{ id: "c1", body: "top", replyCount: 2 }]),
        }),
      ),
      graphql.query("CommentReplies", () =>
        HttpResponse.json({
          data: {
            comment: {
              __typename: "Comment",
              id: "c1",
              replies: {
                __typename: "CommentConnection",
                edges: [
                  { __typename: "CommentEdge", node: commentNode({ id: "r1", body: "nested" }) },
                  { __typename: "CommentEdge", node: commentNode({ id: "r2", body: "more" }) },
                ],
                pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
              },
            },
          },
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

    // Nothing of the branch is on screen, and the line promises the count.
    const unfold = await screen.findByTestId("replies-more-c1");
    expect(unfold).toHaveTextContent("View 2 replies");
    expect(screen.queryByTestId("post-comment-r1")).not.toBeInTheDocument();

    fireEvent.click(unfold);
    expect(await screen.findByTestId("post-comment-r1")).toHaveTextContent("nested");
    expect(screen.getByTestId("post-comment-r2")).toHaveTextContent("more");
    // The whole branch came in one page, so nothing is left to ask for.
    expect(screen.queryByTestId("replies-more-c1")).not.toBeInTheDocument();
  });

  // design/readme.md §13 (2026-08-28), matched by the canonical CommentCard
  // and Android's PostDetailScreen.kt (PR #574): the thread indents ONE
  // level on screen. A reply to a reply flattens into that same level
  // instead of indenting further — its own @handle lead is content the
  // composer prefilled, not something this view generates.
  it("flattens a reply-to-a-reply to the same indent as its parent", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("author-1", [{ id: "c1", body: "top", replyCount: 1 }]),
        }),
      ),
      graphql.query("CommentReplies", ({ variables }) => {
        const parentId = variables.id as string;
        if (parentId === "c1") {
          return HttpResponse.json({
            data: {
              comment: {
                __typename: "Comment",
                id: "c1",
                replies: {
                  __typename: "CommentConnection",
                  edges: [
                    {
                      __typename: "CommentEdge",
                      node: commentNode({ id: "r1", body: "@alice nested", replyCount: 1 }),
                    },
                  ],
                  pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
                },
              },
            },
          });
        }
        return HttpResponse.json({
          data: {
            comment: {
              __typename: "Comment",
              id: "r1",
              replies: {
                __typename: "CommentConnection",
                edges: [
                  {
                    __typename: "CommentEdge",
                    node: commentNode({ id: "r1-1", body: "@bob grandchild" }),
                  },
                ],
                pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

    fireEvent.click(await screen.findByTestId("replies-more-c1"));
    fireEvent.click(await screen.findByTestId("replies-more-r1"));

    const child = await screen.findByTestId("post-comment-r1");
    const grandchild = await screen.findByTestId("post-comment-r1-1");
    expect(grandchild).toHaveTextContent("@bob grandchild");
    // Depth 1 (the child) and depth 2 (the grandchild) draw at the SAME
    // indent — the thread never grows a third rung.
    expect(grandchild.style.marginLeft).toBe(child.style.marginLeft);
    expect(grandchild.style.marginLeft).toBe("12px");
  });

  it("says one reply in the singular", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("author-1", [{ id: "c1", body: "top", replyCount: 1 }]),
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("replies-more-c1")).toHaveTextContent("View 1 reply");
  });

  it("draws no unfold line on a comment nobody answered", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: detail("author-1", [{ id: "c1", body: "top" }]) }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("post-comment-c1");
    expect(screen.queryByTestId("replies-more-c1")).not.toBeInTheDocument();
  });

  it("wears the standing on a load that starts with no access token", async () => {
    // The state every direct arrival at this URL begins in: the refresh
    // token is persisted, the access token is per-tab memory and this tab
    // has none yet. Nothing on this surface is viewer-scoped except the
    // stance controls — the post and its thread read fine anonymously —
    // so the stance read is the first request that needs a viewer, and it
    // is the one that has to notice it is not carrying one.
    window.localStorage.setItem("cogra.activeAccount", "u2");
    window.localStorage.setItem("cogra.refreshToken", "refresh-1");
    const store = createTokenStore();
    expect(store.accessToken()).toBeNull();

    const anonymous: string[] = [];
    const seeded = {
      p1: { pDirected: 1, pInterest: 0.2, recordCount: 3 },
      c1: { pDirected: -0.55, pInterest: 0.25, recordCount: 1 },
    };
    const stanceRoot = (operation: string, field: string, typename: string) =>
      graphql.query(operation, ({ variables, request }) => {
        const id = String(variables.id);
        const authorized = request.headers.get("authorization") !== null;
        if (!authorized) anonymous.push(id);
        return HttpResponse.json({
          data: {
            [field]: {
              __typename: typename,
              id,
              // What the server actually answers a request it did not
              // authenticate: a null field, not an error (types.rs
              // `viewer_stance`). Nothing in the errors array means
              // nothing for the guard to react to on its own.
              viewerStance: authorized ? stanceBundle(seeded[id as keyof typeof seeded]) : null,
            },
          },
        });
      });

    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: detail("u1", [{ id: "c1", body: "First!" }]) }),
      ),
      graphql.mutation("RefreshSession", () =>
        HttpResponse.json({
          data: {
            refreshSession: {
              __typename: "AuthPayload",
              auth: {
                __typename: "AuthSession",
                accessToken: "access-2",
                refreshToken: "refresh-2",
                user: { __typename: "User", id: "u2" },
              },
              userErrors: [],
            },
          },
        }),
      ),
      stanceRoot("PostStance", "post", "Post"),
      stanceRoot("CommentStance", "comment", "Comment"),
    );

    renderWithProviders(<PostView postId="p1" />, { store, writeSigner: fakeWriteSigner() });

    // Both controls, because both are viewer-scoped reads on this surface
    // and the defect took the whole class, not the post alone.
    expect(await screen.findByTestId("post-stance-resting-exact")).toHaveTextContent("+1.00 / +0.20");
    await waitFor(() =>
      expect(screen.getByTestId("comment-stance-c1-resting-exact")).toHaveTextContent(
        "-0.55 / +0.25",
      ),
    );
    expect(screen.getByTestId("post-stance")).toHaveAccessibleName(/Love this/);
    // The reads really did start out anonymous — the standing arrived by
    // refreshing and replaying, not because the rig handed it a token.
    expect(anonymous).toContain("p1");
    expect(store.accessToken()).toBe("access-2");
  });

  it("shows the read-only chip row for a post the viewer doesn't own", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: {
            ...detail("author-1", []),
            post: {
              ...detail("author-1", []).post,
              topics: [
                {
                  __typename: "TopicClaim",
                  hashtag: {
                    __typename: "Hashtag",
                    id: "ht-1",
                    name: moderated("rust"),
                  },
                  relevance: 0.1,
                  confidence: 1,
                  pending: false,
                },
              ],
            },
          },
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("post-topic-rust")).toBeInTheDocument();
    expect(screen.getByTestId("post-topic-rust-link")).toHaveAttribute("href", "/topics/rust");
    // Not the viewer's own post — no add/remove affordance.
    expect(screen.queryByTestId("post-tag-input")).not.toBeInTheDocument();
  });

  // F3: tag editing moved onto the edit screen, so the detail view is
  // read-only for the author too — the Edit affordance is the way in.
  it("shows read-only chips on the viewer's OWN post, with no tag gestures", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: {
            post: {
              ...detail("acct-1", []).post,
              topics: [
                {
                  __typename: "TopicClaim",
                  hashtag: { __typename: "Hashtag", id: "ht-1", name: moderated("rust") },
                  relevance: 0.1,
                  confidence: 1,
                  pending: false,
                },
              ],
            },
          },
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("post-topic-rust")).toBeInTheDocument();
    expect(screen.getByTestId("post-topic-rust-link")).toHaveAttribute("href", "/topics/rust");
    expect(screen.queryByTestId("post-tag-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("post-topic-rust-remove")).not.toBeInTheDocument();
    expect(screen.getByTestId("post-edit")).toHaveAttribute("href", "/compose?post=p1");
  });

  it("shows read-only chips on the viewer's own COMMENT too", async () => {
    server.use(
      graphql.query("PostDetail", () => {
        const base = detail("author-1", [{ id: "c1", body: "mine", authorId: "acct-1" }]);
        return HttpResponse.json({
          data: {
            post: {
              ...base.post,
              comments: {
                ...base.post.comments,
                edges: base.post.comments.edges.map((edge) => ({
                  ...edge,
                  node: {
                    ...edge.node,
                    topics: [
                      {
                        __typename: "TopicClaim",
                        hashtag: { __typename: "Hashtag", id: "ht-1", name: moderated("rust") },
                        relevance: 0.1,
                        confidence: 1,
                        pending: false,
                      },
                    ],
                  },
                })),
              },
            },
          },
        });
      }),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("comment-c1-topic-rust")).toBeInTheDocument();
    expect(screen.queryByTestId("comment-c1-tag-input")).not.toBeInTheDocument();
  });

  it("links authors as chips into their profiles", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: detail("author-1", [{ id: "c1", body: "top" }]) }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("post-author")).toHaveAttribute("href", "/u/alice");
    expect(screen.getByTestId("comment-author-c1")).toHaveAttribute("href", "/u/bob");
  });

  // F8: the detail view is where a reader may ask how strongly a topic
  // is claimed — on the post and on every comment in the thread.
  it("reveals the post's topic values on request", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("u1", [], { hasNextPage: false, endCursor: null }, false, [
            topicClaim("rust", 0.4, 0.9),
          ]),
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    const toggle = await screen.findByTestId("post-topics-reveal");
    expect(screen.queryByTestId("post-topic-rust-values")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByTestId("post-topic-rust-values")).toHaveTextContent("+0.40 · 0.90");
  });

  it("reveals a comment's topic values independently of the post's", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail(
            "u1",
            [{ id: "c1", body: "First!", topics: [topicClaim("wasm", -0.25, 0.5)] }],
            { hasNextPage: false, endCursor: null },
            false,
            [topicClaim("rust", 0.4, 0.9)],
          ),
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    fireEvent.click(await screen.findByTestId("comment-c1-topics-reveal"));
    expect(screen.getByTestId("comment-c1-topic-wasm-values")).toHaveTextContent("-0.25 · 0.50");
    // Each row answers for itself; revealing one does not reveal the rest.
    expect(screen.queryByTestId("post-topic-rust-values")).not.toBeInTheDocument();
  });

  // ---- F9: tagging is part of the comment compose gesture ----

  // ---- F10: the inline comment edit tags like the post edit ----

  describe("editing a comment's tags", () => {
    function tagPayload(id: string) {
      return {
        prepareTag: {
          __typename: "PreparePayload",
          writes: [
            {
              __typename: "PreparedWrite",
              id,
              family: "TAG",
              canonicalProposal: "cHJvcG9zYWw=",
            },
          ],
          userErrors: [],
        },
      };
    }

    function editPayload() {
      return {
        prepareCommentEdit: {
          __typename: "PrepareContentPayload",
          node: "c1",
          writes: [
            {
              __typename: "PreparedWrite",
              id: "w-edit",
              family: "REVIEW",
              canonicalProposal: "cHJvcG9zYWw=",
              gcAfterEpochs: 8,
            },
          ],
          userErrors: [],
        },
      };
    }

    /** The viewer's own comment, carrying whatever claims it was given. */
    function ownComment(topics: TopicFixture[]) {
      return detail("author-1", [
        { id: "c1", body: "old words", authorId: "acct-1", topics },
      ]);
    }

    beforeEach(() => {
      writeConfirmMultiAction(false);
    });

    it("opens the editor on the claims the comment actually carries", async () => {
      server.use(
        graphql.query("PostDetail", () =>
          HttpResponse.json({ data: ownComment([topicClaim("rust", 0.4, 0.8)]) }),
        ),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      fireEvent.click(await screen.findByTestId("comment-edit-c1"));
      expect(screen.getByTestId("comment-edit-tag-0")).toHaveTextContent("#rust");
      // The chip opens on the values the claim actually carries — real
      // ones, never the entry defaults.
      fireEvent.click(screen.getByTestId("comment-edit-tag-0-select"));
      expect(screen.getByTestId("comment-edit-tag-0-relevance")).toHaveValue("0.4");
      expect(screen.getByTestId("comment-edit-tag-0-confidence")).toHaveValue("0.8");
      // No creation batch here, so no batch cap.
      expect(screen.queryByTestId("comment-edit-tag-cap")).not.toBeInTheDocument();
    });

    // Round 4: the display state is the OR of the author's mark and the
    // moderator's, and neither side can clear the other. Re-stating the OR on
    // an edit would quietly adopt a moderator's verdict as the author's own
    // mark, which the author could then never take back.
    it("carries the author's own sensitive mark on an edit, never a moderator's", async () => {
      let sent: { sensitive?: boolean } | null = null;
      server.use(
        graphql.query("PostDetail", () => HttpResponse.json({ data: ownComment([]) })),
        // The reader sees a veiled comment — but that veil is the moderator's.
        graphql.query("CommentSelfMark", () =>
          HttpResponse.json({
            data: { comment: { __typename: "Comment", id: "c1", sensitiveSelfMark: false } },
          }),
        ),
        graphql.mutation("PrepareCommentEdit", ({ variables }) => {
          sent = (variables.input as { sensitive?: boolean }) ?? null;
          return HttpResponse.json({ data: editPayload() });
        }),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });

      fireEvent.click(await screen.findByTestId("comment-edit-c1"));
      fireEvent.change(screen.getByTestId("comment-edit-input"), {
        target: { value: "new words" },
      });
      fireEvent.click(screen.getByTestId("comment-edit-save"));

      await waitFor(() => expect(sent).not.toBeNull());
      expect(sent!.sensitive).toBe(false);
    });

    it("stages the edit record and one Tag act per change, in one signing pass", async () => {
      const tagInputs: Record<string, unknown>[] = [];
      let editCalled = false;
      server.use(
        graphql.query("PostDetail", () =>
          HttpResponse.json({ data: ownComment([topicClaim("wasm", 0.1, 1)]) }),
        ),
        graphql.mutation("PrepareCommentEdit", () => {
          editCalled = true;
          return HttpResponse.json({ data: editPayload() });
        }),
        graphql.mutation("PrepareTag", ({ variables }) => {
          tagInputs.push(variables.input as Record<string, unknown>);
          return HttpResponse.json({ data: tagPayload(`w-tag-${tagInputs.length}`) });
        }),
      );
      const signer = fakeWriteSigner();
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: signer,
      });
      fireEvent.click(await screen.findByTestId("comment-edit-c1"));
      fireEvent.change(screen.getByTestId("comment-edit-input"), {
        target: { value: "better words" },
      });
      fireEvent.change(screen.getByTestId("comment-edit-tag-input"), { target: { value: "rust" } });
      fireEvent.click(screen.getByTestId("comment-edit-tag-add"));
      // Drop the tag the comment came with.
      fireEvent.click(screen.getByTestId("comment-edit-tag-0-remove"));
      fireEvent.click(screen.getByTestId("comment-edit-save"));

      await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(3));
      expect(editCalled).toBe(true);
      expect(tagInputs).toEqual([
        { target: "c1", name: "rust", pDirected: 0.1, pInterest: 1 },
        // A withdrawal is a Tag act at relevance 0, never a deletion.
        { target: "c1", name: "wasm", pDirected: 0, pInterest: null },
      ]);
    });

    it("stages no edit record when only the tags moved", async () => {
      let editCalled = false;
      server.use(
        graphql.query("PostDetail", () => HttpResponse.json({ data: ownComment([]) })),
        graphql.mutation("PrepareCommentEdit", () => {
          editCalled = true;
          return HttpResponse.json({ data: editPayload() });
        }),
        graphql.mutation("PrepareTag", () => HttpResponse.json({ data: tagPayload("w-tag-1") })),
      );
      const signer = fakeWriteSigner();
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: signer,
      });
      fireEvent.click(await screen.findByTestId("comment-edit-c1"));
      fireEvent.change(screen.getByTestId("comment-edit-tag-input"), { target: { value: "rust" } });
      fireEvent.click(screen.getByTestId("comment-edit-tag-add"));
      fireEvent.click(screen.getByTestId("comment-edit-save"));

      await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(1));
      expect(editCalled).toBe(false);
    });

    // Re-tuning is its own act: a fresh declaration at the new values.
    it("stages a re-tune as its own Tag act", async () => {
      const tagInputs: Record<string, unknown>[] = [];
      server.use(
        graphql.query("PostDetail", () =>
          HttpResponse.json({ data: ownComment([topicClaim("rust", 0.4, 0.8)]) }),
        ),
        graphql.mutation("PrepareTag", ({ variables }) => {
          tagInputs.push(variables.input as Record<string, unknown>);
          return HttpResponse.json({ data: tagPayload("w-tag-1") });
        }),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      fireEvent.click(await screen.findByTestId("comment-edit-c1"));
      fireEvent.click(screen.getByTestId("comment-edit-tag-0-select"));
      fireEvent.change(screen.getByTestId("comment-edit-tag-0-relevance"), {
        target: { value: "0.75" },
      });
      fireEvent.click(screen.getByTestId("comment-edit-save"));

      await waitFor(() =>
        expect(tagInputs).toEqual([
          { target: "c1", name: "rust", pDirected: 0.75, pInterest: 0.8 },
        ]),
      );
    });

    // F2: prepared fully before signing — a refusal on a tag leaves
    // nothing signed at all.
    it("signs nothing when a Tag act is refused", async () => {
      server.use(
        graphql.query("PostDetail", () => HttpResponse.json({ data: ownComment([]) })),
        graphql.mutation("PrepareCommentEdit", () => HttpResponse.json({ data: editPayload() })),
        graphql.mutation("PrepareTag", () =>
          HttpResponse.json({
            data: {
              prepareTag: {
                __typename: "PreparePayload",
                writes: null,
                userErrors: [
                  {
                    __typename: "UserError",
                    message: "`a-b` is not a legal topic name: reserved",
                    code: "BAD_INPUT",
                    field: ["name"],
                  },
                ],
              },
            },
          }),
        ),
      );
      const signer = fakeWriteSigner();
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: signer,
      });
      fireEvent.click(await screen.findByTestId("comment-edit-c1"));
      fireEvent.change(screen.getByTestId("comment-edit-input"), { target: { value: "moved" } });
      fireEvent.change(screen.getByTestId("comment-edit-tag-input"), { target: { value: "a-b" } });
      fireEvent.click(screen.getByTestId("comment-edit-tag-add"));
      fireEvent.click(screen.getByTestId("comment-edit-save"));

      expect(await screen.findByTestId("comment-edit-tag-error-0")).toHaveTextContent(
        "Something in this wasn't accepted",
      );
      expect(signer.signStaged).not.toHaveBeenCalled();
      // The editor stays open on the work that was refused.
      expect(screen.getByTestId("comment-edit-input")).toBeInTheDocument();
    });

    it("counts the edit as the record only when the text moved", async () => {
      server.use(
        graphql.query("PostDetail", () =>
          HttpResponse.json({ data: ownComment([topicClaim("wasm", 0.1, 1)]) }),
        ),
      );
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner(),
      });
      fireEvent.click(await screen.findByTestId("comment-edit-c1"));
      // Untouched: nothing to sign, and nothing to press.
      expect(screen.getByTestId("comment-edit-signed-actions")).toHaveTextContent(
        "creates no signed actions",
      );
      expect(screen.getByTestId("comment-edit-save")).toBeDisabled();

      fireEvent.click(screen.getByTestId("comment-edit-tag-0-remove"));
      expect(screen.getByTestId("comment-edit-signed-actions")).toHaveTextContent(
        "creates 1 signed action",
      );
      fireEvent.change(screen.getByTestId("comment-edit-input"), { target: { value: "moved" } });
      expect(screen.getByTestId("comment-edit-signed-actions")).toHaveTextContent(
        "creates 2 signed actions",
      );
    });

    it("asks before an edit that signs more than one action", async () => {
      writeConfirmMultiAction(true);
      server.use(
        graphql.query("PostDetail", () => HttpResponse.json({ data: ownComment([]) })),
        graphql.mutation("PrepareCommentEdit", () => HttpResponse.json({ data: editPayload() })),
        graphql.mutation("PrepareTag", () => HttpResponse.json({ data: tagPayload("w-tag-1") })),
      );
      const signer = fakeWriteSigner();
      renderWithProviders(<PostView postId="p1" />, {
        store: storeFor("acct-1"),
        writeSigner: signer,
      });
      fireEvent.click(await screen.findByTestId("comment-edit-c1"));
      fireEvent.change(screen.getByTestId("comment-edit-input"), { target: { value: "moved" } });
      fireEvent.change(screen.getByTestId("comment-edit-tag-input"), { target: { value: "rust" } });
      fireEvent.click(screen.getByTestId("comment-edit-tag-add"));
      fireEvent.click(screen.getByTestId("comment-edit-save"));

      expect(screen.getByTestId("comment-edit-multi-action-count")).toHaveTextContent(
        "creates 2 signed actions",
      );
      expect(signer.signStaged).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId("comment-edit-multi-action-proceed"));
      await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(2));
    });
  });
});

// Slice 2.4. Named apart from the topics suites above: the reference row
// and the tag row are siblings on this screen.
describe("PostView — references", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Asking is the default; the tests that care about the dialog turn
    // it back on themselves.
    writeConfirmMultiAction(false);
  });

  function referenceWrites(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      __typename: "PreparedWrite",
      id: `r${i}`,
      family: "REFERENCE",
      canonicalProposal: "cHJvcG9zYWw=",
      gcAfterEpochs: 8,
    }));
  }

  it("renders the post's references under the body, values hidden until asked", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("u1", [], undefined, false, [], [
            referenceClaim(userTarget("u-ada", "ada"), 0.4, -0.2),
          ]),
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />);

    const chip = await screen.findByTestId("post-reference-l1-u-ada-link");
    expect(chip).toHaveAttribute("href", "/u/ada");
    expect(screen.queryByTestId("post-reference-l1-u-ada-values")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("post-references-reveal"));
    expect(screen.getByTestId("post-reference-l1-u-ada-values")).toHaveTextContent(
      "+0.40 · -0.20",
    );
  });

  it("opens a referenced post on its own detail", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("u1", [], undefined, false, [], [
            referenceClaim(postTarget("p-quoted", "On folding")),
          ]),
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />);
    expect(await screen.findByTestId("post-reference-l1-p-quoted-link")).toHaveAttribute(
      "href",
      "/posts/p-quoted",
    );
  });

  it("renders a comment's own references on the thread", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("u1", [
            {
              id: "c1",
              body: "First!",
              references: [referenceClaim(userTarget("u-ada", "ada"))],
            },
          ]),
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />);
    expect(
      await screen.findByTestId("comment-c1-reference-l1-u-ada-link"),
    ).toHaveAttribute("href", "/u/ada");
  });

  it("offers the Reference affordance on the post and on each comment", async () => {
    // D20: the word is Reference, never "cite", and it opens the
    // composer with the node already drafted as a chip.
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: detail("u2", [{ id: "c1", body: "First!" }]) }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { store: storeFor("u1") });

    expect(await screen.findByTestId("post-reference")).toHaveAttribute(
      "href",
      "/compose?reference=p1",
    );
    expect(screen.getByTestId("comment-reference-c1")).toHaveAttribute(
      "href",
      "/compose?reference=c1",
    );
  });

  it("hides the Reference affordance from a signed-out reader", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: detail("u2", [{ id: "c1", body: "First!" }]) }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />);
    await screen.findByTestId("post-body");
    expect(screen.queryByTestId("post-reference")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comment-reference-c1")).not.toBeInTheDocument();
  });

  it("asks before it prepares a comment's withdrawal, on the served cost", async () => {
    writeConfirmMultiAction(true);
    let withdrawalInput: Record<string, unknown> | undefined;
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("u2", [
            {
              id: "c1",
              body: "First!",
              authorId: "u1",
              references: [referenceClaim(userTarget("u-ada", "ada"), 1, 1, false, 2)],
            },
          ]),
        }),
      ),
      graphql.mutation("PrepareReferenceWithdrawal", ({ variables }) => {
        withdrawalInput = variables;
        return HttpResponse.json({
          data: {
            prepareReferenceWithdrawal: {
              __typename: "PreparePayload",
              writes: referenceWrites(2),
              userErrors: [],
            },
          },
        });
      }),
    );
    const signer = fakeWriteSigner();
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("u1"),
      writeSigner: signer,
    });

    fireEvent.click(await screen.findByTestId("comment-edit-c1"));
    fireEvent.click(screen.getByTestId("comment-edit-reference-0-remove"));
    fireEvent.click(screen.getByTestId("comment-edit-save"));

    const count = await screen.findByTestId("comment-edit-multi-action-count");
    expect(count).toHaveTextContent("creates 2 signed actions");
    // Nothing is staged, let alone signed, while the reader decides.
    expect(withdrawalInput).toBeUndefined();
    expect(signer.signStaged).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("comment-edit-multi-action-proceed"));
    await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(2));
    // The withdrawal names the L2 id, never the claim's L1 identifier.
    expect((withdrawalInput as { input: { target: string } }).input.target).toBe("u-ada");
  });

  it("stages nothing for an untouched reference section on a comment edit", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("u2", [
            {
              id: "c1",
              body: "First!",
              authorId: "u1",
              references: [referenceClaim(userTarget("u-ada", "ada"))],
            },
          ]),
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { store: storeFor("u1") });
    fireEvent.click(await screen.findByTestId("comment-edit-c1"));
    expect(screen.getByTestId("comment-edit-signed-actions")).toHaveTextContent(
      "creates no signed actions",
    );
    expect(screen.getByTestId("comment-edit-reference-0")).toHaveTextContent("@ada");
  });

  // The gallery on the read side: what a media post looks like when the body
  // is pictures, what happens when the bytes are gone, and what the veil
  // covers.
  describe("the gallery", () => {
    const picture = (id: string, altText: string | null, status = "NORMAL") => ({
      __typename: "MediaAttachment",
      id,
      url: `https://media.test/${id}.webp`,
      altText,
      status,
      mimeType: "image/webp",
      options: { __typename: "MediaOptions", aspectRatio: "4:5", durationMs: null },
      coverMedia: null,
    });

    const withBody = (body: Parameters<typeof detail>[6]) =>
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: detail("u1", [], undefined, false, [], [], body) }),
      );

    it("renders a media post's gallery and no words body", async () => {
      server.use(
        withBody({
          content: null,
          description: "Rubbings from three weekends.",
          attachments: [picture("m1", "paper against the salt crust"), picture("m2", null)],
        }),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

      expect(await screen.findByTestId("post-title")).toHaveTextContent("The title");
      expect(screen.getByTestId("post-media")).toBeInTheDocument();
      // The XOR: a media post has no words half at all.
      expect(screen.queryByTestId("post-body")).not.toBeInTheDocument();
      // The described picture reads as its description; the undescribed one is
      // decorative rather than announced as "image".
      expect(screen.getByAltText("paper against the salt crust")).toBeInTheDocument();
    });

    it("shows the Removed mark in place of bytes that are gone", async () => {
      server.use(
        withBody({
          content: null,
          attachments: [picture("m1", null, "REDACTED")],
          attachmentsStatus: "REDACTED",
        }),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

      const mark = await screen.findByTestId("post-media");
      expect(mark).toHaveTextContent("Removed by its author");
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("names a platform removal differently from an author's own", async () => {
      server.use(
        withBody({
          content: null,
          attachments: [picture("m1", null, "REDACTED")],
          attachmentsStatus: "REDACTED",
          moderationStatus: "ILLEGAL",
        }),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

      expect(await screen.findByTestId("post-media")).toHaveTextContent(
        "Removed under the platform's rules",
      );
    });

    it("veils the body as one and leaves the title readable", async () => {
      server.use(
        withBody({
          description: "Rubbings from three weekends.",
          attachments: [picture("m1", null)],
          attachmentsStatus: "SENSITIVE",
        }),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

      // The title is outside the veil, so the choice to look is informed.
      expect(await screen.findByTestId("post-title")).toHaveTextContent("The title");
      const veil = screen.getByTestId("post-veil");
      expect(veil).toBeInTheDocument();
      // One reveal answers for the whole body, media and words together.
      fireEvent.click(within(veil).getByRole("button"));
      expect(screen.getByTestId("post-media")).toBeInTheDocument();
      expect(screen.getByTestId("post-body")).toHaveTextContent("The body");
    });

    it("renders a comment's picture beside its words, which a comment keeps", async () => {
      server.use(
        graphql.query("PostDetail", () =>
          HttpResponse.json({
            data: detail("u1", [
              { id: "c1", body: "Look at this", attachments: [picture("mc", "a salt flat")] },
            ]),
          }),
        ),
      );
      renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });

      expect(await screen.findByTestId("post-comment-c1")).toHaveTextContent("Look at this");
      expect(screen.getByTestId("comment-media-c1")).toBeInTheDocument();
      expect(screen.getByAltText("a salt flat")).toBeInTheDocument();
    });
  });
});
