import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PostView } from "@/lib/api/content-api";
import { renderWithProviders } from "@/test/providers";
import { PostCard } from "./post-card";

// The card's own rules — order, the XOR, the clamps, the opener — read
// directly rather than through a surface: every one of them is a fact about
// this component, and driving them through the feed would test the feed.
//
// The fixture is shaped as the wire serves it and cast once: the generated
// node type is a query's, and hand-writing every `__typename` for a rule about
// layout would say nothing extra.
function post(over: Record<string, unknown> = {}): PostView {
  return {
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
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: "2026-08-12T10:00:00Z",
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    references: [],
    comments: { __typename: "CommentConnection", totalCount: 0 },
    ...over,
  } as unknown as PostView;
}

const picture = (status = "NORMAL") => ({
  __typename: "MediaAttachment",
  id: "m1",
  url: "https://media.test/m1.webp",
  altText: null,
  status,
  mimeType: "image/webp",
  options: { __typename: "MediaOptions", aspectRatio: "4:5", durationMs: null },
  coverMedia: null,
});

const moderated = (value: string | null, status = "NORMAL") => ({
  __typename: "ModeratedText",
  value,
  status,
});

function mount(node: PostView, over: Record<string, unknown> = {}) {
  return renderWithProviders(
    <PostCard
      post={node}
      href="/posts/p1"
      testId="card"
      authorTestId="card-author"
      stanceTestId="card-stance"
      comments={0}
      onLinkCopied={() => {}}
      {...over}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PostCard", () => {
  // PEOPLE FIRST: the author leads, on a media post too.
  it("puts the author above everything, the age beside it", () => {
    const { container } = mount(post({ attachments: [picture()], content: moderated(null) }));
    const order = Array.from(
      container.querySelectorAll("[data-testid]"),
      (node) => node.getAttribute("data-testid"),
    );
    expect(order.indexOf("card-author")).toBeLessThan(order.indexOf("card-media"));
    expect(order.indexOf("card-author")).toBeLessThan(order.indexOf("card-title"));
    expect(screen.getByTestId("card-timestamp")).toHaveTextContent("2h");
  });

  // ONE ORDER FOR BOTH KINDS — title · body · description.
  it("draws a text post title, body, description", () => {
    const { container } = mount(post({ description: moderated("The caption") }));
    const order = Array.from(
      container.querySelectorAll("[data-testid]"),
      (node) => node.getAttribute("data-testid"),
    );
    expect(order.indexOf("card-title")).toBeLessThan(order.indexOf("card-body"));
    expect(order.indexOf("card-body")).toBeLessThan(order.indexOf("card-description"));
  });

  // The title stays ABOVE the media because it titles the thing.
  it("draws a media post title, media, description — and no words body", () => {
    const { container } = mount(
      post({ attachments: [picture()], description: moderated("The caption") }),
    );
    const order = Array.from(
      container.querySelectorAll("[data-testid]"),
      (node) => node.getAttribute("data-testid"),
    );
    expect(order.indexOf("card-title")).toBeLessThan(order.indexOf("card-media"));
    expect(order.indexOf("card-media")).toBeLessThan(order.indexOf("card-description"));
    // Handed both, the card draws the documented media reading and the
    // `content` never appears.
    expect(screen.queryByTestId("card-body")).not.toBeInTheDocument();
  });

  it("clamps a summary at one title line, eighteen body lines and two caption lines", () => {
    mount(post({ description: moderated("The caption") }));
    expect(screen.getByTestId("card-title").className).toContain("line-clamp-1");
    expect(screen.getByTestId("card-body").className).toContain("line-clamp-[18]");
    expect(screen.getByTestId("card-description").className).toContain("line-clamp-2");
  });

  it("clamps nothing on the read surface and leads at headline-small", () => {
    mount(post({ description: moderated("The caption") }), { variant: "detail" });
    const title = screen.getByTestId("card-title");
    expect(title.tagName).toBe("H1");
    expect(title.className).toContain("text-headline-small");
    expect(screen.getByTestId("card-body").className).not.toContain("line-clamp");
    expect(screen.getByTestId("card-description").className).not.toContain("line-clamp");
    expect(screen.queryByTestId("card-opener")).not.toBeInTheDocument();
  });

  // A media post's caption is clamped to two lines and always carries the
  // opener; a text post's body has eighteen lines to fill first.
  it("offers the opener only where something is folded away", () => {
    mount(post());
    expect(screen.queryByTestId("card-opener")).not.toBeInTheDocument();
    mount(post({ attachments: [picture()], content: moderated(null), description: moderated("A caption") }));
    expect(screen.getByTestId("card-opener")).toHaveTextContent("More");
  });

  it("unfolds the text in place, and folds it back", () => {
    mount(post({ content: moderated("x".repeat(18 * 51 + 1)) }));
    const opener = screen.getByTestId("card-opener");
    expect(opener).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(opener);
    expect(opener).toHaveTextContent("Less");
    expect(screen.getByTestId("card-body").className).not.toContain("line-clamp");
    fireEvent.click(opener);
    expect(opener).toHaveTextContent("More");
  });

  // `More` opens text in place and never navigates, so it stands outside the
  // link — as does everything else with a meaning of its own.
  it("keeps the acting controls outside the link", () => {
    mount(post({ content: moderated("x".repeat(18 * 51 + 1)) }));
    const link = screen.getByTestId("card-link");
    expect(link).toHaveAttribute("href", "/posts/p1");
    expect(link).not.toContainElement(screen.getByTestId("card-opener"));
    expect(link).not.toContainElement(screen.getByTestId("card-comments"));
    expect(link).not.toContainElement(screen.getByTestId("card-author"));
  });

  // REDACTION IS RECORD-GRANULAR: every authored field goes at once, and the
  // skeleton is what is left.
  it("replaces the whole payload with the Removed mark, keeping the skeleton", () => {
    mount(post({ content: moderated(null, "REDACTED"), description: moderated(null, "REDACTED") }));
    expect(screen.getByTestId("card-removed")).toHaveTextContent("Removed by its author");
    expect(screen.queryByTestId("card-title")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-body")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-author")).toBeInTheDocument();
    expect(screen.getByTestId("card-timestamp")).toBeInTheDocument();
    expect(screen.getByTestId("card-stance")).toBeInTheDocument();
  });

  it("keeps the affordance row on one line, in the ruled order", () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    mount(post({ comments: { __typename: "CommentConnection", totalCount: 3 } }), { comments: 3 });
    const row = screen.getByTestId("card-affordances");
    expect(row.className).toContain("flex-nowrap");
    expect(row).toContainElement(screen.getByTestId("card-stance"));
    expect(row).toContainElement(screen.getByTestId("card-comments"));
    expect(row).toContainElement(screen.getByTestId("card-share"));
    const order = Array.from(
      screen.getByTestId("card").querySelectorAll("[data-testid]"),
      (node) => node.getAttribute("data-testid"),
    );
    expect(order.indexOf("card-stance")).toBeLessThan(order.indexOf("card-comments"));
    expect(order.indexOf("card-comments")).toBeLessThan(order.indexOf("card-share"));
  });
});
