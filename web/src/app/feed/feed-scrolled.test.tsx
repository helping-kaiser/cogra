// The feed's way back up (FeedScrolled.md:11-13) and the re-tap rungs of its
// ladder (Feed.md:81-91): the pill's tap and the bar's re-tap from a scrolled
// root take the list to the top, animated, and NEVER refresh; the re-tap at the
// top is the feed's other refresh route.

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { announceFeedReselect } from "@/lib/feed/feed-reselect";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { stanceHandlers } from "@/test/stance";
import { byNode } from "@/test/data-node";
import { FeedView } from "./feed-view";
import { forgetFeed } from "./feed-memory";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function post(id: string) {
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
      id: "u1",
      handle: "alice",
      displayName: { __typename: "ModeratedText", value: "Alice" },
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
  };
}

/** The ranked feed over one post, counting the rankings it was asked for. */
function rankedFeed(rankings: { count: number }) {
  const node = post("p1");
  return [
    gqlLink.query("FeedRanking", () => {
      rankings.count += 1;
      return HttpResponse.json({
        data: {
          feedRanking: {
            __typename: "FeedRanking",
            asOfEpoch: 4,
            entries: [
              {
                __typename: "FeedEntry",
                targetId: "p1",
                kind: "POST",
                score: 1,
                mark: null,
                newestIndex: 0,
              },
            ],
            settling: [],
          },
        },
      });
    }),
    gqlLink.query("Feed", () =>
      HttpResponse.json({
        data: { feed: { __typename: "FeedConnection", edges: [{ __typename: "FeedEdge", node }] } },
      }),
    ),
  ];
}

const server = startMswServer(
  ...stanceHandlers(),
  gqlLink.query("BorrowedView", () =>
    HttpResponse.json({
      data: {
        borrowedView: {
          __typename: "User",
          id: "genesis-id",
          handle: "genesis_mod",
          displayName: { __typename: "ModeratedText", value: "Genesis Moderator" },
          avatar: null,
        },
      },
    }),
  ),
);

function scrolledTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
}

describe("the feed's way back up", () => {
  let scrollTo: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.localStorage.clear();
    forgetFeed();
    scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    scrollTo.mockRestore();
    scrolledTo(0);
  });

  async function renderFeed() {
    const rankings = { count: 0 };
    server.use(...rankedFeed(rankings));
    renderWithProviders(<FeedView />);
    await screen.findByTestId(byNode("feed.card", "p1"));
    await waitFor(() => expect(rankings.count).toBe(1));
    return rankings;
  }

  // FeedScrolled.md:11
  it("tapping_back_to_top_goes_to_the_top_animated_and_never_refreshes", async () => {
    const rankings = await renderFeed();
    scrolledTo(4000);
    fireEvent.click(screen.getByTestId("back-to-top-pill"));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(rankings.count).toBe(1);
    expect(screen.queryByTestId("feed-loading")).not.toBeInTheDocument();
  });

  // FeedScrolled.md:13; Feed.md:85-91
  it("a_feed_re_tap_while_scrolled_goes_to_the_top_animated_and_never_refreshes", async () => {
    const rankings = await renderFeed();
    scrolledTo(4000);
    act(() => announceFeedReselect());
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(rankings.count).toBe(1);
  });

  // Feed.md:87
  it("a_feed_re_tap_at_the_top_refreshes_and_loads_what_is_new", async () => {
    const rankings = await renderFeed();
    scrolledTo(0);
    act(() => announceFeedReselect());
    expect(scrollTo).not.toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    await waitFor(() => expect(rankings.count).toBe(2));
  });

  // A reader who asked for stillness is taken up at once.
  it("the_way_up_is_instant_for_a_reader_who_asked_for_stillness", async () => {
    await renderFeed();
    const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
    try {
      scrolledTo(4000);
      fireEvent.click(screen.getByTestId("back-to-top-pill"));
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(window, "matchMedia");
      } else {
        Object.defineProperty(window, "matchMedia", original);
      }
    }
  });
});
