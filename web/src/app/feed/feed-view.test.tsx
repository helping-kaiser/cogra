import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { stanceHandlers } from "@/test/stance";
import { FeedView } from "./feed-view";

// Every signed-in card reads its own standing, so the read is a default
// rather than something each test remembers: an unhandled one degrades
// the control silently instead of failing the test.
const server = startMswServer(...stanceHandlers());

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

/** The status banners ride the signed-in feed and read the viewer. */
function meHandler() {
  return graphql.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "acct-1",
          handle: "ada",
          displayName: { __typename: "ModeratedText", value: null },
          accountState: "MEMBER",
          hasReciprocated: true,
          invitedBy: null,
        },
      },
    }),
  );
}

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function post(id: string, title: string, pending = false) {
  return {
    __typename: "Post",
    id,
    title: moderated(title),
    description: moderated(null),
    content: moderated(`body of ${id}`),
    author: {
      __typename: "User",
      id: "u1",
      handle: "alice",
      displayName: { __typename: "ModeratedText", value: "Alice" },
    },
    createdAt: "2026-08-12T10:00:00Z",
    updatedAt: "2026-08-12T10:00:00Z",
    landing: { __typename: "Landing", state: pending ? "PENDING" : "LANDED" },
    moderationStatus: "NORMAL",
    license: { __typename: "License", attribution: 0, provenance: 0 },
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
    server.use(meHandler());
    renderWithProviders(<FeedView />, { store: signedInStore() });
    expect(await screen.findByTestId("feed-post-p1")).toHaveTextContent("First");
    expect(screen.queryByTestId("feed-signin")).not.toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1")).toHaveAttribute("href", "/posts/p1");
    expect(screen.queryByTestId("feed-empty")).not.toBeInTheDocument();
  });

  it("carries a stance control on every post card", async () => {
    server.use(
      graphql.query("Posts", () =>
        HttpResponse.json({ data: postsPage([post("p1", "First"), post("p2", "Second")], null, false) }),
      ),
    );
    server.use(meHandler());
    renderWithProviders(<FeedView />, { store: signedInStore() });
    // Part of the post card's inventory (design.md §6) — and outside the
    // link, since it acts rather than navigates.
    expect(await screen.findByTestId("feed-stance-p1")).toBeInTheDocument();
    expect(screen.getByTestId("feed-stance-p2")).toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1")).not.toContainElement(
      screen.getByTestId("feed-stance-p1"),
    );
  });

  it("wears the viewer's own standing on each card it has one for", async () => {
    // §8.3: at rest the target shows the standing — face, words, and the
    // folded pair — for every card the viewer has a bundle toward.
    server.use(
      graphql.query("Posts", () =>
        HttpResponse.json({ data: postsPage([post("p1", "First"), post("p2", "Second")], null, false) }),
      ),
    );
    server.use(
      meHandler(),
      ...stanceHandlers({ p1: { pDirected: 0.55, pInterest: 0.2, recordCount: 2 } }),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await waitFor(() =>
      expect(screen.getByTestId("feed-stance-p1")).toHaveTextContent("Like this"),
    );
    expect(screen.getByTestId("feed-stance-p1")).toHaveTextContent("😊");
    expect(screen.getByTestId("feed-stance-p1-resting-exact")).toHaveTextContent("+0.55 / +0.20");
    // A card the viewer has no bundle toward keeps the affordance — a
    // muted face outside the table, never a bare word and never the
    // shrug a zero standing owns (design.md §8.3, §8.4).
    expect(screen.getByTestId("feed-stance-p2")).toHaveTextContent("😐");
    expect(screen.getByTestId("feed-stance-p2")).not.toHaveTextContent("🤷");
    expect(screen.getByTestId("feed-stance-p2")).toHaveTextContent("No stance yet");
  });

  it("offers a guest the stance control, which asks them to join", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([post("p1", "First")], null, false) })),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId("feed-stance-p1"));
    expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
  });

  it("collapses the restore card into the header for a keyless member", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([], null, false) })),
    );
    server.use(meHandler());
    renderWithProviders(<FeedView store={fakeIdentityStore({})} />, {
      store: signedInStore(),
    });
    const restore = await screen.findByTestId("home_restore");
    expect(screen.getByTestId("collapsing-top")).toContainElement(restore);
  });

  it("reads without a session and carries the guest banner in the collapsing top", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([post("p1", "First")], null, false) })),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-post-p1")).toHaveTextContent("First");

    // The one sign-in-or-join entry rides the guest banner, in place
    // of a header action (design.md §6).
    const banner = screen.getByTestId("feed-guest-banner");
    expect(screen.getByTestId("collapsing-top")).toContainElement(banner);
    expect(screen.getByTestId("feed-signin")).toHaveAttribute("href", "/login");
  });

  it("shows no guest banner to a signed-in reader", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([], null, false) })),
    );
    server.use(meHandler());
    renderWithProviders(<FeedView />, { store: signedInStore() });
    expect(await screen.findByTestId("feed-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("feed-guest-banner")).not.toBeInTheDocument();
  });

  it("carries no back arrow — the feed is a tab root for every viewer", async () => {
    server.use(
      graphql.query("Posts", () => HttpResponse.json({ data: postsPage([], null, false) })),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("feed-back")).not.toBeInTheDocument();
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

  it("marks a pending post and leaves a landed one unmarked", async () => {
    server.use(
      graphql.query("Posts", () =>
        HttpResponse.json({
          data: postsPage([post("p1", "Settling", true), post("p2", "Final")], null, false),
        }),
      ),
    );
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-pending-p1")).toHaveTextContent("Still settling");
    expect(screen.queryByTestId("feed-pending-p2")).not.toBeInTheDocument();
    // Shown in full, never held back (design.md §9).
    expect(screen.getByTestId("feed-post-p1")).toHaveTextContent("Settling");
  });

  // A pending entry sorts above every landed one until it lands, when
  // it drops into landing order — which can put it below the cursor the
  // walk resumes from, so the next page serves it again.
  it("drops an entry the held page already carries when appending", async () => {
    server.use(
      graphql.query("Posts", ({ variables }) =>
        HttpResponse.json({
          data:
            variables.after == null
              ? postsPage([post("p1", "Settling", true), post("p2", "Older")], "c1", true)
              : postsPage([post("p1", "Settling"), post("p3", "Oldest")], null, false),
        }),
      ),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId("feed-load-more"));
    expect(await screen.findByTestId("feed-post-p3")).toBeInTheDocument();
    expect(screen.getAllByTestId("feed-post-p1")).toHaveLength(1);
    // The held copy stays as it was read — no reconciliation.
    expect(screen.getByTestId("feed-pending-p1")).toBeInTheDocument();
  });

  it("renders the transport error on a fault", async () => {
    server.use(graphql.query("Posts", () => HttpResponse.error()));
    renderWithProviders(<FeedView />);
    expect(await screen.findByTestId("feed-transport-error")).toBeInTheDocument();
  });

  it("keeps loaded posts readable and faults at the load-more slot when a page fetch fails", async () => {
    let calls = 0;
    server.use(
      graphql.query("Posts", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ data: postsPage([post("p1", "First")], "c1", true) })
          : HttpResponse.error();
      }),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId("feed-load-more"));
    expect(await screen.findByTestId("feed-load-more-error")).toBeInTheDocument();
    // The fault surfaces where the failed fetch was requested — at the
    // load-more slot, not the top-of-page banner.
    expect(screen.queryByTestId("feed-transport-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feed-load-more")).not.toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1")).toBeInTheDocument();
  });

  it("holds the load-more error through a failed retry instead of flashing", async () => {
    let calls = 0;
    server.use(
      graphql.query("Posts", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ data: postsPage([post("p1", "First")], "c1", true) })
          : HttpResponse.error();
      }),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId("feed-load-more"));
    await screen.findByTestId("feed-load-more-error");
    fireEvent.click(screen.getByTestId("feed-load-more-retry"));
    expect(screen.getByTestId("feed-load-more-error")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("feed-load-more-retry")).toBeEnabled());
    expect(screen.getByTestId("feed-load-more-error")).toBeInTheDocument();
  });

  it("holds the banner through a failed retry instead of flashing", async () => {
    server.use(graphql.query("Posts", () => HttpResponse.error()));
    renderWithProviders(<FeedView />);
    await screen.findByTestId("feed-transport-error");
    fireEvent.click(screen.getByTestId("feed-retry"));
    // The flag reflects the last completed fetch: still set the moment
    // the retry starts, still set once the retry has also failed.
    expect(screen.getByTestId("feed-transport-error")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("feed-loading")).not.toBeInTheDocument());
    expect(screen.getByTestId("feed-transport-error")).toBeInTheDocument();
  });

  it("clears the load-more error when a retried page fetch succeeds", async () => {
    let calls = 0;
    server.use(
      graphql.query("Posts", () => {
        calls += 1;
        if (calls === 2) return HttpResponse.error();
        return HttpResponse.json({
          data:
            calls === 1
              ? postsPage([post("p1", "First")], "c1", true)
              : postsPage([post("p2", "Second")], null, false),
        });
      }),
    );
    renderWithProviders(<FeedView />);
    fireEvent.click(await screen.findByTestId("feed-load-more"));
    await screen.findByTestId("feed-load-more-error");
    fireEvent.click(screen.getByTestId("feed-load-more-retry"));
    expect(await screen.findByTestId("feed-post-p2")).toBeInTheDocument();
    expect(screen.queryByTestId("feed-load-more-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("feed-post-p1")).toBeInTheDocument();
  });
});
