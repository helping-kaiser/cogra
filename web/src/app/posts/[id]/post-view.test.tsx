import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { PostView } from "./post-view";

const server = startMswServer();

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function detail(
  authorId: string,
  comments: { id: string; body: string }[],
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
      author: { __typename: "User", id: authorId, handle: "alice" },
      createdAt: "2026-08-12T10:00:00Z",
      updatedAt: "2026-08-12T10:00:00Z",
      moderationStatus: "NORMAL",
      comments: {
        __typename: "CommentConnection",
        edges: comments.map((comment) => ({
          __typename: "CommentEdge",
          node: {
            __typename: "Comment",
            id: comment.id,
            content: moderated(comment.body),
            author: { __typename: "User", id: "u2", handle: "bob" },
            createdAt: "2026-08-12T10:05:00Z",
            updatedAt: "2026-08-12T10:05:00Z",
            moderationStatus: "NORMAL",
          },
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
    fireEvent.click(screen.getByTestId("comment-license-attribution"));
    fireEvent.click(screen.getByTestId("comment-submit"));

    expect(await screen.findByTestId("comment-signed")).toBeInTheDocument();
    expect(signer.signStaged).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(variables).toEqual({
        input: {
          target: "p1",
          content: "Nice one",
          license: { attributionRequired: true, oversight: "NONE" },
        },
      }),
    );
    expect(screen.getByTestId("comment-draft")).toHaveValue("");
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
    expect(screen.getByTestId("comment-signin")).toHaveAttribute("href", "/");
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
});
