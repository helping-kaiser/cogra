import { fireEvent, screen } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { FeedView } from "./feed-view";

const server = startMswServer();

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function post(id: string, title: string) {
  return {
    __typename: "Post",
    id,
    title: moderated(title),
    description: moderated(null),
    content: moderated(`body of ${id}`),
    author: { __typename: "User", id: "u1", handle: "alice" },
    createdAt: "2026-08-12T10:00:00Z",
    updatedAt: "2026-08-12T10:00:00Z",
    moderationStatus: "NORMAL",
  };
}

function postsPage(nodes: ReturnType<typeof post>[], endCursor: string | null, hasNext: boolean) {
  return {
    posts: {
      __typename: "PostConnection",
      edges: nodes.map((node) => ({ __typename: "PostEdge", node })),
      pageInfo: { __typename: "PageInfo", hasNextPage: hasNext, endCursor },
    },
  };
}

describe("FeedView", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("lists posts newest-first as served and links the composer when signed in", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([post("p1", "First")], null, false) })),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    expect(await screen.findByTestId("feed-post-p1")).toHaveTextContent("First");
    expect(screen.getByTestId("feed-compose")).toHaveAttribute("href", "/compose");
    expect(screen.queryByTestId("feed-signin")).not.toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1")).toHaveAttribute("href", "/posts/p1");
    expect(screen.queryByTestId("feed-empty")).not.toBeInTheDocument();
  });

  it("reads without a session and swaps the composer for the sign-in entry", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([post("p1", "First")], null, false) })),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-post-p1")).toHaveTextContent("First");
    expect(screen.queryByTestId("feed-compose")).not.toBeInTheDocument();
    expect(screen.getByTestId("feed-signin")).toHaveAttribute("href", "/");
  });

  it("backs to home", () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([], null, false) })),
    );
    renderWithProviders(<FeedView />);
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });

  it("shows the empty copy when nothing has landed", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([], null, false) })),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-empty")).toBeInTheDocument();
  });

  it("loads the next page from the cursor", async () => {
    const afters: (string | null)[] = [];
    server.use(
      graphql.query("Posts", ({ variables }) => {
        afters.push((variables.after as string | null) ?? null);
        return HttpResponse.json({
          data:
            variables.after == null
              ? postsPage([post("p1", "First")], "c1", true)
              : postsPage([post("p2", "Second")], null, false),
        });
      }),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId("feed-load-more"));
    expect(await screen.findByTestId("feed-post-p2")).toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1")).toBeInTheDocument();
    expect(afters).toEqual([null, "c1"]);
    expect(screen.queryByTestId("feed-load-more")).not.toBeInTheDocument();
  });

  it("renders the transport error on a fault", async () => {
    server.use(graphql.query("Posts", () => HttpResponse.error()));
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-transport-error")).toBeInTheDocument();
  });
});
