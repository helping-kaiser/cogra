// A card that is its own menu's host (the topic page): the author's Remove
// from its ⋮ leaves the card standing as its mark in place (RM-G9's build
// word; RemoveConfirm.md:11, "NEVER the post leaves without a mark").

import { fireEvent, screen } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { describe, expect, it, vi } from "vitest";

import type { PostView } from "@/lib/api/content-api";
import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { stanceHandlers } from "@/test/stance";
import { PostCard } from "./post-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const AT = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
const removals: string[] = [];

startMswServer(
  // The card's stance control reads its standing on mount.
  ...stanceHandlers(),
  gqlLink.mutation("RemoveContent", ({ variables }) => {
    removals.push(variables.record as string);
    return HttpResponse.json({
      data: { removeContent: { __typename: "RemoveContentPayload", records: [], userErrors: [] } },
    });
  }),
  gqlLink.query("PostRemoval", ({ variables }) =>
    HttpResponse.json({
      data: { post: { __typename: "Post", id: variables.id, removal: { __typename: "Removal", at: AT, by: "AUTHOR" } } },
    }),
  ),
);

const post = {
  __typename: "Post",
  id: "p1",
  title: { __typename: "ModeratedText", value: "The title", status: "NORMAL" },
  description: { __typename: "ModeratedText", value: null, status: "NORMAL" },
  content: { __typename: "ModeratedText", value: "The body", status: "NORMAL" },
  attachments: [],
  attachmentsStatus: "NORMAL",
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
  genesisRecordId: "rec-p1",
  license: { __typename: "License", attribution: 0, provenance: 0 },
  topics: [],
  references: [],
  comments: { __typename: "CommentConnection", totalCount: 2 },
} as unknown as PostView;

describe("a card hosting its own menu", () => {
  it("stands as its mark in place once its author's removal is taken", async () => {
    const store = createTokenStore();
    store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "u1" });
    renderWithProviders(
      <PostCard
        post={post}
        href="/posts/p1"
        testId="card"
        authorTestId="card-author"
        stanceTestId="card-stance"
        comments={2}
        onLinkCopied={() => {}}
      />,
      { store },
    );
    fireEvent.click(screen.getByTestId("card-menu"));
    expect(screen.getByTestId("card-menu-sheet")).toHaveAccessibleName("Post actions");
    fireEvent.click(screen.getByTestId("card-menu-remove"));
    fireEvent.click(screen.getByTestId("card-remove-confirm-remove"));
    const mark = await screen.findByTestId("card-removed");
    expect(mark).toHaveTextContent("Removed by its author");
    expect(mark).toHaveTextContent("3h");
    expect(removals).toEqual(["rec-p1"]);
    expect(screen.queryByTestId("card-body")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-menu")).not.toBeInTheDocument();
    // The skeleton stands: the author, and the count that proves nothing went.
    expect(screen.getByTestId("card-author")).toBeInTheDocument();
    expect(screen.getByTestId("card-comments")).toBeInTheDocument();
  });
});
