import { fireEvent, screen } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { stanceHandlers } from "@/test/stance";
import { TopicView } from "./topic-view";

const server = startMswServer(...stanceHandlers());

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function postNode(id: string, title: string) {
  return {
    __typename: "Post",
    id,
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
    expect(screen.getByTestId("topic-post-p1")).toHaveAttribute("href", "/posts/p1");
    // PostCard's own inventory rides along — the stance control included.
    expect(screen.getByTestId("topic-stance-p1")).toBeInTheDocument();
  });

  // Follow waits for slice 3 (F5): the backend still accepts the stance,
  // the surface simply does not offer it.
  it("offers no follow gesture", async () => {
    server.use(
      graphql.query("HashtagDetail", () => HttpResponse.json({ data: hashtagDetail("rust") })),
    );
    renderWithProviders(<TopicView name="rust" />, { writeSigner: fakeWriteSigner() });
    await screen.findByTestId("topic-name");
    expect(screen.queryByTestId("topic-follow")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /follow/i })).not.toBeInTheDocument();
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
