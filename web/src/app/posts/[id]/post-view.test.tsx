import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { PostView } from "./post-view";

const server = startMswServer();

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

type FixtureComment = {
  id: string;
  body: string;
  authorId?: string;
  edited?: boolean;
  replies?: FixtureComment[];
  repliesHaveMore?: boolean;
};

function commentNode(comment: FixtureComment, withReplies = true): Record<string, unknown> {
  return {
    __typename: "Comment",
    id: comment.id,
    content: moderated(comment.body),
    author: {
      __typename: "User",
      id: comment.authorId ?? "u2",
      handle: "bob",
      displayName: { __typename: "ModeratedText", value: "Bob" },
    },
    createdAt: "2026-08-12T10:05:00Z",
    updatedAt: comment.edited ? "2026-08-12T11:00:00Z" : "2026-08-12T10:05:00Z",
    moderationStatus: "NORMAL",
    license: { __typename: "License", attribution: 0, oversight: 0 },
    ...(withReplies
      ? {
          replies: {
            __typename: "CommentConnection",
            edges: (comment.replies ?? []).map((reply) => ({
              __typename: "CommentEdge",
              node: commentNode(reply, false),
            })),
            pageInfo: {
              __typename: "PageInfo",
              hasNextPage: comment.repliesHaveMore ?? false,
              endCursor: null,
            },
          },
        }
      : {}),
  };
}

function detail(
  authorId: string,
  comments: FixtureComment[],
  page: { hasNextPage: boolean; endCursor: string | null } = {
    hasNextPage: false,
    endCursor: null,
  },
) {
  return {
    post: {
      __typename: "Post",
      id: "p1",
      title: moderated("The title"),
      description: moderated(null),
      content: moderated("The body"),
      author: {
        __typename: "User",
        id: authorId,
        handle: "alice",
        displayName: { __typename: "ModeratedText", value: "Alice" },
      },
      createdAt: "2026-08-12T10:00:00Z",
      updatedAt: "2026-08-12T10:00:00Z",
      moderationStatus: "NORMAL",
    license: { __typename: "License", attribution: 0, oversight: 0 },
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

  it("signs a comment and confirms it is in flight", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(
      graphql.query("PostDetail", () => HttpResponse.json({ data: detail("u1", []) })),
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
    const signer = fakeWriteSigner();
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: signer,
    });

    fireEvent.change(await screen.findByTestId("comment-draft"), {
      target: { value: "Nice one" },
    });
    fireEvent.click(screen.getByTestId("comment-license-attribution-1"));
    fireEvent.click(screen.getByTestId("comment-submit"));

    expect(await screen.findByTestId("comment-signed")).toBeInTheDocument();
    expect(signer.signStaged).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(variables).toEqual({
        input: {
          target: "p1",
          content: "Nice one",
          license: { attribution: 1, oversight: 0 },
        },
      }),
    );
    expect(screen.getByTestId("comment-draft")).toHaveValue("");
  });

  it("tells a keyless browser to restore a pending comment, not to wait", async () => {
    server.use(
      graphql.query("PostDetail", () => HttpResponse.json({ data: detail("u1", []) })),
      graphql.mutation("PrepareComment", () =>
        HttpResponse.json({
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
        }),
      ),
    );
    renderWithProviders(
      <PostView postId="p1" store={fakeIdentityStore({})} />,
      {
        store: storeFor("acct-1"),
        writeSigner: fakeWriteSigner({
          signStaged: () =>
            Promise.resolve({ kind: "awaitingSeal" as const, id: "w1" }),
        }),
      },
    );
    fireEvent.change(await screen.findByTestId("comment-draft"), {
      target: { value: "Nice one" },
    });
    fireEvent.click(screen.getByTestId("comment-license-attribution-1"));
    fireEvent.click(screen.getByTestId("comment-submit"));
    const alert = await screen.findByTestId("comment-signing-needs-key");
    expect(alert).toHaveTextContent("Restore your key");
  });

  it("keeps the comment button disabled without a draft", async () => {
    server.use(
      graphql.query("PostDetail", () => HttpResponse.json({ data: detail("u1", []) })),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("comment-submit")).toBeDisabled();
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

  it("surfaces a failed comment submit in the composer, not on the thread", async () => {
    server.use(
      graphql.query("PostDetail", () => HttpResponse.json({ data: detail("u1", []) })),
      graphql.mutation("PrepareComment", () => HttpResponse.error()),
    );
    renderWithProviders(<PostView postId="p1" />, {
      store: storeFor("acct-1"),
      writeSigner: fakeWriteSigner(),
    });
    fireEvent.change(await screen.findByTestId("comment-draft"), {
      target: { value: "Nice one" },
    });
    fireEvent.click(screen.getByTestId("comment-submit"));
    expect(await screen.findByTestId("comment-transport-error")).toBeInTheDocument();
    expect(screen.queryByTestId("post-thread-transport-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("post-title")).toHaveTextContent("The title");
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
    expect(variables).toEqual({ input: { id: "c1", content: "better words" } });
    // The editor closes and the in-flight notice shows.
    expect(screen.queryByTestId("comment-edit-input")).not.toBeInTheDocument();
    expect(screen.getByTestId("comment-signed")).toBeInTheDocument();
  });

  it("renders prefetched replies nested and expands past them", async () => {
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({
          data: detail("author-1", [
            {
              id: "c1",
              body: "top",
              replies: [{ id: "r1", body: "nested" }],
              repliesHaveMore: true,
            },
          ]),
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
                edges: [{ __typename: "CommentEdge", node: commentNode({ id: "r2", body: "more" }) }],
                pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
              },
            },
          },
        }),
      ),
    );
    renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("post-comment-r1")).toHaveTextContent("nested");
    fireEvent.click(screen.getByTestId("replies-more-c1"));
    expect(await screen.findByTestId("post-comment-r2")).toHaveTextContent("more");
    expect(screen.queryByTestId("replies-more-c1")).not.toBeInTheDocument();
  });

  it("replies inline, targeting the comment not the post", async () => {
    let variables: unknown;
    server.use(
      graphql.query("PostDetail", () =>
        HttpResponse.json({ data: detail("author-1", [{ id: "c1", body: "top" }]) }),
      ),
      graphql.mutation("PrepareComment", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({
          data: {
            prepareComment: {
              __typename: "PrepareContentPayload",
              node: "new-reply",
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
    fireEvent.click(await screen.findByTestId("comment-reply-c1"));
    fireEvent.change(screen.getByTestId("comment-reply-input"), {
      target: { value: "me too" },
    });
    fireEvent.click(screen.getByTestId("comment-reply-submit"));
    await waitFor(() => expect(signer.signStaged).toHaveBeenCalledTimes(1));
    // A reply is a genesis Review targeting the comment (comment.md §1).
    expect((variables as { input: { target: string } }).input.target).toBe("c1");
    expect(screen.queryByTestId("comment-reply-input")).not.toBeInTheDocument();
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
});
