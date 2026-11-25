// The feed's first page asks its stance faces in one request (`PageStances`),
// and every card still wears exactly the standing its own read gave it.

import { screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { byNode } from "@/test/data-node";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { stanceHandlers } from "@/test/stance";
import { FeedView } from "./feed-view";
import { forgetFeed } from "./feed-memory";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/** Every stance read the page sends, by operation name. */
const asked: string[] = [];
const STANCE_READ = /^(PostStance|CommentStance|ProfileStance|PageStances)$/;

const server = startMswServer(
  // Logs, then falls through to the shared stance handlers below it.
  gqlLink.query(STANCE_READ, ({ operationName }) => {
    asked.push(operationName);
    return undefined;
  }),
  ...stanceHandlers({
    p1: { pDirected: 0.55, pInterest: 0.2, recordCount: 2 },
    p20: { pDirected: -0.4, pInterest: 0.6, recordCount: 1 },
  }),
  gqlLink.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "acct-1",
          handle: "ada",
          displayName: { __typename: "ModeratedText", value: null },
          accountState: "MEMBER",
          hasReciprocated: true,
          vouchBackDismissed: false,
          invitedBy: null,
        },
      },
    }),
  ),
  gqlLink.query("BorrowedView", () => HttpResponse.json({ data: { borrowedView: null } })),
);

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

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
    removal: null,
    genesisRecordId: "rec-genesis",
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    referenceCount: 0,
  };
}

/** The ranked feed's two reads over twenty posts: one ranking, windows hydrated from it. */
function rankedFeed(nodes: readonly ReturnType<typeof post>[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
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
    gqlLink.query("Feed", ({ variables }) =>
      HttpResponse.json({
        data: {
          feed: {
            __typename: "FeedConnection",
            edges: (variables.orderedIds as string[])
              .filter((id) => byId.has(id))
              .map((id) => ({ __typename: "FeedEdge", node: byId.get(id) })),
          },
        },
      }),
    ),
  ];
}

describe("the feed's stance faces", () => {
  beforeEach(() => {
    window.localStorage.clear();
    forgetFeed();
    asked.length = 0;
  });

  it("a first page of twenty cards sends one stance request, and each card wears its own standing", async () => {
    server.use(...rankedFeed(Array.from({ length: 20 }, (_, i) => post(`p${i + 1}`))));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await waitFor(() =>
      expect(screen.getByTestId(byNode("feed.card.actionRow.stance.anchor.exact", "p1"))).toHaveTextContent(
        "+0.55 / +0.20",
      ),
    );
    expect(screen.getByTestId(byNode("feed.card.actionRow.stance.anchor.exact", "p20"))).toHaveTextContent(
      "−0.40 / +0.60",
    );
    // A card the viewer never stanced keeps the affordance, as its own read gave it.
    expect(screen.getByTestId(byNode("feed.card.actionRow.stance.anchor", "p2"))).toHaveTextContent("🫥");
    expect(asked).toEqual(["PageStances"]);
  });
});
