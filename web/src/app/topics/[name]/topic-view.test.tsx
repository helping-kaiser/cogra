import { fireEvent, screen } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { stanceHandlers } from "@/test/stance";
import { TopicView } from "./topic-view";

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "u1" });
  return store;
}

/**
 * The persistent half of the store is localStorage, which outlives a
 * test — so a guest says so rather than inheriting whoever signed in
 * above it.
 */
function guestStore() {
  const store = createTokenStore();
  store.clear();
  return store;
}

// The post cards on this page carry the ⋮, whose rows navigate.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const server = startMswServer(...stanceHandlers());

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function postNode(id: string, title: string) {
  return {
    __typename: "Post",
    id,
    comments: { __typename: "CommentConnection", totalCount: 0 },
    title: moderated(title),
    description: moderated(null),
    content: moderated(`body of ${id}`),
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
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    references: [],
  };
}

function hashtagDetail(name: string, taggedContent: unknown[] = []) {
  return {
    hashtag: {
      __typename: "Hashtag",
      id: "ht-1",
      name: moderated(name),
      moderationStatus: "NORMAL",
      taggedContent,
    },
  };
}

describe("TopicView", () => {
  it("renders the canonical name and the tagged posts, reusing PostCard", async () => {
    server.use(
      graphql.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            { relevance: 0.1, confidence: 1, pending: false, node: postNode("p1", "About Rust") },
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("topic-name")).toHaveTextContent("#rust");
    expect(screen.getByTestId("topic-post-p1")).toHaveTextContent("About Rust");
    expect(screen.getByTestId("topic-post-p1-link")).toHaveAttribute("href", "/posts/p1");
    // PostCard's own inventory rides along — the stance control included.
    expect(screen.getByTestId("topic-stance-p1")).toBeInTheDocument();
  });

  // THE WORD "FOLLOW" IS NOT ON THE SCREEN, and will not be
  // (copy-voice's ban, extended to topics 2026-09-14). Taking a position
  // on a topic is the stance gesture at the stance's own price, so there
  // is no toggle and no one-tap follow to find.
  it("offers no follow gesture", async () => {
    server.use(
      graphql.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            { relevance: 0.1, confidence: 1, pending: false, node: postNode("p1", "About Rust") },
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-name");
    expect(screen.queryByTestId("topic-follow")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /follow/i })).not.toBeInTheDocument();
  });

  // The row is the page's own gesture, and it names what it stances —
  // the tag itself, hash and all — because three stance controls stand
  // on this page and the accessible name is what says which is which.
  it("carries an Affinity row toward the topic, named by the tag", async () => {
    server.use(
      graphql.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            { relevance: 0.1, confidence: 1, pending: false, node: postNode("p1", "About Rust") },
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-name");
    expect(await screen.findByTestId("topic-affinity")).toHaveAccessibleName(
      "Take a stance on #rust",
    );
  });

  // THE SIX WORDS ARE THE FAMILY'S (jakob 2026-09-15). The control owns
  // the geometry; association asks how much you like it and attraction
  // how close you want to be — never the opinion's own question.
  it("asks the Affinity's own questions on the accessible route", async () => {
    server.use(
      graphql.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            { relevance: 0.1, confidence: 1, pending: false, node: postNode("p1", "About Rust") },
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    await screen.findByTestId("topic-affinity");
    fireEvent.click(screen.getByTestId("topic-affinity-choose"));
    expect(await screen.findByTestId("stance-alternates")).toBeInTheDocument();
    expect(screen.getByLabelText("How much you like it")).toBeInTheDocument();
    expect(screen.getByLabelText("How close you want to be")).toBeInTheDocument();
    expect(screen.queryByLabelText("How you stand")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("In your world")).not.toBeInTheDocument();
  });

  // A GUEST IS NOT SPECIAL HERE (backlog item 81, ruled 2026-09-15):
  // any reader who taps a tag reaches the page and sees what is tagged.
  // The only thing they lack is an opinion of the topic, so the face
  // wears the no-opinion 🫥 and the tap opens the join prompt — it never
  // bounces them, and the accessible route is not on the page at all.
  it("lets a guest read the page and gates the row at the join prompt", async () => {
    server.use(
      graphql.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            { relevance: 0.1, confidence: 1, pending: false, node: postNode("p1", "About Rust") },
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" />, {
      store: guestStore(),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("topic-post-p1")).toBeInTheDocument();
    const row = await screen.findByTestId("topic-affinity");
    expect(screen.getByTestId("topic-affinity-resting-face")).toHaveTextContent("🫥");
    expect(screen.queryByTestId("topic-affinity-choose")).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  // THE EMPTY PAGE WIRES NO FACE AT ALL (backlog item 81, ruled
  // 2026-09-15) — `TagPageEmpty` draws the header and the empty copy,
  // and nothing else.
  it("wires no stance row on the empty page", async () => {
    server.use(
      graphql.query("HashtagDetail", () =>
        HttpResponse.json({ data: hashtagDetail("nevertagged") }),
      ),
    );
    renderWithProviders(<TopicView name="nevertagged" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-empty");
    expect(screen.queryByTestId("topic-affinity")).not.toBeInTheDocument();
  });

  it("shows the empty copy for a never-tagged but well-formed name (D4)", async () => {
    server.use(
      graphql.query("HashtagDetail", () => HttpResponse.json({ data: hashtagDetail("nevertagged") })),
    );
    renderWithProviders(<TopicView name="nevertagged" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("topic-empty")).toBeInTheDocument();
  });

  it("reports not-found for a substrate-illegal name", async () => {
    server.use(
      graphql.query("HashtagDetail", () => HttpResponse.json({ data: { hashtag: null } })),
    );
    renderWithProviders(<TopicView name="münchen" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("topic-not-found")).toBeInTheDocument();
  });

  it("offers a retry on the nothing-loaded transport error and heals from it", async () => {
    let calls = 0;
    server.use(
      graphql.query("HashtagDetail", () => {
        calls += 1;
        return calls === 1 ? HttpResponse.error() : HttpResponse.json({ data: hashtagDetail("rust") });
      }),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("topic-transport-error")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("topic-retry"));
    expect(await screen.findByTestId("topic-name")).toHaveTextContent("#rust");
    expect(screen.queryByTestId("topic-transport-error")).not.toBeInTheDocument();
  });

  it("backs to the feed", async () => {
    server.use(
      graphql.query("HashtagDetail", () => HttpResponse.json({ data: hashtagDetail("rust") })),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-name");
    expect(screen.getByTestId("topic-back")).toHaveAttribute("href", "/feed");
  });

  it("renders a tagged comment with a link to its parent post", async () => {
    server.use(
      graphql.query("HashtagDetail", () =>
        HttpResponse.json({
          data: hashtagDetail("rust", [
            {
              relevance: 0.1,
              confidence: 1,
              pending: false,
              node: {
                __typename: "Comment",
                id: "c1",
                content: moderated("nice crate"),
                author: {
                  __typename: "User",
                  id: "u2",
                  handle: "bob",
                  displayName: { __typename: "ModeratedText", value: "Bob" },
                  avatar: null,
                },
                createdAt: "2026-08-12T10:05:00Z",
                updatedAt: "2026-08-12T10:05:00Z",
                landing: { __typename: "Landing", state: "LANDED" },
                moderationStatus: "NORMAL",
                target: { __typename: "Post", id: "p1" },
              },
            },
          ]),
        }),
      ),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("topic-comment-c1")).toHaveTextContent("nice crate");
    expect(screen.getByTestId("topic-comment-post-c1")).toHaveAttribute("href", "/posts/p1");
  });
});
