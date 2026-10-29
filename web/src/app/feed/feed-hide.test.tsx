// Hiding from the feed (hidden-actors packet §5.2, §12.2; FeedHidden.md,
// ReaderPostMenu.md, RowSigning.md): the person's rows leave at the tap with
// no confirm, the snackbar names them with Undo, Undo stands the feed as it
// was, and a hide that does not go through reverts and says so on the card it
// was made from — never on the snackbar.

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { byNode } from "@/test/data-node";
import { hiddenHandlers, hiddenLog } from "@/test/hidden";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { stanceHandlers } from "@/test/stance";
import { FeedView } from "./feed-view";
import { forgetFeed } from "./feed-memory";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function post(id: string, authorId: string, handle: string) {
  return {
    __typename: "Post",
    id,
    comments: { __typename: "CommentConnection", totalCount: 0 },
    title: moderated(`Post ${id}`),
    description: moderated(null),
    content: moderated(`body of ${id}`),
    attachments: [] as unknown[],
    attachmentsStatus: "NORMAL",
    sensitiveSelfMark: false,
    sensitiveReason: null,
    author: {
      __typename: "User",
      id: authorId,
      handle,
      displayName: { __typename: "ModeratedText", value: handle, status: "NORMAL" },
      avatar: null,
    },
    createdAt: "2026-08-12T10:00:00Z",
    updatedAt: "2026-08-12T10:00:00Z",
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    // No removal: the node stands (api-spec.md `Post.removal`).
    removal: null,
    genesisRecordId: "rec-genesis",
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    references: [],
    viewerBookmarkedAt: null,
  };
}

function rankedFeed(nodes: ReturnType<typeof post>[]) {
  return [
    gqlLink.query("FeedRanking", () =>
      HttpResponse.json({
        data: {
          feedRanking: {
            __typename: "FeedRanking",
            asOfEpoch: 4,
            entries: nodes.map((node, index) => ({
              __typename: "FeedEntry",
              targetId: node.id,
              kind: "POST",
              score: 1 - index / 100,
              mark: null,
              newestIndex: index,
            })),
            settling: [],
          },
        },
      }),
    ),
    gqlLink.query("Feed", ({ variables }) => {
      const ids = variables.orderedIds as string[];
      return HttpResponse.json({
        data: {
          feed: {
            __typename: "FeedConnection",
            edges: nodes
              .filter((node) => ids.includes(node.id))
              .map((node) => ({ __typename: "FeedEdge", node })),
          },
        },
      });
    }),
  ];
}

const meHandler = gqlLink.query("Me", () =>
  HttpResponse.json({
    data: {
      me: {
        __typename: "User",
        id: "acct-1",
        handle: "reader",
        displayName: { __typename: "ModeratedText", value: null },
        accountState: "MEMBER",
        hasReciprocated: true,
        vouchBackDismissed: false,
        invitedBy: null,
      },
    },
  }),
);

const borrowedViewHandler = gqlLink.query("BorrowedView", () =>
  HttpResponse.json({ data: { borrowedView: null } }),
);

const server = startMswServer(...stanceHandlers(), borrowedViewHandler, meHandler);

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

const FEED = [post("p1", "ada-id", "ada"), post("p2", "bo-id", "bo"), post("p3", "ada-id", "ada")];

function card(id: string) {
  return screen.queryByTestId(byNode("feed.card", id));
}

// The feed paints after the ranking read, the page read and the hidden-set read,
// and the first test in a file also pays the cold module load: under a full
// suite that outruns testing-library's 1 s default, so first paint gets 3 s.
const FIRST_PAINT = { timeout: 3000 };

async function hideFrom(id: string) {
  fireEvent.click(await screen.findByTestId(byNode("feed.card.menu", id), undefined, FIRST_PAINT));
  fireEvent.click(screen.getByTestId("feed.menuSheet.hide"));
}

describe("hiding from the feed", () => {
  beforeEach(() => {
    window.localStorage.clear();
    forgetFeed();
  });

  it("hide_from_a_feed_card_closes_the_persons_rows", async () => {
    const log = hiddenLog();
    server.use(...rankedFeed(FEED), ...hiddenHandlers(log));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await hideFrom("p1");
    // Never asks first: the rows leave at the tap, and nothing marks the space.
    expect(card("p1")).toBeNull();
    expect(card("p3")).toBeNull();
    expect(card("p2")).toBeInTheDocument();
    await waitFor(() => expect(log.hides).toEqual([{ actor: "ada-id", at: null }]));
  });

  it("hide_snackbar_names_the_handle_and_offers_undo_and_undo_stands_the_feed_as_it_was", async () => {
    const log = hiddenLog();
    server.use(...rankedFeed(FEED), ...hiddenHandlers(log));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await hideFrom("p1");
    const bar = await screen.findByTestId("feed.snackbar");
    expect(bar).toHaveTextContent("@ada is hidden — their posts stay out of your feed.");
    await waitFor(() => expect(log.hides).toHaveLength(1));
    fireEvent.click(screen.getByTestId("feed.snackbar.action"));
    expect(card("p1")).toBeInTheDocument();
    expect(card("p3")).toBeInTheDocument();
    await waitFor(() => expect(log.unhides).toEqual(["ada-id"]));
  });

  it("a_failed_hide_reverts_and_the_row_says_retry_never_on_the_snackbar", async () => {
    const log = hiddenLog();
    server.use(...rankedFeed(FEED), ...hiddenHandlers(log, { failHide: true }));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await hideFrom("p1");
    await waitFor(() => expect(card("p1")).toBeInTheDocument());
    expect(card("p3")).toBeInTheDocument();
    expect(await screen.findByText("That didn't go through.")).toBeInTheDocument();
    // The snackbar that announced it is taken down.
    await waitFor(() => expect(screen.queryByTestId("feed.snackbar")).toBeNull());
    // Retry hides again and signs nothing.
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(log.hides).toHaveLength(2));
  });

  it("the_feed_never_renders_before_the_hidden_set_is_read", async () => {
    const log = hiddenLog();
    server.use(...rankedFeed(FEED), ...hiddenHandlers(log, { failRead: true }));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    expect(await screen.findByTestId("feed-transport-error", undefined, FIRST_PAINT)).toBeInTheDocument();
    expect(card("p1")).toBeNull();
  });

  it("a_hidden_persons_posts_never_reach_the_feed", async () => {
    const log = hiddenLog();
    server.use(
      ...rankedFeed(FEED),
      ...hiddenHandlers(log, {
        entries: [{ id: "ada-id", handle: "ada", displayName: "Ada", hiddenAt: "2026-10-01T00:00:00Z" }],
      }),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    expect(await screen.findByTestId(byNode("feed.card", "p2"), undefined, FIRST_PAINT)).toBeInTheDocument();
    expect(card("p1")).toBeNull();
    expect(card("p3")).toBeNull();
  });
});
